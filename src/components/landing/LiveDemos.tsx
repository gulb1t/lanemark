import { AnimatePresence, motion, useInView } from 'motion/react'
import { Check, Clock, Cloud, CloudOff, Loader2, Minus, Search, ShieldCheck, Smartphone, Wifi, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { LEVEL_BY_ID, LEVELS, PROGRAMS } from '../../data/curriculum'
import { generateComment } from '../../lib/report'
import { Avatar } from '../ui/Avatar'
import { LevelChip } from '../ui/bits'

/** Runs `tick` every `ms` while the element is on screen. */
function useTicker(ms: number) {
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-40px' })
  const [n, setN] = useState(0)
  useEffect(() => {
    if (!inView || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const id = setInterval(() => setN((x) => x + 1), ms)
    return () => clearInterval(id)
  }, [inView, ms])
  return { ref, n }
}

const KIDS = ['Maya Chen', 'Noah Patel', 'Sofia Rossi', 'Ethan Kim', 'Amara Okafor']

// ── Hero preview: skill matrix that fills itself in ──────────────────
const SKILLS = LEVEL_BY_ID.sw3.skills.filter((s) => s.category === 'Movement & Swimming' || s.category === 'Surface Support').slice(0, 6)

export function LiveMatrix() {
  const { ref, n } = useTicker(260)
  const total = SKILLS.length * KIDS.length
  // A deterministic "instructor" fills cells in a zig-zag, a few are marked incomplete, then it resets.
  const step = n % (total + 12)
  return (
    <div ref={ref} className="overflow-hidden rounded-2xl border border-line bg-panel">
      <div className="flex items-center justify-between border-b border-line px-4 py-3">
        <div className="flex items-center gap-2.5">
          <LevelChip level={LEVEL_BY_ID.sw3} />
          <span className="text-sm font-semibold">Swimmer 3 · Tue 5:30</span>
        </div>
        <span className="font-mono text-[11px] text-dim">{Math.min(step, total)}/{total} checked</span>
      </div>
      <div className="grid grid-cols-[minmax(0,1.7fr)_repeat(5,minmax(0,1fr))] text-[12px]">
        <div className="border-b border-line px-4 py-2 text-dim">Skill</div>
        {KIDS.map((k) => (
          <div key={k} className="flex flex-col items-center gap-1 border-b border-line py-2">
            <Avatar name={k} size={22} />
            <span className="hidden text-[10px] text-muted sm:block">{k.split(' ')[0]}</span>
          </div>
        ))}
        {SKILLS.map((s, r) => (
          <Row key={s.id} name={s.name} r={r} step={step} />
        ))}
      </div>
    </div>
  )
}

function Row({ name, r, step }: { name: string; r: number; step: number }) {
  return (
    <>
      <div className="truncate border-b border-line/60 px-4 py-2 text-muted">{name}</div>
      {KIDS.map((_, c) => {
        const idx = r * KIDS.length + (r % 2 ? KIDS.length - 1 - c : c)
        const on = step > idx
        const incomplete = (r * 7 + c * 3) % 11 === 0
        return (
          <div key={c} className="flex items-center justify-center border-b border-line/60 py-1.5">
            {/* A CSS pop rather than a JS animation: this grid re-renders four times a second. */}
            <div
              className={`flex size-6 items-center justify-center rounded-md border ${on ? `pop ${incomplete ? 'border-bad/40 bg-bad/15 text-bad' : 'border-good/40 bg-good/15 text-good'}` : 'border-dashed border-line-2'}`}
            >
              {on && (incomplete ? <Minus size={12} strokeWidth={3} /> : <Check size={12} strokeWidth={3} />)}
            </div>
          </div>
        )
      })}
    </>
  )
}

// ── Attendance ───────────────────────────────────────────────────────
const CYCLE = ['present', 'present', 'late', 'present', 'absent', 'present'] as const
export function LiveAttendance() {
  const { ref, n } = useTicker(700)
  return (
    <div ref={ref} className="space-y-1.5">
      {KIDS.slice(0, 4).map((k, i) => (
        <div key={k} className="flex items-center gap-2.5 rounded-xl border border-line bg-panel/80 px-2.5 py-1.5">
          <Avatar name={k} size={24} />
          <span className="flex-1 truncate text-[12.5px]">{k}</span>
          <div className="flex gap-1">
            {[0, 1, 2, 3, 4].map((l) => {
              const filled = l < ((n + i) % 7)
              const v = CYCLE[(i + l) % CYCLE.length]
              const Icon = v === 'present' ? Check : v === 'late' ? Clock : X
              const tone = v === 'present' ? 'border-good/40 bg-good/15 text-good' : v === 'late' ? 'border-warn/40 bg-warn/15 text-warn' : 'border-bad/40 bg-bad/15 text-bad'
              return (
                <motion.span
                  key={l}
                  initial={false}
                  animate={{ scale: filled ? 1 : 0.85, opacity: filled ? 1 : 0.5 }}
                  className={`flex size-5 items-center justify-center rounded-[6px] border ${filled ? tone : 'border-dashed border-line-2'}`}
                >
                  {filled && <Icon size={10} strokeWidth={3} />}
                </motion.span>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Report card typewriter ───────────────────────────────────────────
// Written by the real generator, so the landing page shows exactly what the app produces.
const REPORT = (() => {
  const skills = LEVEL_BY_ID.sw3.skills
  const id = (prefix: string) => skills.find((s) => s.name.startsWith(prefix))?.id ?? ''
  return generateComment({
    name: 'Noah Patel',
    passed: false,
    praiseSkillId: id('Front crawl'),
    focus: [
      { skillId: id('Back crawl'), element: 'body' },
      { skillId: id('Whip kick on back'), element: 'legs' },
    ],
    skills,
  })
})()
export function LiveReport() {
  const { ref, n } = useTicker(28)
  const len = n % (REPORT.length + 90)
  return (
    <div ref={ref} className="rounded-xl border border-line bg-panel/80 p-3.5">
      <div className="mb-2 flex items-center gap-2">
        <Avatar name="Noah Patel" size={22} />
        <span className="text-[12.5px] font-semibold">Noah Patel</span>
        <span className="ml-auto rounded-md border border-warn/30 bg-warn/10 px-1.5 py-0.5 text-[10px] font-semibold text-warn">Not yet passing</span>
      </div>
      <p className="min-h-[5.5rem] text-[12.5px] leading-relaxed text-muted">
        {REPORT.slice(0, len)}
        <span className="ml-px inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-aqua" />
      </p>
    </div>
  )
}

// ── Offline sync ─────────────────────────────────────────────────────
export function LiveSync() {
  const { ref, n } = useTicker(1400)
  const phase = n % 4
  const states = [
    { icon: <CloudOff size={13} />, label: 'Offline · 3 saved on device', tone: 'text-warn border-warn/30 bg-warn/10' },
    { icon: <Wifi size={13} />, label: 'Back online', tone: 'text-blue border-blue/30 bg-blue/10' },
    { icon: <Loader2 size={13} className="animate-spin" />, label: 'Syncing 3 changes', tone: 'text-aqua border-aqua/30 bg-aqua/10' },
    { icon: <Check size={13} strokeWidth={3} />, label: 'All changes saved', tone: 'text-good border-good/30 bg-good/10' },
  ]
  const s = states[phase]
  return (
    <div ref={ref} className="flex h-full flex-col items-center justify-center gap-4 py-2">
      <div className="relative flex h-24 w-40 items-end justify-center">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            className="absolute bottom-0 size-2.5 rounded-full bg-aqua"
            animate={phase === 2 ? { y: [-4, -78], opacity: [0, 1, 0], x: (i - 1) * 16 } : { y: 0, opacity: 0 }}
            transition={{ duration: 1.1, delay: i * 0.18, repeat: phase === 2 ? Infinity : 0 }}
          />
        ))}
        <div className={`absolute top-0 flex size-11 items-center justify-center rounded-2xl border bg-panel-2 transition-colors ${phase === 3 ? 'border-good/40 text-good' : phase === 0 ? 'border-line-2 text-dim' : 'border-aqua/40 text-aqua'}`}>
          {phase === 0 ? <CloudOff size={20} /> : <Cloud size={20} />}
        </div>
        <Smartphone size={40} strokeWidth={1.5} className="text-muted" />
      </div>
      <AnimatePresence mode="wait">
        <motion.span
          key={phase}
          initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -6 }}
          className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] ${s.tone}`}
        >
          {s.icon}
          {s.label}
        </motion.span>
      </AnimatePresence>
    </div>
  )
}

// ── Lesson plan ──────────────────────────────────────────────────────
const LESSONS = [
  ['Sep 9', 'Entries and floats'],
  ['Sep 16', 'Front glide, flutter kick'],
  ['Sep 23', 'Back crawl 10 m'],
  ['Sep 30', 'Treading water 30 s'],
]
export function LiveLessons() {
  const { ref, n } = useTicker(1300)
  const cur = n % (LESSONS.length + 1)
  return (
    <div ref={ref} className="space-y-1.5">
      {LESSONS.map(([d, t], i) => (
        <div key={d} className={`flex items-center gap-2.5 rounded-xl border px-2.5 py-1.5 text-[12.5px] transition-colors duration-300 ${i === cur ? 'border-aqua/40 bg-aqua/[0.07]' : 'border-line bg-panel/80'}`}>
          <span className="w-12 shrink-0 font-mono text-[10.5px] text-dim">{d}</span>
          <span className="flex-1 truncate">{t}</span>
          <span className={`flex size-4 items-center justify-center rounded-full border transition-colors duration-300 ${i < cur ? 'border-good/40 bg-good/15 text-good' : 'border-line-2'}`}>
            {i < cur && <Check size={9} strokeWidth={3} />}
          </span>
        </div>
      ))}
    </div>
  )
}

// ── 2FA ──────────────────────────────────────────────────────────────
export function LiveTwoFactor() {
  const { ref, n } = useTicker(900)
  const codes = ['482 913', '107 355', '936 028', '551 764']
  const code = codes[Math.floor(n / 4) % codes.length]
  const progress = (n % 4) / 4
  return (
    <div ref={ref} className="flex h-full flex-col items-center justify-center gap-3">
      <div className="flex items-center gap-2 text-[12px] text-muted">
        <ShieldCheck size={15} className="text-aqua" /> SwimTrack · coach@pool.ca
      </div>
      <AnimatePresence mode="popLayout">
        <motion.div
          key={code}
          initial={{ opacity: 0, y: 10, filter: 'blur(6px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -10, filter: 'blur(6px)' }}
          className="font-mono text-3xl font-semibold tracking-[0.14em] text-fg"
        >
          {code}
        </motion.div>
      </AnimatePresence>
      <div className="h-1 w-32 overflow-hidden rounded-full bg-fg/10">
        {/* scaleX, not width: this bar never stops moving, and animating width re-lays out the page every frame. */}
        <div className="h-full origin-left bg-aqua transition-transform duration-[900ms] ease-linear" style={{ transform: `scaleX(${1 - progress})` }} />
      </div>
    </div>
  )
}

// ── Curriculum search ────────────────────────────────────────────────
const QUERY = 'front crawl 50m'
const HITS = LEVELS.flatMap((l) => l.skills.filter((s) => /front crawl, 50 m/i.test(s.name)).map((s) => ({ l, s }))).slice(0, 3)
export function LiveSearch() {
  const { ref, n } = useTicker(110)
  const cycle = n % 60
  const typed = QUERY.slice(0, Math.max(0, cycle - 4))
  const done = typed.length === QUERY.length
  return (
    <div ref={ref} className="space-y-2">
      <div className="flex items-center gap-2 rounded-xl border border-aqua/40 bg-panel px-3 py-2 shadow-[0_0_0_4px_rgb(var(--accent-rgb)/0.1)]">
        <Search size={14} className="text-dim" />
        <span className="text-[13px]">
          {typed}
          <span className="ml-px inline-block h-3.5 w-[2px] translate-y-0.5 animate-pulse bg-aqua" />
        </span>
      </div>
      <AnimatePresence>
        {done &&
          HITS.map(({ l, s }, i) => (
            <motion.div
              key={s.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ delay: i * 0.08 }}
              className="flex items-center gap-2 rounded-lg border border-line bg-panel/80 px-2.5 py-1.5 text-[12px]"
            >
              <LevelChip level={l} />
              <span className="truncate text-muted">{s.name}</span>
            </motion.div>
          ))}
      </AnimatePresence>
    </div>
  )
}

// ── Levels ───────────────────────────────────────────────────────────
export function LevelCloud() {
  return (
    <div className="flex flex-wrap gap-1.5">
      {LEVELS.map((l) => (
        <span
          key={l.id}
          className="rounded-lg border px-2 py-1 font-mono text-[11px]"
          style={{ color: PROGRAMS[l.program].hue, borderColor: `color-mix(in oklab, ${PROGRAMS[l.program].hue} 35%, transparent)` }}
        >
          {l.short}
        </span>
      ))}
    </div>
  )
}
