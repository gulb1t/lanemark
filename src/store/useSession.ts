import { create } from 'zustand'
import { api, ApiError, NetworkError, setAuthToken, type User } from '../lib/api'
import { buildDemoData } from '../lib/demo'
import { canLock, forgetSession, loadCapabilities, lockPref, readSession, saveTrustMark, savedSession, storeSession, trustMark, useLock } from '../native/lock'
import { IS_APP, type VaultError } from '../native/platform'
import { clearCache, hasCache, pendingChanges, startSync, stopSync, syncNow } from '../sync/engine'
import { resetPool } from './usePool'
import { useStore } from './useStore'

type Status = 'loading' | 'signedOut' | 'signedIn' | 'demo'

interface SessionState {
  status: Status
  user: User | null
  /** True when signed in from cache because the server couldn't be reached. */
  offline: boolean
}

export const useSession = create<SessionState>(() => ({ status: 'loading', user: null, offline: false }))

const LAST_USER = 'swimtrack:last-user'
const DEMO_FLAG = 'swimtrack:demo'
const DEMO_ID = 'demo'

const storage = {
  get(key: string) {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(key)
      else localStorage.setItem(key, value)
    } catch {
      /* private mode */
    }
  },
}

/** The phone app's token for this session, in memory while the app runs (and in the Vault between launches). */
let appToken: string | null = null
export const currentAppToken = () => appToken

/** The app got a new session token: use it, save it, and offer fingerprint unlock the first time. */
async function adopt(token: string | undefined) {
  if (!IS_APP || !token) return
  appToken = token
  setAuthToken(token)
  await storeSession(token).catch(() => undefined)
  if (lockPref() === null && canLock()) useLock.setState({ offer: true })
}

async function dropAppToken() {
  if (!IS_APP) return
  appToken = null
  setAuthToken(null)
  await forgetSession()
}

/** The server ended this session (expired, or signed out everywhere). Unsynced edits stay cached for next sign-in. */
export function expire() {
  void dropAppToken()
  stopSync()
  resetPool()
  useStore.getState().hydrate({ swimmers: [], classes: [] })
  useSession.setState({ status: 'signedOut', user: null, offline: false })
}

async function enter(user: User, offline = false) {
  storage.set(LAST_USER, JSON.stringify({ id: user.id, name: user.name, email: user.email }))
  storage.set(DEMO_FLAG, null)
  useSession.setState({ status: 'signedIn', user, offline })
  await startSync({ userId: user.id, remote: true, onUnauthorized: expire })
}

/**
 * Works out who is signed in on app start. Falls back to the cached copy when the server is unreachable. In the phone
 * app the session token comes from the Vault; when fingerprint unlock is on, this stops at the lock screen, which
 * calls unlockAtStart().
 */
export async function bootstrap() {
  if (IS_APP) await loadCapabilities()
  if (storage.get(DEMO_FLAG) === '1') {
    await enterDemo()
    return
  }
  if (IS_APP) {
    const saved = await savedSession()
    if (!saved.exists) return useSession.setState({ status: 'signedOut', user: null })
    if (saved.locked) return useLock.setState({ locked: true, reason: 'start' })
    const token = await readSession().catch(() => null)
    if (!token) return useSession.setState({ status: 'signedOut', user: null })
    appToken = token
    setAuthToken(token)
  }
  await signInFromSaved()
}

/** The lock screen passed its check. At start this loads the session; coming back it just hides the lock. */
export async function unlock(): Promise<VaultError | null> {
  try {
    const token = await readSession()
    if (!token) {
      await switchToPassword()
      return null
    }
    const { reason } = useLock.getState()
    useLock.setState({ locked: false })
    if (reason === 'start') {
      appToken = token
      setAuthToken(token)
      await signInFromSaved()
    }
    return null
  } catch (err) {
    return err as VaultError
  }
}

/** From the lock screen: forget the saved sign-in and go to the password form. */
export async function switchToPassword() {
  const { status } = useSession.getState()
  useLock.setState({ locked: false })
  if (status === 'signedIn') {
    // Coming back to a running app: sign out properly (unsynced edits stay cached for the next sign-in).
    await dropAppToken()
    expire()
  } else {
    await dropAppToken()
    useSession.setState({ status: 'signedOut', user: null, offline: false })
  }
}

