/**
 * Thin JSON client for the SwimTrack API. The web app talks to its own origin; a native build can point
 * VITE_API_URL at the deployed server instead.
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

/** The request never reached the server (offline, DNS, server down). */
export class NetworkError extends Error {
  constructor() {
    super('You’re offline. Changes are saved on this device and will sync when you’re back online.')
  }
}

export interface User {
  id: string
  email: string
  name: string
  /** Absent on a user restored from the offline cache. */
  emailVerified?: boolean
  twoFactor: boolean
  recoveryCodesLeft: number
  createdAt: number
}

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE'

export async function api<T>(path: string, method: Method = 'GET', body?: unknown, signal?: AbortSignal): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, {
      method,
      credentials: BASE ? 'include' : 'same-origin',
      headers: method === 'GET' ? { accept: 'application/json' } : { 'content-type': 'application/json', accept: 'application/json' },
      body: method === 'GET' ? undefined : JSON.stringify(body ?? {}),
      signal,
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') throw err
    throw new NetworkError()
  }
  const json = (await res.json().catch(() => null)) as { error?: { code: string; message: string } } | null
  if (!res.ok) {
    // A proxy with the API down answers 502/503/504: treat it like being offline.
    if (res.status >= 502 && res.status <= 504) throw new NetworkError()
    throw new ApiError(res.status, json?.error?.code ?? 'error', json?.error?.message ?? `Request failed (${res.status}).`)
  }
  return json as T
}

export function errorMessage(err: unknown): string {
  if (err instanceof ApiError || err instanceof NetworkError) return err.message
  return 'Something went wrong. Please try again.'
}
