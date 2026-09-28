import { create } from 'zustand'

/**
 * "Display size" in Settings → Appearance: scales the whole app (text, buttons, spacing) with CSS zoom, like a phone's
 * own display size setting. Viewport heights and positions from JS scale with it, so sheets divide by --ui-zoom and
 * popovers and tours divide by uiZoom().
 */
export const TEXT_SIZES = [
  { id: 'default', label: 'Default', step: 0 },
  { id: 'large', label: 'Large', step: 1 },
  { id: 'larger', label: 'Larger', step: 2 },
  { id: 'largest', label: 'Largest', step: 3 },
] as const
export type TextSize = (typeof TEXT_SIZES)[number]['id']

const KEY = 'lanemark:text-size'

function stored(): TextSize {
  try {
    const v = localStorage.getItem(KEY)
    // 'small' was the old smallest size, which is now the default.
    return TEXT_SIZES.some((s) => s.id === v) ? (v as TextSize) : 'default'
  } catch {
    return 'default'
  }
}

export const useTextSize = create<{ size: TextSize }>(() => ({ size: stored() }))

/**
 * CSS zoom as Lanemark uses it (sizes and positions scale together) arrived in Chrome 128. Older WebViews (Android 7
 * phones stop at Chrome 119) zoom differently and would misplace menus, so there the app stays at its normal size.
 */
export function zoomWorks(): boolean {
  return typeof Element !== 'undefined' && 'currentCSSZoom' in Element.prototype
}

/**
 * The app's current zoom factor. Phones start a notch smaller than the design (0.9), so more fits on screen; computers
 * start at 1. Each size up adds 10%.
 */
export function uiZoom(): number {
  if (!zoomWorks()) return 1
  const base = matchMedia('(max-width: 767px)').matches ? 0.9 : 1
  const step = TEXT_SIZES.find((s) => s.id === useTextSize.getState().size)?.step ?? 0
  return Math.round((base + step * 0.1) * 100) / 100
}

function apply() {
  const z = uiZoom()
  const root = document.documentElement
  root.style.zoom = z === 1 ? '' : String(z)
  root.style.setProperty('--ui-zoom', String(z))
}

export function initTextSize() {
  apply()
  // Turning a tablet, or resizing a window across the phone width, changes the starting size.
  matchMedia('(max-width: 767px)').addEventListener('change', apply)
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
