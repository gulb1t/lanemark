import { motion } from 'motion/react'
import { useRef, type ClipboardEvent, type KeyboardEvent } from 'react'

/**
 * Six single-digit boxes for authenticator codes. Typing advances, Backspace goes back, pasting fills every box,
 * and `onComplete` fires as soon as all six digits are in.
 */
export function CodeInput({
  value,
  onChange,
  onComplete,
  disabled,
  error,
  autoFocus,
}: {
  value: string
  onChange: (v: string) => void
  onComplete?: (v: string) => void
  disabled?: boolean
  error?: boolean
  autoFocus?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  const digits = value.padEnd(6, ' ').slice(0, 6).split('')

  function set(next: string) {
    const clean = next.replace(/\D/g, '').slice(0, 6)
    onChange(clean)
    if (clean.length === 6) onComplete?.(clean)
    return clean
  }

  function onInput(i: number, raw: string) {
    const d = raw.replace(/\D/g, '')
    if (!d) return
    if (d.length > 1) {
      const clean = set(value.slice(0, i) + d)
      refs.current[Math.min(clean.length, 5)]?.focus()
      return
    }
    const next = (value.slice(0, i) + d + value.slice(i + 1)).slice(0, 6)
    set(next)
    refs.current[Math.min(i + 1, 5)]?.focus()
  }

  function onKey(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace') {
      e.preventDefault()
      if (value[i]) set(value.slice(0, i) + value.slice(i + 1))
      else if (i > 0) {
        set(value.slice(0, i - 1) + value.slice(i))
        refs.current[i - 1]?.focus()
      }
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus()
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus()
  }

  function onPaste(e: ClipboardEvent) {
    e.preventDefault()
    const clean = set(e.clipboardData.getData('text'))
    refs.current[Math.min(clean.length, 5)]?.focus()
  }

  return (
    <motion.div className="flex max-w-[22rem] justify-between gap-2" animate={error ? { x: [0, -10, 10, -7, 7, -3, 0] } : { x: 0 }} transition={{ duration: 0.45 }}>
      {digits.map((d, i) => {
        const filled = d.trim() !== ''
        return (
          <div key={i} className={`relative ${i === 3 ? 'ml-3' : ''}`}>
            <input
              ref={(el) => {
                refs.current[i] = el
              }}
              value={d.trim()}
              onChange={(e) => onInput(i, e.target.value)}
              onKeyDown={(e) => onKey(i, e)}
              onPaste={onPaste}
              onFocus={(e) => e.target.select()}
              inputMode="numeric"
              autoComplete={i === 0 ? 'one-time-code' : 'off'}
              autoFocus={autoFocus && i === 0}
              disabled={disabled}
              aria-label={`Digit ${i + 1}`}
              aria-invalid={error || undefined}
              maxLength={6}
              className={`h-14 w-11 rounded-xl border bg-ink text-center font-mono text-2xl font-semibold text-fg outline-none transition-[border-color,box-shadow,transform] focus:border-aqua/70 focus:shadow-[0_0_0_4px_rgb(var(--accent-rgb)/0.14)] sm:w-12 ${error ? 'border-bad/60' : filled ? 'border-aqua/40' : 'border-line-2'}`}
            />
            {filled && (
              <motion.span
                key={d}
                initial={{ scale: 1.6, opacity: 0.6 }}
                animate={{ scale: 1, opacity: 0 }}
                transition={{ duration: 0.4 }}
                className="pointer-events-none absolute inset-0 rounded-xl border border-aqua"
              />
            )}
          </div>
        )
      })}
    </motion.div>
  )
}
