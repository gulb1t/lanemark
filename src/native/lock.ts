import { create } from 'zustand'
import { Vault, vaultError, type VaultError } from './platform'

/**
 * The phone app's sign-in, kept in the Vault. With "Unlock with fingerprint" on, the saved token can only be read
 * after a fingerprint, face or screen-lock check, so a lost phone doesn't open SwimTrack. The app also locks again
 * after it has been away for a while (the "lock after" setting).
 */

const SESSION = 'session'
/** The trusted-device mark from a two-factor sign-in, so this phone can skip the code for 30 days. */
const TRUST = 'trust'
const PREF = 'swimtrack:app-lock'
const AFTER = 'swimtrack:lock-after'

const PROMPT = { title: 'Unlock SwimTrack', subtitle: 'Use your fingerprint, face or screen lock' }

function read(key: string) {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function write(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, value)
  } catch {
    /* ignore */
  }
}

/** On, off, or not asked yet (null). */
export function lockPref(): boolean | null {
  const v = read(PREF)
  return v === '1' ? true : v === '0' ? false : null
}

/** Minutes away before the app locks again; 0 means only when it starts. */
export const LOCK_AFTER = [1, 5, 30, 0] as const
export type LockAfter = (typeof LOCK_AFTER)[number]
export function lockAfter(): LockAfter {
  const v = Number(read(AFTER))
  return (LOCK_AFTER as readonly number[]).includes(v) && read(AFTER) !== null ? (v as LockAfter) : 5
}
export function setLockAfter(minutes: LockAfter) {
  write(AFTER, String(minutes))
}

interface LockState {
  /** The lock screen is showing. */
  locked: boolean
  /** Why: at start (the session isn't loaded yet) or coming back to the app. */
  reason: 'start' | 'resume'
  /** What the phone offers, filled in once at start. */
  biometrics: 'strong' | 'weak' | 'none'
  screenLock: boolean
  /** Ask "Unlock with your fingerprint next time?" (after the first sign-in on this phone). */
  offer: boolean
}
export const useLock = create<LockState>(() => ({ locked: false, reason: 'start', biometrics: 'none', screenLock: false, offer: false }))

/** Whether the phone can do any kind of unlock check at all. */
export const canLock = () => {
  const { biometrics, screenLock } = useLock.getState()
  return biometrics !== 'none' || screenLock
}

export async function loadCapabilities() {
  try {
    const s = await Vault.status()
    useLock.setState({ biometrics: s.biometrics, screenLock: s.screenLock })
  } catch {
    /* no plugin (tests) */
  }
}

/** Is there a saved sign-in, and does reading it need the check? */
export async function savedSession() {
  try {
    return await Vault.has({ key: SESSION })
  } catch {
    return { exists: false, locked: false }
  }
}

/** Reads the saved token, asking for the check when it's locked. Throws a VaultError code. */
export async function readSession(): Promise<string | null> {
  try {
    return (await Vault.get({ key: SESSION, ...PROMPT })).value
  } catch (err) {
    throw vaultError(err)
  }
}

/**
 * Saves the token. `locked` asks for the check once now; if that's cancelled or impossible, the token is saved
 * without it and fingerprint unlock is switched off. Returns whether it ended up locked.
 */
export async function storeSession(token: string, locked = lockPref() === true): Promise<boolean> {
  if (locked) {
    try {
      await Vault.set({ key: SESSION, value: token, locked: true, title: 'Turn on fingerprint unlock', subtitle: 'Use your fingerprint, face or screen lock' })
      write(PREF, '1')
      return true
    } catch (err) {
      write(PREF, '0')
      await Vault.set({ key: SESSION, value: token })
      if (vaultError(err) !== 'cancelled') throw vaultError(err)
      return false
    }
  }
  await Vault.set({ key: SESSION, value: token })
  return false
}

export async function forgetSession() {
  await Vault.remove({ key: SESSION }).catch(() => undefined)
}

/** Turns fingerprint unlock on or off for the saved token. Turning it off asks for the check first. */
export async function setLockPref(on: boolean, token: string): Promise<{ ok: true } | { ok: false; error: VaultError }> {
  try {
    if (on) {
      const locked = await storeSession(token, true)
      return locked ? { ok: true } : { ok: false, error: 'cancelled' }
    }
    await readSession()
    await Vault.set({ key: SESSION, value: token })
    write(PREF, '0')
    return { ok: true }
  } catch (err) {
    return { ok: false, error: typeof err === 'string' ? (err as VaultError) : vaultError(err) }
  }
}

/** Only asked once, after the first sign-in; "Not now" is remembered. */
export function declineLock() {
  write(PREF, '0')
}

export async function trustMark(): Promise<string | undefined> {
  try {
    return (await Vault.get({ key: TRUST })).value ?? undefined
  } catch {
    return undefined
  }
}
export async function saveTrustMark(mark: string) {
  await Vault.set({ key: TRUST, value: mark }).catch(() => undefined)
}

/** Friendly words for a failed check. */
export function lockMessage(error: VaultError): string {
  switch (error) {
    case 'cancelled':
      return ''
    case 'invalidated':
      return 'The fingerprints or face on this phone changed, so SwimTrack needs your password once.'
    case 'lockout':
      return 'Too many tries. Wait a moment, or sign in with your password.'
    case 'unavailable':
      return 'This phone has no fingerprint, face or screen lock set up. Sign in with your password.'
    default:
      return 'That didn’t work. Try again, or sign in with your password.'
  }
}

// ── locking again after time away ────────────────────────────────────
let awaySince = 0
/** Call when the app goes to the background or comes back. `signedIn` gates it to real sessions. */
export function onAppState(active: boolean, signedIn: boolean) {
  if (!active) {
    awaySince = Date.now()
    return
  }
  const after = lockAfter()
  if (!signedIn || lockPref() !== true || !after || !awaySince) return
  if (Date.now() - awaySince >= after * 60_000) useLock.setState({ locked: true, reason: 'resume' })
  awaySince = 0
}
