import { registerPlugin } from '@capacitor/core'

/**
 * True in the Android app's build (`npm run app:build`), false on the website. A build-time constant, so the web
 * bundle drops the app-only code paths entirely.
 */
export const IS_APP = import.meta.env.VITE_APP === '1'

/** The public website, for links people share (invites) or open elsewhere. In the app, pages live on the phone. */
export const SITE_URL = IS_APP ? (import.meta.env.VITE_API_URL as string) : typeof location === 'undefined' ? '' : location.origin

export type VaultError = 'cancelled' | 'invalidated' | 'unavailable' | 'lockout' | 'failed'

/**
 * Small native plugin (android/app/src/main/java/.../VaultPlugin.java). Keeps short secrets encrypted with a key in
 * the phone's secure hardware. A `locked` value can only be read after a fingerprint, face or screen-lock check.
 */
export interface VaultPlugin {
  /** What this phone can do: strong biometrics (fingerprint, some faces), weak only (most face unlock), or none. */
  status(): Promise<{ biometrics: 'strong' | 'weak' | 'none'; screenLock: boolean }>
  has(o: { key: string }): Promise<{ exists: boolean; locked: boolean }>
  /** A locked value asks for the check once while it is saved. Rejects with a VaultError code. */
  set(o: { key: string; value: string; locked?: boolean; title?: string; subtitle?: string }): Promise<void>
  get(o: { key: string; title?: string; subtitle?: string }): Promise<{ value: string | null }>
  remove(o: { key: string }): Promise<void>
}
export const Vault = registerPlugin<VaultPlugin>('Vault')

/** Small native plugin (DevicePlugin.java) for what the web view can't do on its own. */
export interface DevicePlugin {
  /** Prints the current page with Android's print dialog (which can also save a PDF). Resolves when it closes. */
  print(o: { name: string }): Promise<void>
  /** Keeps the screen on while Lanemark is open (attendance on deck). */
  keepAwake(o: { on: boolean }): Promise<void>
}
export const Device = registerPlugin<DevicePlugin>('Device')

/** The error code a Vault call failed with. */
export function vaultError(err: unknown): VaultError {
  const code = (err as { code?: string } | null)?.code
  return code === 'cancelled' || code === 'invalidated' || code === 'unavailable' || code === 'lockout' ? code : 'failed'
}
