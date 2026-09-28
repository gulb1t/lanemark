import { create } from 'zustand'

/**
 * "Lite effects": the same app without the costly drawing (frosted-glass blurs, background glows, glow shadows, most
 * animation). Budget phones can't draw those smoothly, so Auto turns lite on for weaker devices; Settings → Appearance
 * can force either way. Lite also counts as reduced motion everywhere the app checks for it.
 */
export type EffectsPref = 'auto' | 'full' | 'lite'

const KEY = 'lanemark:effects'

/** 4 or fewer CPU cores, or 4 GB of memory or less (Chrome rounds and caps what it reports). */
export function weakDevice(): boolean {
  const n = navigator as Navigator & { deviceMemory?: number }
  return (n.hardwareConcurrency ?? 8) <= 4 || (n.deviceMemory ?? 8) <= 4
}

function storedPref(): EffectsPref {
  try {
    const v = localStorage.getItem(KEY)
    return v === 'full' || v === 'lite' ? v : 'auto'
  } catch {
    return 'auto'
  }
}

const resolveLite = (pref: EffectsPref) => (pref === 'auto' ? weakDevice() : pref === 'lite')

export const useEffectsPref = create<{ pref: EffectsPref; lite: boolean }>(() => {
  const pref = storedPref()
  return { pref, lite: resolveLite(pref) }
})

function apply() {
  document.documentElement.classList.toggle('lite', useEffectsPref.getState().lite)
}

export function initEffects() {
  apply()
}

export function setEffectsPref(pref: EffectsPref) {
  try {
    if (pref === 'auto') localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, pref)
  } catch {
    /* this visit only */
  }
  useEffectsPref.setState({ pref, lite: resolveLite(pref) })
  apply()
}

/** For code outside React: the system's reduced-motion setting, or lite effects. */
export function lessMotion(): boolean {
  return useEffectsPref.getState().lite || window.matchMedia('(prefers-reduced-motion: reduce)').matches
}
