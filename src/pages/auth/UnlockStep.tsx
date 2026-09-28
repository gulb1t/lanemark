import { Fingerprint, ScanFace } from 'lucide-react'
import { useState } from 'react'
import { Button } from '../../components/ui/Button'
import { declineLock, lockMessage, setLockPref, useLock } from '../../native/lock'
import { currentAppToken } from '../../store/useSession'
import { toast } from '../../store/useUi'
import { AuthLayout } from './AuthLayout'

/**
 * The last step of the first sign-in on a phone: "Unlock with your fingerprint next time?". It's part of signing in,
 * so it shows before the app (and its tours) instead of on top of them.
 */
export default function UnlockStep() {
  const biometrics = useLock((s) => s.biometrics)
  const [busy, setBusy] = useState(false)
  const done = () => useLock.setState({ offer: false })

  function notNow() {
    declineLock()
    done()
  }

  async function turnOn() {
    const token = currentAppToken()
    if (!token) return done()
    setBusy(true)
    const res = await setLockPref(true, token)
    setBusy(false)
    // Cancelling the system prompt leaves the choice open: they can try again or pick "Not now".
    if (!res.ok && res.error === 'cancelled') return
    done()
    if (res.ok) toast('Fingerprint unlock is on')
    else toast(lockMessage(res.error), 'error')
  }

  const Icon = biometrics === 'weak' ? ScanFace : Fingerprint
  return (
    <AuthLayout title="One more thing" subtitle="Open SwimTrack with your fingerprint, face or screen lock next time, instead of your password.">
      <div className="flex justify-center pb-8 pt-2">
        <span className="flex size-24 items-center justify-center rounded-full border border-aqua/30 bg-aqua/10 text-aqua">
          <Icon size={44} strokeWidth={1.5} />
        </span>
      </div>
      <div className="space-y-3">
        <Button variant="primary" size="lg" className="w-full" icon={<Icon size={17} />} loading={busy} onClick={() => void turnOn()}>
          Turn on fingerprint unlock
        </Button>
        <Button variant="ghost" size="lg" className="w-full" onClick={notNow} disabled={busy}>
          Not now
        </Button>
      </div>
      <p className="mt-6 text-center text-[13px] text-muted">You can change this any time in Settings → This phone.</p>
    </AuthLayout>
  )
}
