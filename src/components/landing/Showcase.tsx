import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { BookOpen, CalendarCheck, FileText, ListChecks, Search, Users } from 'lucide-react'
import { useRef, useState } from 'react'
import { LEVEL_BY_ID, PROGRAMS } from '../../data/curriculum'
import { Logo } from '../Logo'
import { LevelCloud, LiveAttendance, LiveMatrix, LiveReport, LiveSearch } from './LiveDemos'

const TABS = [
  { id: 'skills', label: 'Skills', icon: ListChecks, title: 'Check off a whole class in one pass', body: 'Every level’s skills and distances come preloaded. Tap through the grid while they swim.', demo: <LiveMatrix />, extra: null },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck, title: 'Attendance in two taps', body: 'Tap to cycle present, late and absent, or mark the whole lesson at once.', demo: <LiveAttendance />, extra: <AttendanceStats /> },
  { id: 'reports', label: 'Report cards', icon: FileText, title: 'Report cards that write themselves', body: 'Pick what they nailed and what to work on. The comment is drafted from the manual’s must-sees.', demo: <LiveReport />, extra: <ReportPicks /> },
  { id: 'curriculum', label: 'Curriculum', icon: BookOpen, title: 'The whole manual, searchable', body: 'Find any skill across every Swim for Life level in a keystroke.', demo: <LiveSearch />, extra: <LevelCloud /> },
] as const

const CLASSES = [
  { name: 'Swimmer 3 · Tue 5:30', level: LEVEL_BY_ID.sw3 },
  { name: 'Preschool 4 · Sat 9:00', level: LEVEL_BY_ID.ps4 },
  { name: 'Ranger · Thu 7:00', level: LEVEL_BY_ID.ranger },
]

const DWELL = 7 // seconds per tab

