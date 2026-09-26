import { describe, expect, it } from 'vitest'
import { hashPassword, passwordProblem, verifyPassword } from '../auth/password.ts'
import { base32Decode, base32Encode, generateRecoveryCodes, hotp, normalizeRecoveryCode, totp, verifyTotp } from '../auth/totp.ts'
import { decrypt, encrypt, sha256 } from '../lib/crypto.ts'

describe('TOTP (RFC 6238 / 4226)', () => {
  const rfcSecret = base32Encode(Buffer.from('12345678901234567890'))

  it('matches the RFC 4226 HOTP vectors', () => {
    const key = Buffer.from('12345678901234567890')
    expect([0, 1, 2, 3, 9].map((n) => hotp(key, n))).toEqual(['755224', '287082', '359152', '969429', '520489'])
  })

  it('matches the RFC 6238 SHA-1 vectors (last 6 digits)', () => {
    expect(totp(rfcSecret, 59_000)).toBe('287082')
    expect(totp(rfcSecret, 1111111109_000)).toBe('081804')
    expect(totp(rfcSecret, 2000000000_000)).toBe('279037')
  })

  it('round-trips base32', () => {
    const buf = Buffer.from([0, 1, 2, 250, 251, 252, 253, 254, 255, 9])
    expect(base32Decode(base32Encode(buf))).toEqual(buf)
  })

  it('accepts ±1 step of drift, rejects replays and junk', () => {
    const t = 1_700_000_000_000
    const code = totp(rfcSecret, t)
    const step = verifyTotp(rfcSecret, code, 0, t)
    expect(step).not.toBeNull()
    expect(verifyTotp(rfcSecret, code, 0, t + 30_000)).toBe(step) // phone slightly behind
    expect(verifyTotp(rfcSecret, code, step!, t)).toBeNull() // replay
    expect(verifyTotp(rfcSecret, code, 0, t + 90_000)).toBeNull() // too old
    expect(verifyTotp(rfcSecret, '12345', 0, t)).toBeNull()
    expect(verifyTotp(rfcSecret, 'abcdef', 0, t)).toBeNull()
  })

  it('makes readable, unique, hashable recovery codes', () => {
    const { codes, hashes } = generateRecoveryCodes()
    expect(codes).toHaveLength(10)
    expect(new Set(codes).size).toBe(10)
    for (const c of codes) expect(c).toMatch(/^[a-z2-9]{5}-[a-z2-9]{5}$/)
    expect(hashes[0]).toBe(sha256(normalizeRecoveryCode(codes[0].toUpperCase().replace('-', ' '))))
  })
})

describe('passwords', () => {
  it('hashes with a random salt and verifies', async () => {
    const a = await hashPassword('correct horse battery')
    const b = await hashPassword('correct horse battery')
    expect(a).not.toBe(b)
    expect(a).toMatch(/^scrypt\$32768\$8\$3\$/)
    expect(await verifyPassword('correct horse battery', a)).toBe(true)
    expect(await verifyPassword('correct horse batterx', a)).toBe(false)
    expect(await verifyPassword('anything', 'garbage')).toBe(false)
  })

  it('rejects weak passwords with a reason', () => {
    expect(passwordProblem('short')).toMatch(/at least 10/)
    expect(passwordProblem('password123')).toMatch(/common/)
    expect(passwordProblem('aaaaaaaaaaaa')).toMatch(/repeat/)
    expect(passwordProblem('ababababab')).toMatch(/wider mix/)
    expect(passwordProblem('casey.coach!2026', { email: 'casey.coach@example.com' })).toMatch(/email/)
    expect(passwordProblem('Tangerine-Lanes-42')).toBeNull()
  })
})

describe('secret encryption', () => {
  it('round-trips and detects tampering', () => {
    const key = Buffer.alloc(32, 1)
    const enc = encrypt(key, 'JBSWY3DPEHPK3PXP')
    expect(enc).not.toContain('JBSWY3DPEHPK3PXP')
    expect(decrypt(key, enc)).toBe('JBSWY3DPEHPK3PXP')
    const parts = enc.split('.')
    parts[3] = parts[3].slice(0, -2) + (parts[3].endsWith('A') ? 'BB' : 'AA')
    expect(() => decrypt(key, parts.join('.'))).toThrow()
    expect(() => decrypt(Buffer.alloc(32, 2), enc)).toThrow()
  })
})
