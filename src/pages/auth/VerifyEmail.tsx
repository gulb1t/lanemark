import { ArrowRight, CircleAlert, MailCheck } from 'lucide-react'
import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ButtonLink } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/bits'
import { api, errorMessage, type User } from '../../lib/api'
import { setUser, useSession } from '../../store/useSession'
import { AuthLayout } from './AuthLayout'

type State = { kind: 'working' } | { kind: 'done'; email: string; changed: boolean } | { kind: 'failed'; message: string }

export default function VerifyEmail() {
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const status = useSession((s) => s.status)
  const [state, setState] = useState<State>(() => (token ? { kind: 'working' } : { kind: 'failed', message: 'This page needs the link from your email.' }))
  const ran = useRef(false)

  useEffect(() => {
    // Links are single use, so never send the token twice (StrictMode runs effects twice in development).
    if (ran.current) return
    ran.current = true
    if (!token) return
    api<{ email: string; changed: boolean }>('/auth/email/verify', 'POST', { token })
      .then(async (res) => {
        setState({ kind: 'done', email: res.email, changed: res.changed })
        // Refresh the signed-in user on this device so the reminder disappears.
        const me = await api<{ user: User }>('/me').catch(() => null)
        if (me) setUser(me.user)
      })
      .catch((err) => setState({ kind: 'failed', message: errorMessage(err) }))
  }, [token])

  const signedIn = status === 'signedIn'
  const next = (
    <ButtonLink to={signedIn ? '/app' : '/login'} variant="primary" size="lg" className="w-full">
      {signedIn ? 'Open Lanemark' : 'Sign in'} <ArrowRight size={16} />
    </ButtonLink>
  )

  if (state.kind === 'working') {
    return (
      <AuthLayout title="Confirming your email…">
        <div className="flex justify-center py-6 text-aqua">
          <Spinner size={22} />
        </div>
      </AuthLayout>
    )
  }
  if (state.kind === 'failed') {
    return (
      <AuthLayout title="That link didn’t work" subtitle={state.message}>
        <div className="card mb-6 flex items-center gap-3 p-4 text-[14px] text-muted">
          <CircleAlert size={18} className="shrink-0 text-warn" /> Confirmation links work once, for 24 hours. You can send a new one from Settings.
        </div>
        {next}
      </AuthLayout>
    )
  }
  return (
    <AuthLayout title={state.changed ? 'Email changed' : 'Email confirmed'} subtitle={<>Your account now uses <b className="font-semibold text-fg">{state.email}</b>.</>}>
      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 18 }} className="mb-8 flex justify-center">
        <span className="icon-tile size-16 !rounded-2xl">
          <MailCheck size={28} />
        </span>
      </motion.div>
      {next}
    </AuthLayout>
  )
}
