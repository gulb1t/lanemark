import { describe, expect, it } from 'vitest'
import { totp } from '../auth/totp.ts'
import { client, PASSWORD, register, setupApp } from './helpers.ts'

describe('registration and sign-in', () => {
  it('registers, signs in with a session cookie and exposes /me', async () => {
    const { app } = setupApp()
    const c = client(app)
    const user = await register(c)
    expect(user.email).toBe('coach@example.com')
    expect(c.jar.get('st_session')).toBeTruthy()
    const me = await c.get('/api/me')
    expect(me.status).toBe(200)
    expect(me.json.user).toMatchObject({ email: 'coach@example.com', name: 'Casey Coach', twoFactor: false })
    expect(me.json.user.passwordHash).toBeUndefined()
  })

  it('sets hardened cookies and security headers', async () => {
    const { app } = setupApp()
    const res = await app.request('http://localhost/api/auth/register', {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/json' },
      body: JSON.stringify({ name: 'A', email: 'a@example.com', password: PASSWORD }),
    })
    const cookie = res.headers.getSetCookie()[0]
    expect(cookie).toMatch(/HttpOnly/)
    expect(cookie).toMatch(/SameSite=Lax/)
    expect(res.headers.get('content-security-policy')).toContain("frame-ancestors 'none'")
    expect(res.headers.get('x-content-type-options')).toBe('nosniff')
    expect(res.headers.get('cache-control')).toBe('no-store')
  })

  it('normalises email, rejects duplicates and weak passwords', async () => {
    const { app } = setupApp()
    const c = client(app)
    await register(c, 'Coach@Example.com ')
    const dup = await client(app).post('/api/auth/register', { name: 'X', email: 'coach@example.com', password: PASSWORD })
    expect(dup.status).toBe(409)
    const weak = await client(app).post('/api/auth/register', { name: 'X', email: 'x@example.com', password: 'password123' })
    expect(weak.status).toBe(400)
    expect(weak.json.error.code).toBe('weak_password')
    const bad = await client(app).post('/api/auth/register', { name: 'X', email: 'not-an-email', password: PASSWORD })
    expect(bad.status).toBe(400)
  })

  it('gives the same error for a wrong password and an unknown email', async () => {
    const { app } = setupApp()
    await register(client(app))
    const wrong = await client(app).post('/api/auth/login', { email: 'coach@example.com', password: 'nope nope nope' })
    const unknown = await client(app).post('/api/auth/login', { email: 'ghost@example.com', password: 'nope nope nope' })
    expect(wrong.status).toBe(401)
    expect(unknown.status).toBe(401)
    expect(wrong.json).toEqual(unknown.json)
  })

  it('rate-limits password guessing per account', async () => {
    const { app } = setupApp()
    await register(client(app))
    const attacker = client(app)
    const statuses: number[] = []
    for (let i = 0; i < 10; i++) {
      statuses.push((await attacker.post('/api/auth/login', { email: 'coach@example.com', password: `guess number ${i}` })).status)
    }
    expect(statuses.slice(0, 8).every((s) => s === 401)).toBe(true)
    expect(statuses[8]).toBe(429)
  })

  it('logs out and rejects the old cookie afterwards', async () => {
    const { app } = setupApp()
    const c = client(app)
    await register(c)
    const token = c.jar.get('st_session')!
    await c.post('/api/auth/logout')
    expect((await c.get('/api/me')).status).toBe(401)
    const replay = await app.request('http://localhost/api/me', { headers: { cookie: `st_session=${token}` } })
    expect(replay.status).toBe(401)
  })

  it('expires idle sessions', async () => {
    const { app, clock } = setupApp()
    const c = client(app)
    await register(c)
    clock.t += 31 * 24 * 3600_000
    expect((await c.get('/api/me')).status).toBe(401)
  })
})

