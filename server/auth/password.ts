import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto'

/**
 * scrypt with OWASP's recommended 32 MiB profile (N=2^15, r=8, p=3). The parameters are stored with the hash
 * so they can be raised later without breaking existing accounts.
 */
const PARAMS = { N: 2 ** 15, r: 8, p: 3 }
const KEYLEN = 32
const MAXMEM = 96 * 1024 * 1024

function derive(password: string, salt: Buffer, opts: ScryptOptions): Promise<Buffer> {
  return new Promise((resolve, reject) =>
    scrypt(password.normalize('NFKC'), salt, KEYLEN, { ...opts, maxmem: MAXMEM }, (err, key) => (err ? reject(err) : resolve(key))),
  )
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16)
  const key = await derive(password, salt, PARAMS)
  return ['scrypt', PARAMS.N, PARAMS.r, PARAMS.p, salt.toString('base64url'), key.toString('base64url')].join('$')
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [alg, n, r, p, salt, hash] = stored.split('$')
  if (alg !== 'scrypt' || !salt || !hash) return false
  const expected = Buffer.from(hash, 'base64url')
  const key = await derive(password, Buffer.from(salt, 'base64url'), { N: Number(n), r: Number(r), p: Number(p) })
  return key.length === expected.length && timingSafeEqual(key, expected)
}

let dummy: Promise<string> | undefined
/** Burns the same time as a real check so unknown emails can't be detected by response time. */
export async function fakeVerify(password: string): Promise<false> {
  dummy ??= hashPassword(randomBytes(12).toString('hex'))
  await verifyPassword(password, await dummy)
  return false
}

export { PASSWORD_MAX, PASSWORD_MIN, passwordProblem } from '../../src/lib/passwordPolicy.ts'
