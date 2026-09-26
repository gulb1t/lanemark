import { ShieldCheck } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { CodeInput } from '../../components/ui/CodeInput'
import { Field } from '../../components/ui/bits'
import { ApiError, errorMessage } from '../../lib/api'
import { safeNext } from '../../lib/redirect'
import { verifyLogin } from '../../store/useSession'
import { toast } from '../../store/useUi'
import { AuthLayout, FormError } from './AuthLayout'

export default function Verify() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [mode, setMode] = useState<'totp' | 'recovery'>('totp')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)

  async function submit(value = code) {
    if (busy) return
    setBusy(true)
    setError(null)
    try {
      const { usedRecoveryCode } = await verifyLogin(value)
      if (usedRecoveryCode) toast('Recovery code used. Generate new codes in Settings if you’re running low.')
      navigate(safeNext(params.get('next')), { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.code === 'mfa_expired') {
        toast(err.message, 'error')
        navigate('/login', { replace: true })
        return
      }
      setError(errorMessage(err))
      setAttempt((a) => a + 1)
      setCode('')
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthLayout
      title="Two-step verification"
      subtitle={mode === 'totp' ? 'Enter the 6-digit code from your authenticator app.' : 'Enter one of the recovery codes you saved when you turned on 2FA.'}
      footer={
        <Link to="/login" className="underline-offset-4 hover:underline">
          Use a different account
        </Link>
      }
    >
      <div className="mb-6 flex size-12 items-center justify-center rounded-2xl border border-aqua/30 bg-aqua/10 text-aqua">
        <ShieldCheck size={22} />
      </div>
      <FormError message={error} shakeKey={attempt} />
      {mode === 'totp' ? (
        <div className="space-y-5">
          <CodeInput value={code} onChange={setCode} onComplete={(v) => void submit(v)} disabled={busy} error={Boolean(error)} autoFocus />
          <Button variant="primary" size="lg" className="w-full" loading={busy} disabled={code.length !== 6} onClick={() => void submit()}>
            Verify
          </Button>
        </div>
      ) : (
        <form
          className="space-y-4"
          onSubmit={(e: FormEvent) => {
            e.preventDefault()
            void submit()
          }}
        >
          <Field label="Recovery code">
            <input className="input h-11 font-mono tracking-wider" placeholder="xxxxx-xxxxx" value={code} onChange={(e) => setCode(e.target.value)} autoFocus autoComplete="off" spellCheck={false} />
          </Field>
          <Button variant="primary" size="lg" type="submit" className="w-full" loading={busy} disabled={code.trim().length < 10}>
            Verify
          </Button>
        </form>
      )}
      <button
        type="button"
        onClick={() => {
          setMode(mode === 'totp' ? 'recovery' : 'totp')
          setCode('')
          setError(null)
        }}
        className="mt-5 w-full text-center text-sm text-muted underline-offset-4 hover:text-fg hover:underline"
      >
        {mode === 'totp' ? 'Lost your phone? Use a recovery code' : 'Use an authenticator code instead'}
      </button>
    </AuthLayout>
  )
}
