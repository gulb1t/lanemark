import { ArrowLeft, MailCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useState, type FormEvent } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/bits'
import { api, errorMessage } from '../../lib/api'
import { AuthLayout, FormError } from './AuthLayout'

export default function ForgotPassword() {
  const location = useLocation()
  const [email, setEmail] = useState(() => (location.state as { email?: string } | null)?.email ?? '')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      await api('/auth/password/forgot', 'POST', { email })
      setSent(true)
    } catch (err) {
      setError(errorMessage(err))
      setAttempt((a) => a + 1)
    } finally {
      setBusy(false)
    }
  }

  const back = (
    <Link to="/login" className="inline-flex items-center gap-1.5 font-semibold text-fg underline-offset-4 hover:underline">
      <ArrowLeft size={14} /> Back to sign in
    </Link>
  )

  if (sent) {
    return (
      <AuthLayout title="Check your email" subtitle={<>If an account uses <b className="font-semibold text-fg">{email.trim()}</b>, a reset link is on its way. It works once, for 30 minutes.</>} footer={back}>
        <motion.div initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} className="card flex items-start gap-3.5 p-5">
          <span className="icon-tile size-10 shrink-0 !rounded-xl !shadow-none">
            <MailCheck size={18} />
          </span>
          <div className="text-[14px] leading-relaxed text-muted">
            Nothing after a few minutes? Check spam, or{' '}
            <button type="button" className="font-semibold text-fg underline-offset-4 hover:underline" onClick={() => setSent(false)}>
              try another address
            </button>
            .
          </div>
        </motion.div>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout title="Forgot your password?" subtitle="Enter your account’s email and we’ll send you a link to choose a new one." footer={back}>
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} shakeKey={attempt} />
        <Field label="Email">
          <input className="input h-11" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Button variant="primary" size="lg" type="submit" className="w-full" loading={busy} disabled={!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())}>
          Send reset link
        </Button>
      </form>
    </AuthLayout>
  )
}