describe('CSRF protection', () => {
  it('blocks writes without our Origin or without JSON', async () => {
    const { app } = setupApp()
    const noOrigin = await app.request('http://localhost/api/auth/logout', { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
    expect(noOrigin.status).toBe(403)
    const evil = await app.request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: '{}',
    })
    expect(evil.status).toBe(403)
    const form = await app.request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { origin: 'http://localhost:5173', 'content-type': 'application/x-www-form-urlencoded' },
      body: 'a=1',
    })
    expect(form.status).toBe(415)
    const sameHost = await app.request('http://localhost/api/auth/logout', {
      method: 'POST',
      headers: { origin: 'https://swim.example', host: 'swim.example', 'content-type': 'application/json' },
      body: '{}',
    })
    expect(sameHost.status).toBe(200)
  })
})

describe('two-factor authentication', () => {
  async function enable2fa() {
    const env = setupApp()
    const c = client(env.app)
    await register(c)
    const setup = await c.post('/api/account/2fa/setup', { password: PASSWORD })
    expect(setup.status).toBe(200)
    expect(setup.json.otpauthUrl).toMatch(/^otpauth:\/\/totp\/Lanemark:coach%40example\.com\?secret=/)
    expect(setup.json.qrSvg).toContain('<svg')
    const secret: string = setup.json.secret
    const wrong = await c.post('/api/account/2fa/enable', { code: '000000' })
    expect(wrong.status).toBe(401)
    const on = await c.post('/api/account/2fa/enable', { code: totp(secret, env.clock.t) })
    expect(on.status).toBe(200)
    expect(on.json.recoveryCodes).toHaveLength(10)
    expect((await c.get('/api/me')).json.user.twoFactor).toBe(true)
    await c.post('/api/auth/logout')
    env.clock.t += 30_000 // the enable code's step is now used up
    return { ...env, c, secret, recoveryCodes: on.json.recoveryCodes as string[] }
  }

  it('requires the password to start setup', async () => {
    const { app } = setupApp()
    const c = client(app)
    await register(c)
    expect((await c.post('/api/account/2fa/setup', { password: 'wrong password!' })).status).toBe(401)
  })

  it('stores the secret encrypted, never in plain text', async () => {
    const { repo, secret } = await enable2fa()
    const user = await repo.getUserByEmail('coach@example.com')
    expect(user!.totpSecretEnc).toBeTruthy()
    expect(JSON.stringify(user)).not.toContain(secret)
  })

  it('asks for a code after the password and only then starts a session', async () => {
    const { app, clock, secret } = await enable2fa()
    const c = client(app)
    const step1 = await c.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    expect(step1.json).toMatchObject({ twoFactor: true })
    expect(c.jar.has('st_session')).toBe(false)
    expect((await c.get('/api/me')).status).toBe(401)
    const code = totp(secret, clock.t)
    const step2 = await c.post('/api/auth/login/verify', { code })
    expect(step2.status).toBe(200)
    expect(c.jar.has('st_session')).toBe(true)
    expect(c.jar.has('st_mfa')).toBe(false)

    // The same code can't be used again, even within its 30 s window.
    const other = client(app)
    await other.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    expect((await other.post('/api/auth/login/verify', { code })).status).toBe(401)
  })

  it('accepts each recovery code exactly once', async () => {
    const { app, recoveryCodes } = await enable2fa()
    const a = client(app)
    await a.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    const ok = await a.post('/api/auth/login/verify', { code: recoveryCodes[0].toUpperCase() })
    expect(ok.status).toBe(200)
    expect(ok.json.usedRecoveryCode).toBe(true)
    expect(ok.json.user.recoveryCodesLeft).toBe(9)
    const b = client(app)
    await b.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    expect((await b.post('/api/auth/login/verify', { code: recoveryCodes[0] })).status).toBe(401)
  })

  it('kills the sign-in ticket after 5 wrong codes and when it times out', async () => {
    const { app, clock, secret } = await enable2fa()
    const c = client(app)
    await c.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    for (let i = 0; i < 4; i++) expect((await c.post('/api/auth/login/verify', { code: '000000' })).json.error.code).toBe('invalid_code')
    expect((await c.post('/api/auth/login/verify', { code: '000000' })).json.error.code).toBe('mfa_expired')
    expect((await c.post('/api/auth/login/verify', { code: totp(secret, clock.t) })).status).toBe(401)

    const slow = client(app)
    await slow.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    clock.t += 6 * 60_000
    const late = await slow.post('/api/auth/login/verify', { code: totp(secret, clock.t) })
    expect(late.json.error.code).toBe('mfa_expired')
  })

  it('needs password and code to turn 2FA off', async () => {
    const { app, clock, secret } = await enable2fa()
    const c = client(app)
    await c.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    await c.post('/api/auth/login/verify', { code: totp(secret, clock.t) })
    clock.t += 30_000
    expect((await c.post('/api/account/2fa/disable', { password: PASSWORD })).json.error.code).toBe('code_required')
    expect((await c.post('/api/account/2fa/disable', { password: PASSWORD, code: totp(secret, clock.t) })).status).toBe(200)
    expect((await c.get('/api/me')).json.user.twoFactor).toBe(false)
  })
})

