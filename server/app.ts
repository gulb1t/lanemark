import type { HttpBindings } from '@hono/node-server'
import { Hono, type Context, type MiddlewareHandler } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { deleteCookie, getCookie, setCookie } from 'hono/cookie'
import { secureHeaders } from 'hono/secure-headers'
import { randomUUID } from 'node:crypto'
import QRCode from 'qrcode'
import type { z } from 'zod'
import { fakeVerify, hashPassword, passwordProblem, verifyPassword } from './auth/password.ts'
import { generateRecoveryCodes, generateSecret, normalizeRecoveryCode, otpauthUrl, verifyTotp } from './auth/totp.ts'
import type { Config } from './config.ts'
import { EmailTakenError, monotonicClock, type DocRecord, type Repo, type SessionRecord, type TokenPurpose, type UserRecord } from './db/types.ts'
import { askAssistant, AssistantError } from './assistant.ts'
import { emails } from './lib/emails.ts'
import { outboxMailer, type Mail, type Mailer } from './lib/mailer.ts'
import { decrypt, encrypt, randomToken, sha256 } from './lib/crypto.ts'
import { keyedMutex, RateLimiter } from './lib/ratelimit.ts'
import { describeUserAgent, maskIp } from './lib/useragent.ts'
import {
  AssistantBody,
  ChangeEmailBody,
  ChangePasswordBody,
  ClassDoc,
  CodeBody,
  ContactBody,
  firstIssue,
  SecurityPrefsBody,
  VerifyLoginBody,
  ForgotBody,
  LoginBody,
  PasswordAndCodeBody,
  PasswordBody,
  ProfileBody,
  RegisterBody,
  ResetBody,
  SwimmerDoc,
  SyncBody,
  TokenBody,
} from './validation.ts'

const MINUTE = 60_000
const HOUR = 60 * MINUTE
const DAY = 24 * HOUR
const SESSION_TTL = 30 * DAY
/** "Remember me" off: the cookie dies with the browser and the server forgets the session after 12 hours. */
const SHORT_TTL = 12 * HOUR
const TRUST_TTL = 30 * DAY
const MFA_TTL = 5 * MINUTE
const MFA_MAX_ATTEMPTS = 5
const MAX_DOCS_PER_USER = 5000
const VERIFY_TTL = DAY
const RESET_TTL = 30 * MINUTE

type Vars = { user: UserRecord; session: SessionRecord }
type Env = { Bindings: HttpBindings; Variables: Vars }
type Ctx = Context<Env>

export interface AppDeps {
  config: Config
  repo: Repo
  limiter?: RateLimiter
  now?: () => number
  /** Defaults to the in-memory outbox (development and tests). */
  mailer?: Mailer
  /** fetch used for the AI provider; swapped out in tests. */
  aiFetch?: typeof fetch
}

/** c•••@example.com: enough to recognise an address without spelling it out. */
export function maskEmail(email: string) {
  const [local, domain] = email.split('@')
  return `${local.slice(0, 1)}•••@${domain}`
}

export function publicUser(u: UserRecord) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    emailVerified: Boolean(u.emailVerifiedAt),
    trustDevices: u.trustDevices !== false,
    twoFactor: Boolean(u.totpSecretEnc),
    recoveryCodesLeft: u.recoveryCodes.length,
    createdAt: u.createdAt,
  }
}
export type PublicUser = ReturnType<typeof publicUser>