async function signInFromSaved() {
  try {
    const { user } = await api<{ user: User }>('/me')
    await enter(user)
  } catch (err) {
    if (err instanceof NetworkError) {
      const last = storage.get(LAST_USER)
      const cached = last ? (JSON.parse(last) as Pick<User, 'id' | 'name' | 'email'>) : null
      if (cached && (await hasCache(cached.id))) {
        await enter({ ...cached, twoFactor: false, recoveryCodesLeft: 0, createdAt: 0 }, true)
        return
      }
    } else if (isAuthError(err)) await dropAppToken()
    useSession.setState({ status: 'signedOut', user: null })
  }
}

export type LoginResult = { twoFactor: true; trustAllowed: boolean } | { twoFactor: false; trustedDevice: boolean }

/** The app's half-finished two-factor sign-in (a browser keeps it in a cookie). */
let mfaTicket: string | undefined

export async function login(email: string, password: string, remember = true): Promise<LoginResult> {
  const trustToken = IS_APP ? await trustMark() : undefined
  const res = await api<{ user?: User; twoFactor?: boolean; trustAllowed?: boolean; trustedDevice?: boolean; token?: string; ticket?: string }>('/auth/login', 'POST', {
    email,
    password,
    remember,
    trustToken,
  })
  if (res.twoFactor) {
    mfaTicket = res.ticket
    return { twoFactor: true, trustAllowed: res.trustAllowed !== false }
  }
  await adopt(res.token)
  await enter(res.user!)
  return { twoFactor: false, trustedDevice: Boolean(res.trustedDevice) }
}

export async function verifyLogin(code: string, trust = false): Promise<{ usedRecoveryCode: boolean }> {
  const res = await api<{ user: User; usedRecoveryCode: boolean; token?: string; trustToken?: string }>('/auth/login/verify', 'POST', { code, trust, ticket: mfaTicket })
  mfaTicket = undefined
  if (res.trustToken) await saveTrustMark(res.trustToken)
  await adopt(res.token)
  await enter(res.user)
  return { usedRecoveryCode: res.usedRecoveryCode }
}

export async function register(name: string, email: string, password: string) {
  const res = await api<{ user: User; token?: string }>('/auth/register', 'POST', { name, email, password })
  await adopt(res.token)
  await enter(res.user)
}

/** Signs out. Pushes unsynced edits first; returns how many would be lost if that fails and `force` is off. */
export async function logout({ force = false } = {}): Promise<{ unsynced: number }> {
  const { status, user } = useSession.getState()
  resetPool()
  if (status === 'demo') {
    stopSync()
    storage.set(DEMO_FLAG, null)
    useStore.getState().hydrate({ swimmers: [], classes: [] })
    useSession.setState({ status: 'signedOut', user: null })
    return { unsynced: 0 }
  }
  await syncNow().catch(() => undefined)
  const unsynced = pendingChanges()
  if (unsynced && !force) return { unsynced }
  await api('/auth/logout', 'POST').catch(() => undefined)
  await dropAppToken()
  stopSync()
  if (user) await clearCache(user.id)
  storage.set(LAST_USER, null)
  useStore.getState().hydrate({ swimmers: [], classes: [] })
  useSession.setState({ status: 'signedOut', user: null, offline: false })
  return { unsynced: 0 }
}

/** Local-only sandbox with sample classes, for trying the app without an account. */
export async function enterDemo() {
  storage.set(DEMO_FLAG, '1')
  const fresh = !(await hasCache(DEMO_ID))
  useSession.setState({
    status: 'demo',
    user: { id: DEMO_ID, email: 'demo@swimtrack.app', name: 'Demo Coach', twoFactor: false, recoveryCodesLeft: 0, createdAt: Date.now() },
    offline: false,
  })
  await startSync({ userId: DEMO_ID, remote: false })
  if (fresh) useStore.getState().importData(buildDemoData())
}

export async function resetDemo() {
  await clearCache(DEMO_ID)
  stopSync()
  await startSync({ userId: DEMO_ID, remote: false })
  useStore.getState().importData(buildDemoData())
}

export function setUser(user: User) {
  useSession.setState({ user })
  storage.set(LAST_USER, JSON.stringify({ id: user.id, name: user.name, email: user.email }))
}

/** Called after the account is deleted server-side. */
export async function forgetAccount() {
  const { user } = useSession.getState()
  await dropAppToken()
  stopSync()
  resetPool()
  if (user) await clearCache(user.id)
  storage.set(LAST_USER, null)
  useStore.getState().hydrate({ swimmers: [], classes: [] })
  useSession.setState({ status: 'signedOut', user: null })
}

export function isAuthError(err: unknown, code?: string) {
  return err instanceof ApiError && (code ? err.code === code : err.status === 401)
}
