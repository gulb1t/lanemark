import { ArrowRight } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/bits'
import { PasswordInput, StrengthMeter } from '../../components/ui/PasswordInput'
import { errorMessage } from '../../lib/api'
import { passwordProblem } from '../../lib/passwordPolicy'
import { safeNext } from '../../lib/redirect'
import { register } from '../../store/useSession'
import { toast } from '../../store/useUi'
import { AuthLayout, FormError } from './AuthLayout'

export default function Signup() {
  const navigate = useNavigate()
  // Set when sign-up starts from somewhere in the app, like a pool invite link.
  const next = useSearchParams()[0].get('next')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  const problem = password ? passwordProblem(password, { email, name }) : 'Choose a password.'
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (!name.trim() || !emailOk || problem) return
    setBusy(true)
    setError(null)
    try {
      await register(name.trim(), email, password)
      toast(`Welcome to Lanemark, ${name.trim().split(/\s+/)[0]}! Check ${email.trim()} for a link to confirm your email.`)
      navigate(next ? safeNext(next) : '/app?welcome=1', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setAttempt((a) => a + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title={
        <>
          Create your <span className="accent">free</span> account
        </>
      }
      subtitle="Your classes sync securely across your phone, tablet and laptop."
      footer={
        <>
          Already have an account?{' '}
          <Link to={next ? `/login?next=${encodeURIComponent(next)}` : '/login'} className="font-semibold text-fg underline-offset-4 hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} shakeKey={attempt} />
        <Field label="Your name" error={touched && !name.trim() ? 'Enter your name.' : null}>
          <input className="input h-11" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} autoFocus aria-invalid={touched && !name.trim()} />
        </Field>
        <Field label="Email" error={touched && !emailOk ? 'Enter a valid email address.' : null}>
          <input className="input h-11" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} maxLength={254} aria-invalid={touched && !emailOk} />
        </Field>
        <Field label="Password" error={touched && problem ? problem : null}>
          <PasswordInput className="h-11" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} aria-invalid={Boolean(touched && problem)} />
          <StrengthMeter password={password} />
        </Field>
        <Button variant="primary" size="lg" type="submit" className="w-full" loading={busy}>
          Create account <ArrowRight size={16} />
        </Button>
        <p className="text-center text-xs leading-relaxed text-dim">
          You can turn on two-factor authentication from Settings once you’re in. See{' '}
          <Link to="/privacy" className="underline underline-offset-2 hover:text-fg">
            how swimmer data is handled
          </Link>
          .
        </p>
      </form>
    </AuthLayout>
  )
}
