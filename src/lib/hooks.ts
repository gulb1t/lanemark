import { useEffect, useState, useSyncExternalStore } from 'react'

/** One delegated listener feeds --mx/--my to whichever .spotlight element is under the pointer. */
export function useSpotlight() {
  useEffect(() => {
    let frame = 0
    let last: PointerEvent | null = null
    const run = () => {
      frame = 0
      const e = last
      if (!e) return
      const el = (e.target as Element | null)?.closest?.('.spotlight') as HTMLElement | null
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${e.clientX - r.left}px`)
      el.style.setProperty('--my', `${e.clientY - r.top}px`)
    }
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return
      last = e
      if (!frame) frame = requestAnimationFrame(run)
    }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => {
      document.removeEventListener('pointermove', onMove)
      cancelAnimationFrame(frame)
    }
  }, [])
}

export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    (cb) => {
      const m = window.matchMedia(query)
      m.addEventListener('change', cb)
      return () => m.removeEventListener('change', cb)
    },
    () => window.matchMedia(query).matches,
    () => false,
  )
}

export const useIsMobile = () => useMediaQuery('(max-width: 639px)')
/** Below this width the app uses the phone layout: top bar plus bottom tabs. */
export const usePhoneLayout = () => useMediaQuery('(max-width: 767px)')
export const useReducedMotion = () => useMediaQuery('(prefers-reduced-motion: reduce)')

export function useOnline(): boolean {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener('online', cb)
      window.addEventListener('offline', cb)
      return () => {
        window.removeEventListener('online', cb)
        window.removeEventListener('offline', cb)
      }
    },
    () => navigator.onLine,
    () => true,
  )
}

/** Re-renders every `ms` so relative times ("2 min ago") stay fresh. */
export function useNow(ms = 30_000): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}

export function timeAgo(t: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - t) / 1000))
  if (s < 45) return 'just now'
  const m = Math.round(s / 60)
  if (m < 60) return `${m} min ago`
  const h = Math.round(m / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 30) return `${d} day${d === 1 ? '' : 's'} ago`
  return new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

/** True for platforms that label the command key ⌘. */
export const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform)
