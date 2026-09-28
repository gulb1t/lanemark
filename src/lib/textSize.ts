import { create } from 'zustand'

/**
 * "Display size" in Settings → Appearance: scales the whole app (text, buttons, spacing) with CSS zoom, like a phone's
 * own display size setting. Viewport heights and positions from JS scale with it, so sheets divide by --ui-zoom and
 * popovers and tours divide by uiZoom().
 */
export const TEXT_SIZES = [
  { id: 'small', label: 'Smaller', zoom: 0.9 },
  { id: 'default', label: 'Default', zoom: 1 },
  { id: 'large', label: 'Larger', zoom: 1.1 },
  { id: 'largest', label: 'Largest', zoom: 1.2 },
] as const
export type TextSize = (typeof TEXT_SIZES)[number]['id']

const KEY = 'swimtrack:text-size'

function stored(): TextSize {
  try {
    const v = localStorage.getItem(KEY)
    return TEXT_SIZES.some((s) => s.id === v) ? (v as TextSize) : 'default'
  } catch {
    return 'default'
  }
}

export const useTextSize = create<{ size: TextSize }>(() => ({ size: stored() }))

/** The app's current zoom factor (1 at the default size). */
export function uiZoom(): number {
  return TEXT_SIZES.find((s) => s.id === useTextSize.getState().size)?.zoom ?? 1
}

function apply() {
  const z = uiZoom()
  const root = document.documentElement
  root.style.zoom = z === 1 ? '' : String(z)
  root.style.setProperty('--ui-zoom', String(z))
}

export function initTextSize() {
  apply()
}

export function setTextSize(size: TextSize) {
  try {
    localStorage.setItem(KEY, size)
  } catch {
    /* private mode: this visit only */
  }
  useTextSize.setState({ size })
  apply()
}
