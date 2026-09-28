import { motion } from 'motion/react'
import { Fingerprint, ScanFace } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Logo } from '../components/Logo'
import { Button } from '../components/ui/Button'
import { Modal } from '../components/ui/Modal'
import { currentAppToken, switchToPassword, unlock } from '../store/useSession'
import { toast } from '../store/useUi'
import { declineLock, lockMessage, setLockPref, useLock } from './lock'

function lastName(): string {
  try {
    const raw = localStorage.getItem('swimtrack:last-user')
    return raw ? ((JSON.parse(raw) as { name?: string }).name?.split(' ')[0] ?? '') : ''
  } catch {
    return ''
  }
}

/** Full-screen lock in the phone app. Asks for the fingerprint straight away; the button asks again. */
export function AppLock() {
  const locked = useLock((s) => s.locked)
  const biometrics = useLock((s) => s.biometrics)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const asked = useRef(false)

  async function tryUnlock() {
    setBusy(true)
    setMessage('')
    const error = await unlock()
    setBusy(false)
    if (!error) return
    // The saved sign-in is gone (new fingerprints) or can't be read here: only the password can help.
    if (error === 'invalidated' || error === 'unavailable') {
      toast(lockMessage(error), 'error')
      await switchToPassword()
    } else setMessage(lockMessage(error))
  }

  useEffect(() => {
    if (!locked) {
      asked.current = false
      return
    }
    if (asked.current) return
    asked.current = true
    // Give the lock screen a frame to draw before the system prompt slides over it.
    const t = setTimeout(() => void tryUnlock(), 250)
    return () => clearTimeout(t)
  }, [locked])

  if (!locked) return null
  const name = lastName()
  const Icon = biometrics === 'weak' ? ScanFace : Fingerprint
  return (
    <div className="fixed inset-0 z-[100] flex flex-col bg-ink" role="dialog" aria-modal="true" aria-label="SwimTrack is locked">
      <div className="ambient" aria-hidden />
      <div className="relative flex flex-1 flex-col items-center justify-center px-8 text-center">
        <motion.div initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}>
          <Logo size={56} animated />
        </motion.div>
        <h1 className="mt-7 font-display text-[1.9rem] font-bold tracking-tight">{name ? `Welcome back, ${name}` : 'Welcome back'}</h1>
        <p className="mt-2 max-w-xs text-[15px] text-muted">SwimTrack is locked. Unlock it to see your classes.</p>
        <button
          type="button"
          onClick={() => void tryUnlock()}
          disabled={busy}
          aria-label="Unlock"
          className="mt-10 flex size-24 items-center justify-center rounded-full border border-aqua/30 bg-aqua/10 text-aqua transition-transform active:scale-95 disabled:opacity-60"
        >
          <Icon size={44} strokeWidth={1.5} />
        </button>
        <p className="mt-4 text-[14px] font-medium">Tap to unlock</p>
        {message && (
          <p role="alert" className="mt-6 max-w-xs text-[14px] leading-relaxed text-warn">
            {message}
          </p>
        )}
      </div>
      <div className="relative px-8 pb-10 text-center" style={{ paddingBottom: 'calc(2.5rem + env(safe-area-inset-bottom))' }}>
        <button type="button" onClick={() => void switchToPassword()} className="text-[14px] font-medium text-muted underline-offset-4 hover:text-fg hover:underline">
          Sign in with your password instead
        </button>
      </div>
    </div>
  )
}

/** Asked once, after the first sign-in on this phone. */
export function UnlockOffer() {
  const open = useLock((s) => s.offer)
  const biometrics = useLock((s) => s.biometrics)
  const [busy, setBusy] = useState(false)
  const close = () => useLock.setState({ offer: false })

  function notNow() {
    declineLock()
    close()
  }

  async function turnOn() {
    const token = currentAppToken()
    if (!token) return close()
    setBusy(true)
    const res = await setLockPref(true, token)
    setBusy(false)
    close()
    if (res.ok) toast('Fingerprint unlock is on')
    else if (res.error !== 'cancelled') toast(lockMessage(res.error), 'error')
  }

  const Icon = biometrics === 'weak' ? ScanFace : Fingerprint
  return (
    <Modal
      open={open}
      onClose={notNow}
      title="Unlock with your fingerprint?"
      description="Next time, open SwimTrack with your fingerprint, face or screen lock instead of your password. You can change this in Settings."
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={notNow}>
            Not now
          </Button>
          <Button variant="primary" icon={<Icon size={16} />} loading={busy} onClick={() => void turnOn()}>
            Turn on
          </Button>
        </>
      }
    >
      <div className="flex justify-center py-4">
        <span className="flex size-20 items-center justify-center rounded-full bg-aqua/10 text-aqua">
          <Icon size={38} strokeWidth={1.5} />
        </span>
      </div>
    </Modal>
  )
}
