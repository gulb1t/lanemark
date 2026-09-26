/**
 * Password rules shared by the signup form and the server, so the UI can explain problems before submitting.
 * Imported by server/auth/password.ts: keep this file dependency-free.
 */

const COMMON = new Set([
  'password12', 'password123', 'password1234', 'passw0rd123', '1234567890', '12345678910', '0123456789', '1111111111',
  '0987654321', 'qwertyuiop', 'qwerty1234', 'qwerty12345', 'asdfghjkl1', 'iloveyou12', 'iloveyou123', 'football12',
  'baseball12', 'welcome123', 'letmein123', 'abcdefghij', 'abc1234567', 'administrator', 'trustno1234', 'superman12',
  'sunshine12', 'princess12', 'swimming12', 'swimming123', 'swimmer123', 'lifeguard1', 'lifeguard123', 'changeme123',
  'monkey12345', 'dragon12345', 'master12345', 'starwars123', 'whatever12', 'computer12', 'internet12', 'q1w2e3r4t5',
  '1q2w3e4r5t', 'zaq12wsxcde', 'passwordpassword', 'aaaaaaaaaa',
])

export const PASSWORD_MIN = 10
export const PASSWORD_MAX = 200

/** Returns a human-readable reason the password is too weak, or null when it is acceptable. */
export function passwordProblem(password: string, context: { email?: string; name?: string } = {}): string | null {
  if (password.length < PASSWORD_MIN) return `Use at least ${PASSWORD_MIN} characters.`
  if (password.length > PASSWORD_MAX) return `Use at most ${PASSWORD_MAX} characters.`
  const lower = password.toLowerCase()
  if (COMMON.has(lower)) return 'That password is too common.'
  if (/^(.)\1+$/.test(password)) return 'Avoid repeating a single character.'
  if (new Set(lower).size < 4) return 'Use a wider mix of characters.'
  const local = context.email?.split('@')[0]?.toLowerCase()
  if (local && local.length >= 4 && lower.includes(local)) return 'Don’t include your email address in your password.'
  const first = context.name?.trim().split(/\s+/)[0]?.toLowerCase()
  if (first && first.length >= 4 && lower.startsWith(first) && lower.length - first.length < 6) {
    return 'Don’t base your password on your name.'
  }
  return null
}

/** 0–4 strength estimate for the meter. Only guidance: the server enforces passwordProblem. */
export function passwordStrength(password: string): 0 | 1 | 2 | 3 | 4 {
  if (!password) return 0
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(password)).length
  const unique = new Set(password.toLowerCase()).size
  let score = 0
  if (password.length >= PASSWORD_MIN) score++
  if (password.length >= 14) score++
  if (classes >= 3 || password.includes(' ')) score++
  if (password.length >= 18 && unique >= 8) score++
  if (unique < 4 || COMMON.has(password.toLowerCase())) score = Math.min(score, 1)
  return Math.max(password.length >= 6 ? 1 : 0, score) as 0 | 1 | 2 | 3 | 4
}
