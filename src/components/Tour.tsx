import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, ArrowRight, X } from 'lucide-react'
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useReducedMotion } from '../lib/hooks'
import { uiZoom } from '../lib/textSize'
import { useTheme } from '../lib/theme'
import { useLock } from '../native/lock'
import { markTourSeen, tourSeen, useTourVersion } from '../store/useTour'

export interface TourStep {
  /** CSS selector for what to point at; the first visible match is used and the step is skipped if there's none. Omit for a message in the middle. */
  target?: string
  title: string
  body: ReactNode
}

const GAP = 12
const PAD = 8

type Run = { steps: TourStep[]; index: number } | null

/** Moves a running tour by `d` steps; past the last step it ends and is remembered as seen. */
const step =
  (id: string, d: number) =>
  (r: Run): Run => {
    if (!r) return r
    const i = r.index + d
    if (i >= r.steps.length) {
      markTourSeen(id)
      return null
    }
    return { ...r, index: Math.max(0, i) }
  }

function findVisible(selector: string): HTMLElement | null {
  for (const el of document.querySelectorAll<HTMLElement>(selector)) {
    const r = el.getBoundingClientRect()
    if (r.width > 0 && r.height > 0 && getComputedStyle(el).visibility !== 'hidden') return el
  }
  return null
}

/**
 * A short guided tour: dims the page, points at one thing at a time and explains it. Shown once per browser (see
 * useTour); Help can bring every tour back. Steps whose target isn't on screen (no class today, say) are skipped.
 */
export function Tour({ id, steps, when = true }: { id: string; steps: TourStep[]; when?: boolean }) {
  const version = useTourVersion((s) => s.version)
  const [run, setRun] = useState<Run>(null)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const reduce = useReducedMotion()
  const theme = useTheme((s) => s.resolved)
  const next = useRef<HTMLButtonElement>(null)
  const titleId = useId()
  // The latest steps, read when the tour starts (the array is rebuilt on every render).
  const latest = useRef(steps)
  useLayoutEffect(() => {
    latest.current = steps
  })

  // Start a moment after the page settles, with only the steps that have something to point at.
  // Never over the lock screen (the phone app asks for a fingerprint when it opens).
  const locked = useLock((s) => s.locked)
  useEffect(() => {
    if (!when || locked || tourSeen(id)) return
    const t = setTimeout(() => {
      const live = latest.current.filter((s) => !s.target || findVisible(s.target))
      if (live.length) setRun({ steps: live, index: 0 })
    }, 700)
    return () => clearTimeout(t)
  }, [id, when, locked, version])

  const current = run ? run.steps[run.index] : null

  // Bring the target into view and follow it while the page scrolls or resizes.
  useEffect(() => {
    if (!current) return
    const el = current.target ? findVisible(current.target) : null
    el?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' })
    let frame = 0
    const started = performance.now()
    const measure = () => setRect(el ? el.getBoundingClientRect() : null)
    const follow = () => {
      measure()
      if (performance.now() - started < 700) frame = requestAnimationFrame(follow)
    }
    frame = requestAnimationFrame(follow)
    window.addEventListener('resize', measure)
    window.addEventListener('scroll', measure, true)
    next.current?.focus({ preventScroll: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', measure)
      window.removeEventListener('scroll', measure, true)
    }
  }, [current, reduce])

  const finish = () => {
    markTourSeen(id)
    setRun(null)
  }
  const go = (d: number) => setRun(step(id, d))

  const open = Boolean(run)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        markTourSeen(id)
        setRun(null)
      } else if (e.key === 'ArrowRight') setRun(step(id, 1))
      else if (e.key === 'ArrowLeft') setRun(step(id, -1))
      else return
      e.preventDefault()
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, id])

  if (!run || !current) return null

  // Screen measurements, turned into the page's (zoomed) pixels: see Display size.
  const z = uiZoom()
  const vw = window.innerWidth / z
  const vh = window.innerHeight / z
  const width = Math.min(360, vw - 32)
  const hole = current.target && rect ? { top: rect.top / z - PAD, left: rect.left / z - PAD, width: rect.width / z + PAD * 2, height: rect.height / z + PAD * 2 } : null
  let card: CSSProperties = { width, left: (vw - width) / 2, top: '50%', transform: 'translateY(-50%)' }
  if (hole) {
    const left = Math.min(Math.max(16, hole.left + hole.width / 2 - width / 2), vw - width - 16)
    const below = vh - (hole.top + hole.height)
    if (below >= 220) card = { width, left, top: hole.top + hole.height + GAP }
    else if (hole.top >= 220) card = { width, left, bottom: vh - hole.top + GAP }
    else card = { width, left: (vw - width) / 2, bottom: 16 }
  }
  const last = run.index === run.steps.length - 1
  // A dark page needs a heavier dim to show what's lit up.
  const dim = theme === 'dark' ? 'rgb(0 0 0 / 0.74)' : 'rgb(3 7 14 / 0.55)'

  return createPortal(
    <div className="fixed inset-0 z-[80]" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      {/* The dimmed page, with a window cut around the thing being explained. */}
      {hole ? (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute rounded-2xl"
          // The aqua outline and the dimmed page are both shadows of the same box, so they can't drift apart.
          style={{ boxShadow: `0 0 0 2px var(--color-aqua), 0 0 24px 2px color-mix(in oklab, var(--color-aqua) 45%, transparent), 0 0 0 9999px ${dim}` }}
          initial={false}
          animate={hole}
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 260, damping: 32 }}
        />
      ) : (
        <div aria-hidden className="absolute inset-0" style={{ background: dim }} />
      )}
      <AnimatePresence mode="wait">
        <motion.div
          key={run.index}
          initial={reduce ? false : { opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="absolute rounded-2xl border border-line-2 bg-panel p-5 shadow-[var(--shadow-lg)]"
          style={card}
        >
          <div className="flex items-center justify-between">
            <span className="text-[12px] font-semibold text-aqua">
              {run.index + 1} of {run.steps.length}
            </span>
            <button
              type="button"
              onClick={finish}
              aria-label="Close the tour"
              className="-mr-1.5 -mt-1 inline-flex size-8 items-center justify-center rounded-full text-dim hover:bg-fg/[0.06] hover:text-fg"
            >
              <X size={16} />
            </button>
          </div>
          <h2 id={titleId} className="mt-1 font-display text-[18px] font-bold leading-snug">
            {current.title}
          </h2>
          <div className="mt-1.5 text-[14px] leading-relaxed text-muted">{current.body}</div>
          <div className="mt-4 flex items-center gap-2">
            {run.index === 0 ? (
              <button type="button" onClick={finish} className="text-[13px] font-medium text-muted hover:text-fg">
                Skip tour
              </button>
            ) : (
              <button type="button" onClick={() => go(-1)} className="inline-flex items-center gap-1 text-[13px] font-medium text-muted hover:text-fg">
                <ArrowLeft size={14} /> Back
              </button>
            )}
            <button
              ref={next}
              type="button"
              onClick={() => go(1)}
              className="btn-primary ml-auto inline-flex h-9 items-center gap-1.5 rounded-full px-4 text-[13.5px] font-semibold"
            >
              {last ? 'Got it' : 'Next'}
              {!last && <ArrowRight size={14} />}
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>,
    document.body,
  )
}
