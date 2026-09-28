import { create } from 'zustand'
import { api, NetworkError } from '../lib/api'
import type { ClassProgress } from '../lib/overview'

export type PoolRole = 'supervisor' | 'instructor'

export interface PoolMember {
  id: string
  name: string
  /** Only supervisors see addresses. */
  email?: string
  role: PoolRole
  joinedAt: number
  you: boolean
}

export interface Pool {
  id: string
  name: string
  role: PoolRole
  shareLeaderboard: boolean
  createdAt: number
  /** Only supervisors see the code. */
  inviteCode?: string
  memberCount: number
  /** Supervisors see everyone; instructors see the supervisors and themselves. */
  members: PoolMember[]
}

export interface InstructorProgress {
  id: string
  name: string
  role: PoolRole
  you: boolean
  classes: ClassProgress[]
}

export interface LeaderboardRow {
  id: string
  name: string
  you: boolean
  classes: number
  caughtUp: number | null
}

export type Overview = { today: string; instructors: InstructorProgress[] } | { today: string; leaderboard: LeaderboardRow[] }

interface PoolState {
  pool: Pool | null
  /** 'ready' once the server (or the offline copy) has answered for this account. */
  status: 'idle' | 'ready'
}

export const usePool = create<PoolState>(() => ({ pool: null, status: 'idle' }))

const cacheKey = (userId: string) => `lanemark:pool:${userId}`

/** Fetches the account's pool. Offline, the last copy seen on this device keeps the Pool tab where it was. */
export async function loadPool(userId: string) {
  try {
    const { pool } = await api<{ pool: Pool | null }>('/pool')
    setPool(pool, userId)
  } catch (err) {
    if (!(err instanceof NetworkError)) throw err
    let cached: Pool | null = null
    try {
      cached = JSON.parse(localStorage.getItem(cacheKey(userId)) ?? 'null') as Pool | null
    } catch {
      /* private mode or a damaged copy */
    }
    usePool.setState({ pool: cached, status: 'ready' })
  }
}

export function setPool(pool: Pool | null, userId?: string) {
  usePool.setState({ pool, status: 'ready' })
  if (!userId) return
  try {
    if (pool) localStorage.setItem(cacheKey(userId), JSON.stringify(pool))
    else localStorage.removeItem(cacheKey(userId))
  } catch {
    /* private mode */
  }
}

export function resetPool() {
  usePool.setState({ pool: null, status: 'idle' })
}

/** ABCD2345 → ABCD-2345 */
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`
