import { DatabaseSync, type SQLInputValue } from 'node:sqlite'
import { EmailTakenError, type DocRecord, type MemberRecord, type PoolRecord, type Repo, type SessionRecord, type TokenRecord, type UserRecord } from './types.ts'

/**
 * Zero-setup storage using Node's built-in SQLite. Users and sessions keep their indexed fields as columns and
 * everything else as JSON, so the record shapes can grow without migrations.
 */
export function openSqlite(file: string): Repo {
  const db = new DatabaseSync(file)
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;

    CREATE TABLE IF NOT EXISTS users (
      id    TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      data  TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      kind       TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      data       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id, kind);

    CREATE TABLE IF NOT EXISTS docs (
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      kind       TEXT NOT NULL,
      id         TEXT NOT NULL,
      data       TEXT,
      updated_at INTEGER NOT NULL,
      deleted    INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (user_id, kind, id)
    );
    CREATE INDEX IF NOT EXISTS docs_changes ON docs(user_id, updated_at);

    CREATE TABLE IF NOT EXISTS tokens (
      id         TEXT PRIMARY KEY,
      user_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      purpose    TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      used_at    INTEGER,
      data       TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS tokens_user ON tokens(user_id, purpose);

    CREATE TABLE IF NOT EXISTS pools (
      id          TEXT PRIMARY KEY,
      invite_code TEXT NOT NULL UNIQUE,
      data        TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pool_members (
      user_id   TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      pool_id   TEXT NOT NULL REFERENCES pools(id) ON DELETE CASCADE,
      joined_at INTEGER NOT NULL,
      data      TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS pool_members_pool ON pool_members(pool_id, joined_at);
  `)

  const q = {
    insertUser: db.prepare('INSERT INTO users (id, email, data) VALUES (?, ?, ?)'),
    userById: db.prepare('SELECT data FROM users WHERE id = ?'),
    userByEmail: db.prepare('SELECT data FROM users WHERE email = ?'),
    saveUser: db.prepare('UPDATE users SET email = ?, data = ? WHERE id = ?'),
    deleteUser: db.prepare('DELETE FROM users WHERE id = ?'),

    insertSession: db.prepare('INSERT INTO sessions (id, user_id, token_hash, kind, expires_at, data) VALUES (?, ?, ?, ?, ?, ?)'),
    sessionByHash: db.prepare('SELECT data FROM sessions WHERE token_hash = ?'),
    sessionById: db.prepare('SELECT data FROM sessions WHERE id = ?'),
    saveSession: db.prepare('UPDATE sessions SET expires_at = ?, data = ? WHERE id = ?'),
    deleteSession: db.prepare('DELETE FROM sessions WHERE id = ?'),
    deleteUserSessions: db.prepare('DELETE FROM sessions WHERE user_id = ? AND id != ?'),
    listSessions: db.prepare('SELECT data FROM sessions WHERE user_id = ? AND kind = ? ORDER BY expires_at DESC'),
    purgeSessions: db.prepare('DELETE FROM sessions WHERE expires_at < ?'),

    listDocs: db.prepare('SELECT kind, id, data, updated_at, deleted FROM docs WHERE user_id = ? AND updated_at > ? ORDER BY updated_at'),
    putDoc: db.prepare(`
      INSERT INTO docs (user_id, kind, id, data, updated_at, deleted) VALUES (?, ?, ?, ?, ?, ?)
      ON CONFLICT (user_id, kind, id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at, deleted = excluded.deleted
    `),
    countDocs: db.prepare('SELECT COUNT(*) AS n FROM docs WHERE user_id = ? AND deleted = 0'),
    liveDocs: db.prepare('SELECT kind, id, data, updated_at FROM docs WHERE user_id = ? AND kind = ? AND deleted = 0 ORDER BY updated_at'),

    insertToken: db.prepare('INSERT INTO tokens (id, user_id, token_hash, purpose, expires_at, used_at, data) VALUES (?, ?, ?, ?, ?, NULL, ?)'),
    tokenByHash: db.prepare('SELECT data, used_at FROM tokens WHERE token_hash = ?'),
    consumeToken: db.prepare('UPDATE tokens SET used_at = ? WHERE id = ? AND used_at IS NULL'),
    deleteUserTokens: db.prepare('DELETE FROM tokens WHERE user_id = ? AND purpose = ? AND used_at IS NULL'),
    purgeTokens: db.prepare('DELETE FROM tokens WHERE expires_at < ?'),

    insertPool: db.prepare('INSERT INTO pools (id, invite_code, data) VALUES (?, ?, ?)'),
    poolById: db.prepare('SELECT data FROM pools WHERE id = ?'),
    poolByCode: db.prepare('SELECT data FROM pools WHERE invite_code = ?'),
    savePool: db.prepare('UPDATE pools SET invite_code = ?, data = ? WHERE id = ?'),
    deletePool: db.prepare('DELETE FROM pools WHERE id = ?'),
    memberOf: db.prepare('SELECT data FROM pool_members WHERE user_id = ?'),
    listMembers: db.prepare('SELECT data FROM pool_members WHERE pool_id = ? ORDER BY joined_at, user_id'),
    putMember: db.prepare(`
      INSERT INTO pool_members (user_id, pool_id, joined_at, data) VALUES (?, ?, ?, ?)
      ON CONFLICT (user_id) DO UPDATE SET pool_id = excluded.pool_id, joined_at = excluded.joined_at, data = excluded.data
    `),
    deleteMember: db.prepare('DELETE FROM pool_members WHERE user_id = ?'),
  }

  const parse = <T>(row: unknown): T | null => (row ? (JSON.parse((row as { data: string }).data) as T) : null)

  return {
    kind: 'sqlite',

    async createUser(user) {
      try {
        q.insertUser.run(user.id, user.email, JSON.stringify(user))
      } catch (err) {
        if (String(err).includes('UNIQUE')) throw new EmailTakenError()
        throw err
      }
    },
    async getUserById(id) {
      return parse<UserRecord>(q.userById.get(id))
    },
    async getUserByEmail(email) {
      return parse<UserRecord>(q.userByEmail.get(email))
    },
    async updateUser(id, patch) {
      const current = parse<UserRecord>(q.userById.get(id))
      if (!current) return
      const next = { ...current, ...patch, id }
      try {
        q.saveUser.run(next.email, JSON.stringify(next), id)
      } catch (err) {
        if (String(err).includes('UNIQUE')) throw new EmailTakenError()
        throw err
      }
    },
    async deleteUser(id) {
      q.deleteUser.run(id)
    },

    async createSession(s) {
      q.insertSession.run(s.id, s.userId, s.tokenHash, s.kind, s.expiresAt, JSON.stringify(s))
    },
    async getSessionByTokenHash(hash) {
      return parse<SessionRecord>(q.sessionByHash.get(hash))
    },
    async updateSession(id, patch) {
      const current = parse<SessionRecord>(q.sessionById.get(id))
      if (!current) return
      const next = { ...current, ...patch }
      q.saveSession.run(next.expiresAt, JSON.stringify(next), id)
    },
    async deleteSession(id) {
      q.deleteSession.run(id)
    },
    async deleteUserSessions(userId, keepId = '') {
      q.deleteUserSessions.run(userId, keepId)
    },
    async listSessions(userId, kind) {
      return q.listSessions.all(userId, kind).map((r) => parse<SessionRecord>(r)!)
    },

    async listDocs(userId, since) {
      return q.listDocs.all(userId, since).map((r) => {
        const row = r as { kind: DocRecord['kind']; id: string; data: string | null; updated_at: number; deleted: number }
        return {
          kind: row.kind,
          id: row.id,
          data: row.data === null ? null : JSON.parse(row.data),
          updatedAt: row.updated_at,
          deleted: row.deleted === 1,
        }
      })
    },
    async putDocs(userId, docs) {
      db.exec('BEGIN')
      try {
        for (const d of docs) {
          const params: SQLInputValue[] = [userId, d.kind, d.id, d.deleted ? null : JSON.stringify(d.data), d.updatedAt, d.deleted ? 1 : 0]
          q.putDoc.run(...params)
        }
        db.exec('COMMIT')
      } catch (err) {
        db.exec('ROLLBACK')
        throw err
      }
    },
    async countDocs(userId) {
      return (q.countDocs.get(userId) as { n: number }).n
    },
    async liveDocs(userId, kind) {
      return q.liveDocs.all(userId, kind).map((r) => {
        const row = r as { kind: DocRecord['kind']; id: string; data: string; updated_at: number }
        return { kind: row.kind, id: row.id, data: JSON.parse(row.data), updatedAt: row.updated_at, deleted: false }
      })
    },

    async createToken(t) {
      q.insertToken.run(t.id, t.userId, t.tokenHash, t.purpose, t.expiresAt, JSON.stringify(t))
    },
    async getTokenByHash(hash) {
      const row = q.tokenByHash.get(hash) as { data: string; used_at: number | null } | undefined
      return row ? { ...(JSON.parse(row.data) as TokenRecord), usedAt: row.used_at } : null
    },
    async consumeToken(id, at) {
      return Number(q.consumeToken.run(at, id).changes) === 1
    },
    async deleteUserTokens(userId, purpose) {
      q.deleteUserTokens.run(userId, purpose)
    },

    async createPool(p) {
      q.insertPool.run(p.id, p.inviteCode, JSON.stringify(p))
    },
    async getPool(id) {
      return parse<PoolRecord>(q.poolById.get(id))
    },
    async getPoolByCode(code) {
      return parse<PoolRecord>(q.poolByCode.get(code))
    },
    async updatePool(id, patch) {
      const current = parse<PoolRecord>(q.poolById.get(id))
      if (!current) return
      const next = { ...current, ...patch, id }
      q.savePool.run(next.inviteCode, JSON.stringify(next), id)
    },
    async deletePool(id) {
      q.deletePool.run(id)
    },
    async getMembership(userId) {
      return parse<MemberRecord>(q.memberOf.get(userId))
    },
    async listMembers(poolId) {
      return q.listMembers.all(poolId).map((r) => parse<MemberRecord>(r)!)
    },
    async putMember(m) {
      q.putMember.run(m.userId, m.poolId, m.joinedAt, JSON.stringify(m))
    },
    async deleteMember(userId) {
      q.deleteMember.run(userId)
    },

    async purgeExpiredSessions(now) {
      q.purgeSessions.run(now)
      q.purgeTokens.run(now)
    },
    async close() {
      db.close()
    },
  }
}
