import { describe, expect, it } from 'vitest'
import { totp } from '../auth/totp.ts'
import { client, PASSWORD, register, setupApp } from './helpers.ts'

type App = ReturnType<typeof setupApp>

/** Registers and turns on 2FA; returns the secret. */
async function withTwoFactor({ app, clock }: App, email = 'coach@example.com') {
  const c = client(app)
  await register(c, email)
  const setup = await c.post('/api/account/2fa/setup', { password: PASSWORD })
  await c.post('/api/account/2fa/enable', { code: totp(setup.json.secret, clock.t) })
  return { c, secret: setup.json.secret as string }
}

/** Signs in on a device (cookie jar) with password + code; returns the login responses. */
async function signIn(env: App, device: ReturnType<typeof client>, secret: string, trust?: boolean) {
  const first = await device.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
  if (!first.json.twoFactor) return { first, second: null }
  env.clock.t += 31_000 // a fresh 30-second step, so the code isn't a replay
  const second = await device.post('/api/auth/login/verify', { code: totp(secret, env.clock.t), trust })
  return { first, second }
}

describe('remember me', () => {
  it('uses a browser-session cookie when remember is off', async () => {
    const { app } = setupApp()
    await register(client(app))
    const res = await app.request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'coach@example.com', password: PASSWORD, remember: false }),
    })
    expect(res.status).toBe(200)
    const cookie = res.headers.getSetCookie().find((l) => l.startsWith('st_session='))!
    expect(cookie).not.toMatch(/Max-Age/i)
    const remembered = await client(app).raw('POST', '/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    expect(remembered.headers.getSetCookie().find((l) => l.startsWith('st_session='))).toMatch(/Max-Age=2592000/)
  })
})

describe('trusted devices', () => {
  it('skips the code for 30 days on a device the user trusted, and only there', async () => {
    const env = setupApp()
    const { secret } = await withTwoFactor(env)
    const laptop = client(env.app)
    const { second } = await signIn(env, laptop, secret, true)
    expect(second!.status).toBe(200)
    expect(laptop.jar.get('st_trust')).toBeTruthy()

    await laptop.post('/api/auth/logout')
    const again = await laptop.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    expect(again.json.user).toBeTruthy()
    expect(again.json.twoFactor).toBeUndefined()

    // A different device still needs the code.
    const phone = client(env.app)
    expect((await phone.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })).json).toEqual({ twoFactor: true, trustAllowed: true })

    // After 30 days the laptop asks again.
    await laptop.post('/api/auth/logout')
    env.clock.t += 31 * 24 * 3600_000
    expect((await laptop.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })).json.twoFactor).toBe(true)
  })

  it('never trusts a device when the box was left unticked', async () => {
    const env = setupApp()
    const { secret } = await withTwoFactor(env)
    const laptop = client(env.app)
    await signIn(env, laptop, secret, false)
    await laptop.post('/api/auth/logout')
    expect((await laptop.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })).json.twoFactor).toBe(true)
  })

  it('is forgotten on password change, when switched off, and cannot be enabled while off', async () => {
    const env = setupApp()
    const { c, secret } = await withTwoFactor(env)
    const laptop = client(env.app)
    await signIn(env, laptop, secret, true)
    await laptop.post('/api/auth/logout')

    env.clock.t += 31_000
    const changed = await c.post('/api/account/password', { current: PASSWORD, next: 'a whole new passphrase', code: totp(secret, env.clock.t) })
    expect(changed.status).toBe(200)
    expect((await laptop.post('/api/auth/login', { email: 'coach@example.com', password: 'a whole new passphrase' })).json.twoFactor).toBe(true)

    const off = await c.patch('/api/account/security', { trustDevices: false })
    expect(off.json.user.trustDevices).toBe(false)
    env.clock.t += 31_000
    const verify = await laptop.post('/api/auth/login/verify', { code: totp(secret, env.clock.t), trust: true })
    expect(verify.status).toBe(200)
    await laptop.post('/api/auth/logout')
    expect((await laptop.post('/api/auth/login', { email: 'coach@example.com', password: 'a whole new passphrase' })).json).toEqual({ twoFactor: true, trustAllowed: false })
  })

  it('lists and forgets trusted devices', async () => {
    const env = setupApp()
    const { secret } = await withTwoFactor(env)
    const laptop = client(env.app)
    await signIn(env, laptop, secret, true)
    expect((await laptop.get('/api/account/sessions')).json.trusted).toHaveLength(1)
    expect((await laptop.del('/api/account/trusted-devices')).status).toBe(200)
    expect((await laptop.get('/api/account/sessions')).json.trusted).toHaveLength(0)
  })
})

describe('reset link from settings', () => {
  it('emails a reset link to the signed-in user, rate limited', async () => {
    const { app, mailer } = setupApp()
    const c = client(app)
    await register(c)
    const res = await c.post('/api/account/password/reset-link')
    expect(res.json).toEqual({ ok: true, email: 'coach@example.com' })
    await new Promise((r) => setTimeout(r, 5))
    expect(mailer.list()[0].subject).toBe('Reset your Lanemark password')
    await c.post('/api/account/password/reset-link')
    await c.post('/api/account/password/reset-link')
    expect((await c.post('/api/account/password/reset-link')).status).toBe(429)
  })
})
