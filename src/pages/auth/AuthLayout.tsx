import { motion } from 'motion/react'
import { ArrowLeft, Check } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Caustics } from '../../components/fx/Caustics'
import { Logo, Wordmark } from '../../components/Logo'
import { ThemeToggle } from '../../components/ThemeToggle'

const POINTS = ['Attendance in two taps', 'Report cards that write themselves', 'Works offline on deck', 'Two-factor sign-in']

export function AuthLayout({ title, subtitle, children, footer }: { title: ReactNode; subtitle?: ReactNode; children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* Water panel */}
      <aside className="relative hidden overflow-hidden lg:block">
        <Caustics className="absolute inset-0" />
        {/* Follows the theme: the scrim fades the water toward the page colour so the text stays readable. */}
        <div className="absolute inset-0 bg-[linear-gradient(to_top,color-mix(in_oklab,var(--color-ink)_78%,transparent),color-mix(in_oklab,var(--color-ink)_12%,transparent)_55%,color-mix(in_oklab,var(--color-ink)_35%,transparent))]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_65%_38%_at_28%_52%,color-mix(in_oklab,var(--color-ink)_50%,transparent),transparent)]" />
        <div className="relative flex h-full flex-col justify-between p-10">
          <Link to="/" className="flex w-fit items-center gap-2.5">
            <Logo size={34} />
            <Wordmark size={18} />
          </Link>
          <div>
            <motion.h2
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
              className="text-gradient max-w-md font-display text-5xl font-extrabold leading-[1.04] tracking-[-0.035em]"
            >
              Every length, <span className="accent">logged.</span>
            </motion.h2>
            <ul className="mt-8 space-y-3">
              {POINTS.map((p, i) => (
                <motion.li
                  key={p}
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 + i * 0.08, duration: 0.5 }}
                  className="flex items-center gap-3 text-[15px] text-fg/80"
                >
                  <span className="flex size-6 items-center justify-center rounded-full border border-fg/15 bg-panel/60 text-aqua backdrop-blur">
                    <Check size={13} strokeWidth={3} />
                  </span>
                  {p}
                </motion.li>
              ))}
            </ul>
          </div>
          <p className="text-xs text-dim">Move your cursor over the water.</p>
        </div>
      </aside>

      {/* Form */}
      <main className="relative flex flex-col">
        <div className="ambient lg:hidden" aria-hidden />
        <div className="relative flex items-center justify-between p-4 sm:p-6">
          <Link to="/" className="flex items-center gap-2 text-sm text-muted transition-colors hover:text-fg">
            <ArrowLeft size={15} />
            <span className="lg:hidden">
              <Wordmark size={14} />
            </span>
            <span className="hidden lg:inline">Back to home</span>
          </Link>
          <ThemeToggle />
        </div>
        <div className="relative flex flex-1 items-center justify-center px-5 pb-16 pt-4">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[400px]"
          >
            <div className="mb-8 lg:hidden">
              <Logo size={40} animated />
            </div>
            <h1 className="page-title !text-[2rem]">{title}</h1>
            {subtitle && <p className="mt-2 text-[15px] leading-relaxed text-muted">{subtitle}</p>}
            <div className="mt-8">{children}</div>
            {footer && <div className="mt-8 text-center text-sm text-muted">{footer}</div>}
          </motion.div>
        </div>
      </main>
    </div>
  )
}

export function FormError({ message, shakeKey }: { message: string | null; shakeKey: number }) {
  if (!message) return null
  return (
    <motion.div
      key={shakeKey}
      role="alert"
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0, x: [0, -8, 8, -6, 6, -3, 0] }}
      transition={{ duration: 0.45 }}
      className="mb-4 rounded-xl border border-bad/30 bg-bad/10 px-3.5 py-2.5 text-[13.5px] text-bad"
    >
      {message}
    </motion.div>
  )
}
