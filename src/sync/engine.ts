import { del, get, set } from 'idb-keyval'
import { create } from 'zustand'
import { api, ApiError, NetworkError } from '../lib/api'
import { useStore, type RemoteDoc } from '../store/useStore'
import type { PersistedData, Swimmer, SwimClass } from '../types'

/**
 * Offline-first sync.
 *
 * Every edit lands in the Zustand store instantly. A store subscription diffs each change by reference (edits are
 * immutable), marks the touched documents as pending, caches everything in IndexedDB and pushes the queue to
 * POST /api/sync in one batch. The same call returns anything changed on other devices since our cursor.
 * Documents edited again while a request is in flight keep their local version, so nothing is ever clobbered.
 */

type Key = `class:${string}` | `swimmer:${string}`
interface Pending {
  op: 'put' | 'delete'
  rev: number
}
interface Cache {
  v: 1
  data: PersistedData
  pending: Record<Key, Pending>
  cursor: number
}

export type SyncStatus = 'local' | 'synced' | 'saving' | 'offline' | 'error'

interface SyncState {
  status: SyncStatus
  pending: number
  lastSyncedAt: number | null
  error: string | null
}

export const useSync = create<SyncState>(() => ({ status: 'local', pending: 0, lastSyncedAt: null, error: null }))

const cacheKey = (userId: string) => `swimtrack:cache:${userId}`
const EMPTY: PersistedData = { swimmers: [], classes: [] }

let userId: string | null = null
let remote = false
let pending: Record<Key, Pending> = {}
let cursor = 0
let rev = 0
let applyingRemote = false
let inflight: Promise<void> | null = null
let flushAgain = false
let flushTimer: ReturnType<typeof setTimeout> | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let retryTimer: ReturnType<typeof setTimeout> | undefined
let retryDelay = 2000
let cleanups: (() => void)[] = []
let onUnauthorized: (() => void) | null = null

const pendingCount = () => Object.keys(pending).length

function setStatus(patch: Partial<SyncState>) {
  useSync.setState({ pending: pendingCount(), ...patch })
}

/** Starts syncing for a user (or a local-only profile such as the demo). Loads the cached copy first. */
export async function startSync(opts: { userId: string; remote: boolean; onUnauthorized?: () => void }) {
  stopSync()
  userId = opts.userId
  remote = opts.remote
  onUnauthorized = opts.onUnauthorized ?? null

  const cache = await readCache(userId)
  pending = cache?.pending ?? {}
  cursor = cache?.cursor ?? 0
  applyingRemote = true
  useStore.getState().hydrate(cache?.data ?? EMPTY)
  applyingRemote = false

  cleanups.push(useStore.subscribe((next, prev) => onLocalChange(next, prev)))

  if (!remote) {
    setStatus({ status: 'local', error: null })
    return
  }
  setStatus({ status: pendingCount() ? 'saving' : 'synced', error: null })

  const kick = () => void flush()
  const onVisible = () => document.visibilityState === 'visible' && kick()
  window.addEventListener('online', kick)
  window.addEventListener('focus', kick)
  document.addEventListener('visibilitychange', onVisible)
  const poll = setInterval(kick, 45_000)
  cleanups.push(() => {
    window.removeEventListener('online', kick)
    window.removeEventListener('focus', kick)
    document.removeEventListener('visibilitychange', onVisible)
    clearInterval(poll)
  })
  await flush()
}

export function stopSync() {
  for (const fn of cleanups) fn()
  cleanups = []
  clearTimeout(flushTimer)
  clearTimeout(retryTimer)
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = undefined
    void writeCache()
  }
  userId = null
  remote = false
}

/** Forgets this device's copy of a user's data (used on sign-out and account deletion). */
export async function clearCache(id: string) {
  try {
    await del(cacheKey(id))
  } catch {
    /* IndexedDB unavailable */
  }
}

export async function hasCache(id: string): Promise<boolean> {
  return Boolean(await readCache(id))
}

export function pendingChanges() {
  return pendingCount()
}

/** Pushes pending changes now and waits for the result. */
export async function syncNow(): Promise<void> {
  if (!remote) return
  clearTimeout(flushTimer)
  await flush()
  if (inflight) await inflight
}

// ── internals ────────────────────────────────────────────────────────

