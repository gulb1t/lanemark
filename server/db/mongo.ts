import { MongoClient, MongoServerError, type Collection } from 'mongodb'
import { EmailTakenError, type DocRecord, type Repo, type SessionRecord, type TokenRecord, type UserRecord } from './types.ts'

type UserDoc = Omit<UserRecord, 'id'> & { _id: string }
type SessionDoc = Omit<SessionRecord, 'id'> & { _id: string; expireAt: Date }
type StoredDoc = DocRecord & { _id: string; userId: string }
type TokenDoc = Omit<TokenRecord, 'id'> & { _id: string; expireAt: Date }

const docKey = (userId: string, kind: string, id: string) => `${userId}:${kind}:${id}`

/** MongoDB storage (works with a free Atlas cluster). Selected when MONGODB_URI is set. */
export async function openMongo(uri: string, dbName: string): Promise<Repo> {
  const client = new MongoClient(uri, { appName: 'swimtrack', maxPoolSize: 10 })
  await client.connect()
  const db = client.db(dbName)
  const users: Collection<UserDoc> = db.collection('users')
  const sessions: Collection<SessionDoc> = db.collection('sessions')
  const docs: Collection<StoredDoc> = db.collection('docs')
  const tokens: Collection<TokenDoc> = db.collection('tokens')

  await Promise.all([
    users.createIndex({ email: 1 }, { unique: true }),
    sessions.createIndex({ tokenHash: 1 }, { unique: true }),
    sessions.createIndex({ userId: 1, kind: 1 }),
    // Mongo removes expired sessions on its own.
    sessions.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
    docs.createIndex({ userId: 1, updatedAt: 1 }),
    tokens.createIndex({ tokenHash: 1 }, { unique: true }),
    tokens.createIndex({ userId: 1, purpose: 1 }),
    tokens.createIndex({ expireAt: 1 }, { expireAfterSeconds: 0 }),
  ])

  const toUser = (d: UserDoc | null): UserRecord | null => {
    if (!d) return null
    const { _id, ...rest } = d
    return { id: _id, ...rest }
  }
  const toSession = (d: SessionDoc | null): SessionRecord | null => {
    if (!d) return null
    const { _id, expireAt: _drop, ...rest } = d
    return { id: _id, ...rest }
  }

  return {
    kind: 'mongo',

    async createUser(user) {
      const { id, ...rest } = user
      try {
        await users.insertOne({ _id: id, ...rest })
      } catch (err) {
        if (err instanceof MongoServerError && err.code === 11000) throw new EmailTakenError()
        throw err
      }
    },
    async getUserById(id) {
      return toUser(await users.findOne({ _id: id }))
    },
    async getUserByEmail(email) {
      return toUser(await users.findOne({ email }))
    },
    async updateUser(id, patch) {
      try {
        await users.updateOne({ _id: id }, { $set: patch })
      } catch (err) {
        if (err instanceof MongoServerError && err.code === 11000) throw new EmailTakenError()
        throw err
      }
    },
    async deleteUser(id) {
      await Promise.all([
        users.deleteOne({ _id: id }),
        sessions.deleteMany({ userId: id }),
        docs.deleteMany({ userId: id }),
        tokens.deleteMany({ userId: id }),
      ])
    },

    async createSession(s) {
      const { id, ...rest } = s
      await sessions.insertOne({ _id: id, ...rest, expireAt: new Date(s.expiresAt) })
    },
    async getSessionByTokenHash(tokenHash) {
      return toSession(await sessions.findOne({ tokenHash }))
    },
    async updateSession(id, patch) {
      await sessions.updateOne({ _id: id }, { $set: { ...patch, ...(patch.expiresAt ? { expireAt: new Date(patch.expiresAt) } : {}) } })
    },
    async deleteSession(id) {
      await sessions.deleteOne({ _id: id })
    },
    async deleteUserSessions(userId, keepId) {
      await sessions.deleteMany({ userId, ...(keepId ? { _id: { $ne: keepId } } : {}) })
    },
    async listSessions(userId, kind) {
      const rows = await sessions.find({ userId, kind }).sort({ expiresAt: -1 }).toArray()
      return rows.map((r) => toSession(r)!)
    },

    async listDocs(userId, since) {
      const rows = await docs.find({ userId, updatedAt: { $gt: since } }).sort({ updatedAt: 1 }).toArray()
      return rows.map(({ kind, id, data, updatedAt, deleted }) => ({ kind, id, data: data ?? null, updatedAt, deleted }))
    },
    async putDocs(userId, list) {
      if (!list.length) return
      await docs.bulkWrite(
        list.map((d) => ({
          replaceOne: {
            filter: { _id: docKey(userId, d.kind, d.id) },
            replacement: { _id: docKey(userId, d.kind, d.id), userId, ...d, data: d.deleted ? null : d.data },
            upsert: true,
          },
        })),
        { ordered: true },
      )
    },
    async countDocs(userId) {
      return docs.countDocuments({ userId, deleted: false })
    },

    async createToken(t) {
      const { id, ...rest } = t
      await tokens.insertOne({ _id: id, ...rest, expireAt: new Date(t.expiresAt) })
    },
    async getTokenByHash(tokenHash) {
      const d = await tokens.findOne({ tokenHash })
      if (!d) return null
      const { _id, expireAt: _drop, ...rest } = d
      return { id: _id, ...rest }
    },
    async consumeToken(id, at) {
      const res = await tokens.updateOne({ _id: id, usedAt: null }, { $set: { usedAt: at } })
      return res.modifiedCount === 1
    },
    async deleteUserTokens(userId, purpose) {
      await tokens.deleteMany({ userId, purpose, usedAt: null })
    },

    async purgeExpiredSessions(now) {
      await Promise.all([sessions.deleteMany({ expiresAt: { $lt: now } }), tokens.deleteMany({ expiresAt: { $lt: now } })])
    },
    async close() {
      await client.close()
    },
  }
}
