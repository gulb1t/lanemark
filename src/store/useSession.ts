import { create } from 'zustand'
import { api, ApiError, NetworkError, type User } from '../lib/api'
import { buildDemoData } from '../lib/demo'
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

/** The server ended this session (expired, or signed out everywhere). Unsynced edits stay cached for next sign-in. */
export function expire() {
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

/** Works out who is signed in on app start. Falls back to the cached copy when the server is unreachable. */
export async function bootstrap() {
  if (storage.get(DEMO_FLAG) === '1') {
    await enterDemo()
    return
  }
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
    }
    useSession.setState({ status: 'signedOut', user: null })
  }
}

export type LoginResult = { twoFactor: true; trustAllowed: boolean } | { twoFactor: false; trustedDevice: boolean }

export async function login(email: string, password: string, remember = true): Promise<LoginResult> {
  const res = await api<{ user?: User; twoFactor?: boolean; trustAllowed?: boolean; trustedDevice?: boolean }>('/auth/login', 'POST', { email, password, remember })
  if (res.twoFactor) return { twoFactor: true, trustAllowed: res.trustAllowed !== false }
  await enter(res.user!)
  return { twoFactor: false, trustedDevice: Boolean(res.trustedDevice) }
}

export async function verifyLogin(code: string, trust = false): Promise<{ usedRecoveryCode: boolean }> {
  const res = await api<{ user: User; usedRecoveryCode: boolean }>('/auth/login/verify', 'POST', { code, trust })
  await enter(res.user)
  return { usedRecoveryCode: res.usedRecoveryCode }
}

export async function register(name: string, email: string, password: string) {
  const res = await api<{ user: User }>('/auth/register', 'POST', { name, email, password })
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
