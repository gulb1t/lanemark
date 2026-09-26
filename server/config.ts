import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

export interface Config {
  port: number
  production: boolean
  /** Where the SQLite database and generated secret key live. */
  dataDir: string
  /** When set, MongoDB is used instead of SQLite. */
  mongoUri?: string
  mongoDb: string
  /** 32-byte key used to encrypt 2FA secrets at rest. */
  secretKey: Buffer
  /** Extra origins allowed to make state-changing requests. Same-origin requests are always allowed. */
  origins: string[]
  /** Read the client IP from X-Forwarded-For (only behind a proxy you control). */
  trustProxy: boolean
  /** Folder of the built frontend to serve in production. */
  staticDir: string
  /** Public address of the app, used in emailed links. Never taken from request headers. */
  appUrl: string
  /** SMTP connection string. Without it, email goes to the in-memory dev outbox instead. */
  smtpUrl?: string
  mailFrom: string
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const production = env.NODE_ENV === 'production'
  const dataDir = resolve(env.DATA_DIR ?? 'data')
  mkdirSync(dataDir, { recursive: true })
  const devOrigins = 'http://localhost:5173,http://127.0.0.1:5173'
  return {
    port: Number(env.PORT ?? 8787),
    production,
    dataDir,
    mongoUri: env.MONGODB_URI || undefined,
    mongoDb: env.MONGODB_DB ?? 'swimtrack',
    secretKey: loadSecretKey(env.SECRET_KEY, dataDir),
    origins: (env.APP_ORIGINS ?? (production ? '' : devOrigins))
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
    trustProxy: env.TRUST_PROXY === '1',
    staticDir: resolve(env.STATIC_DIR ?? 'dist'),
    appUrl: appUrl(env.APP_URL, production),
    smtpUrl: env.SMTP_URL || undefined,
    mailFrom: env.MAIL_FROM ?? 'SwimTrack <no-reply@swimtrack.local>',
  }
}

function appUrl(fromEnv: string | undefined, production: boolean) {
  const url = fromEnv ?? (production ? '' : 'http://localhost:5173')
  if (!url) throw new Error('Set APP_URL to the public address of the app (for example https://swimtrack.example.ca). Emailed links point there.')
  return url.replace(/\/+$/, '')
}

/** Uses SECRET_KEY when provided, otherwise creates one in the data folder on first run. */
function loadSecretKey(fromEnv: string | undefined, dataDir: string): Buffer {
  if (fromEnv) {
    const key = Buffer.from(fromEnv, 'base64')
    if (key.length !== 32) throw new Error('SECRET_KEY must be 32 random bytes, base64-encoded (openssl rand -base64 32).')
    return key
  }
  const file = join(dataDir, 'secret.key')
  if (existsSync(file)) return Buffer.from(readFileSync(file, 'utf8').trim(), 'base64')
  const key = randomBytes(32)
  writeFileSync(file, key.toString('base64'), { mode: 0o600 })
  return key
}