/** Product window that tilts up as it scrolls in, with tabs that auto-advance while on screen. */
export function Showcase() {
  const [active, setActive] = useState(0)
  const ref = useRef<HTMLDivElement>(null)
  const inView = useInView(ref, { margin: '-15% 0px' })
  const reduced = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], [22, 0])
  const scale = useTransform(scrollYProgress, [0, 1], [0.9, 1])
  // The scroll-linked tilt re-renders a large 3D layer every frame, which phones can't keep up with.
  const [tilt] = useState(() => typeof window !== 'undefined' && window.matchMedia('(pointer: fine) and (min-width: 768px)').matches)
  const tab = TABS[active]
  const next = () => setActive((i) => (i + 1) % TABS.length)

  return (
    <div ref={ref} className="[perspective:1400px]">
      <motion.div style={tilt && !reduced ? { rotateX, scale, transformOrigin: 'center top' } : undefined}>
        <div className="rounded-[1.75rem] border border-line-2 bg-panel-2 p-2 shadow-[var(--shadow-lg)]">
          <div className="flex items-center gap-2 px-3 pb-2.5 pt-1.5">
            <span className="size-3 rounded-full bg-[#ff5f57]" />
            <span className="size-3 rounded-full bg-[#febc2e]" />
            <span className="size-3 rounded-full bg-[#28c840]" />
            <span className="mx-auto hidden rounded-lg bg-fg/[0.05] px-10 py-1 font-mono text-[11px] text-dim sm:block">lanemark.app/app/classes/swimmer-3?tab={tab.id}</span>
          </div>
          <div className="grid min-h-[25rem] overflow-hidden rounded-[1.25rem] border border-line bg-ink md:grid-cols-[13.5rem_1fr]">
            <aside className="hidden flex-col gap-5 border-r border-line bg-panel/60 p-3 md:flex" aria-hidden>
              <div className="flex items-center gap-2 px-1.5 pt-1">
                <Logo size={22} />
                <span className="font-display text-[14px] font-bold">Lanemark</span>
              </div>
              <div className="flex h-8 items-center gap-2 rounded-lg border border-line bg-fg/[0.03] px-2.5 text-[12px] text-dim">
                <Search size={12} /> Search…
              </div>
              <div>
                <div className="mb-1 px-1.5 text-[11px] text-dim">Classes</div>
                {CLASSES.map((c, i) => (
                  <div key={c.name} className={`flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[12px] ${i ? 'text-muted' : 'bg-fg/[0.06] text-fg'}`}>
                    <span className="size-1.5 shrink-0 rounded-full" style={{ background: PROGRAMS[c.level.program].hue }} />
                    <span className="truncate">{c.name}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="mb-1 px-1.5 text-[11px] text-dim">Swimmer 3</div>
                {TABS.map((t, i) => (
                  <div key={t.id} className={`relative flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-[12px] transition-colors ${i === active ? 'text-fg' : 'text-muted'}`}>
                    {i === active && <motion.span layoutId="showcase-side" className="absolute inset-0 rounded-lg bg-aqua/10 shadow-[inset_0_0_0_1px_rgb(var(--accent-rgb)/0.25)]" transition={{ type: 'spring', stiffness: 420, damping: 36 }} />}
                    <t.icon size={13} className={`relative ${i === active ? 'text-aqua' : ''}`} />
                    <span className="relative">{t.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-auto flex items-center gap-2 rounded-lg px-1.5 py-1 text-[11.5px] text-dim">
                <Users size={12} /> 5 swimmers · 10 lessons
              </div>
            </aside>

            <div className="min-w-0 p-4 sm:p-6">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={tab.id}
                  initial={{ opacity: 0, y: 12, filter: 'blur(6px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }}
                  transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                >
                  <h3 className="mb-5 font-display text-[19px] font-bold tracking-tight">{tab.title}</h3>
                  <div className={tab.id === 'skills' ? '' : 'max-w-xl'}>{tab.demo}</div>
                  {tab.extra && <div className="mt-6 max-w-xl border-t border-line pt-5">{tab.extra}</div>}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="no-scrollbar -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:justify-center" role="tablist" aria-label="Product tour">
        {TABS.map((t, i) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={i === active}
            onClick={() => setActive(i)}
            className={`relative flex h-10 shrink-0 items-center gap-2 overflow-hidden rounded-full px-4 text-[13.5px] font-medium transition-colors ${i === active ? 'btn-glass text-fg' : 'text-muted hover:text-fg'}`}
          >
            {i === active && inView && !reduced && (
              // A CSS animation, so the 7-second fill runs off the main thread.
              <span key={active} aria-hidden className="tab-fill absolute inset-0 origin-left bg-aqua/[0.12]" style={{ animationDuration: `${DWELL}s` }} onAnimationEnd={next} />
            )}
            <t.icon size={15} className={`relative ${i === active ? 'text-aqua' : ''}`} />
            <span className="relative">{t.label}</span>
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={tab.id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.25 }}
          className="mx-auto mt-4 max-w-md text-center text-[14.5px] leading-relaxed text-muted"
        >
          {tab.body}
        </motion.p>
      </AnimatePresence>
    </div>
  )
}

function AttendanceStats() {
  return (
    <dl className="grid grid-cols-3 gap-3">
      {[
        ['Present', '92%', 'var(--color-good)'],
        ['Late', '5%', 'var(--color-warn)'],
        ['Absent', '3%', 'var(--color-bad)'],
      ].map(([label, value, color]) => (
        <div key={label} className="rounded-xl border border-line bg-panel/80 p-3">
          <dt className="flex items-center gap-1.5 text-[11.5px] text-dim">
            <span className="size-1.5 rounded-full" style={{ background: color }} />
            {label}
          </dt>
          <dd className="mt-1 font-display text-xl font-bold">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function ReportPicks() {
  const groups = [
    ['Nailed it', ['Front crawl 15 m', 'Tread water 45 s'], 'border-good/35 bg-good/10 text-good'],
    ['Work on', ['Back crawl body position', 'Whip kick on back'], 'border-warn/35 bg-warn/10 text-warn'],
  ] as const
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map(([label, items, tone]) => (
        <div key={label}>
          <div className="mb-2 text-[11.5px] text-dim">{label}</div>
          <div className="flex flex-wrap gap-1.5">
            {items.map((x) => (
              <span key={x} className={`rounded-lg border px-2 py-1 text-[11.5px] font-medium ${tone}`}>
                {x}
              </span>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
