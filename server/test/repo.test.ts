import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { openMongo } from '../db/mongo.ts'
import { openSqlite } from '../db/sqlite.ts'
import { EmailTakenError, type Repo, type SessionRecord, type UserRecord } from '../db/types.ts'
import { client, PASSWORD, register, setupApp } from './helpers.ts'

/**
 * The same contract runs against SQLite and a throwaway MongoDB. The Mongo half is skipped when the test
 * binary can't start (set SKIP_MONGO_TESTS=1 to skip it on purpose).
 */

let mongo: { stop: () => Promise<unknown>; getUri: () => string } | null = null
let dbCounter = 0

beforeAll(async () => {
  if (process.env.SKIP_MONGO_TESTS) return
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server')
    mongo = await MongoMemoryServer.create({ instance: { launchTimeout: 60_000 } })
  } catch (err) {
    console.warn('MongoDB tests skipped:', (err as Error).message)
  }
}, 120_000)

afterAll(async () => {
  await mongo?.stop()
})

const backends: [string, () => Promise<Repo | null>][] = [
  ['sqlite', async () => openSqlite(':memory:')],
  ['mongo', async () => (mongo ? openMongo(mongo.getUri(), `lanemark_test_${++dbCounter}`) : null)],
]

const user = (id: string, email: string): UserRecord => ({
  id,
  email,
  name: 'Casey',
  passwordHash: 'scrypt$x',
  totpSecretEnc: null,
  totpPendingEnc: null,
  totpLastStep: 0,
  recoveryCodes: [],
  createdAt: 1,
  updatedAt: 1,
})

const session = (id: string, userId: string, kind: SessionRecord['kind'] = 'session', expiresAt = 10_000): SessionRecord => ({
  id,
  userId,
  tokenHash: `hash-${id}`,
  kind,
  userAgent: 'ua',
  ip: '127.0.0.1',
  createdAt: 1,
  lastSeenAt: 1,
  expiresAt,
  attempts: 0,
})

