import { create } from 'zustand'

/** Guided tours that have been finished or skipped, remembered per browser. */
const PREFIX = 'lanemark:tour:'

/** Bumped when tours are reset, so mounted tours check again. */
export const useTourVersion = create<{ version: number }>(() => ({ version: 0 }))

export function tourSeen(id: string): boolean {
  try {
    return localStorage.getItem(PREFIX + id) === '1' || localStorage.getItem(PREFIX + 'all') === '1'
  } catch {
    // Without storage the tour would reappear on every visit, which is worse than never.
    return true
  }
}

export function markTourSeen(id: string) {
  try {
    localStorage.setItem(PREFIX + id, '1')
  } catch {
    /* private mode */
  }
}

/** Shows every tour again, from the start. */
export function restartTours() {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith(PREFIX)) localStorage.removeItem(key)
  } catch {
    /* private mode */
  }
  useTourVersion.setState((s) => ({ version: s.version + 1 }))
}
