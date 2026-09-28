import { z } from 'zod'
import { PASSWORD_MAX } from './auth/password.ts'

const Id = z.string().min(1).max(80).regex(/^[\w.-]+$/, 'Invalid id')
const text = (max: number) => z.string().max(max)
const boundedRecord = <T extends z.ZodType>(value: T, max: number) =>
  z.record(z.string().max(80), value).refine((r) => Object.keys(r).length <= max, `At most ${max} entries`)

// ── Auth ────────────────────────────────────────────────────────────
export const Email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254)
  .pipe(z.email('Enter a valid email address.'))

export const RegisterBody = z.object({
  name: z.string().trim().min(1, 'Enter your name.').max(80),
  email: Email,
  password: z.string().max(PASSWORD_MAX),
})

/** A token the server handed the phone app (which keeps them itself, where a browser would keep a cookie). */
const AppToken = z.string().regex(/^[\w-]{20,100}$/)
export const LoginBody = z.object({
  email: Email,
  password: z.string().min(1).max(PASSWORD_MAX),
  remember: z.boolean().optional(),
  /** The app's trusted-device mark, if it has one. */
  trustToken: AppToken.optional(),
})
export const CodeBody = z.object({ code: z.string().trim().min(6).max(20) })
/** `ticket` is the app's half-finished sign-in (browsers carry it in a cookie). */
export const VerifyLoginBody = CodeBody.extend({ trust: z.boolean().optional(), ticket: AppToken.optional() })
export const SecurityPrefsBody = z.object({ trustDevices: z.boolean() })
export const PasswordBody = z.object({ password: z.string().min(1).max(PASSWORD_MAX) })
export const PasswordAndCodeBody = PasswordBody.extend({ code: z.string().trim().max(20).optional() })
export const ChangePasswordBody = z.object({
  current: z.string().min(1).max(PASSWORD_MAX),
  next: z.string().max(PASSWORD_MAX),
  code: z.string().trim().max(20).optional(),
})
export const ProfileBody = z.object({ name: z.string().trim().min(1).max(80) })
const OneLine = (max: number) => z.string().trim().max(max).regex(/^[^\r\n]*$/, 'Use a single line.')
export const ContactBody = z.object({
  name: OneLine(80).min(1, 'Enter your name.'),
  email: Email,
  organisation: OneLine(120).default(''),
  plan: z.enum(['pool', 'city']),
  pools: z.number().int().min(1).max(99).optional(),
  message: z.string().trim().max(2000).default(''),
  /** Left empty by people; bots fill it in. */
  website: z.string().max(200).optional(),
})
export const PoolNameBody = z.object({ name: OneLine(80).min(2, 'Give the pool a name.') })
export const PoolPatchBody = z.object({ name: OneLine(80).min(2, 'Give the pool a name.').optional(), shareLeaderboard: z.boolean().optional() })
export const JoinPoolBody = z.object({ code: z.string().trim().min(4, 'Enter the code from your supervisor.').max(20) })
export const MemberRoleBody = z.object({ role: z.enum(['supervisor', 'instructor']) })
export const TokenBody = z.object({ token: z.string().trim().min(20).max(200) })
export const ForgotBody = z.object({ email: Email })
export const ResetBody = TokenBody.extend({ password: z.string().max(PASSWORD_MAX) })
export const ChangeEmailBody = z.object({ email: Email, password: z.string().min(1).max(PASSWORD_MAX), code: z.string().trim().max(20).optional() })

// ── Assistant ───────────────────────────────────────────────────────
export const AssistantBody = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(2000) }))
    .min(1)
    .max(24),
  context: z.object({
    path: z.string().max(200),
    today: z.string().max(10).optional(),
    classes: z
      .array(
        z.object({
          id: Id,
          name: text(120),
          levelId: text(40),
          lessons: z.number().int().min(0).max(100),
          taught: z.number().int().min(0).max(100),
          swimmers: z.number().int().min(0).max(500),
          reportsDone: z.number().int().min(0).max(500),
          unassessed: z.number().int().min(0).max(20000),
          todayLesson: z.number().int().nullable(),
          nextLessonDate: z.string().max(10).nullable(),
        }),
      )
      .max(60),
    todos: z.array(text(200)).max(20).optional(),
  }),
})

// ── Synced documents (mirror src/types.ts) ──────────────────────────
const MustSees = z
  .object({ arms: text(1000), legs: text(1000), breathing: text(1000), body: text(1000), note: text(1000) })
  .partial()

export const SwimmerDoc = z.object({
  id: Id,
  name: text(120),
  photo: z
    .string()
    .max(400_000)
    .regex(/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/, 'Photo must be an image data URL')
    .optional(),
  notes: text(4000),
  createdAt: z.number(),
})

export const ClassDoc = z.object({
  id: Id,
  name: text(120),
  levelId: text(40),
  session: text(60),
  schedule: text(80),
  archived: z.boolean().optional(),
  lessons: z
    .array(z.object({ id: Id, topic: text(200), date: z.union([z.literal(''), z.iso.date()]), notes: text(2000) }))
    .max(60),
  skills: z.array(z.object({ id: Id, name: text(300), category: text(80), mustSees: MustSees.optional() })).max(250),
  enrollments: z
    .array(
      z.object({
        swimmerId: Id,
        attendance: boundedRecord(z.enum(['present', 'absent', 'late']), 60),
        skills: boundedRecord(z.enum(['pass', 'incomplete']), 250),
        comment: text(4000),
        nextLevelId: text(40),
      }),
    )
    .max(120),
  createdAt: z.number(),
})

export const SyncBody = z.object({
  cursor: z.number().int().min(0),
  changes: z
    .array(
      z.object({
        kind: z.enum(['class', 'swimmer']),
        id: Id,
        op: z.enum(['put', 'delete']),
        data: z.unknown().optional(),
      }),
    )
    .max(500),
})

export function firstIssue(err: z.ZodError): string {
  const issue = err.issues[0]
  if (!issue) return 'Invalid request.'
  const where = issue.path.length ? `${issue.path.join('.')}: ` : ''
  return `${where}${issue.message}`
}
