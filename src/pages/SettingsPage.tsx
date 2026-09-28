import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  BadgeCheck,
  Building2,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Database,
  Download,
  KeyRound,
  Laptop,
  LogOut,
  MailCheck,
  MailWarning,
  Monitor,
  Moon,
  Palette,
  ShieldCheck,
  Smartphone,
  Sun,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, ButtonLink } from '../components/ui/Button'
import { CodeInput } from '../components/ui/CodeInput'
import { Modal } from '../components/ui/Modal'
import { PasswordInput, StrengthMeter } from '../components/ui/PasswordInput'
import { Field, Spinner, Switch } from '../components/ui/bits'
import { api, errorMessage, type User } from '../lib/api'
import { timeAgo, useNow, usePhoneLayout } from '../lib/hooks'
import { passwordProblem } from '../lib/passwordPolicy'
import { setEffectsPref, useEffectsPref, weakDevice, type EffectsPref } from '../lib/effects'
import { setTextSize, TEXT_SIZES, useTextSize, zoomWorks } from '../lib/textSize'
import { setTheme, useTheme, type ThemePref } from '../lib/theme'
import { usePool } from '../store/usePool'
import { currentAppToken, forgetAccount, resetDemo, setUser, useSession } from '../store/useSession'
import { parseBackup, useStore } from '../store/useStore'
import { confirm, toast, withUndo } from '../store/useUi'
import { saveFile } from '../lib/files'
import { keepAwakePref, setKeepAwakePref } from '../native/keepAwake'
import { LOCK_AFTER, lockAfter, lockMessage, lockPref, setLockAfter, setLockPref, useLock, type LockAfter } from '../native/lock'
import { IS_APP } from '../native/platform'
import { syncNow, useSync } from '../sync/engine'

type Section = 'phone' | 'account' | 'security' | 'devices' | 'data' | 'appearance'