describe.each(backends)('%s repository', (name, open) => {
  let repo: Repo | null = null
  beforeAll(async () => {
    repo = await open()
  })
  afterAll(async () => {
    await repo?.close()
  })
  const r = () => {
    if (!repo) throw new Error('skip')
    return repo
  }
  const test = (title: string, fn: () => Promise<void>) =>
    it(title, async (ctx) => {
      if (!repo) ctx.skip()
      await fn()
    })

  test('creates, reads, updates users and enforces unique email', async () => {
    await r().createUser(user('u1', 'a@example.com'))
    await expect(r().createUser(user('u2', 'a@example.com'))).rejects.toBeInstanceOf(EmailTakenError)
    expect((await r().getUserByEmail('a@example.com'))?.id).toBe('u1')
    await r().updateUser('u1', { name: 'Casey Coach', recoveryCodes: ['h1', 'h2'] })
    const u = await r().getUserById('u1')
    expect(u).toMatchObject({ id: 'u1', email: 'a@example.com', name: 'Casey Coach', recoveryCodes: ['h1', 'h2'] })
    expect(await r().getUserById('missing')).toBeNull()
  })

  test('manages sessions', async () => {
    await r().createUser(user('u3', 'b@example.com'))
    await r().createSession(session('s1', 'u3'))
    await r().createSession(session('s2', 'u3'))
    await r().createSession(session('m1', 'u3', 'mfa', 5))
    expect((await r().getSessionByTokenHash('hash-s1'))?.id).toBe('s1')
    await r().updateSession('s1', { lastSeenAt: 50, expiresAt: 20_000, attempts: 2 })
    expect(await r().getSessionByTokenHash('hash-s1')).toMatchObject({ lastSeenAt: 50, expiresAt: 20_000, attempts: 2 })
    expect((await r().listSessions('u3', 'session')).map((s) => s.id).sort()).toEqual(['s1', 's2'])
    await r().deleteUserSessions('u3', 's1')
    expect((await r().listSessions('u3', 'session')).map((s) => s.id)).toEqual(['s1'])
    await r().purgeExpiredSessions(10)
    expect(await r().getSessionByTokenHash('hash-m1')).toBeNull()
    await r().deleteSession('s1')
    expect(await r().getSessionByTokenHash('hash-s1')).toBeNull()
  })

  test('stores documents with cursors and tombstones, per user', async () => {
    await r().createUser(user('u4', 'c@example.com'))
    await r().createUser(user('u5', 'd@example.com'))
    await r().putDocs('u4', [
      { kind: 'swimmer', id: 'w1', data: { id: 'w1', name: 'Maya' }, updatedAt: 100, deleted: false },
      { kind: 'class', id: 'c1', data: { id: 'c1', name: 'SW3' }, updatedAt: 101, deleted: false },
    ])
    await r().putDocs('u5', [{ kind: 'swimmer', id: 'w1', data: { id: 'w1', name: 'Other' }, updatedAt: 102, deleted: false }])
    expect((await r().listDocs('u4', 0)).map((d) => d.id)).toEqual(['w1', 'c1'])
    expect(await r().listDocs('u4', 101)).toEqual([])
    expect(await r().countDocs('u4')).toBe(2)

    await r().putDocs('u4', [{ kind: 'swimmer', id: 'w1', data: null, updatedAt: 110, deleted: true }])
    expect(await r().listDocs('u4', 101)).toEqual([{ kind: 'swimmer', id: 'w1', data: null, updatedAt: 110, deleted: true }])
    expect(await r().countDocs('u4')).toBe(1)
    expect((await r().listDocs('u5', 0))[0].data).toEqual({ id: 'w1', name: 'Other' })
  })

  test('deleting a user removes their sessions and documents', async () => {
    await r().createUser(user('u6', 'e@example.com'))
    await r().createSession(session('s6', 'u6'))
    await r().putDocs('u6', [{ kind: 'class', id: 'c6', data: { id: 'c6' }, updatedAt: 200, deleted: false }])
    await r().deleteUser('u6')
    expect(await r().getUserById('u6')).toBeNull()
    expect(await r().getSessionByTokenHash('hash-s6')).toBeNull()
    expect(await r().listDocs('u6', 0)).toEqual([])
  })

  test('emailed tokens are single use, replaceable and purged when expired', async () => {
    await r().createUser(user('u7', 'f@example.com'))
    const tok = (id: string, purpose: 'verify-email' | 'reset-password', expiresAt = 10_000) => ({
      id, userId: 'u7', tokenHash: `th-${id}`, purpose, email: 'f@example.com', createdAt: 1, expiresAt, usedAt: null,
    })
    await r().createToken(tok('t1', 'reset-password'))
    expect(await r().getTokenByHash('th-t1')).toMatchObject({ id: 't1', purpose: 'reset-password', usedAt: null })
    expect(await r().consumeToken('t1', 50)).toBe(true)
    expect(await r().consumeToken('t1', 60)).toBe(false)
    expect((await r().getTokenByHash('th-t1'))?.usedAt).toBe(50)
    await r().createToken(tok('t2', 'verify-email'))
    await r().createToken(tok('t3', 'reset-password', 5))
    await r().deleteUserTokens('u7', 'verify-email')
    expect(await r().getTokenByHash('th-t2')).toBeNull()
    await r().purgeExpiredSessions(10)
    expect(await r().getTokenByHash('th-t3')).toBeNull()
    await r().createUser(user('u8', 'g@example.com'))
    await expect(r().updateUser('u8', { email: 'f@example.com' })).rejects.toBeInstanceOf(EmailTakenError)
  })

  test('pools: codes, members in join order, and removal with the pool or the user', async () => {
    const pool = (id: string, inviteCode: string) => ({ id, name: 'Riverside', inviteCode, shareLeaderboard: false, createdBy: 'p1', createdAt: 1, updatedAt: 1 })
    for (const id of ['p1', 'p2', 'p3']) await r().createUser(user(id, `${id}@example.com`))
    await r().createPool(pool('pool1', 'AAAA2222'))
    await r().createPool(pool('pool2', 'BBBB3333'))
    expect((await r().getPoolByCode('AAAA2222'))?.id).toBe('pool1')
    await r().updatePool('pool1', { inviteCode: 'CCCC4444', shareLeaderboard: true })
    expect(await r().getPoolByCode('AAAA2222')).toBeNull()
    expect(await r().getPool('pool1')).toMatchObject({ inviteCode: 'CCCC4444', shareLeaderboard: true, name: 'Riverside' })

    await r().putMember({ userId: 'p2', poolId: 'pool1', role: 'instructor', joinedAt: 20 })
    await r().putMember({ userId: 'p1', poolId: 'pool1', role: 'supervisor', joinedAt: 10 })
    await r().putMember({ userId: 'p3', poolId: 'pool2', role: 'supervisor', joinedAt: 5 })
    expect((await r().listMembers('pool1')).map((m) => m.userId)).toEqual(['p1', 'p2'])
    await r().putMember({ userId: 'p2', poolId: 'pool1', role: 'supervisor', joinedAt: 20 })
    expect((await r().getMembership('p2'))?.role).toBe('supervisor')

    await r().deleteUser('p2')
    expect(await r().getMembership('p2')).toBeNull()
    await r().deletePool('pool1')
    expect(await r().getPool('pool1')).toBeNull()
    expect(await r().getMembership('p1')).toBeNull()
    expect((await r().listMembers('pool2')).map((m) => m.userId)).toEqual(['p3'])
    await r().deleteMember('p3')
    expect(await r().listMembers('pool2')).toEqual([])
  })

  test('live documents of one kind skip tombstones', async () => {
    await r().createUser(user('u9', 'h@example.com'))
    await r().putDocs('u9', [
      { kind: 'class', id: 'c1', data: { id: 'c1' }, updatedAt: 300, deleted: false },
      { kind: 'class', id: 'c2', data: null, updatedAt: 301, deleted: true },
      { kind: 'swimmer', id: 'w1', data: { id: 'w1' }, updatedAt: 302, deleted: false },
    ])
    expect(await r().liveDocs('u9', 'class')).toEqual([{ kind: 'class', id: 'c1', data: { id: 'c1' }, updatedAt: 300, deleted: false }])
  })

  test(`full sign-up, 2FA-free login and sync round trip on ${name}`, async () => {
    const { app } = setupApp(await open() as Repo)
    const a = client(app)
    await register(a, `flow-${name}@example.com`)
    await a.post('/api/sync', { cursor: 0, changes: [{ kind: 'swimmer', id: 's1', op: 'put', data: { id: 's1', name: 'Maya', notes: '', createdAt: 1 } }] })
    const b = client(app)
    expect((await b.post('/api/auth/login', { email: `flow-${name}@example.com`, password: PASSWORD })).status).toBe(200)
    const pulled = await b.post('/api/sync', { cursor: 0, changes: [] })
    expect(pulled.json.docs.map((d: { id: string }) => d.id)).toEqual(['s1'])
  })
})