function onLocalChange(next: PersistedData, prev: PersistedData) {
  if (applyingRemote || !userId) return
  diffInto(prev.classes, next.classes, 'class')
  diffInto(prev.swimmers, next.swimmers, 'swimmer')
  setStatus(remote ? { status: 'saving' } : {})
  scheduleSave()
  if (remote) {
    clearTimeout(flushTimer)
    flushTimer = setTimeout(() => void flush(), 600)
  }
}

function diffInto<T extends { id: string }>(prev: T[], next: T[], kind: 'class' | 'swimmer') {
  if (prev === next) return
  const before = new Map(prev.map((d) => [d.id, d]))
  for (const d of next) {
    if (before.get(d.id) !== d) pending[`${kind}:${d.id}`] = { op: 'put', rev: ++rev }
    before.delete(d.id)
  }
  for (const id of before.keys()) pending[`${kind}:${id}`] = { op: 'delete', rev: ++rev }
}

function scheduleSave() {
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = undefined
    void writeCache()
  }, 400)
}

async function readCache(id: string): Promise<Cache | null> {
  try {
    const c = (await get(cacheKey(id))) as Cache | undefined
    return c?.v === 1 ? c : null
  } catch {
    return null
  }
}

async function writeCache() {
  if (!userId) return
  const { swimmers, classes } = useStore.getState()
  const cache: Cache = { v: 1, data: { swimmers, classes }, pending, cursor }
  try {
    await set(cacheKey(userId), cache)
  } catch {
    // IndexedDB can be unavailable (private mode). The server copy is still the source of truth.
  }
}

function flush(): Promise<void> {
  if (!remote) return Promise.resolve()
  if (inflight) {
    flushAgain = true
    return inflight
  }
  inflight = doFlush().finally(() => {
    inflight = null
    if (flushAgain) {
      flushAgain = false
      void flush()
    }
  })
  return inflight
}

async function doFlush() {
  const owner = userId
  const { classes, swimmers } = useStore.getState()
  const sent = Object.entries(pending) as [Key, Pending][]
  const changes = sent.map(([key, p]) => {
    const [kind, id] = splitKey(key)
    const doc = kind === 'class' ? classes.find((c) => c.id === id) : swimmers.find((w) => w.id === id)
    return p.op === 'put' && doc ? { kind, id, op: 'put' as const, data: doc } : { kind, id, op: 'delete' as const }
  })

  try {
    if (changes.length) setStatus({ status: 'saving' })
    const res = await api<{ cursor: number; docs: RemoteDoc[] }>('/sync', 'POST', { cursor, changes })
    if (owner !== userId) return // signed out mid-request
    for (const [key, p] of sent) if (pending[key]?.rev === p.rev) delete pending[key]
    const incoming = res.docs.filter((d) => !pending[`${d.kind}:${d.id}` as Key])
    if (incoming.length) {
      applyingRemote = true
      useStore.getState().applyRemote(incoming)
      applyingRemote = false
    }
    cursor = res.cursor
    retryDelay = 2000
    setStatus({ status: pendingCount() ? 'saving' : 'synced', lastSyncedAt: Date.now(), error: null })
    await writeCache()
  } catch (err) {
    if (owner !== userId) return
    if (err instanceof ApiError && err.status === 401) {
      setStatus({ status: 'offline', error: 'Signed out' })
      onUnauthorized?.()
      return
    }
    const offline = err instanceof NetworkError
    setStatus({ status: offline ? 'offline' : 'error', error: offline ? null : (err as Error).message })
    clearTimeout(retryTimer)
    retryTimer = setTimeout(() => void flush(), retryDelay)
    retryDelay = Math.min(retryDelay * 2, 60_000)
  }
}

function splitKey(key: Key): ['class' | 'swimmer', string] {
  const i = key.indexOf(':')
  return [key.slice(0, i) as 'class' | 'swimmer', key.slice(i + 1)]
}

// ── one-time import of data from the pre-account version ─────────────
const LEGACY_KEY = 'swimtrack:v1'

export function readLegacyData(): PersistedData | null {
  try {
    const raw = localStorage.getItem(LEGACY_KEY)
    if (!raw) return null
    const state = (JSON.parse(raw) as { state?: { swimmers?: Swimmer[]; classes?: SwimClass[] } }).state
    if (!state?.classes?.length && !state?.swimmers?.length) return null
    return { swimmers: state.swimmers ?? [], classes: state.classes ?? [] }
  } catch {
    return null
  }
}

export function forgetLegacyData() {
  try {
    localStorage.removeItem(LEGACY_KEY)
  } catch {
    /* ignore */
  }
}
