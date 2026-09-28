import { createApp } from '../app.ts'
import type { Config } from '../config.ts'
import { openSqlite } from '../db/sqlite.ts'
import type { Repo } from '../db/types.ts'
import { outboxMailer } from '../lib/mailer.ts'
import { RateLimiter } from '../lib/ratelimit.ts'

export const ORIGIN = 'http://localhost:5173'

export function testConfig(over: Partial<Config> = {}): Config {
  return {
    port: 0,
    production: false,
    dataDir: '/tmp',
    mongoDb: 'test',
    secretKey: Buffer.alloc(32, 7),
    origins: [ORIGIN],
    trustProxy: false,
    staticDir: '/nonexistent',
    appUrl: 'http://localhost:5173',
    mailFrom: 'Lanemark <test@lanemark.test>',
    ai: { model: 'test-model', baseUrl: 'http://ai.test/v1' },
    ...over,
  }
}

/** App on a fresh in-memory SQLite database with a controllable clock. */
export function setupApp(repo: Repo = openSqlite(':memory:'), over: Partial<Config> = {}, aiFetch?: typeof fetch) {
  const clock = { t: Date.UTC(2026, 8, 1, 12, 0, 0) }
  const now = () => clock.t
  const limiter = new RateLimiter(now)
  const mailer = outboxMailer({ log: false })
  const app = createApp({ config: testConfig(over), repo, limiter, now, mailer, aiFetch })
  return { app, repo, clock, limiter, mailer }
}

/** Minimal browser stand-in: keeps cookies between requests and sends the Origin header. */
export function client(app: ReturnType<typeof createApp>) {
  const jar = new Map<string, string>()
  async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await app.request(`http://localhost${path}`, {
      method,
      headers: {
        origin: ORIGIN,
        'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) Chrome/140.0',
        ...(body !== undefined ? { 'content-type': 'application/json' } : method !== 'GET' ? { 'content-type': 'application/json' } : {}),
        ...(jar.size ? { cookie: [...jar].map(([k, v]) => `${k}=${v}`).join('; ') } : {}),
        ...headers,
      },
      body: body !== undefined ? JSON.stringify(body) : method !== 'GET' ? '{}' : undefined,
    })
    for (const line of res.headers.getSetCookie()) {
      const [pair, ...attrs] = line.split(';')
      const [name, value] = pair.split('=')
      const expired = attrs.some((a) => /max-age=0/i.test(a.trim()))
      if (expired || !value) jar.delete(name.trim())
      else jar.set(name.trim(), value.trim())
    }
    const json = (await res.json().catch(() => null)) as any
    return { status: res.status, json, headers: res.headers }
  }
  return {
    jar,
    get: (p: string) => call('GET', p),
    post: (p: string, b?: unknown, h?: Record<string, string>) => call('POST', p, b ?? {}, h),
    patch: (p: string, b?: unknown) => call('PATCH', p, b ?? {}),
    del: (p: string, b?: unknown) => call('DELETE', p, b ?? {}),
    raw: call,
  }
}

export const PASSWORD = 'correct horse battery'

export async function register(c: ReturnType<typeof client>, email = 'coach@example.com', name = 'Casey Coach') {
  const res = await c.post('/api/auth/register', { name, email, password: PASSWORD })
  if (res.status !== 201) throw new Error(`register failed: ${JSON.stringify(res.json)}`)
  return res.json.user as { id: string; email: string }
}
