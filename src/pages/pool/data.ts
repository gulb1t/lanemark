import { useCallback, useEffect, useMemo, useState } from 'react'
import { api, errorMessage } from '../../lib/api'
import { isoDate } from '../../lib/dates'
import { demoOverview } from '../../lib/demoPool'
import { loadPool, type Overview, type Pool } from '../../store/usePool'
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
  const userId = useUserId()
  const classes = useStore((s) => s.classes)
  const canSee = !demo && (pool.role === 'supervisor' || pool.shareLeaderboard)
  const [remote, setRemote] = useState<{ data: Overview; at: number } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fetchOverview = useCallback(async () => {
    const data = await api<Overview>(`/pool/overview?today=${isoDate()}`)
    setRemote({ data, at: Date.now() })
    setError(null)
  }, [])

  useEffect(() => {
    if (!canSee) return
    let live = true
    api<Overview>(`/pool/overview?today=${isoDate()}`)
      .then((data) => live && (setRemote({ data, at: Date.now() }), setError(null)))
      .catch((err) => live && setError(errorMessage(err)))
    return () => {
      live = false
    }
  }, [canSee, pool.memberCount, pool.role])

  /** The refresh button: the pool itself (team, roles) and its numbers, with a word when it's done. */
  async function reload() {
    if (busy) return
    setBusy(true)
    const started = Date.now()
    try {
      if (!demo && userId) await loadPool(userId)
      if (canSee) await fetchOverview()
      // Long enough to see the spin, so a fast answer still reads as "it did something".
      await new Promise((r) => setTimeout(r, Math.max(0, 500 - (Date.now() - started))))
      toast(demo ? 'The demo pool is always up to date' : 'Pool updated')
    } catch (err) {
      setError(errorMessage(err))
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  const local = useMemo(() => (demo ? demoOverview(pool, classes) : null), [demo, pool, classes])
  return {
    data: local ?? remote?.data ?? null,
    at: remote?.at ?? null,
    error,
    busy,
    reload: () => void reload(),
  }
}
