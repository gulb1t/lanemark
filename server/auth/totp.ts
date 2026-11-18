import { createHmac, randomBytes, randomInt } from 'node:crypto'
import { sha256 } from '../lib/crypto.ts'

/** RFC 6238 TOTP (SHA-1, 6 digits, 30 s), compatible with Google Authenticator, 1Password, Authy, etc. */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
export const STEP_SECONDS = 30
const DIGITS = 6

export function base32Encode(buf: Buffer): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(input: string): Buffer {
  const clean = input.toUpperCase().replace(/[\s=-]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch)
    if (idx === -1) throw new Error('Invalid base32')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return Buffer.from(out)
}

export function generateSecret(): string {
  return base32Encode(randomBytes(20))
}

export function hotp(key: Buffer, counter: number, digits = DIGITS): string {
  const msg = Buffer.alloc(8)
  msg.writeBigUInt64BE(BigInt(counter))
  const mac = createHmac('sha1', key).update(msg).digest()
  const offset = mac[mac.length - 1] & 0xf
  const bin = ((mac[offset] & 0x7f) << 24) | (mac[offset + 1] << 16) | (mac[offset + 2] << 8) | mac[offset + 3]
  return String(bin % 10 ** digits).padStart(digits, '0')
}

export const stepAt = (ms: number) => Math.floor(ms / 1000 / STEP_SECONDS)

export function totp(secret: string, ms = Date.now()): string {
  return hotp(base32Decode(secret), stepAt(ms))
}

/**
 * Checks a code against the current step ±1 (clock drift). Returns the matching step, or null.
 * Steps at or before `lastUsedStep` are rejected so a code can never be replayed.
 */
export function verifyTotp(secret: string, code: string, lastUsedStep: number, ms = Date.now()): number | null {
  const clean = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(clean)) return null
  const key = base32Decode(secret)
  const now = stepAt(ms)
  for (const step of [now, now - 1, now + 1]) {
    if (step <= lastUsedStep) continue
    if (hotp(key, step) === clean) return step
  }
  return null
}

export function otpauthUrl(secret: string, account: string, issuer = 'Lanemark'): string {
  const label = `${encodeURIComponent(issuer)}:${encodeURIComponent(account)}`
  const params = new URLSearchParams({ secret, issuer, algorithm: 'SHA1', digits: String(DIGITS), period: String(STEP_SECONDS) })
  return `otpauth://totp/${label}?${params}`
}

// Recovery codes
const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789' // no look-alikes (0/o, 1/l/i)

export function normalizeRecoveryCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Ten single-use codes like "k7m2p-x9qd4". Returns the plain codes (show once) and their hashes (store). */
export function generateRecoveryCodes(count = 10): { codes: string[]; hashes: string[] } {
  const codes = Array.from({ length: count }, () => {
    const raw = Array.from({ length: 10 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join('')
    return `${raw.slice(0, 5)}-${raw.slice(5)}`
  })
  return { codes, hashes: codes.map((c) => sha256(normalizeRecoveryCode(c))) }
}
