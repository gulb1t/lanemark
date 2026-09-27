export interface UserRecord {
  id: string
  /** Lower-cased, trimmed. Unique. */
  email: string
  name: string
  passwordHash: string
  /** AES-GCM encrypted TOTP secret once 2FA is on. */
  totpSecretEnc: string | null
  /** Secret generated during setup, promoted to totpSecretEnc once a code is confirmed. */
  totpPendingEnc: string | null
  /** Last TOTP time step accepted, so a code can't be replayed. */
  totpLastStep: number
  /** sha256 hashes of unused recovery codes. */
  recoveryCodes: string[]
  /** When the address was confirmed through an emailed link. Missing on accounts made before verification existed. */
  emailVerifiedAt?: number | null
  /** Whether "don't ask for a code on this device for 30 days" is offered. Missing means yes. */
  trustDevices?: boolean
  createdAt: number
  updatedAt: number
}

export type TokenPurpose = 'verify-email' | 'reset-password' | 'change-email'

/** Single-use emailed link. Only the sha256 of the token is stored, like sessions. */
export interface TokenRecord {
  id: string
  userId: string
  tokenHash: string
  purpose: TokenPurpose
  /** Address the link was sent to (the new address for email changes). */
  email: string
  createdAt: number
  expiresAt: number
  usedAt: number | null
}

/**
 * Server-side session. `kind: 'mfa'` rows are short-lived tickets issued after a correct password when the
 * account still needs its second factor. `kind: 'trusted'` rows mark a device that may skip the second factor
 * for 30 days; they never grant access on their own.
 */
export interface SessionRecord {
  id: string
  userId: string
  tokenHash: string
  kind: 'session' | 'mfa' | 'trusted'
  /** False for "don't remember me" sign-ins: a browser-session cookie and a short server-side lifetime. */
  persistent?: boolean
  userAgent: string
  ip: string
  createdAt: number
  lastSeenAt: number
  expiresAt: number
  /** Failed second-factor attempts against an mfa ticket. */
  attempts: number
}

export type DocKind = 'class' | 'swimmer'

export interface DocRecord {
  kind: DocKind
  id: string
  /** Null for tombstones. */
  data: unknown
  /** Server-assigned, monotonically increasing per server. Clients pull everything newer than their cursor. */
  updatedAt: number
  deleted: boolean
}

/**
 * A facility's instructor team. Members keep their own classes; supervisors see progress counts for every
 * member's classes (never swimmer names, marks or comments).
 */
export interface PoolRecord {
  id: string
  name: string
  /** What instructors type to join. Unique; replacing it stops the old one working. */
  inviteCode: string
  /** Whether instructors see the leaderboard (names and caught-up scores only). */
  shareLeaderboard: boolean
  createdBy: string
  createdAt: number
  updatedAt: number
}

export type PoolRole = 'supervisor' | 'instructor'

/** A user belongs to at most one pool, so the user id is the key. */
export interface MemberRecord {
  userId: string
  poolId: string
  role: PoolRole
  joinedAt: number
}

export class EmailTakenError extends Error {
  constructor() {
    super('Email already registered')
  }
}

/** Storage contract implemented by both the SQLite and MongoDB backends. */
export interface Repo {
  readonly kind: 'sqlite' | 'mongo'

  createUser(user: UserRecord): Promise<void>
  getUserById(id: string): Promise<UserRecord | null>
  getUserByEmail(email: string): Promise<UserRecord | null>
  /** Throws EmailTakenError when changing the email to one another account uses. */
  updateUser(id: string, patch: Partial<Omit<UserRecord, 'id'>>): Promise<void>
  /** Removes the user with all of their sessions, documents and pool membership. */
  deleteUser(id: string): Promise<void>

  createSession(session: SessionRecord): Promise<void>
  getSessionByTokenHash(tokenHash: string): Promise<SessionRecord | null>
  updateSession(id: string, patch: Partial<Pick<SessionRecord, 'lastSeenAt' | 'expiresAt' | 'attempts'>>): Promise<void>
  deleteSession(id: string): Promise<void>
  /** Deletes a user's sessions, optionally keeping one (the current session). */
  deleteUserSessions(userId: string, keepId?: string): Promise<void>
  listSessions(userId: string, kind: SessionRecord['kind']): Promise<SessionRecord[]>

  /** Documents (including tombstones) changed after `since`, oldest first. */
  listDocs(userId: string, since: number): Promise<DocRecord[]>
  putDocs(userId: string, docs: DocRecord[]): Promise<void>
  /** A user's current documents of one kind, without tombstones. */
  liveDocs(userId: string, kind: DocKind): Promise<DocRecord[]>
  countDocs(userId: string): Promise<number>

  createToken(token: TokenRecord): Promise<void>
  getTokenByHash(tokenHash: string): Promise<TokenRecord | null>
  /** Marks a token used. Returns false if it was already used, so each link works exactly once. */
  consumeToken(id: string, at: number): Promise<boolean>
  /** Deletes a user's unused tokens for one purpose (a new link replaces the old one). */
  deleteUserTokens(userId: string, purpose: TokenPurpose): Promise<void>

  createPool(pool: PoolRecord): Promise<void>
  getPool(id: string): Promise<PoolRecord | null>
  getPoolByCode(inviteCode: string): Promise<PoolRecord | null>
  updatePool(id: string, patch: Partial<Omit<PoolRecord, 'id'>>): Promise<void>
  /** Removes the pool and every membership in it. Members' own classes are untouched. */
  deletePool(id: string): Promise<void>
  getMembership(userId: string): Promise<MemberRecord | null>
  /** Oldest member first. */
  listMembers(poolId: string): Promise<MemberRecord[]>
  /** Adds or replaces the user's membership. */
  putMember(member: MemberRecord): Promise<void>
  deleteMember(userId: string): Promise<void>

  /** Removes expired sessions and emailed tokens. */
  purgeExpiredSessions(now: number): Promise<void>
  close(): Promise<void>
}

/** Strictly increasing millisecond clock, so two writes never share a sync cursor value. */
export function monotonicClock() {
  let last = 0
  return () => {
    last = Math.max(Date.now(), last + 1)
    return last
  }
}
