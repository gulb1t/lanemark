/**
 * Creates a local development account with sample classes, so you can sign in straight away.
 *   npm run seed
 * Refuses to run in production. Safe to run twice (it skips an existing account).
 */
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { buildDemoData } from '../src/lib/demo.ts'
import { hashPassword } from './auth/password.ts'
import { loadConfig } from './config.ts'
import { openMongo } from './db/mongo.ts'
import { openSqlite } from './db/sqlite.ts'
import { monotonicClock } from './db/types.ts'

export const DEV_ACCOUNT = {
  name: 'Dev Coach',
  email: 'coach@swimtrack.test',
  password: 'Lane-Lines-Forever-42',
}

const config = loadConfig()
if (config.production) {
  console.error('Refusing to seed a production database.')
  process.exit(1)
}

const repo = config.mongoUri ? await openMongo(config.mongoUri, config.mongoDb) : openSqlite(join(config.dataDir, 'swimtrack.db'))

if (await repo.getUserByEmail(DEV_ACCOUNT.email)) {
  console.log(`${DEV_ACCOUNT.email} already exists. Nothing to do.`)
} else {
  const now = Date.now()
  const id = randomUUID()
  await repo.createUser({
    id,
    email: DEV_ACCOUNT.email,
    name: DEV_ACCOUNT.name,
    passwordHash: await hashPassword(DEV_ACCOUNT.password),
    totpSecretEnc: null,
    totpPendingEnc: null,
    totpLastStep: 0,
    recoveryCodes: [],
    createdAt: now,
    updatedAt: now,
  })
  const clock = monotonicClock()
  const { swimmers, classes } = buildDemoData()
  await repo.putDocs(id, [
    ...swimmers.map((s) => ({ kind: 'swimmer' as const, id: s.id, data: s, updatedAt: clock(), deleted: false })),
    ...classes.map((c) => ({ kind: 'class' as const, id: c.id, data: c, updatedAt: clock(), deleted: false })),
  ])
  console.log(`Created ${DEV_ACCOUNT.email} with ${classes.length} sample classes. Password: ${DEV_ACCOUNT.password}`)
}
await repo.close()
