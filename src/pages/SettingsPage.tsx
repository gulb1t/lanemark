import { AnimatePresence, motion } from 'motion/react'
import {
  AlertTriangle,
  BadgeCheck,
  Check,
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
import { Field, Spinner } from '../components/ui/bits'
import { api, errorMessage, type User } from '../lib/api'
import { timeAgo, useNow } from '../lib/hooks'
import { passwordProblem } from '../lib/passwordPolicy'
import { setTheme, useTheme, type ThemePref } from '../lib/theme'
import { forgetAccount, resetDemo, setUser, useSession } from '../store/useSession'
import { parseBackup, useStore } from '../store/useStore'
import { confirm, toast, withUndo } from '../store/useUi'
import { syncNow, useSync } from '../sync/engine'

type Section = 'account' | 'security' | 'devices' | 'data' | 'appearance'

export default function SettingsPage() {
  const status = useSession((s) => s.status)
  const demo = status === 'demo'
  const [params, setParams] = useSearchParams()
  const sections: { id: Section; label: string; icon: ReactNode }[] = [
    ...(!demo
      ? ([
          { id: 'account', label: 'Account', icon: <UserRound size={16} /> },
          { id: 'security', label: 'Security', icon: <ShieldCheck size={16} /> },
          { id: 'devices', label: 'Devices', icon: <Laptop size={16} /> },
        ] as const)
      : []),
    { id: 'data', label: 'Data', icon: <Database size={16} /> },
    { id: 'appearance', label: 'Appearance', icon: <Palette size={16} /> },
  ]
  const requested = params.get('s') as Section | null
  const section = sections.find((s) => s.id === requested)?.id ?? sections[0].id

  return (
    <div className="space-y-8">
      <div>
        <div className="eyebrow mb-2">Settings</div>
        <h1 className="page-title">Your account</h1>
      </div>

      {demo && (
        <div className="card flex flex-wrap items-center gap-4 border-aqua/30 p-5">
          <div className="flex-1">
            <div className="font-semibold">You’re using the demo</div>
            <p className="mt-0.5 text-sm text-muted">Create an account to sync across devices, turn on two-factor sign-in and keep your data safe.</p>
          </div>
          <ButtonLink to="/signup" variant="primary">
            Create free account
          </ButtonLink>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
        <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 no-scrollbar lg:mx-0 lg:flex-col lg:px-0" aria-label="Settings sections">
          {sections.map((s) => {
            const active = s.id === section
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setParams({ s: s.id }, { replace: true })}
                className={`relative flex shrink-0 items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-left text-[14px] font-medium transition-colors ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
              >
                {active && <motion.span layoutId="settings-nav" className="absolute inset-0 rounded-xl bg-fg/[0.07] shadow-[inset_0_0_0_1px_var(--color-line)]" transition={{ type: 'spring', stiffness: 480, damping: 38 }} />}
                <span className={`relative ${active ? 'text-aqua' : ''}`}>{s.icon}</span>
                <span className="relative">{s.label}</span>
              </button>
            )
          })}
        </nav>

        <motion.div key={section} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }} className="min-w-0 space-y-5">
          {section === 'account' && <AccountSection />}
          {section === 'security' && <SecuritySection />}
          {section === 'devices' && <DevicesSection />}
          {section === 'data' && <DataSection />}
          {section === 'appearance' && <AppearanceSection />}
        </motion.div>
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
      <Panel tone="danger" title="Delete account" description="Permanently deletes your account, every class, swimmer and record, and signs you out everywhere. This can’t be undone.">
        <Button variant="danger" icon={<Trash2 size={15} />} onClick={() => setDeleting(true)}>
          Delete my account
        </Button>
      </Panel>
      {deleting && <DeleteAccountDialog onClose={() => setDeleting(false)} />}
      {changingEmail && <ChangeEmailDialog onClose={() => setChangingEmail(false)} />}
    </>
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

function PasswordPanel({ user }: { user: User }) {
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
    } catch (err) {
      toast(errorMessage(err), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Panel title="Password" description="Changing your password signs out every other device.">
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
        <div>
          <Button type="submit" variant="primary" loading={busy} disabled={!current || !next || Boolean(problem) || (user.twoFactor && code.length !== 6)}>
            Change password
          </Button>
        </div>
      </form>
    </Panel>
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
        <div className="flex-1">
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
            <Button variant="primary" size="sm" onClick={() => setStep('password')}>
              Turn on
            </Button>
          ))}
      </div>

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

              {step === 'scan' && setup && (
                <div className="grid gap-6 sm:grid-cols-[auto_1fr]">
                  <motion.div initial={{ scale: 0.9, opacity: 0, rotate: -2 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} className="w-fit self-start rounded-2xl bg-white p-3 shadow-[var(--glow)]">
                    <img src={`data:image/svg+xml;utf8,${encodeURIComponent(setup.qrSvg)}`} alt="QR code for your authenticator app" width={176} height={176} />
                  </motion.div>
                  <div className="space-y-4">
                    <ol className="list-decimal space-y-1.5 pl-4 text-[13.5px] text-muted">
                      <li>Open your authenticator app and scan the code.</li>
                      <li>Can’t scan? Enter this key manually:</li>
                    </ol>
                    <CopyValue value={setup.secret.match(/.{1,4}/g)!.join(' ')} raw={setup.secret} />
                    <div>
                      <div className="mb-2 text-[13px] font-medium text-muted">3. Enter the 6-digit code it shows</div>
                      <CodeInput value={code} onChange={setCode} onComplete={(v) => void enable(v)} disabled={busy} error={Boolean(error)} autoFocus />
                    </div>
                    <div className="flex gap-2">
                      <Button variant="primary" loading={busy} disabled={code.length !== 6} onClick={() => void enable()}>
                        Verify and turn on
                      </Button>
                      <Button variant="ghost" onClick={reset}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              )}

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
      className="flex w-full items-center justify-between gap-3 rounded-xl border border-line-2 bg-ink/50 px-3.5 py-2.5 text-left font-mono text-[13px] tracking-wider transition-colors hover:border-aqua/40"
    >
      <span className="break-all">{value}</span>
      {copied ? <Check size={15} className="shrink-0 text-good" /> : <Copy size={15} className="shrink-0 text-dim" />}
    </button>
  )
}

function RecoveryCodes({ codes, onDone }: { codes: string[]; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  const text = `SwimTrack recovery codes\nEach code works once. Keep them somewhere safe.\n\n${codes.join('\n')}\n`
  function download() {
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'swimtrack-recovery-codes.txt'
    a.click()
    URL.revokeObjectURL(url)
    setSaved(true)
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
  const input = useRef<HTMLInputElement>(null)
  const now = useNow()

  function exportBackup() {
    const { swimmers, classes } = useStore.getState()
    const blob = new Blob([JSON.stringify({ app: 'swimtrack', version: 1, exportedAt: new Date().toISOString(), swimmers, classes }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `swimtrack-backup-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast('Backup downloaded')
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
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Classes', String(counts.classes)],
            ['Swimmers', String(counts.swimmers)],
            ['Last synced', status === 'demo' ? 'Local only' : sync.lastSyncedAt ? timeAgo(sync.lastSyncedAt, now) : sync.status === 'offline' ? 'Offline' : '—'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-2xl border border-line bg-ink/40 p-4">
              <div className="eyebrow">{label}</div>
              <div className="mt-1 font-mono text-xl font-semibold">{value}</div>
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
    <Panel title="Theme" description="Dark is easier on the eyes at an indoor pool; light reads better in direct sun.">
      <div className="grid gap-3 sm:grid-cols-3">
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
              <div className="flex items-center gap-2 px-3.5 py-3 text-[14px] font-medium">
                <span className={active ? 'text-aqua' : 'text-muted'}>{o.icon}</span>
                {o.label}
                {active && <Check size={15} className="ml-auto text-aqua" />}
              </div>
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
