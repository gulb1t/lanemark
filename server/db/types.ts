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
 * account still needs its second factor.
 */
export interface SessionRecord {
  id: string
  userId: string
  tokenHash: string
  kind: 'session' | 'mfa'
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
  /** Removes the user with all of their sessions and documents. */
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
  countDocs(userId: string): Promise<number>

  createToken(token: TokenRecord): Promise<void>
  getTokenByHash(tokenHash: string): Promise<TokenRecord | null>
  /** Marks a token used. Returns false if it was already used, so each link works exactly once. */
  consumeToken(id: string, at: number): Promise<boolean>
  /** Deletes a user's unused tokens for one purpose (a new link replaces the old one). */
  deleteUserTokens(userId: string, purpose: TokenPurpose): Promise<void>

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