describe('sessions and account', () => {
  it('lists devices and can sign out the others', async () => {
    const { app } = setupApp()
    const laptop = client(app)
    await register(laptop)
    const phone = client(app)
    await phone.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD }, { 'user-agent': 'Mozilla/5.0 (Linux; Android 15) Chrome/140.0' })
    const list = await laptop.get('/api/account/sessions')
    expect(list.json.sessions).toHaveLength(2)
    expect(list.json.sessions.map((s: { device: string }) => s.device).sort()).toEqual(['Chrome on Android', 'Chrome on Linux'])
    expect(list.json.sessions.filter((s: { current: boolean }) => s.current)).toHaveLength(1)
    await laptop.post('/api/account/sessions/revoke-others')
    expect((await phone.get('/api/me')).status).toBe(401)
    expect((await laptop.get('/api/me')).status).toBe(200)
  })

  it('can revoke only its own sessions', async () => {
    const { app } = setupApp()
    const a = client(app)
    await register(a, 'a@example.com')
    const b = client(app)
    await register(b, 'b@example.com')
    const bSession = (await b.get('/api/account/sessions')).json.sessions[0].id
    expect((await a.del(`/api/account/sessions/${bSession}`)).status).toBe(404)
    expect((await b.get('/api/me')).status).toBe(200)
  })

  it('changing the password signs out other devices', async () => {
    const { app } = setupApp()
    const a = client(app)
    await register(a)
    const other = client(app)
    await other.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    expect((await a.post('/api/account/password', { current: 'wrong password', next: 'Brand-New-Lane-7' })).status).toBe(401)
    expect((await a.post('/api/account/password', { current: PASSWORD, next: 'Brand-New-Lane-7' })).status).toBe(200)
    expect((await other.get('/api/me')).status).toBe(401)
    expect((await a.get('/api/me')).status).toBe(200)
    expect((await client(app).post('/api/auth/login', { email: 'coach@example.com', password: 'Brand-New-Lane-7' })).status).toBe(200)
  })

  it('deletes the account with all its data', async () => {
    const { app, repo } = setupApp()
    const c = client(app)
    const user = await register(c)
    await c.post('/api/sync', { cursor: 0, changes: [{ kind: 'swimmer', id: 's1', op: 'put', data: { id: 's1', name: 'Maya', notes: '', createdAt: 1 } }] })
    expect((await c.del('/api/account', { password: 'wrong password' })).status).toBe(401)
    expect((await c.del('/api/account', { password: PASSWORD })).status).toBe(200)
    expect(await repo.getUserById(user.id)).toBeNull()
    expect(await repo.listDocs(user.id, 0)).toEqual([])
    expect((await c.get('/api/me')).status).toBe(401)
  })
})
