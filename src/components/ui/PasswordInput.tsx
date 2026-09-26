import { motion } from 'motion/react'
import { Eye, EyeOff } from 'lucide-react'
import { forwardRef, useState, type InputHTMLAttributes } from 'react'
import { passwordStrength } from '../../lib/passwordPolicy'

export const PasswordInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(function PasswordInput({ className = '', ...props }, ref) {
  const [show, setShow] = useState(false)
  return (
    <div className="relative">
      <input ref={ref} type={show ? 'text' : 'password'} className={`input pr-11 ${className}`} spellCheck={false} {...props} />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1.5 top-1/2 flex size-8 -translate-y-1/2 items-center justify-center rounded-lg text-dim transition-colors hover:text-fg"
      >
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  )
})

const LABELS = ['Too short', 'Weak', 'Okay', 'Strong', 'Excellent']
const COLORS = ['var(--color-bad)', 'var(--color-bad)', 'var(--color-warn)', 'var(--color-good)', 'var(--color-aqua)']

export function StrengthMeter({ password }: { password: string }) {
  const score = passwordStrength(password)
  return (
    <div className="mt-2" aria-live="polite">
      <div className="flex gap-1.5">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-1 flex-1 overflow-hidden rounded-full bg-fg/[0.08]">
            <motion.div
              className="h-full rounded-full"
              initial={false}
              animate={{ width: score >= i ? '100%' : '0%', backgroundColor: COLORS[score] }}
              transition={{ type: 'spring', stiffness: 220, damping: 26, delay: (i - 1) * 0.04 }}
            />
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-xs">
        <span style={{ color: password ? COLORS[score] : 'var(--color-dim)' }}>{password ? LABELS[score] : 'At least 10 characters'}</span>
        <span className="text-dim">A few random words works great.</span>
      </div>
    </div>
  )
}
