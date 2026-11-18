import { serve } from '@hono/node-server'
import { serveStatic } from '@hono/node-server/serve-static'
import type { Context } from 'hono'
import { existsSync, readFileSync } from 'node:fs'
import { join, relative } from 'node:path'
import { createApp } from './app.ts'
import { loadConfig } from './config.ts'
import { openMongo } from './db/mongo.ts'
import { openSqlite } from './db/sqlite.ts'
import { dataFile } from './lib/dataFile.ts'
import { outboxMailer, smtpMailer } from './lib/mailer.ts'

const config = loadConfig()

const repo = config.mongoUri
  ? await openMongo(config.mongoUri, config.mongoDb)
  : openSqlite(dataFile(config.dataDir))

if (config.production && config.mongoUri && !process.env.SECRET_KEY) {
  console.warn('Set SECRET_KEY in production. Without it, 2FA secrets can’t be decrypted after the data folder is wiped.')
}

const mailer = config.smtpUrl ? smtpMailer(config.smtpUrl, config.mailFrom) : outboxMailer()
if (!config.smtpUrl) {
  console.warn(
    config.production
      ? '[mail] SMTP_URL is not set: verification and password-reset emails are only written to this log.'
      : '[mail] No SMTP_URL: emails go to the dev outbox at /api/dev/outbox (and this log).',
  )
}
const app = createApp({ config, repo, mailer })

// In production the same server hosts the built frontend.
if (existsSync(join(config.staticDir, 'index.html'))) {
  const root = relative(process.cwd(), config.staticDir) || '.'
  const indexHtml = readFileSync(join(config.staticDir, 'index.html'), 'utf8')
  app.use(
    '/assets/*',
    serveStatic({ root, onFound: (_path, c) => c.header('Cache-Control', 'public, max-age=31536000, immutable') }),
  )
  // index.html must always be revalidated, or browsers keep running an old build after a deploy.
  const shell = (c: Context) => {
    c.header('Cache-Control', 'no-cache')
    return c.html(indexHtml)
  }
  app.get('/', shell)
  app.get('/index.html', shell)
  // The service worker must be revalidated too, so new builds reach devices that are offline-capable.
  app.use('/sw.js', async (c, next) => {
    await next()
    c.header('Cache-Control', 'no-cache')
  })
  app.use('*', serveStatic({ root }))
  // SPA fallback: any other GET renders the app shell, and the client router takes it from there.
  app.get('*', shell)
}

const sweep = setInterval(() => repo.purgeExpiredSessions(Date.now()).catch(console.error), 60 * 60 * 1000)
sweep.unref()

// HOST=127.0.0.1 keeps the server off the network, e.g. when a tunnel on the same machine is the only way in.
const server = serve({ fetch: app.fetch, port: config.port, hostname: process.env.HOST || undefined }, (info) => {
  console.log(`Lanemark API on http://localhost:${info.port}  ·  storage: ${repo.kind}${config.production ? '  ·  production' : ''}`)
})

async function shutdown() {
  server.close()
  await repo.close()
  process.exit(0)
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
