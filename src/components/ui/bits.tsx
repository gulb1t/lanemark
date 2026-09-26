import { animate, motion, useInView, useReducedMotion } from 'motion/react'
import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { PROGRAMS } from '../../data/curriculum'
import type { LevelDef, ProgramId } from '../../types'

export function Field({ label, hint, error, children }: { label: string; hint?: ReactNode; error?: string | null; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[13px] font-medium text-muted">{label}</span>
      {children}
      {error ? (
        <motion.span initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} className="mt-1.5 block text-xs text-bad" role="alert">
          {error}
        </motion.span>
      ) : (
        hint && <span className="mt-1.5 block text-xs text-dim">{hint}</span>
      )}
    </label>
  )
}

export function ProgressBar({ value, color = 'var(--color-aqua)', className = '' }: { value: number; color?: string; className?: string }) {
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className={`h-1.5 overflow-hidden rounded-full bg-fg/[0.07] ${className}`} role="progressbar" aria-valuenow={Math.round(v * 100)} aria-valuemin={0} aria-valuemax={100}>
      <motion.div
        className="h-full rounded-full"
        style={{ background: color }}
        initial={{ width: 0 }}
        animate={{ width: `${v * 100}%` }}
        transition={{ type: 'spring', stiffness: 90, damping: 20 }}
      />
    </div>
  )
}

/** Circular progress with an animated stroke. */
export function ProgressRing({
  value,
  size = 44,
  stroke = 4,
  color = 'var(--color-aqua)',
  children,
}: {
  value: number
  size?: number
  stroke?: number
  color?: string
  children?: ReactNode
}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = Math.max(0, Math.min(1, value))
  return (
    <div className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-fg/[0.16]" />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          initial={{ strokeDashoffset: c }}
          animate={{ strokeDashoffset: c * (1 - v) }}
          transition={{ type: 'spring', stiffness: 70, damping: 18 }}
        />
      </svg>
      {children && <div className="absolute inset-0 flex items-center justify-center">{children}</div>}
    </div>
  )
}

/** Counts up to `value` when scrolled into view. */
export function NumberTicker({ value, format = (n) => String(Math.round(n)), className = '' }: { value: number; format?: (n: number) => string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, margin: '-20px' })
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)
  const from = useRef(0)
  useEffect(() => {
    if (!inView || reduce) return
    // Start from whatever is on screen, so an interrupted animation resumes instead of freezing.
    const controls = animate(from.current, value, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => {
        from.current = n
        setShown(n)
      },
    })
    return () => controls.stop()
  }, [inView, value, reduce])
  return (
    <span ref={ref} className={`tabular-nums ${className}`}>
      {format(reduce ? value : shown)}
    </span>
  )
}

export function LevelChip({ level, program }: { level?: Pick<LevelDef, 'short' | 'program'>; program?: ProgramId }) {
  const p = program ?? level?.program
  const hue = p ? PROGRAMS[p].hue : '#8b94a1'
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11.5px] font-semibold"
      style={{ color: hue, borderColor: `color-mix(in oklab, ${hue} 35%, transparent)`, background: `color-mix(in oklab, ${hue} 9%, transparent)` }}
    >
      <span className="size-1.5 rounded-full" style={{ background: hue }} />
      {level?.short ?? (p ? PROGRAMS[p].label : 'Custom')}
    </span>
  )
}

export function Stat({ label, value, format, sub, accent, icon }: { label: string; value: number | null; format?: (n: number) => string; sub?: string; accent: string; icon?: ReactNode }) {
  return (
    <div className="card spotlight overflow-hidden px-4 py-4">
      <div className="relative flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        {icon && (
          <span className="flex size-8 items-center justify-center rounded-xl" style={{ color: accent, background: `color-mix(in oklab, ${accent} 13%, transparent)` }}>
            {icon}
          </span>
        )}
      </div>
      <div className="relative mt-3 font-display text-[28px] font-bold leading-none tracking-tight">
        {value === null ? <span className="text-dim">—</span> : <NumberTicker value={value} format={format} />}
      </div>
      {sub && <div className="relative mt-1.5 text-xs text-dim">{sub}</div>}
    </div>
  )
}

export function EmptyState({ icon, title, body, action }: { icon: ReactNode; title: string; body?: string; action?: ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="card flex flex-col items-center gap-3 border-dashed px-6 py-14 text-center"
    >
      <div className="icon-tile relative size-14">
        <span className="relative">{icon}</span>
      </div>
      <div>
        <h3 className="text-base font-semibold">{title}</h3>
        {body && <p className="mx-auto mt-1 max-w-sm text-sm leading-relaxed text-muted">{body}</p>}
      </div>
      {action && <div className="mt-1 flex flex-wrap justify-center gap-2">{action}</div>}
    </motion.div>
  )
}

/** Segmented control with a sliding highlight. */
export function Segmented<T extends string>({
  value,
  onChange,
  options,
  label,
  size = 'md',
}: {
  value: T
  onChange: (v: T) => void
  options: { value: T; label: ReactNode }[]
  label: string
  size?: 'sm' | 'md'
}) {
  const id = useId()
  return (
    <div role="radiogroup" aria-label={label} className="inline-flex rounded-xl border border-line bg-panel p-0.5">
      {options.map((o) => {
        const active = value === o.value
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(o.value)}
            className={`relative flex items-center gap-1.5 rounded-[10px] font-medium transition-colors ${size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3 py-1.5 text-[13px]'} ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
          >
            {active && (
              <motion.span
                layoutId={`seg-${id}`}
                className="absolute inset-0 rounded-[10px] bg-panel-2 shadow-[inset_0_0_0_1px_var(--color-line-2)]"
                transition={{ type: 'spring', stiffness: 500, damping: 38 }}
              />
            )}
            <span className="relative flex items-center gap-1.5">{o.label}</span>
          </button>
        )
      })}
    </div>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="inline-flex h-5 min-w-5 items-center justify-center rounded-md border border-line-2 bg-panel-2 px-1 font-mono text-[10px] font-medium text-muted">
      {children}
    </kbd>
  )
}

/** Words fade up out of a blur, one after another. */
export function BlurText({ text, className = '', wordClassName = '', delay = 0 }: { text: string; className?: string; wordClassName?: string; delay?: number }) {
  const words = text.split(' ')
  return (
    <span className={className}>
      {words.map((w, i) => (
        <motion.span
          key={i}
          className={`inline-block whitespace-pre ${wordClassName}`}
          initial={{ opacity: 0, filter: 'blur(10px)', y: 12 }}
          animate={{ opacity: 1, filter: 'blur(0px)', y: 0 }}
          transition={{ duration: 0.7, delay: delay + i * 0.06, ease: [0.16, 1, 0.3, 1] }}
        >
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </motion.span>
      ))}
    </span>
  )
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <span
      className="inline-block animate-spin rounded-full border-2 border-current border-r-transparent"
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  )
}