export function createApp({ config, repo, limiter = new RateLimiter(), now = Date.now, mailer = outboxMailer({ log: !config.production }), aiFetch = fetch }: AppDeps) {
  const app = new Hono<Env>()
  const clock = monotonicClock()
  const lock = keyedMutex()
  const secure = config.production
  const SESSION_COOKIE = secure ? '__Host-st_session' : 'st_session'
  const MFA_COOKIE = secure ? '__Host-st_mfa' : 'st_mfa'
  const TRUST_COOKIE = secure ? '__Host-st_trust' : 'st_trust'

  // ── helpers ───────────────────────────────────────────────────────
  const fail = (c: Ctx, status: 400 | 401 | 403 | 404 | 409 | 413 | 415 | 429, code: string, message: string) =>
    c.json({ error: { code, message } }, status)

  /** Exact matches, or `https://*.host` for any subdomain of host (over the same scheme). */
  const allowedOrigin = (origin: string) =>
    config.origins.some((o) => {
      if (o === origin) return true
      const wild = o.match(/^(https?):\/\/\*\.(.+)$/)
      if (!wild) return false
      try {
        const u = new URL(origin)
        return u.protocol === `${wild[1]}:` && u.hostname.endsWith(`.${wild[2]}`) && !u.port
      } catch {
        return false
      }
    })

  const tooMany = (c: Ctx, seconds: number) => {
    c.header('Retry-After', String(seconds))
    const mins = Math.ceil(seconds / 60)
    return fail(c, 429, 'rate_limited', `Too many attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.`)
  }

  const clientIp = (c: Ctx) => {
    if (config.trustProxy) {
      // The proxy appends the address it saw, so the last entry is the real one. Earlier entries come from the
      // client and can be anything, which would let someone dodge rate limits by sending a new one each time.
      const fwd = c.req.header('x-forwarded-for')?.split(',').at(-1)?.trim()
      if (fwd) return fwd
    }
    return c.env?.incoming?.socket?.remoteAddress ?? 'unknown'
  }

  async function body<T extends z.ZodType>(c: Ctx, schema: T): Promise<z.infer<T> | Response> {
    let raw: unknown
    try {
      raw = await c.req.json()
    } catch {
      return fail(c, 400, 'bad_json', 'Request body must be JSON.')
    }
    const parsed = schema.safeParse(raw)
    return parsed.success ? parsed.data : fail(c, 400, 'invalid', firstIssue(parsed.error))
  }

  const cookieOpts = (maxAgeMs: number) =>
    ({ httpOnly: true, secure, sameSite: 'Lax', path: '/', maxAge: Math.floor(maxAgeMs / 1000) }) as const
  /** No Max-Age: the browser drops it when it closes. */
  const browserCookie = { httpOnly: true, secure, sameSite: 'Lax', path: '/' } as const

  async function startSession(c: Ctx, user: UserRecord, persistent = true) {
    const token = randomToken()
    const t = now()
    await repo.createSession({
      id: randomUUID(),
      userId: user.id,
      tokenHash: sha256(token),
      kind: 'session',
      userAgent: (c.req.header('user-agent') ?? '').slice(0, 300),
      ip: maskIp(clientIp(c)),
      createdAt: t,
      lastSeenAt: t,
      expiresAt: t + (persistent ? SESSION_TTL : SHORT_TTL),
      attempts: 0,
      persistent,
    })
    setCookie(c, SESSION_COOKIE, token, persistent ? cookieOpts(SESSION_TTL) : browserCookie)
  }

  /** Remembers this device for 30 days so sign-ins here skip the authenticator code. */
  async function trustDevice(c: Ctx, user: UserRecord) {
    const token = randomToken()
    const t = now()
    await repo.createSession({
      id: randomUUID(),
      userId: user.id,
      tokenHash: sha256(token),
      kind: 'trusted',
      userAgent: (c.req.header('user-agent') ?? '').slice(0, 300),
      ip: maskIp(clientIp(c)),
      createdAt: t,
      lastSeenAt: t,
      expiresAt: t + TRUST_TTL,
      attempts: 0,
    })
    setCookie(c, TRUST_COOKIE, token, cookieOpts(TRUST_TTL))
  }

  /** True when this browser carries a live trusted-device mark for this user. */
  async function isTrusted(c: Ctx, user: UserRecord) {
    if (user.trustDevices === false) return false
    const token = getCookie(c, TRUST_COOKIE)
    if (!token) return false
    const rec = await repo.getSessionByTokenHash(sha256(token))
    return Boolean(rec && rec.kind === 'trusted' && rec.userId === user.id && rec.expiresAt > now())
  }

  async function forgetTrustedDevices(userId: string) {
    for (const s of await repo.listSessions(userId, 'trusted')) await repo.deleteSession(s.id)
  }

  const secretOf = (enc: string) => decrypt(config.secretKey, enc)

  // ── email ─────────────────────────────────────────────────────────
  /** Sends without making the request wait, so response times don't reveal whether an account exists. */
  const deliver = (mail: Mail) => void mailer.send(mail).catch((err) => console.error('[mail] delivery failed:', err))

  /** Issues a fresh single-use link, replacing any unused one for the same purpose. */
  async function issueLink(user: UserRecord, purpose: TokenPurpose, email: string, ttl: number) {
    await repo.deleteUserTokens(user.id, purpose)
    const token = randomToken()
    const t = now()
    await repo.createToken({ id: randomUUID(), userId: user.id, tokenHash: sha256(token), purpose, email, createdAt: t, expiresAt: t + ttl, usedAt: null })
    const page = purpose === 'reset-password' ? 'reset-password' : 'verify-email'
    return `${config.appUrl}/${page}?token=${encodeURIComponent(token)}`
  }

  /** Looks up an unexpired, unused link of one of the given kinds, with its user. */
  async function readLink(token: string, purposes: TokenPurpose[]) {
    const rec = await repo.getTokenByHash(sha256(token))
    if (!rec || !purposes.includes(rec.purpose) || rec.usedAt || rec.expiresAt <= now()) return null
    const user = await repo.getUserById(rec.userId)
    // A verify or reset link only counts for the address it was sent to.
    if (!user || (rec.purpose !== 'change-email' && user.email !== rec.email)) return null
    return { rec, user }
  }

  const badLink = (c: Ctx) => fail(c, 400, 'invalid_link', 'This link has expired or was already used. Ask for a new one.')
  const notice = (to: string, subject: string, heading: string, text: string) =>
    deliver(emails.notice(to, subject, heading, text, `${config.appUrl}/forgot-password`))

  async function sendVerification(user: UserRecord) {
    deliver(emails.verify(user.email, user.name, await issueLink(user, 'verify-email', user.email, VERIFY_TTL)))
  }

  /** Accepts a 6-digit authenticator code or an unused recovery code. Serialised per user to stop replays. */
  function checkSecondFactor(user: UserRecord, code: string): Promise<'totp' | 'recovery' | null> {
    return lock(user.id, async () => {
      const fresh = await repo.getUserById(user.id)
      if (!fresh?.totpSecretEnc) return null
      const digits = code.replace(/\s/g, '')
      if (/^\d{6}$/.test(digits)) {
        const step = verifyTotp(secretOf(fresh.totpSecretEnc), digits, fresh.totpLastStep, now())
        if (step === null) return null
        await repo.updateUser(fresh.id, { totpLastStep: step, updatedAt: now() })
        return 'totp'
      }
      const hash = sha256(normalizeRecoveryCode(code))
      if (!fresh.recoveryCodes.includes(hash)) return null
      await repo.updateUser(fresh.id, { recoveryCodes: fresh.recoveryCodes.filter((h) => h !== hash), updatedAt: now() })
      return 'recovery'
    })
  }

  /** "Sudo" check for sensitive account changes: the password, plus a second factor when 2FA is on. */
  async function confirmIdentity(c: Ctx, user: UserRecord, password: string, code?: string): Promise<Response | null> {
    const wait = limiter.hit([[`sudo:${user.id}`, 10, 15 * MINUTE]])
    if (wait) return tooMany(c, wait)
    if (!(await verifyPassword(password, user.passwordHash))) return fail(c, 401, 'invalid_password', 'That password isn’t right.')
    if (user.totpSecretEnc) {
      if (!code) return fail(c, 401, 'code_required', 'Enter a code from your authenticator app.')
      if (!(await checkSecondFactor(user, code))) return fail(c, 401, 'invalid_code', 'That code isn’t valid. Codes change every 30 seconds.')
    }
    return null
  }

  // ── global middleware ─────────────────────────────────────────────
  app.use(
    '*',
    secureHeaders({
      contentSecurityPolicy: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        // sonner and vaul inject small <style> tags at runtime.
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'"],
        connectSrc: ["'self'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'none'"],
      },
      strictTransportSecurity: secure ? 'max-age=63072000; includeSubDomains' : false,
      referrerPolicy: 'strict-origin-when-cross-origin',
      permissionsPolicy: { camera: [], microphone: [], geolocation: [] },
    }),
  )

  app.use('/api/*', async (c, next) => {
    c.header('Cache-Control', 'no-store')
    const method = c.req.method
    if (method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS') {
      // CSRF: state-changing requests must come from our own origin and carry JSON (which forces a CORS preflight).
      const origin = c.req.header('origin')
      const host = c.req.header('host')
      let sameOrigin = false
      try {
        sameOrigin = Boolean(origin && host && new URL(origin).host === host)
      } catch {
        /* malformed origin */
      }
      if (!origin || !(sameOrigin || allowedOrigin(origin))) return fail(c, 403, 'bad_origin', 'Request blocked.')
      if (!c.req.header('content-type')?.startsWith('application/json')) return fail(c, 415, 'bad_type', 'Send JSON.')
    }
    await next()
  })

  app.use('/api/*', bodyLimit({ maxSize: 4 * 1024 * 1024, onError: (c) => fail(c as Ctx, 413, 'too_large', 'Request is too large.') }))

  /** Loads the signed-in user, sliding the session's expiry forward at most once an hour. */
  const requireUser: MiddlewareHandler<Env> = async (c, next) => {
    const token = getCookie(c, SESSION_COOKIE)
    const session = token ? await repo.getSessionByTokenHash(sha256(token)) : null
    const t = now()
    if (!session || session.kind !== 'session' || session.expiresAt <= t) {
      if (session) await repo.deleteSession(session.id)
      if (token) deleteCookie(c, SESSION_COOKIE, { path: '/', secure })
      return fail(c, 401, 'unauthenticated', 'Please sign in.')
    }
    const user = await repo.getUserById(session.userId)
    if (!user) {
      await repo.deleteSession(session.id)
      return fail(c, 401, 'unauthenticated', 'Please sign in.')
    }
    if (t - session.lastSeenAt > HOUR) {
      const persistent = session.persistent !== false
      session.lastSeenAt = t
      session.expiresAt = t + (persistent ? SESSION_TTL : SHORT_TTL)
      await repo.updateSession(session.id, { lastSeenAt: t, expiresAt: session.expiresAt })
      setCookie(c, SESSION_COOKIE, token!, persistent ? cookieOpts(SESSION_TTL) : browserCookie)
    }
    c.set('user', user)
    c.set('session', session)
    await next()
  }

  // ── public ────────────────────────────────────────────────────────
  app.get('/api/health', (c) => c.json({ ok: true, db: repo.kind }))

  app.post('/api/auth/register', async (c) => {
    const data = await body(c, RegisterBody)
    if (data instanceof Response) return data
    const wait = limiter.hit([[`register:${clientIp(c)}`, 10, HOUR]])
    if (wait) return tooMany(c, wait)
    const problem = passwordProblem(data.password, data)
    if (problem) return fail(c, 400, 'weak_password', problem)
    const t = now()
    const user: UserRecord = {
      id: randomUUID(),
      email: data.email,
      name: data.name,
      passwordHash: await hashPassword(data.password),
      totpSecretEnc: null,
      totpPendingEnc: null,
      totpLastStep: 0,
      recoveryCodes: [],
      emailVerifiedAt: null,
      createdAt: t,
      updatedAt: t,
    }
    try {
      await repo.createUser(user)
    } catch (err) {
      if (err instanceof EmailTakenError) return fail(c, 409, 'email_taken', 'An account with that email already exists. Try signing in.')
      throw err
    }
    await sendVerification(user)
    await startSession(c, user)
    return c.json({ user: publicUser(user) }, 201)
  })

  app.post('/api/auth/login', async (c) => {
    const data = await body(c, LoginBody)
    if (data instanceof Response) return data
    const wait = limiter.hit([
      [`login:ip:${clientIp(c)}`, 30, 15 * MINUTE],
      [`login:acct:${data.email}`, 8, 15 * MINUTE],
    ])
    if (wait) return tooMany(c, wait)
    const user = await repo.getUserByEmail(data.email)
    const ok = user ? await verifyPassword(data.password, user.passwordHash) : await fakeVerify(data.password)
    if (!user || !ok) return fail(c, 401, 'invalid_credentials', 'Incorrect email or password.')
    limiter.reset(`login:acct:${data.email}`)
    const persistent = data.remember !== false

    if (user.totpSecretEnc && !(await isTrusted(c, user))) {
      const token = randomToken()
      const t = now()
      await repo.createSession({
        id: randomUUID(),
        userId: user.id,
        tokenHash: sha256(token),
        kind: 'mfa',
        userAgent: '',
        ip: maskIp(clientIp(c)),
        createdAt: t,
        lastSeenAt: t,
        expiresAt: t + MFA_TTL,
        attempts: 0,
        persistent,
      })
      setCookie(c, MFA_COOKIE, token, cookieOpts(MFA_TTL))
      return c.json({ twoFactor: true, trustAllowed: user.trustDevices !== false })
    }
    await startSession(c, user, persistent)
    return c.json({ user: publicUser(user), trustedDevice: Boolean(user.totpSecretEnc) })
  })

  app.post('/api/auth/login/verify', async (c) => {
    const data = await body(c, VerifyLoginBody)
    if (data instanceof Response) return data
    const wait = limiter.hit([[`mfa:ip:${clientIp(c)}`, 30, 15 * MINUTE]])
    if (wait) return tooMany(c, wait)
    const token = getCookie(c, MFA_COOKIE)
    const ticket = token ? await repo.getSessionByTokenHash(sha256(token)) : null
    const expired = () => {
      deleteCookie(c, MFA_COOKIE, { path: '/', secure })
      return fail(c, 401, 'mfa_expired', 'Your sign-in timed out. Enter your password again.')
    }
    if (!ticket || ticket.kind !== 'mfa' || ticket.expiresAt <= now()) {
      if (ticket) await repo.deleteSession(ticket.id)
      return expired()
    }
    const user = await repo.getUserById(ticket.userId)
    if (!user) return expired()

    const method = await checkSecondFactor(user, data.code)
    if (!method) {
      const attempts = ticket.attempts + 1
      if (attempts >= MFA_MAX_ATTEMPTS) {
        await repo.deleteSession(ticket.id)
        return expired()
      }
      await repo.updateSession(ticket.id, { attempts })
      return fail(c, 401, 'invalid_code', 'That code isn’t valid. Codes change every 30 seconds.')
    }
    await repo.deleteSession(ticket.id)
    deleteCookie(c, MFA_COOKIE, { path: '/', secure })
    await startSession(c, user, ticket.persistent !== false)
    if (data.trust && user.trustDevices !== false) await trustDevice(c, user)
    const fresh = (await repo.getUserById(user.id))!
    return c.json({ user: publicUser(fresh), usedRecoveryCode: method === 'recovery' })
  })

  // Confirms the address from an emailed link. Works without being signed in (the link may open on another device).
  app.post('/api/auth/email/verify', async (c) => {
    const data = await body(c, TokenBody)
    if (data instanceof Response) return data
    const wait = limiter.hit([[`link:ip:${clientIp(c)}`, 30, 15 * MINUTE]])
    if (wait) return tooMany(c, wait)
    const found = await readLink(data.token, ['verify-email', 'change-email'])
    if (!found) return badLink(c)
    const { rec, user } = found
    if (rec.purpose === 'change-email') {
      const taken = await repo.getUserByEmail(rec.email)
      if (taken && taken.id !== user.id) return fail(c, 409, 'email_taken', 'Another account already uses that email.')
    }
    if (!(await repo.consumeToken(rec.id, now()))) return badLink(c)
    if (rec.purpose === 'change-email') {
      try {
        await repo.updateUser(user.id, { email: rec.email, emailVerifiedAt: now(), updatedAt: now() })
      } catch (err) {
        if (err instanceof EmailTakenError) return fail(c, 409, 'email_taken', 'Another account already uses that email.')
        throw err
      }
      await repo.deleteUserTokens(user.id, 'reset-password')
      notice(user.email, 'Your SwimTrack email was changed', 'Your email was changed', `Your account now signs in with ${rec.email}. This address won’t get SwimTrack emails any more.`)
    } else {
      await repo.updateUser(user.id, { emailVerifiedAt: now(), updatedAt: now() })
    }
    return c.json({ ok: true, email: rec.email, changed: rec.purpose === 'change-email' })
  })

  // Always answers the same way, so it can't be used to find out who has an account.
  app.post('/api/auth/password/forgot', async (c) => {
    const data = await body(c, ForgotBody)
    if (data instanceof Response) return data
    const wait = limiter.hit([[`forgot:ip:${clientIp(c)}`, 10, HOUR]])
    if (wait) return tooMany(c, wait)
    const email = data.email
    void (async () => {
      const user = await repo.getUserByEmail(email)
      if (user && !limiter.hit([[`forgot:acct:${user.id}`, 3, HOUR]])) {
        deliver(emails.reset(user.email, await issueLink(user, 'reset-password', user.email, RESET_TTL)))
      }
    })().catch((err) => console.error('[mail] reset failed:', err))
    return c.json({ ok: true })
  })

  app.post('/api/auth/password/check', async (c) => {
    const data = await body(c, TokenBody)
    if (data instanceof Response) return data
    const wait = limiter.hit([[`link:ip:${clientIp(c)}`, 30, 15 * MINUTE]])
    if (wait) return tooMany(c, wait)
    const found = await readLink(data.token, ['reset-password'])
    if (!found) return badLink(c)
    return c.json({ ok: true, email: maskEmail(found.user.email) })
  })

  app.post('/api/auth/password/reset', async (c) => {
    const data = await body(c, ResetBody)
    if (data instanceof Response) return data
    const wait = limiter.hit([[`link:ip:${clientIp(c)}`, 30, 15 * MINUTE]])
    if (wait) return tooMany(c, wait)
    const found = await readLink(data.token, ['reset-password'])
    if (!found) return badLink(c)
    const { rec, user } = found
    const problem = passwordProblem(data.password, user)
    if (problem) return fail(c, 400, 'weak_password', problem)
    if (!(await repo.consumeToken(rec.id, now()))) return badLink(c)
    // Using the link proves the address, so it also counts as verification.
    await repo.updateUser(user.id, { passwordHash: await hashPassword(data.password), emailVerifiedAt: user.emailVerifiedAt ?? now(), updatedAt: now() })
    await repo.deleteUserSessions(user.id)
    notice(user.email, 'Your SwimTrack password was changed', 'Your password was changed', 'Your password was just reset from an emailed link, and every device was signed out.')
    return c.json({ ok: true })
  })

  app.post('/api/auth/logout', async (c) => {
    const token = getCookie(c, SESSION_COOKIE)
    if (token) {
      const session = await repo.getSessionByTokenHash(sha256(token))
      if (session) await repo.deleteSession(session.id)
    }
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure })
    return c.json({ ok: true })
  })

  // ── signed in ─────────────────────────────────────────────────────
  app.use('/api/me', requireUser)
  app.use('/api/account/*', requireUser)
  app.use('/api/sync', requireUser)

  app.get('/api/me', (c) => c.json({ user: publicUser(c.get('user')) }))

  app.patch('/api/account', async (c) => {
    const data = await body(c, ProfileBody)
    if (data instanceof Response) return data
    const user = c.get('user')
    await repo.updateUser(user.id, { name: data.name, updatedAt: now() })
    return c.json({ user: publicUser({ ...user, name: data.name }) })
  })

  app.post('/api/account/email/resend', async (c) => {
    const user = c.get('user')
    if (user.emailVerifiedAt) return fail(c, 400, 'already_verified', 'Your email is already confirmed.')
    const wait = limiter.hit([[`verify-resend:${user.id}`, 3, HOUR]])
    if (wait) return tooMany(c, wait)
    await sendVerification(user)
    return c.json({ ok: true, email: user.email })
  })

  app.post('/api/account/email', async (c) => {
    const data = await body(c, ChangeEmailBody)
    if (data instanceof Response) return data
    const user = c.get('user')
    const denied = await confirmIdentity(c, user, data.password, data.code)
    if (denied) return denied
    if (data.email === user.email) return fail(c, 400, 'same_email', 'That’s already your email.')
    if (await repo.getUserByEmail(data.email)) return fail(c, 409, 'email_taken', 'Another account already uses that email.')
    deliver(emails.changeEmail(data.email, await issueLink(user, 'change-email', data.email, VERIFY_TTL)))
    notice(user.email, 'Email change requested', 'Someone asked to change your email', `We sent a confirmation link to ${data.email}. Your email stays the same unless that link is used.`)
    return c.json({ ok: true, pendingEmail: data.email })
  })

  app.post('/api/account/password', async (c) => {
    const data = await body(c, ChangePasswordBody)
    if (data instanceof Response) return data
    const user = c.get('user')
    const denied = await confirmIdentity(c, user, data.current, data.code)
    if (denied) return denied
    const problem = passwordProblem(data.next, user)
    if (problem) return fail(c, 400, 'weak_password', problem)
    if (data.next === data.current) return fail(c, 400, 'same_password', 'Choose a password you haven’t used here.')
    await repo.updateUser(user.id, { passwordHash: await hashPassword(data.next), updatedAt: now() })
    // Anyone holding an old session is signed out; this device stays signed in.
    await repo.deleteUserSessions(user.id, c.get('session').id)
    notice(user.email, 'Your SwimTrack password was changed', 'Your password was changed', 'Your password was changed from Settings, and your other devices were signed out.')
    return c.json({ ok: true })
  })

  app.delete('/api/account', async (c) => {
    const data = await body(c, PasswordAndCodeBody)
    if (data instanceof Response) return data
    const user = c.get('user')
    const denied = await confirmIdentity(c, user, data.password, data.code)
    if (denied) return denied
    await repo.deleteUser(user.id)
    deleteCookie(c, SESSION_COOKIE, { path: '/', secure })
    return c.json({ ok: true })
  })

  app.patch('/api/account/security', async (c) => {
    const data = await body(c, SecurityPrefsBody)
    if (data instanceof Response) return data
    const user = c.get('user')
    await repo.updateUser(user.id, { trustDevices: data.trustDevices, updatedAt: now() })
    if (!data.trustDevices) await forgetTrustedDevices(user.id)
    return c.json({ user: publicUser({ ...user, trustDevices: data.trustDevices }) })
  })

  app.delete('/api/account/trusted-devices', async (c) => {
    await forgetTrustedDevices(c.get('user').id)
    deleteCookie(c, TRUST_COOKIE, { path: '/', secure })
    return c.json({ ok: true })
  })

  // Signed in but can't remember the current password: mail a reset link to the account's own address.
  app.post('/api/account/password/reset-link', async (c) => {
    const user = c.get('user')
    const wait = limiter.hit([[`forgot:acct:${user.id}`, 3, HOUR]])
    if (wait) return tooMany(c, wait)
    deliver(emails.reset(user.email, await issueLink(user, 'reset-password', user.email, RESET_TTL)))
    return c.json({ ok: true, email: user.email })
  })

  app.get('/api/account/sessions', async (c) => {
    const current = c.get('session').id
    const list = await repo.listSessions(c.get('user').id, 'session')
    const trusted = (await repo.listSessions(c.get('user').id, 'trusted')).filter((s) => s.expiresAt > now())
    return c.json({
      trusted: trusted.map((s) => ({ id: s.id, device: describeUserAgent(s.userAgent), createdAt: s.createdAt, expiresAt: s.expiresAt })),
      sessions: list
        .filter((s) => s.expiresAt > now())
        .sort((a, b) => b.lastSeenAt - a.lastSeenAt)
        .map((s) => ({
          id: s.id,
          current: s.id === current,
          device: describeUserAgent(s.userAgent),
          ip: maskIp(s.ip),
          createdAt: s.createdAt,
          lastSeenAt: s.lastSeenAt,
        })),
    })
  })

  app.delete('/api/account/sessions/:id', async (c) => {
    const id = c.req.param('id')
    const list = await repo.listSessions(c.get('user').id, 'session')
    if (!list.some((s) => s.id === id)) return fail(c, 404, 'not_found', 'Session not found.')
    await repo.deleteSession(id)
    return c.json({ ok: true, signedOut: id === c.get('session').id })
  })

  app.post('/api/account/sessions/revoke-others', async (c) => {
    await repo.deleteUserSessions(c.get('user').id, c.get('session').id)
    return c.json({ ok: true })
  })

  // ── two-factor ────────────────────────────────────────────────────
  app.post('/api/account/2fa/setup', async (c) => {
    const data = await body(c, PasswordBody)
    if (data instanceof Response) return data
    const user = c.get('user')
    if (user.totpSecretEnc) return fail(c, 409, 'already_enabled', 'Two-factor authentication is already on.')
    const denied = await confirmIdentity(c, user, data.password)
    if (denied) return denied
    const secret = generateSecret()
    await repo.updateUser(user.id, { totpPendingEnc: encrypt(config.secretKey, secret), updatedAt: now() })
    const url = otpauthUrl(secret, user.email)
    const qr = await QRCode.toString(url, { type: 'svg', margin: 1, errorCorrectionLevel: 'M', color: { dark: '#07080aff', light: '#ffffffff' } })
    return c.json({ secret, otpauthUrl: url, qrSvg: qr })
  })

  app.post('/api/account/2fa/enable', async (c) => {
    const data = await body(c, CodeBody)
    if (data instanceof Response) return data
    const user = c.get('user')
    if (user.totpSecretEnc) return fail(c, 409, 'already_enabled', 'Two-factor authentication is already on.')
    if (!user.totpPendingEnc) return fail(c, 400, 'no_setup', 'Start the setup again.')
    const wait = limiter.hit([[`2fa-enable:${user.id}`, 10, 15 * MINUTE]])
    if (wait) return tooMany(c, wait)
    const step = verifyTotp(secretOf(user.totpPendingEnc), data.code, 0, now())
    if (step === null) return fail(c, 401, 'invalid_code', 'That code didn’t match. Check your phone’s clock and try the newest code.')
    const { codes, hashes } = generateRecoveryCodes()
    await repo.updateUser(user.id, {
      totpSecretEnc: user.totpPendingEnc,
      totpPendingEnc: null,
      totpLastStep: step,
      recoveryCodes: hashes,
      updatedAt: now(),
    })
    return c.json({ recoveryCodes: codes })
  })

  app.post('/api/account/2fa/disable', async (c) => {
    const data = await body(c, PasswordAndCodeBody)
    if (data instanceof Response) return data
    const user = c.get('user')
    if (!user.totpSecretEnc) return fail(c, 400, 'not_enabled', 'Two-factor authentication is off.')
    const denied = await confirmIdentity(c, user, data.password, data.code)
    if (denied) return denied
    await repo.updateUser(user.id, { totpSecretEnc: null, totpPendingEnc: null, recoveryCodes: [], updatedAt: now() })
    await forgetTrustedDevices(user.id)
    notice(user.email, 'Two-factor authentication was turned off', 'Two-factor authentication is off', 'Signing in to your account now only needs your password.')
    return c.json({ ok: true })
  })

  app.post('/api/account/2fa/recovery-codes', async (c) => {
    const data = await body(c, PasswordAndCodeBody)
    if (data instanceof Response) return data
    const user = c.get('user')
    if (!user.totpSecretEnc) return fail(c, 400, 'not_enabled', 'Turn on two-factor authentication first.')
    const denied = await confirmIdentity(c, user, data.password, data.code)
    if (denied) return denied
    const { codes, hashes } = generateRecoveryCodes()
    await repo.updateUser(user.id, { recoveryCodes: hashes, updatedAt: now() })
    return c.json({ recoveryCodes: codes })
  })

  // ── sync ──────────────────────────────────────────────────────────
  /**
   * One round trip: apply the client's queued changes, then return every document changed after the client's
   * cursor (including tombstones). Last write wins.
   */
  app.post('/api/sync', async (c) => {
    const data = await body(c, SyncBody)
    if (data instanceof Response) return data
    const user = c.get('user')
    const wait = limiter.hit([[`sync:${user.id}`, 300, MINUTE]])
    if (wait) return tooMany(c, wait)

    const records: DocRecord[] = []
    for (const ch of data.changes) {
      if (ch.op === 'delete') {
        records.push({ kind: ch.kind, id: ch.id, data: null, updatedAt: clock(), deleted: true })
        continue
      }
      const parsed = (ch.kind === 'class' ? ClassDoc : SwimmerDoc).safeParse(ch.data)
      if (!parsed.success) return fail(c, 400, 'invalid', `${ch.kind} ${ch.id}: ${firstIssue(parsed.error)}`)
      if (parsed.data.id !== ch.id) return fail(c, 400, 'invalid', `${ch.kind} ${ch.id}: id mismatch`)
      records.push({ kind: ch.kind, id: ch.id, data: parsed.data, updatedAt: clock(), deleted: false })
    }

    if (records.some((r) => !r.deleted)) {
      const count = await repo.countDocs(user.id)
      if (count + records.length > MAX_DOCS_PER_USER) {
        return fail(c, 413, 'quota', `Accounts can hold up to ${MAX_DOCS_PER_USER} classes and swimmers.`)
      }
    }
    if (records.length) await repo.putDocs(user.id, records)

    const docs = await repo.listDocs(user.id, data.cursor)
    const cursor = docs.reduce((m, d) => Math.max(m, d.updatedAt), data.cursor)
    return c.json({ cursor, docs })
  })

  // ── assistant ─────────────────────────────────────────────────────
  app.get('/api/assistant', (c) => c.json({ enabled: Boolean(config.ai.key) }))

  // Works signed in or in the demo. Limits per account (or address) plus a server-wide hourly cap on the AI key.
  app.post('/api/assistant', async (c) => {
    if (!config.ai.key) return fail(c, 404, 'not_found', 'The assistant isn’t set up on this server.')
    const data = await body(c, AssistantBody)
    if (data instanceof Response) return data
    const token = getCookie(c, SESSION_COOKIE)
    const session = token ? await repo.getSessionByTokenHash(sha256(token)) : null
    const who = session?.kind === 'session' && session.expiresAt > now() ? `user:${session.userId}` : `ip:${clientIp(c)}`
    const wait = limiter.hit([
      [`ai:${who}`, who.startsWith('user:') ? 40 : 15, 10 * MINUTE],
      ['ai:all', 600, HOUR],
    ])
    if (wait) return tooMany(c, wait)
    try {
      return c.json(await askAssistant(config.ai, data.messages, data.context, aiFetch))
    } catch (err) {
      if (err instanceof AssistantError) return c.json({ error: { code: 'assistant_unavailable', message: err.message } }, 503)
      throw err
    }
  })

  // ── pilot requests (pricing section) ───────────────────────────────
  app.get('/api/contact', (c) => c.json({ enabled: Boolean(config.contactEmail) }))

  // Emailed to the team, never stored. Nothing is sent back to the address in the form, so it can't be used to
  // spam someone else.
  app.post('/api/contact', async (c) => {
    if (!config.contactEmail) return fail(c, 404, 'not_found', 'Pilot requests aren’t set up on this server yet.')
    const data = await body(c, ContactBody)
    if (data instanceof Response) return data
    const wait = limiter.hit([
      [`contact:ip:${clientIp(c)}`, 5, HOUR],
      ['contact:all', 100, HOUR],
    ])
    if (wait) return tooMany(c, wait)
    if (!data.website) deliver(emails.contact(config.contactEmail, data))
    return c.json({ ok: true })
  })

  // ── development outbox ────────────────────────────────────────────
  if (!config.production && 'list' in mailer) {
    const outbox = mailer as ReturnType<typeof outboxMailer>
    app.get('/api/dev/outbox', (c) => {
      const rows = outbox
        .list()
        .map((m, i) => `<li><a href="/api/dev/outbox/${i}">${escapeHtml(m.subject)}</a><span>${escapeHtml(m.to)} · ${new Date(m.sentAt).toLocaleTimeString()}</span></li>`)
        .join('')
      return c.html(`<!doctype html><meta charset="utf-8"><title>SwimTrack dev outbox</title><style>body{font:15px system-ui;max-width:640px;margin:40px auto;padding:0 16px;color:#0a1020}li{margin:0 0 12px;list-style:none;padding:12px 16px;border:1px solid #e4e8ee;border-radius:12px}li span{display:block;color:#667085;font-size:13px;margin-top:2px}a{color:#2657e0;font-weight:600}</style><h1>Dev outbox</h1><p>Emails the server would have sent. Set SMTP_URL to deliver real email.</p><ul style="padding:0">${rows || '<li>No emails yet.</li>'}</ul>`)
    })
    app.get('/api/dev/outbox/:i', (c) => {
      const m = outbox.list()[Number(c.req.param('i'))]
      return m ? c.html(m.html) : fail(c, 404, 'not_found', 'No such email.')
    })
  }

  app.all('/api/*', (c) => fail(c, 404, 'not_found', 'No such endpoint.'))

  app.onError((err, c) => {
    console.error(err)
    return c.json({ error: { code: 'server_error', message: 'Something went wrong on our side.' } }, 500)
  })

  return app
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]!)
}
