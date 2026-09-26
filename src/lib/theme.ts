import { flushSync } from 'react-dom'
import { create } from 'zustand'

export type ThemePref = 'system' | 'dark' | 'light'
type Resolved = 'dark' | 'light'

const KEY = 'swimtrack:theme'
const media = () => window.matchMedia('(prefers-color-scheme: light)')

function readPref(): ThemePref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'dark' || v === 'light' ? v : 'system'
  } catch {
    return 'system'
  }
}

const resolve = (pref: ThemePref): Resolved => (pref === 'system' ? (media().matches ? 'light' : 'dark') : pref)

function apply(theme: Resolved) {
  document.documentElement.dataset.theme = theme
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#060709' : '#f5f6f8')
}

export const useTheme = create<{ pref: ThemePref; resolved: Resolved }>(() => {
  const pref = typeof window === 'undefined' ? 'system' : readPref()
  return { pref, resolved: typeof window === 'undefined' ? 'dark' : resolve(pref) }
})

/** Keeps "system" in sync with the OS setting, and every open tab in sync with each other. Call once at startup. */
export function initTheme() {
  apply(useTheme.getState().resolved)
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY && e.key !== null) return
    const pref = readPref()
    const resolved = resolve(pref)
    useTheme.setState({ pref, resolved })
    apply(resolved)
  })
  media().addEventListener('change', () => {
    const { pref } = useTheme.getState()
    if (pref !== 'system') return
    const resolved = resolve(pref)
    useTheme.setState({ resolved })
    apply(resolved)
  })
}

/**
 * Switches theme. When the browser supports View Transitions, the new theme is revealed as a circle expanding from
 * `origin` (usually the toggle button).
 */
export function setTheme(pref: ThemePref, origin?: { x: number; y: number }) {
  try {
    localStorage.setItem(KEY, pref)
  } catch {
    /* ignore */
  }
  const resolved = resolve(pref)
  const change = () => {
    useTheme.setState({ pref, resolved })
    apply(resolved)
  }
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  if (!document.startViewTransition || reduce || resolved === useTheme.getState().resolved) {
    change()
    return
  }
  const x = origin?.x ?? window.innerWidth / 2
  const y = origin?.y ?? 0
  const radius = Math.hypot(Math.max(x, window.innerWidth - x), Math.max(y, window.innerHeight - y))
  const transition = document.startViewTransition(() => flushSync(change))
  transition.ready
    .then(() =>
      document.documentElement.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${radius}px at ${x}px ${y}px)`] },
        { duration: 700, easing: 'cubic-bezier(0.16, 1, 0.3, 1)', pseudoElement: '::view-transition-new(root)' },
      ),
    )
    .catch(() => undefined)
}

export function toggleTheme(origin?: { x: number; y: number }) {
  setTheme(useTheme.getState().resolved === 'dark' ? 'light' : 'dark', origin)
}
