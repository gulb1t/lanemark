import { useEffect, useMemo, useState } from 'react'
import { api, errorMessage } from '../../lib/api'
import { isoDate } from '../../lib/dates'
import { demoOverview } from '../../lib/demoPool'
import type { Overview, Pool } from '../../store/usePool'
import { useSession } from '../../store/useSession'
import { useStore } from '../../store/useStore'
import { toast } from '../../store/useUi'

/** Runs a pool request, shows its error as a toast, and returns null when it failed. */
export async function attempt<T>(fn: () => Promise<T>): Promise<T | null> {
  try {
    return await fn()
  } catch (err) {
    toast(errorMessage(err), 'error')
    return null
  }
}

/** Your own classes open as usual; anyone else's open in the supervisor's view-only page. */
export const classLink = (memberId: string, you: boolean, classId: string) => (you ? `/app/classes/${classId}` : `/app/pool/${memberId}/classes/${classId}`)

export function useDemo() {
  return useSession((s) => s.status === 'demo')
}

export function useUserId() {
  return useSession((s) => s.user?.id)
}

/**
 * The page's numbers: fetched for a real pool (again on `reload`, or when the team changes), generated in the
 * browser for the demo's. `at` is when the server answered; the demo's numbers are always current.
 */
export function useOverview(pool: Pool) {
  const demo = useDemo()
  const classes = useStore((s) => s.classes)
  const canSee = !demo && (pool.role === 'supervisor' || pool.shareLeaderboard)
  const [tick, setTick] = useState(0)
  const [remote, setRemote] = useState<{ data: Overview; at: number; tick: number } | null>(null)
  const [error, setError] = useState<{ message: string; tick: number } | null>(null)

  useEffect(() => {
    if (!canSee) return
    let live = true
    api<Overview>(`/pool/overview?today=${isoDate()}`)
      .then((data) => {
        if (!live) return
        setRemote({ data, at: Date.now(), tick })
        setError(null)
      })
      .catch((err) => live && setError({ message: errorMessage(err), tick }))
    return () => {
      live = false
    }
  }, [canSee, tick, pool.memberCount, pool.role])

  const local = useMemo(() => (demo ? demoOverview(pool, classes) : null), [demo, pool, classes])
  return {
    data: local ?? remote?.data ?? null,
    at: remote?.at ?? null,
    error: error?.message ?? null,
    busy: canSee && remote?.tick !== tick && error?.tick !== tick,
    reload: () => setTick((t) => t + 1),
  }
}