export default function SettingsPage() {
  const status = useSession((s) => s.status)
  const demo = status === 'demo'
  const phone = usePhoneLayout()
  const [params, setParams] = useSearchParams()
  const sections: { id: Section; label: string; hint: string; icon: ReactNode }[] = [
    ...(IS_APP && !demo ? ([{ id: 'phone', label: 'This phone', hint: 'Fingerprint unlock, screen on deck', icon: <Smartphone size={16} /> }] as const) : []),
    ...(!demo
      ? ([
          { id: 'account', label: 'Account', hint: 'Name, email, password, pool', icon: <UserRound size={16} /> },
          { id: 'security', label: 'Security', hint: 'Two-step sign-in, recovery codes', icon: <ShieldCheck size={16} /> },
          { id: 'devices', label: 'Devices', hint: 'Where you’re signed in', icon: <Laptop size={16} /> },
        ] as const)
      : []),
    { id: 'data', label: 'Data', hint: 'Sync, backup, erase', icon: <Database size={16} /> },
    { id: 'appearance', label: 'Appearance', hint: 'Theme, display size, effects', icon: <Palette size={16} /> },
  ]
  const requested = params.get('s') as Section | null
  const found = sections.find((s) => s.id === requested)
  // Phones get a list to tap into (the back button returns to it); wider screens show a section straight away.
  const section = found?.id ?? (phone ? null : sections[0].id)
  const open = (id: Section) => setParams({ s: id }, { replace: !phone })

  const demoCard = demo && (
    <div className="card flex flex-wrap items-center gap-4 border-aqua/30 p-5">
      {/* basis-64 lets the button drop below the text on phones instead of squeezing it into a narrow column. */}
      <div className="flex-1 basis-64">
        <div className="font-semibold">You’re using the demo</div>
        <p className="mt-0.5 text-sm text-muted">Create an account to sync across devices, turn on two-factor sign-in and keep your data safe.</p>
      </div>
      <ButtonLink to="/signup" variant="primary">
        Create free account
      </ButtonLink>
    </div>
  )

  const content = section && (
    <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="min-w-0 space-y-5">
      {section === 'phone' && <PhoneSection />}
      {section === 'account' && <AccountSection />}
      {section === 'security' && <SecuritySection />}
      {section === 'devices' && <DevicesSection />}
      {section === 'data' && <DataSection />}
      {section === 'appearance' && <AppearanceSection />}
    </motion.div>
  )

  if (phone) {
    const current = sections.find((s) => s.id === section)
    if (current)
      return (
        <div className="space-y-6">
          <div>
            <button type="button" onClick={() => (history.state?.idx > 0 ? history.back() : setParams({}, { replace: true }))} className="-ml-1 mb-3 inline-flex items-center gap-1 text-[14px] font-medium text-muted hover:text-fg">
              <ChevronLeft size={18} /> Settings
            </button>
            <h1 className="page-title">{current.label}</h1>
          </div>
          {content}
        </div>
      )
    return (
      <div className="space-y-6">
        <h1 className="page-title">Settings</h1>
        {demoCard}
        <nav className="card divide-y divide-line overflow-hidden" aria-label="Settings sections">
          {sections.map((s) => (
            <button key={s.id} type="button" onClick={() => open(s.id)} className="flex w-full items-center gap-3.5 px-4 py-3.5 text-left transition-colors active:bg-fg/[0.05]">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-aqua/10 text-aqua">{s.icon}</span>
              <span className="min-w-0 flex-1">
                <span className="block text-[15px] font-medium">{s.label}</span>
                <span className="block truncate text-[13px] text-muted">{s.hint}</span>
              </span>
              <ChevronRight size={18} className="shrink-0 text-dim" />
            </button>
          ))}
        </nav>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow mb-2">Settings</div>
        <h1 className="page-title">Your account</h1>
      </div>

      {demoCard}

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:flex-col lg:px-0" aria-label="Settings sections">
          {sections.map((s) => {
            const active = s.id === section
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => open(s.id)}
                className={`relative flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
              >
                {active && <motion.span layoutId="settings-nav" className="absolute inset-0 rounded-xl bg-fg/[0.07] shadow-[inset_0_0_0_1px_var(--color-line)]" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
                <span className={`relative ${active ? 'text-aqua' : ''}`}>{s.icon}</span>
                <span className="relative">{s.label}</span>
              </button>
            )
          })}
        </nav>

        {content}
      </div>
    </div>
  )
}

function Panel({ title, description, children, tone }: { title: string; description?: ReactNode; children: ReactNode; tone?: 'danger' }) {
  return (
    <section className={`card p-5 sm:p-6 ${tone === 'danger' ? 'border-bad/25' : ''}`}>
      <h2 className={`text-[16px] font-semibold ${tone === 'danger' ? 'text-bad' : ''}`}>{title}</h2>
      {description && <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  )
}

// ── This phone (the Android app only) ────────────────────────────────
function PhoneSection() {
  const biometrics = useLock((s) => s.biometrics)
  const available = useLock((s) => s.biometrics !== 'none' || s.screenLock)
  const [locked, setLocked] = useState(lockPref() === true)
  const [after, setAfter] = useState<LockAfter>(lockAfter())
  const [busy, setBusy] = useState(false)
  const [awake, setAwake] = useState(keepAwakePref())

  async function toggle(on: boolean) {
    const token = currentAppToken()
    if (!token) return
    setBusy(true)
    const res = await setLockPref(on, token)
    setBusy(false)
    if (res.ok) {
      setLocked(on)
      toast(on ? 'Fingerprint unlock is on' : 'Fingerprint unlock is off')
    } else if (res.error !== 'cancelled') toast(lockMessage(res.error), 'error')
  }

  const AFTER_LABEL: Record<LockAfter, string> = { 1: 'After 1 minute', 5: 'After 5 minutes', 30: 'After 30 minutes', 0: 'Only when it opens' }
  return (
    <>
      <Panel
        title={biometrics === 'weak' ? 'Unlock with your face' : 'Unlock with your fingerprint'}
        description="SwimTrack opens with your fingerprint, face or screen lock instead of your password. Your sign-in is kept in this phone’s secure storage, and nobody can open the app without passing the check."
      >
        {available ? (
          <div className="space-y-5">
            <label className="flex items-center justify-between gap-4">
              <span className="text-[14.5px] font-medium">Ask for my fingerprint or face</span>
              <Switch checked={locked} onChange={(v) => void toggle(v)} disabled={busy} label="Unlock with fingerprint or face" />
            </label>
            {locked && (
              <div>
                <div className="mb-2 text-[13.5px] text-muted">Lock again when I leave SwimTrack</div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {LOCK_AFTER.map((m) => (
                    <button
                      key={m}
                      type="button"
                      aria-pressed={after === m}
                      onClick={() => {
                        setLockAfter(m)
                        setAfter(m)
                      }}
                      className={`rounded-xl border px-3 py-2.5 text-[13.5px] font-medium transition-colors ${after === m ? 'border-aqua/60 bg-aqua/10 text-fg' : 'border-line-2 text-muted hover:text-fg'}`}
                    >
                      {AFTER_LABEL[m]}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <p className="text-[14px] text-muted">This phone has no fingerprint, face or screen lock set up. Add one in your phone’s settings, then come back here.</p>
        )}
      </Panel>
      <Panel title="On deck" description="Your phone won’t dim or lock itself while the attendance screen is open.">
        <label className="flex items-center justify-between gap-4">
          <span className="text-[14.5px] font-medium">Keep the screen on during attendance</span>
          <Switch
            checked={awake}
            onChange={(v) => {
              setKeepAwakePref(v)
              setAwake(v)
            }}
            label="Keep the screen on during attendance"
          />
        </label>
      </Panel>
    </>
  )
}

// ── Account ──────────────────────────────────────────────────────────
function AccountSection() {
  const user = useSession((s) => s.user)!
  const [name, setName] = useState(user.name)
  const [busy, setBusy] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [changingEmail, setChangingEmail] = useState(false)

  async function save(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    try {
      const res = await api<{ user: User }>('/account', 'PATCH', { name })
      setUser(res.user)
      toast('Profile updated')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Panel title="Profile" description="Your first name is used as the instructor name on printed report cards.">
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <Field label="Name">
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
          </Field>
          <Field label="Email" hint={`Member since ${new Date(user.createdAt).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}`}>
            <div className="flex items-center gap-2">
              <input className="input opacity-80" value={user.email} readOnly aria-describedby="email-status" />
              <Button size="sm" onClick={() => setChangingEmail(true)}>
                Change
              </Button>
            </div>
            <EmailStatus verified={user.emailVerified} />
          </Field>
          <div className="sm:col-span-2">
            <Button type="submit" variant="primary" loading={busy} disabled={!name.trim() || name.trim() === user.name}>
              Save
            </Button>
          </div>
        </form>
      </Panel>
      <PoolPanel />
      <Panel
        tone="danger"
        title="Delete account"
        description="Permanently deletes your account, every class, swimmer and record, and signs you out everywhere. If you’re a pool’s only supervisor, the pool closes too. This can’t be undone."
      >
        <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setDeleting(true)}>
          Delete my account
        </Button>
      </Panel>
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
      {changingEmail && <ChangeEmailDialog onClose={() => setChangingEmail(false)} />}
    </>
  )
}

/** Where people who aren't in a pool yet find one; members get a shortcut to theirs. */
function PoolPanel() {
  const pool = usePool((s) => s.pool)
  return (
    <Panel
      title="Pool"
      description={
        pool
          ? `You’re ${pool.role === 'supervisor' ? 'a supervisor' : 'an instructor'} at ${pool.name}.`
          : 'Join your pool’s team so your supervisors can see your classes and report cards. They can look, not edit.'
      }
    >
      <ButtonLink to="/app/pool" variant={pool ? 'secondary' : 'primary'} size="sm" icon={<Building2 size={14} />}>
        {pool ? 'Open pool' : 'Join or start a pool'}
      </ButtonLink>
    </Panel>
  )
}

function EmailStatus({ verified }: { verified?: boolean }) {
  const [busy, setBusy] = useState(false)
  if (verified === undefined) return null
  if (verified)
    return (
      <p id="email-status" className="mt-1.5 flex items-center gap-1.5 text-xs text-good">
        <BadgeCheck size={13} /> Confirmed
      </p>
    )
  async function resend() {
    setBusy(true)
    try {
      const res = await api<{ email: string }>('/account/email/resend', 'POST')
      toast(`Sent a new link to ${res.email}`)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <p id="email-status" className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-warn">
      <MailWarning size={13} /> Not confirmed yet.
      <button type="button" onClick={resend} disabled={busy} className="font-semibold text-fg underline-offset-4 hover:underline disabled:opacity-50">
        Resend link
      </button>
    </p>
  )
}

function ChangeEmailDialog({ onClose }: { onClose: () => void }) {
  const user = useSession((s) => s.user)!
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState<string | null>(null)
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await api<{ pendingEmail: string }>('/account/email', 'POST', { email, password, code: user.twoFactor ? code : undefined })
      setPending(res.pendingEmail)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  if (pending) {
    return (
      <Modal open onClose={onClose} title="Check your new inbox" description={`We sent a link to ${pending}. Your email changes once you open it. ${user.email} was told about the request.`} size="sm" footer={<Button variant="primary" onClick={onClose}>Done</Button>}>
        <div className="flex justify-center py-2">
          <span className="icon-tile size-14 !rounded-2xl">
            <MailCheck size={24} />
          </span>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Change your email"
      description="You’ll confirm the new address from a link we email to it."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="change-email" loading={busy} disabled={!valid || !password || (user.twoFactor && code.length !== 6)}>
            Send confirmation
          </Button>
        </>
      }
    >
      <form id="change-email" onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
        <Field label="New email">
          <input className="input" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Current password">
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        {user.twoFactor && (
          <Field label="Authenticator code">
            <CodeInput value={code} onChange={setCode} />
          </Field>
        )}
      </form>
    </Modal>
  )
}

function DeleteAccountDialog({ onClose }: { onClose: () => void }) {
  const user = useSession((s) => s.user)!
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [confirmText, setConfirmText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/account', 'DELETE', { password, code: user.twoFactor ? code : undefined })
      await forgetAccount()
      navigate('/', { replace: true })
      toast('Your account was deleted')
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Delete your account?"
      description="Everything is deleted for good. Export a backup first if you might need it."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="danger" type="submit" form="delete-account" loading={busy} disabled={confirmText !== 'delete' || !password || (user.twoFactor && code.length !== 6)}>
            Delete forever
          </Button>
        </>
      }
    >
      <form id="delete-account" onSubmit={submit} className="space-y-4">
        {error && <p className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">{error}</p>}
        <Field label="Password">
          <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
        </Field>
        {user.twoFactor && (
          <Field label="Authenticator code">
            <CodeInput value={code} onChange={setCode} />
          </Field>
        )}
        <Field label={'Type “delete” to confirm'}>
          <input className="input" value={confirmText} onChange={(e) => setConfirmText(e.target.value.toLowerCase())} autoComplete="off" />
        </Field>
      </form>
    </Modal>
  )
}

// ── Security ─────────────────────────────────────────────────────────
function SecuritySection() {
  const user = useSession((s) => s.user)!
  return (
    <>
      <TwoFactorPanel user={user} />
      <PasswordPanel user={user} />
    </>
  )
}

/** Signed in but forgot the current password: email a reset link to the account's address. */
function ResetLink() {
  const [sent, setSent] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  async function send() {
    setBusy(true)
    try {
      const res = await api<{ email: string }>('/account/password/reset-link', 'POST')
      setSent(res.email)
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <p className="mt-5 border-t border-line pt-4 text-[13px] text-muted">
      {sent ? (
        <span className="inline-flex items-center gap-1.5 text-good">
          <MailCheck size={14} /> Reset link sent to {sent}. It works once, for 30 minutes.
        </span>
      ) : (
        <>
          Can’t remember your current password?{' '}
          <button type="button" onClick={() => void send()} disabled={busy} className="font-semibold text-fg underline-offset-4 hover:underline disabled:opacity-50">
            Email me a reset link
          </button>
        </>
      )}
    </p>
  )
}

function PasswordPanel({ user }: { user: User }) {
  const phone = usePhoneLayout()
  const [open, setOpen] = useState(false)
  return (
    <Panel title="Password" description="Changing your password signs out every other device.">
      {/* On a phone the form gets its own sheet instead of three more boxes on an already long page. */}
      {phone ? (
        <>
          <Button icon={<KeyRound size={15} />} className="w-full" onClick={() => setOpen(true)}>
            Change password
          </Button>
          <Modal open={open} onClose={() => setOpen(false)} title="Change password" description="Other devices will be signed out.">
            <PasswordForm user={user} onDone={() => setOpen(false)} />
          </Modal>
        </>
      ) : (
        <PasswordForm user={user} />
      )}
      <ResetLink />
    </Panel>
  )
}

function PasswordForm({ user, onDone }: { user: User; onDone?: () => void }) {
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const problem = next ? passwordProblem(next, user) : null

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (problem) return
    setBusy(true)
    try {
      await api('/account/password', 'POST', { current, next, code: user.twoFactor ? code : undefined })
      toast('Password changed. Other devices were signed out.')
      setCurrent('')
      setNext('')
      setCode('')
      onDone?.()
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="grid max-w-md gap-4">
      <Field label="Current password">
        <PasswordInput autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
      </Field>
      <Field label="New password" error={problem}>
        <PasswordInput autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} maxLength={200} />
        <StrengthMeter password={next} />
      </Field>
      {user.twoFactor && (
        <Field label="Authenticator code">
          <CodeInput value={code} onChange={setCode} />
        </Field>
      )}
      <Button type="submit" variant="primary" className="max-sm:w-full sm:w-fit" loading={busy} disabled={!current || !next || Boolean(problem) || (user.twoFactor && code.length !== 6)}>
        Change password
      </Button>
    </form>
  )
}

/** "Don't ask on this device for 30 days": the account-wide switch and a way to forget every trusted device. */
function TrustedDevices({ user }: { user: User }) {
  const [count, setCount] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const enabled = user.trustDevices !== false

  useEffect(() => {
    let live = true
    api<{ trusted: unknown[] }>('/account/sessions')
      .then((r) => live && setCount(r.trusted.length))
      .catch(() => live && setCount(null))
    return () => {
      live = false
    }
  }, [enabled])

  async function toggle(next: boolean) {
    setBusy(true)
    try {
      const res = await api<{ user: User }>('/account/security', 'PATCH', { trustDevices: next })
      setUser(res.user)
      toast(next ? 'Trusted devices can skip the code for 30 days' : 'Every sign-in will ask for a code')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  async function forget() {
    setBusy(true)
    try {
      await api('/account/trusted-devices', 'DELETE')
      setCount(0)
      toast('Trusted devices forgotten. Every device will ask for a code next time.')
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="mt-5 rounded-2xl border border-line p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[14.5px] font-semibold">Remember trusted devices</div>
          <p className="mt-0.5 text-[13px] leading-relaxed text-muted">When you tick “don’t ask for a code” at sign-in, that device skips the code for 30 days. Changing your password forgets every device.</p>
        </div>
        <Switch checked={enabled} onChange={(v) => void toggle(v)} disabled={busy} label="Remember trusted devices" />
      </div>
      {enabled && count !== null && (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-3 text-[13px] text-muted">
          <span>
            {count === 0 ? 'No trusted devices right now.' : `${count} trusted device${count === 1 ? '' : 's'}.`}
          </span>
          {count > 0 && (
            <Button size="sm" variant="ghost" onClick={() => void forget()} disabled={busy}>
              Forget all
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

type Setup = { secret: string; otpauthUrl: string; qrSvg: string }

function TwoFactorPanel({ user }: { user: User }) {
  const [step, setStep] = useState<'idle' | 'password' | 'scan' | 'codes' | 'disable' | 'regenerate'>('idle')
  const [password, setPassword] = useState('')
  const [code, setCode] = useState('')
  const [setup, setSetup] = useState<Setup | null>(null)
  const [codes, setCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [shake, setShake] = useState(0)

  const reset = () => {
    setStep('idle')
    setPassword('')
    setCode('')
    setSetup(null)
    setError(null)
  }

  async function refreshUser() {
    const { user } = await api<{ user: User }>('/me')
    setUser(user)
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await fn()
    } catch (err) {
      setError(errorMessage(err))
      setShake((n) => n + 1)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  const startSetup = () =>
    run(async () => {
      setSetup(await api<Setup>('/account/2fa/setup', 'POST', { password }))
      setStep('scan')
    })

  const enable = (value = code) =>
    run(async () => {
      const res = await api<{ recoveryCodes: string[] }>('/account/2fa/enable', 'POST', { code: value })
      setCodes(res.recoveryCodes)
      setStep('codes')
      await refreshUser()
      toast('Two-factor authentication is on')
    })

  const disable = () =>
    run(async () => {
      await api('/account/2fa/disable', 'POST', { password, code })
      await refreshUser()
      reset()
      toast('Two-factor authentication is off')
    })

  const regenerate = () =>
    run(async () => {
      const res = await api<{ recoveryCodes: string[] }>('/account/2fa/recovery-codes', 'POST', { password, code })
      setCodes(res.recoveryCodes)
      setStep('codes')
      await refreshUser()
    })

  return (
    <Panel
      title="Two-factor authentication"
      description="Require a code from an authenticator app (Google Authenticator, 1Password, Authy…) when you sign in on a new device."
    >
      <div className="flex flex-wrap items-center gap-4 rounded-2xl border border-line bg-ink/40 p-4">
        <span className={`flex size-11 items-center justify-center rounded-xl border ${user.twoFactor ? 'border-good/30 bg-good/10 text-good' : 'border-line-2 bg-panel-2 text-dim'}`}>
          <ShieldCheck size={20} />
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <div className="font-semibold">{user.twoFactor ? 'On' : 'Off'}</div>
          <div className="text-[13px] text-muted">
            {user.twoFactor ? `${user.recoveryCodesLeft} recovery code${user.recoveryCodesLeft === 1 ? '' : 's'} left` : 'Your account is protected by your password only.'}
          </div>
        </div>
        {step === 'idle' &&
          (user.twoFactor ? (
            <div className="flex flex-wrap gap-2">
              <Button size="sm" icon={<KeyRound size={14} />} onClick={() => setStep('regenerate')}>
                New recovery codes
              </Button>
              <Button size="sm" variant="danger" onClick={() => setStep('disable')}>
                Turn off
              </Button>
            </div>
          ) : (
            <Button variant="primary" size="sm" className="max-sm:w-full" onClick={() => setStep('password')}>
              Turn on
            </Button>
          ))}
      </div>

      {user.twoFactor && step === 'idle' && <TrustedDevices user={user} />}

      {user.twoFactor && user.recoveryCodesLeft <= 3 && step === 'idle' && (
        <p className="mt-3 flex items-center gap-2 text-[13px] text-warn">
          <AlertTriangle size={14} /> You’re running low on recovery codes. Generate a new set.
        </p>
      )}

      <AnimatePresence mode="wait">
        {step !== 'idle' && (
          <motion.div key={step} initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="mt-5 space-y-4">
              {error && (
                <motion.p key={shake} animate={{ x: [0, -8, 8, -5, 5, 0] }} className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad">
                  {error}
                </motion.p>
              )}

              {step === 'password' && (
                <form
                  className="max-w-sm space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void startSetup()
                  }}
                >
                  <Field label="Confirm your password to continue">
                    <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" variant="primary" loading={busy} disabled={!password}>
                      Continue
                    </Button>
                    <Button variant="ghost" onClick={reset}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}

              {step === 'scan' && setup && <ScanStep setup={setup} code={code} setCode={setCode} busy={busy} error={Boolean(error)} onEnable={(v) => void enable(v)} onCancel={reset} />}

              {step === 'codes' && <RecoveryCodes codes={codes} onDone={reset} />}

              {(step === 'disable' || step === 'regenerate') && (
                <form
                  className="max-w-sm space-y-4"
                  onSubmit={(e) => {
                    e.preventDefault()
                    void (step === 'disable' ? disable() : regenerate())
                  }}
                >
                  <Field label="Password">
                    <PasswordInput autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} autoFocus />
                  </Field>
                  <Field label="Authenticator code">
                    <CodeInput value={code} onChange={setCode} error={Boolean(error)} />
                  </Field>
                  <div className="flex gap-2">
                    <Button type="submit" variant={step === 'disable' ? 'danger' : 'primary'} loading={busy} disabled={!password || code.length !== 6}>
                      {step === 'disable' ? 'Turn off 2FA' : 'Generate new codes'}
                    </Button>
                    <Button variant="ghost" onClick={reset}>
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Panel>
  )
}

/** A numbered step in a short how-to. */
function Step({ n, title, children }: { n: number; title: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-2 flex items-center gap-2 text-[14px] font-medium">
        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-aqua/15 text-[12px] font-semibold text-aqua">{n}</span>
        {title}
      </div>
      {children}
    </div>
  )
}

/**
 * Adding SwimTrack to an authenticator app. On a computer, scanning the QR code with a phone is quickest; on the phone
 * itself there's nothing to scan with, so the app opens the authenticator directly (or the key is copied in).
 */
function ScanStep({ setup, code, setCode, busy, error, onEnable, onCancel }: { setup: Setup; code: string; setCode: (v: string) => void; busy: boolean; error: boolean; onEnable: (v?: string) => void; onCancel: () => void }) {
  const phone = usePhoneLayout()
  const [showQr, setShowQr] = useState(false)
  const qr = (
    <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-fit rounded-2xl bg-white p-3 shadow-[var(--glow)]">
      <img src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qrSvg)}`} alt="QR code for your authenticator app" width={phone ? 160 : 176} height={phone ? 160 : 176} />
    </motion.div>
  )
  return (
    <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
      {!phone && qr}
      <div className="min-w-0 space-y-5">
        {phone ? (
          <Step n={1} title="Add SwimTrack to your authenticator app">
            <a href={setup.otpauthUrl} className="btn-glass flex h-11 w-full items-center justify-center gap-2 rounded-full text-[14px] font-medium">
              <KeyRound size={15} /> Open authenticator app
            </a>
            <p className="mt-3 text-[13px] text-muted">Nothing happened? Copy this key into the app instead:</p>
            <div className="mt-2">
              <CopyValue value={setup.secret.match(/.{1,4}/g)!.join(' ')} raw={setup.secret} />
            </div>
            <button type="button" onClick={() => setShowQr((v) => !v)} className="mt-3 text-[13px] font-medium text-muted underline underline-offset-4 hover:text-fg">
              {showQr ? 'Hide the QR code' : 'Authenticator on another device? Show a QR code'}
            </button>
            {showQr && <div className="mt-3">{qr}</div>}
          </Step>
        ) : (
          <Step n={1} title="Scan the code with your authenticator app">
            <p className="mb-2 text-[13px] text-muted">Can’t scan? Enter this key instead:</p>
            <CopyValue value={setup.secret.match(/.{1,4}/g)!.join(' ')} raw={setup.secret} />
          </Step>
        )}
        <Step n={2} title="Enter the 6-digit code it shows">
          <CodeInput value={code} onChange={setCode} onComplete={(v) => onEnable(v)} disabled={busy} error={error} autoFocus={!phone} />
        </Step>
        <div className="flex flex-wrap gap-2">
          <Button variant="primary" loading={busy} disabled={code.length !== 6} onClick={() => onEnable()}>
            Verify and turn on
          </Button>
          <Button variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  )
}

function CopyValue({ value, raw }: { value: string; raw: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <button
      type="button"
      onClick={() => {
        void navigator.clipboard?.writeText(raw).then(() => {
          setCopied(true)
          setTimeout(() => setCopied(false), 1500)
        })
      }}
      aria-label="Copy the key"
      className="flex w-full min-w-0 items-center gap-3 rounded-xl border border-line-2 bg-ink/50 py-2.5 pl-3.5 pr-2.5 text-left transition-colors hover:border-aqua/40"
    >
      <span className="min-w-0 flex-1 break-all font-mono text-[13px] leading-relaxed tracking-wider">{value}</span>
      <span className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-medium ${copied ? 'bg-good/15 text-good' : 'bg-fg/[0.06] text-muted'}`}>
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? 'Copied' : 'Copy'}
      </span>
    </button>
  )
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  const text = `SwimTrack recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join('\n')}\n`
  function download() {
    void saveFile('swimtrack-recovery-codes.txt', text, 'text/plain').then((done) => done && setSaved(true))
  }
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-warn/30 bg-warn/[0.07] p-4 text-[13.5px] text-muted">
        <span className="font-semibold text-warn">Save these recovery codes now.</span> If you lose your phone, each one lets you sign in once. You won’t see them again.
      </div>
      <ul className="grid grid-cols-2 gap-2 rounded-2xl border border-line bg-ink/50 p-4 font-mono text-[14px] tracking-wider sm:grid-cols-5">
        {codes.map((c, i) => (
          <motion.li key={c} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }} className="text-center">
            {c}
          </motion.li>
        ))}
      </ul>
      <div className="flex flex-wrap gap-2">
        <Button icon={<Download size={15} />} onClick={download}>
          Download
        </Button>
        <Button
          icon={<Copy size={15} />}
          onClick={() => void navigator.clipboard?.writeText(text).then(() => (setSaved(true), toast('Recovery codes copied')))}
        >
          Copy
        </Button>
        <Button variant="primary" onClick={onDone} disabled={!saved}>
          {saved ? 'Done' : 'Save them first'}
        </Button>
      </div>
    </div>
  )
}

// ── Devices ──────────────────────────────────────────────────────────
interface SessionRow {
  id: string
  current: boolean
  device: string
  ip: string
  createdAt: number
  lastSeenAt: number
}

function DevicesSection() {
  const [sessions, setSessions] = useState<SessionRow[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const now = useNow()

  const load = () =>
    api<{ sessions: SessionRow[] }>('/account/sessions')
      .then((r) => setSessions(r.sessions))
      .catch((err) => setError(errorMessage(err)))

  useEffect(() => {
    void load()
  }, [])

  async function revoke(id: string) {
    await api(`/account/sessions/${id}`, 'DELETE').catch((err) => toast(errorMessage(err), 'error'))
    toast('Device signed out')
    void load()
  }

  async function revokeOthers() {
    const ok = await confirm({ title: 'Sign out all other devices?', body: 'Anyone signed in to your account elsewhere will need to sign in again.', confirmLabel: 'Sign them out', danger: true })
    if (!ok) return
    await api('/account/sessions/revoke-others', 'POST').catch((err) => toast(errorMessage(err), 'error'))
    toast('Signed out everywhere else')
    void load()
  }

  return (
    <Panel title="Where you’re signed in" description="If you don’t recognise a device, sign it out and change your password.">
      {error && <p className="text-sm text-bad">{error}</p>}
      {!sessions && !error && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <Spinner size={14} /> Loading devices…
        </div>
      )}
      {sessions && (
        <>
          <ul className="divide-y divide-line rounded-2xl border border-line">
            {sessions.map((s) => {
              const Icon = /Android|iOS/.test(s.device) ? Smartphone : Monitor
              return (
                <li key={s.id} className="flex items-center gap-3.5 px-4 py-3.5">
                  <span className={`flex size-10 items-center justify-center rounded-xl border ${s.current ? 'border-aqua/30 bg-aqua/10 text-aqua' : 'border-line-2 bg-panel-2 text-muted'}`}>
                    <Icon size={18} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 text-[14px] font-medium">
                      {s.device}
                      {s.current && <span className="rounded-md bg-aqua/15 px-1.5 py-0.5 text-[10.5px] font-semibold text-aqua">This device</span>}
                    </div>
                    <div className="font-mono text-[11.5px] text-dim">
                      {s.ip} · active {timeAgo(s.lastSeenAt, now)} · signed in {timeAgo(s.createdAt, now)}
                    </div>
                  </div>
                  {!s.current && (
                    <Button size="sm" variant="ghost" icon={<LogOut size={14} />} onClick={() => void revoke(s.id)}>
                      Sign out
                    </Button>
                  )}
                </li>
              )
            })}
          </ul>
          {sessions.length > 1 && (
            <Button className="mt-4" variant="danger" size="sm" icon={<LogOut size={14} />} onClick={() => void revokeOthers()}>
              Sign out all other devices
            </Button>
          )}
        </>
      )}
    </Panel>
  )
}

// ── Data ─────────────────────────────────────────────────────────────
function DataSection() {
  const status = useSession((s) => s.status)
  const sync = useSync()
  const counts = { classes: useStore((s) => s.classes.length), swimmers: useStore((s) => s.swimmers.length) }
  const withPhotos = useStore((s) => s.swimmers.filter((w) => w.photo).length)

  async function removePhotos() {
    const ok = await confirm({
      title: `Remove ${withPhotos} swimmer photo${withPhotos === 1 ? '' : 's'}?`,
      body: 'They’re deleted from this device and, once it syncs, from your account. Names and everything else stay.',
      confirmLabel: 'Remove photos',
      danger: true,
    })
    if (!ok) return
    const { swimmers, updateSwimmer } = useStore.getState()
    for (const w of swimmers) if (w.photo) updateSwimmer(w.id, { photo: undefined })
    toast('Photos removed')
  }
  const input = useRef<HTMLInputElement>(null)
  const now = useNow()

  function exportBackup() {
    const { swimmers, classes } = useStore.getState()
    const json = JSON.stringify({ app: 'swimtrack', version: 1, exportedAt: new Date().toISOString(), swimmers, classes }, null, 2)
    void saveFile(`swimtrack-backup-${new Date().toISOString().slice(0, 10)}.json`, json, 'application/json').then((done) => done && !IS_APP && toast('Backup downloaded'))
  }

  async function onImport(file: File | undefined) {
    if (!file) return
    try {
      const data = parseBackup(JSON.parse(await file.text()))
      const ok = await confirm({
        title: 'Import backup?',
        body: `Adds ${data.classes.length} class${data.classes.length === 1 ? '' : 'es'} and ${data.swimmers.length} swimmer${data.swimmers.length === 1 ? '' : 's'}. Anything already here is kept.`,
        confirmLabel: 'Import',
      })
      if (ok) withUndo('Backup imported', () => useStore.getState().importData(data))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not read that file.', 'error')
    } finally {
      if (input.current) input.current.value = ''
    }
  }

  async function erase() {
    const ok = await confirm({
      title: 'Erase all classes and swimmers?',
      body: status === 'demo' ? 'The demo will be reset to its sample classes.' : 'Every class and swimmer is deleted from your account on all devices. You can undo right after.',
      confirmLabel: 'Erase all',
      danger: true,
    })
    if (!ok) return
    if (status === 'demo') {
      await resetDemo()
      toast('Demo reset')
    } else withUndo('Everything erased', () => useStore.getState().clearAll())
  }

  return (
    <>
      <Panel
        title="Sync"
        description={status === 'demo' ? 'The demo keeps everything in this browser.' : 'Edits save on this device instantly and sync to your account in the background.'}
      >
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3">
          {[
            ['Classes', String(counts.classes)],
            ['Swimmers', String(counts.swimmers)],
            ['Last synced', status === 'demo' ? 'Local only' : sync.lastSyncedAt ? timeAgo(sync.lastSyncedAt, now) : sync.status === 'offline' ? 'Offline' : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-line bg-ink/40 p-3 last:max-sm:col-span-2 sm:p-4">
              <div className="eyebrow">{label}</div>
              <div className="mt-1 font-display text-lg font-semibold tabular-nums sm:text-xl">{value}</div>
            </div>
          ))}
        </div>
        {status !== 'demo' && (
          <Button className="mt-4" size="sm" onClick={() => void syncNow().then(() => toast(useSync.getState().status === 'synced' ? 'Everything is synced' : 'Still offline. Changes are safe on this device.'))}>
            Sync now
          </Button>
        )}
      </Panel>
      <Panel title="Backup" description={<>Download everything as a JSON file, or import one. Importing adds to what you have; nothing is overwritten. <Link to="/privacy" className="font-medium text-fg underline-offset-4 hover:underline">How SwimTrack handles data</Link></>}>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Download size={15} />} onClick={exportBackup}>
            Export backup
          </Button>
          <Button icon={<Upload size={15} />} onClick={() => input.current?.click()}>
            Import backup
          </Button>
          <input ref={input} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void onImport(e.target.files?.[0])} />
        </div>
      </Panel>
      {withPhotos > 0 && (
        <Panel
          title="Old swimmer photos"
          description={`SwimTrack no longer shows or takes photos of swimmers, but ${withPhotos} swimmer${withPhotos === 1 ? ' still has one' : 's still have one'} saved from before. Remove them from this device and your account.`}
        >
          <Button icon={<Trash2 size={15} />} onClick={() => void removePhotos()}>
            Remove {withPhotos} photo{withPhotos === 1 ? '' : 's'}
          </Button>
        </Panel>
      )}
      <Panel tone="danger" title={status === 'demo' ? 'Reset demo' : 'Erase all data'} description="Removes every class and swimmer. Your account stays.">
        <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => void erase()}>
          {status === 'demo' ? 'Reset demo' : 'Erase all data'}
        </Button>
      </Panel>
    </>
  )
}

// ── Appearance ───────────────────────────────────────────────────────
function AppearanceSection() {
  const pref = useTheme((s) => s.pref)
  const options: { value: ThemePref; label: string; icon: ReactNode }[] = [
    { value: 'system', label: 'System', icon: <Monitor size={16} /> },
    { value: 'light', label: 'Light', icon: <Sun size={16} /> },
    { value: 'dark', label: 'Dark', icon: <Moon size={16} /> },
  ]
  return (
    <>
    <Panel title="Theme" description="Dark is easier on the eyes at an indoor pool; light reads better in direct sun.">
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {options.map((o) => {
          const active = pref === o.value
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              onClick={(e) => {
                const r = e.currentTarget.getBoundingClientRect()
                setTheme(o.value, { x: r.left + r.width / 2, y: r.top + r.height / 2 })
              }}
              className={`group overflow-hidden rounded-2xl border text-left transition-colors ${active ? 'border-aqua/60 shadow-[var(--glow)]' : 'border-line-2 hover:border-dim/60'}`}
            >
              <ThemePreview kind={o.value} />
              <div className="flex items-center gap-2 px-3 py-2.5 text-[13.5px] font-medium sm:px-3.5 sm:py-3 sm:text-[14px]">
                <span className={`max-sm:hidden ${active ? 'text-aqua' : 'text-muted'}`}>{o.icon}</span>
                {o.label}
                {active && <Check size={15} className="ml-auto text-aqua" />}
              </div>
            </button>
          )
        })}
      </div>
    </Panel>
    <TextSizePanel />
    <EffectsPanel />
    </>
  )
}

function EffectsPanel() {
  const pref = useEffectsPref((s) => s.pref)
  const options: { value: EffectsPref; label: string; hint: string }[] = [
    { value: 'auto', label: 'Automatic', hint: weakDevice() ? 'Lite on this device' : 'Full on this device' },
    { value: 'full', label: 'Full', hint: 'Glass, glows, animation' },
    { value: 'lite', label: 'Lite', hint: 'Smoother on older phones' },
  ]
  return (
    <Panel title="Effects" description="Lite drops the frosted glass, glows and most animation, so older or budget phones stay smooth. Everything else stays the same.">
      <div role="radiogroup" aria-label="Effects" className="grid grid-cols-3 gap-2">
        {options.map((o) => {
          const active = o.value === pref
          return (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setEffectsPref(o.value)}
              className={`flex flex-col items-start gap-0.5 rounded-2xl border px-3 py-2.5 text-left transition-colors ${active ? 'border-aqua/60 bg-aqua/10' : 'border-line-2 hover:border-dim/60'}`}
            >
              <span className={`text-[14px] ${active ? 'font-semibold' : 'font-medium'}`}>{o.label}</span>
              <span className="text-[12px] leading-snug text-muted">{o.hint}</span>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

function TextSizePanel() {
  const size = useTextSize((s) => s.size)
  return (
    <Panel
      title="Display size"
      description={
        zoomWorks()
          ? 'Makes text, buttons and spacing bigger everywhere in SwimTrack, on this device.'
          : 'Needs a newer Android System WebView (Chrome 128 or later). Update it from the Play Store to use this; your phone’s own font size setting still works.'
      }
    >
      <div role="radiogroup" aria-label="Display size" className={`grid grid-cols-4 gap-2 ${zoomWorks() ? '' : 'pointer-events-none opacity-45'}`}>
        {TEXT_SIZES.map((t, i) => {
          const active = t.id === size
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setTextSize(t.id)}
              className={`flex flex-col items-center justify-end gap-1.5 rounded-2xl border px-1 pb-2.5 pt-3 transition-colors ${active ? 'border-aqua/60 bg-aqua/10' : 'border-line-2 hover:border-dim/60'}`}
            >
              <span className="font-display font-semibold leading-none" style={{ fontSize: 15 + i * 4 }}>
                Aa
              </span>
              <span className={`text-[12px] ${active ? 'font-semibold text-fg' : 'text-muted'}`}>{t.label}</span>
            </button>
          )
        })}
      </div>
    </Panel>
  )
}

function ThemePreview({ kind }: { kind: ThemePref }) {
  const tile = (bg: string, fg: string, line: string) => (
    <div className="flex h-full flex-1 flex-col gap-1.5 p-3" style={{ background: bg }}>
      <div className="h-2 w-10 rounded-full" style={{ background: '#3ce0cf' }} />
      <div className="h-1.5 w-16 rounded-full" style={{ background: fg }} />
      <div className="mt-auto h-6 rounded-md border" style={{ borderColor: line }} />
    </div>
  )
  return (
    <div className="flex h-24 border-b border-line">
      {kind !== 'light' && tile('#0c0e11', 'rgb(255 255 255 / 0.3)', 'rgb(255 255 255 / 0.12)')}
      {kind !== 'dark' && tile('#f5f6f8', 'rgb(0 0 0 / 0.2)', 'rgb(0 0 0 / 0.12)')}
    </div>
  )
}
