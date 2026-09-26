import { ArrowRight, CircleAlert, CircleCheck } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button, ButtonLink } from '../../components/ui/Button'
import { Field, Spinner } from '../../components/ui/bits'
import { PasswordInput, StrengthMeter } from '../../components/ui/PasswordInput'
import { api, errorMessage } from '../../lib/api'
import { passwordProblem } from '../../lib/passwordPolicy'
import { expire, useSession } from '../../store/useSession'
import { toast } from '../../store/useUi'
import { AuthLayout, FormError } from './AuthLayout'

type State = { kind: 'checking' } | { kind: 'ready'; email: string } | { kind: 'invalid'; message: string }

export default function ResetPassword() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const navigate = useNavigate()
  const [state, setState] = useState<State>(() => (token ? { kind: 'checking' } : { kind: 'invalid', message: 'This page needs the link from your email.' }))
  const [password, setPassword] = useState('')
  const [touched, setTouched] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    if (!token) return
    api<{ email: string }>('/auth/password/check', 'POST', { token })
      .then((res) => setState({ kind: 'ready', email: res.email }))
      .catch((err) => setState({ kind: 'invalid', message: errorMessage(err) }))
  }, [token])

  const problem = password ? passwordProblem(password, {}) : 'Choose a password.'

  async function submit(e: FormEvent) {
    e.preventDefault()
    setTouched(true)
    if (problem) return
    setBusy(true)
    setError(null)
    try {
      await api('/auth/password/reset', 'POST', { token, password })
      // Every device was signed out, this one included.
      if (useSession.getState().status === 'signedIn') expire()
      toast('Password changed. Sign in with your new password.')
      navigate('/login', { replace: true })
    } catch (err) {
      setError(errorMessage(err))
      setAttempt((a) => a + 1)
    } finally {
      setBusy(false)
    }
  }

  if (state.kind === 'checking') {
    return (
      <AuthLayout title="Checking your link…">
        <div className="flex justify-center py-6 text-aqua">
          <Spinner size={22} />
        </div>
      </AuthLayout>
    )
  }

  if (state.kind === 'invalid') {
    return (
      <AuthLayout title="That link didn’t work" subtitle={state.message}>
        <div className="card mb-6 flex items-center gap-3 p-4 text-[14px] text-muted">
          <CircleAlert size={18} className="shrink-0 text-warn" /> Reset links work once and expire after 30 minutes.
        </div>
        <ButtonLink to="/forgot-password" variant="primary" size="lg" className="w-full">
          Send a new link <ArrowRight size={16} />
        </ButtonLink>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Choose a new password"
      subtitle={<>For <b className="font-semibold text-fg">{state.email}</b>. Every device will be signed out.</>}
      footer={
        <Link to="/login" className="font-semibold text-fg underline-offset-4 hover:underline">
          Back to sign in
        </Link>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <FormError message={error} shakeKey={attempt} />
        <Field label="New password" error={touched && problem ? problem : null}>
          <PasswordInput className="h-11" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} maxLength={200} autoFocus aria-invalid={Boolean(touched && problem)} />
          <StrengthMeter password={password} />
        </Field>
        <Button variant="primary" size="lg" type="submit" className="w-full" loading={busy}>
          <CircleCheck size={16} /> Save new password
        </Button>
      </form>
    </AuthLayout>
  )
}
