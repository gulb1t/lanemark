import { useEffect } from 'react'
import { Device, IS_APP } from './platform'

const KEY = 'swimtrack:keep-awake'

/** On unless turned off in Settings → This phone. */
export function keepAwakePref(): boolean {
  try {
    return localStorage.getItem(KEY) !== '0'
  } catch {
    return true
  }
}
export function setKeepAwakePref(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? '1' : '0')
  } catch {
    /* ignore */
  }
}

/** Keeps the phone's screen on while `active` (the attendance screen is open), so it doesn't dim mid-roll-call. */
export function useKeepAwake(active: boolean) {
  useEffect(() => {
    if (!IS_APP || !active || !keepAwakePref()) return
    void Device.keepAwake({ on: true }).catch(() => undefined)
    return () => void Device.keepAwake({ on: false }).catch(() => undefined)
  }, [active])
}
