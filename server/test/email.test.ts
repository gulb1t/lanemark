import { describe, expect, it } from 'vitest'
import { totp } from '../auth/totp.ts'
import { client, PASSWORD, register, setupApp } from './helpers.ts'

const NEW_PASSWORD = 'lane ropes and kickboards'
const tick = () => new Promise((r) => setTimeout(r, 5))
/** The token from the newest email's link. */
const linkToken = (mailer: ReturnType<typeof setupApp>['mailer'], to?: string) => {
  const mail = mailer.list().find((m) => !to || m.to === to)
  const url = mail?.text.match(/https?:\/\/\S+/)?.[0]
  return url ? new URL(url).searchParams.get('token')! : null
}

describe('email verification', () => {
  it('sends a link on sign-up that confirms the address once', async () => {
    const { app, mailer } = setupApp()
    const c = client(app)
    await register(c)
    await tick()
    expect((await c.get('/api/me')).json.user.emailVerified).toBe(false)
    expect(mailer.list()[0]).toMatchObject({ to: 'coach@example.com', subject: 'Confirm your email for Lanemark' })
    expect(mailer.list()[0].html).toContain('http://localhost:5173/verify-email?token=')
    const token = linkToken(mailer)!
    // The link works from a device that isn't signed in.
    const res = await client(app).post('/api/auth/email/verify', { token })
    expect(res.status).toBe(200)
    expect((await c.get('/api/me')).json.user.emailVerified).toBe(true)
    expect((await client(app).post('/api/auth/email/verify', { token })).json.error.code).toBe('invalid_link')
  })

  it('expires links after a day and replaces them on resend', async () => {
    const { app, mailer, clock } = setupApp()
    const c = client(app)
    await register(c)
    await tick()
    const first = linkToken(mailer)!
    const resent = await c.post('/api/account/email/resend')
    expect(resent.status).toBe(200)
    await tick()
    const second = linkToken(mailer)!
    expect(second).not.toBe(first)
    expect((await c.post('/api/auth/email/verify', { token: first })).status).toBe(400)
    clock.t += 25 * 3600_000
    expect((await c.post('/api/auth/email/verify', { token: second })).status).toBe(400)
  })

  it('rate-limits resends', async () => {
    const { app } = setupApp()
    const c = client(app)
    await register(c)
    for (let i = 0; i < 3; i++) expect((await c.post('/api/account/email/resend')).status).toBe(200)
    expect((await c.post('/api/account/email/resend')).status).toBe(429)
  })
})

describe('password reset', () => {
  it('never reveals whether an account exists', async () => {
    const { app, mailer } = setupApp()
    await register(client(app))
    await tick()
    const before = mailer.list().length
    const known = await client(app).post('/api/auth/password/forgot', { email: 'coach@example.com' })
    const unknown = await client(app).post('/api/auth/password/forgot', { email: 'nobody@example.com' })
    expect(known.status).toBe(200)
    expect(unknown.json).toEqual(known.json)
    await tick()
    expect(mailer.list().length).toBe(before + 1)
    expect(mailer.list()[0].subject).toBe('Reset your Lanemark password')
  })

  it('resets the password once, signs out every device and verifies the email', async () => {
    const { app, mailer } = setupApp()
    const c = client(app)
    await register(c)
    await client(app).post('/api/auth/password/forgot', { email: 'coach@example.com' })
    await tick()
    const token = linkToken(mailer)!
    const check = await client(app).post('/api/auth/password/check', { token })
    expect(check.json).toEqual({ ok: true, email: 'c•••@example.com' })
    expect((await client(app).post('/api/auth/password/reset', { token, password: 'password123' })).json.error.code).toBe('weak_password')
    expect((await client(app).post('/api/auth/password/reset', { token, password: NEW_PASSWORD })).status).toBe(200)
    await tick()
    expect(mailer.list()[0].subject).toBe('Your Lanemark password was changed')
    expect((await c.get('/api/me')).status).toBe(401)
    expect((await client(app).post('/api/auth/password/reset', { token, password: 'another long passphrase' })).status).toBe(400)
    expect((await client(app).post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })).status).toBe(401)
    const b = client(app)
    expect((await b.post('/api/auth/login', { email: 'coach@example.com', password: NEW_PASSWORD })).status).toBe(200)
    expect((await b.get('/api/me')).json.user.emailVerified).toBe(true)
  })

  it('expires reset links after 30 minutes and keeps two-factor in place', async () => {
    const { app, mailer, clock } = setupApp()
    const c = client(app)
    await register(c)
    const setup = await c.post('/api/account/2fa/setup', { password: PASSWORD })
    await c.post('/api/account/2fa/enable', { code: totp(setup.json.secret, clock.t) })
    await client(app).post('/api/auth/password/forgot', { email: 'coach@example.com' })
    await tick()
    const token = linkToken(mailer)!
    clock.t += 31 * 60_000
    expect((await client(app).post('/api/auth/password/reset', { token, password: NEW_PASSWORD })).status).toBe(400)
    await client(app).post('/api/auth/password/forgot', { email: 'coach@example.com' })
    await tick()
    expect((await client(app).post('/api/auth/password/reset', { token: linkToken(mailer)!, password: NEW_PASSWORD })).status).toBe(200)
    const login = await client(app).post('/api/auth/login', { email: 'coach@example.com', password: NEW_PASSWORD })
    expect(login.json).toMatchObject({ twoFactor: true })
  })
})

describe('changing email', () => {
  it('needs the password, confirms through the new address and tells the old one', async () => {
    const { app, mailer } = setupApp()
    const c = client(app)
    await register(c)
    await register(client(app), 'taken@example.com', 'Other')
    expect((await c.post('/api/account/email', { email: 'new@example.com', password: 'wrong' })).status).toBe(401)
    expect((await c.post('/api/account/email', { email: 'taken@example.com', password: PASSWORD })).status).toBe(409)
    const res = await c.post('/api/account/email', { email: 'New@Example.com', password: PASSWORD })
    expect(res.json).toEqual({ ok: true, pendingEmail: 'new@example.com' })
    await tick()
    expect(mailer.list().map((m) => m.to).slice(0, 2).sort()).toEqual(['coach@example.com', 'new@example.com'])
    // Nothing changes until the new address confirms.
    expect((await c.get('/api/me')).json.user.email).toBe('coach@example.com')
    const verify = await client(app).post('/api/auth/email/verify', { token: linkToken(mailer, 'new@example.com')! })
    expect(verify.json).toMatchObject({ ok: true, changed: true, email: 'new@example.com' })
    expect((await c.get('/api/me')).json.user).toMatchObject({ email: 'new@example.com', emailVerified: true })
    await tick()
    expect(mailer.list()[0]).toMatchObject({ to: 'coach@example.com', subject: 'Your Lanemark email was changed' })
  })
})

describe('dev outbox', () => {
  it('lists sent mail outside production', async () => {
    const { app } = setupApp()
    await register(client(app))
    await tick()
    const res = await app.request('http://localhost/api/dev/outbox')
    expect(res.status).toBe(200)
    expect(await res.text()).toContain('Confirm your email for Lanemark')
  })
})
