import { ArrowRight, Sparkles } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Checkbox, Field } from '../../components/ui/bits'
import { PasswordInput } from '../../components/ui/PasswordInput'
import { errorMessage } from '../../lib/api'
import { safeNext } from '../../lib/redirect'
import { login } from '../../store/useSession'
import { toast } from '../../store/useUi'
import { AuthLayout, FormError } from './AuthLayout'

export default function Login() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [remember, setRemember] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const next = safeNext(params.get('next'))

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    try {
      const res = await login(email, password, remember)
      if (res.twoFactor) navigate(`/login/verify?next=${encodeURIComponent(next)}`, { state: { trustAllowed: res.trustAllowed } })
      else {
        toast(res.trustedDevice ? 'Welcome back. This device is trusted, so no code was needed.' : 'Welcome back')
        navigate(next, { replace: true })
      }
    } catch (err) {
      setError(errorMessage(err))
      setAttempt((a) => a + 1)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to pick up where you left off, on any device."
      footer={
        <>
          New here?{' '}
          <Link to="/signup" className="font-semibold text-fg underline-offset-4 hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} shakeKey={attempt} />
        <Field label="Email">
          <input className="input h-11" type="email" autoComplete="email" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
        </Field>
        <Field label="Password">
          <PasswordInput className="h-11" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </Field>
        <div className="-mt-1 flex items-center justify-between gap-3">
          <Checkbox checked={remember} onChange={setRemember}>
            Remember me for 30 days
          </Checkbox>
          <Link to="/forgot-password" state={{ email }} className="text-[13px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
            Forgot password?
          </Link>
        </div>
        <Button variant="primary" size="lg" type="submit" className="w-full" loading={busy} disabled={!email || !password}>
          Sign in <ArrowRight size={16} />
        </Button>
      </form>
      <div className="my-6 flex items-center gap-3 text-xs text-dim">
        <span className="h-px flex-1 bg-line" /> or <span className="h-px flex-1 bg-line" />
      </div>
      <Link to="/demo" className="group flex items-center justify-center gap-2 rounded-2xl border border-line-2 px-4 py-3 text-sm font-medium transition-colors hover:border-aqua/40 hover:bg-aqua/[0.05]">
        <Sparkles size={15} className="text-aqua transition-transform group-hover:rotate-12" />
        Explore the demo without an account
      </Link>
    </AuthLayout>
  )
}
