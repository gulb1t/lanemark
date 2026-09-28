import { describe, expect, it } from 'vitest'
import { totp } from '../auth/totp.ts'
import { client, PASSWORD, register, setupApp } from './helpers.ts'

type App = ReturnType<typeof setupApp>['app']

/** The phone app: no cookies, a bearer token, its own origin, and the client header. */
function phone(app: App, platform = 'android') {
  let token: string | null = null
  async function call(method: string, path: string, body?: unknown, extra: Record<string, string> = {}) {
    const res = await app.request(`http://localhost${path}`, {
      method,
      headers: {
        origin: 'https://localhost',
        'x-swimtrack-client': platform,
        'user-agent': 'Mozilla/5.0 (Linux; Android 16) Chrome/140.0 Mobile SwimTrackApp/1.0',
        ...(method !== 'GET' ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
        ...extra,
      },
      body: method !== 'GET' ? JSON.stringify(body ?? {}) : undefined,
    })
    return { status: res.status, json: (await res.json().catch(() => null)) as any, headers: res.headers }
  }
  return {
    get token() {
      return token
    },
    set token(t: string | null) {
      token = t
    },
    get: (p: string) => call('GET', p),
    post: (p: string, b?: unknown) => call('POST', p, b),
    raw: call,
  }
}

describe('the phone app', () => {
  it('signs up and in with a bearer token and never gets cookies', async () => {
    const { app } = setupApp()
    const p = phone(app)
    const reg = await p.post('/api/auth/register', { name: 'Casey Coach', email: 'coach@example.com', password: PASSWORD })
    expect(reg.status).toBe(201)
    expect(reg.json.token).toMatch(/^[\w-]{40,}$/)
    expect(reg.headers.getSetCookie()).toEqual([])

    expect((await p.get('/api/me')).status).toBe(401)
    p.token = reg.json.token
    expect((await p.get('/api/me')).json.user.email).toBe('coach@example.com')

    const login = await p.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    expect(login.json.token).toMatch(/^[\w-]{40,}$/)
    expect(login.headers.getSetCookie()).toEqual([])

    // The sessions list names the app.
    p.token = login.json.token
    const sessions = await p.get('/api/account/sessions')
    expect(sessions.json.sessions.find((s: any) => s.current).device).toBe('SwimTrack app on Android')

    // Signing out ends that token only.
    expect((await p.post('/api/auth/logout')).status).toBe(200)
    expect((await p.get('/api/me')).status).toBe(401)
    p.token = reg.json.token
    expect((await p.get('/api/me')).status).toBe(200)
  })

  it('never hands browsers a token, and never accepts a cookie from the app', async () => {
    const { app } = setupApp()
    const web = client(app)
    const reg = await web.post('/api/auth/register', { name: 'Casey Coach', email: 'coach@example.com', password: PASSWORD })
    expect(reg.json.token).toBeUndefined()
    // A browser cookie sent with the app header doesn't count.
    const cookie = [...web.jar].map(([k, v]) => `${k}=${v}`).join('; ')
    const p = phone(app)
    expect((await p.raw('GET', '/api/me', undefined, { cookie })).status).toBe(401)
    // And a bearer token without the app header doesn't count either.
    const login = await p.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    const res = await app.request('http://localhost/api/me', { headers: { authorization: `Bearer ${login.json.token}` } })
    expect(res.status).toBe(401)
  })

  it('finishes a two-factor sign-in with the ticket, and can trust the phone', async () => {
    const { app, clock } = setupApp()
    const web = client(app)
    await register(web)
    const setup = await web.post('/api/account/2fa/setup', { password: PASSWORD })
    await web.post('/api/account/2fa/enable', { code: totp(setup.json.secret, clock.t) })

    const p = phone(app)
    const first = await p.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })
    expect(first.json).toMatchObject({ twoFactor: true, trustAllowed: true })
    expect(first.json.ticket).toMatch(/^[\w-]{40,}$/)
    expect(first.json.token).toBeUndefined()

    clock.t += 31_000
    expect((await p.post('/api/auth/login/verify', { code: totp(setup.json.secret, clock.t) })).json.error.code).toBe('mfa_expired')
    const done = await p.post('/api/auth/login/verify', { code: totp(setup.json.secret, clock.t), ticket: first.json.ticket, trust: true })
    expect(done.status).toBe(200)
    expect(done.json.token).toMatch(/^[\w-]{40,}$/)
    expect(done.json.trustToken).toMatch(/^[\w-]{40,}$/)
    expect(done.headers.getSetCookie()).toEqual([])

    // With the mark, the next sign-in skips the code; without it, it doesn't.
    const again = await p.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD, trustToken: done.json.trustToken })
    expect(again.json.token).toBeTruthy()
    expect((await p.post('/api/auth/login', { email: 'coach@example.com', password: PASSWORD })).json.twoFactor).toBe(true)
  })

  it('answers the app’s preflight, and only for the app’s origins', async () => {
    const { app } = setupApp()
    const pre = await app.request('http://localhost/api/auth/login', {
      method: 'OPTIONS',
      headers: { origin: 'https://localhost', 'access-control-request-method': 'POST', 'access-control-request-headers': 'content-type, x-swimtrack-client' },
    })
    expect(pre.status).toBe(204)
    expect(pre.headers.get('access-control-allow-origin')).toBe('https://localhost')
    expect(pre.headers.get('access-control-allow-headers')).toContain('x-swimtrack-client')
    expect(pre.headers.get('access-control-allow-credentials')).toBeNull()

    const evil = await app.request('http://localhost/api/auth/login', { method: 'OPTIONS', headers: { origin: 'https://evil.example', 'access-control-request-method': 'POST' } })
    expect(evil.headers.get('access-control-allow-origin')).toBeNull()
  })

  it('still blocks cross-site browser writes that lack the app header', async () => {
    const { app } = setupApp()
    const res = await app.request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      body: JSON.stringify({ email: 'coach@example.com', password: PASSWORD }),
    })
    expect(res.status).toBe(403)
    // A made-up client name isn't the app.
    const fake = await app.request('http://localhost/api/auth/login', {
      method: 'POST',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json', 'x-swimtrack-client': 'bot' },
      body: JSON.stringify({ email: 'coach@example.com', password: PASSWORD }),
    })
    expect(fake.status).toBe(403)
  })
})
