import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, CalendarCheck, Check, CheckCheck, Clock, Eraser, LayoutGrid, ListTodo, X } from 'lucide-react'
import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { burstFrom } from '../../components/fx/bubbles'
import { Avatar } from '../../components/ui/Avatar'
import { Button, ButtonLink } from '../../components/ui/Button'
import { EmptyState, Kbd, Segmented } from '../../components/ui/bits'
import { formatDate, isoDate } from '../../lib/dates'
import { attendanceSummary, lessonHeadcount, pct } from '../../lib/stats'
import { useKeepAwake } from '../../native/keepAwake'
import { useStore } from '../../store/useStore'
import { confirm, withUndo } from '../../store/useUi'
import type { AttendanceStatus, Swimmer, SwimClass } from '../../types'

const LOOK: Record<AttendanceStatus, { cls: string; icon: typeof Check; label: string; key: string }> = {
  present: { cls: 'border-good/45 bg-good/15 text-good', icon: Check, label: 'Present', key: 'P' },
  late: { cls: 'border-warn/45 bg-warn/15 text-warn', icon: Clock, label: 'Late', key: 'L' },
  absent: { cls: 'border-bad/45 bg-bad/15 text-bad', icon: X, label: 'Absent', key: 'A' },
}
const STATUSES = Object.keys(LOOK) as AttendanceStatus[]
const CYCLE: (AttendanceStatus | undefined)[] = [undefined, 'present', 'late', 'absent']
const nextStatus = (s: AttendanceStatus | undefined) => CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length]

const MODE_KEY = 'swimtrack:attendance-mode'

export function AttendanceTab({ cls, swimmers }: { cls: SwimClass; swimmers: Map<string, Swimmer> }) {
  useKeepAwake(true)
  const [mode, setMode] = useState<'take' | 'grid'>(() => {
    try {
      return (localStorage.getItem(MODE_KEY) as 'take' | 'grid') || 'take'
    } catch {
      return 'take'
    }
  })
  const changeMode = (m: 'take' | 'grid') => {
    setMode(m)
    try {
      localStorage.setItem(MODE_KEY, m)
    } catch {
      /* ignore */
    }
  }

  if (!cls.enrollments.length) {
    return <EmptyState icon={<CalendarCheck size={22} />} title="Add swimmers to take attendance" body="Head to the Swimmers tab and add members first." />
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="Attendance view"
          value={mode}
          onChange={changeMode}
          options={[
            { value: 'take', label: <><ListTodo size={14} /> Take attendance</> },
            { value: 'grid', label: <><LayoutGrid size={14} /> Whole session</> },
          ]}
        />
        <ul className="flex gap-3 text-xs text-muted" aria-label="Legend">
          {STATUSES.map((k) => {
            const { icon: Icon, label, cls: c } = LOOK[k]
            return (
              <li key={k} className="flex items-center gap-1.5">
                <span className={`inline-flex size-5 items-center justify-center rounded-md border ${c}`}>
                  <Icon size={12} strokeWidth={2.75} />
                </span>
                {label}
              </li>
            )
          })}
        </ul>
      </div>
      {mode === 'take' ? <TakeMode cls={cls} swimmers={swimmers} /> : <GridMode cls={cls} swimmers={swimmers} />}
    </div>
  )
}

function pickDefaultLesson(cls: SwimClass, requested: string | null): string {
  if (requested && cls.lessons.some((l) => l.id === requested)) return requested
  const today = isoDate()
  const dated = cls.lessons.find((l) => l.date === today)
  if (dated) return dated.id
  const unfinished = cls.lessons.find((l) => cls.enrollments.some((e) => !e.attendance[l.id]))
  return (unfinished ?? cls.lessons[cls.lessons.length - 1]).id
}

/** A short tap on phones that support it, so a mark registers without looking. */
const buzz = (pattern: number | number[] = 8) => {
  try {
    navigator.vibrate?.(pattern)
  } catch {
    /* unsupported */
  }
}

/** Present, then late, then absent, then back to unmarked. */
const NEXT: Record<AttendanceStatus | 'none', AttendanceStatus | undefined> = { none: 'present', present: 'late', late: 'absent', absent: undefined }

/** One button per swimmer: each tap moves to the next mark, so a row stays one line even on a phone. */
function CycleButton({ name, value, onChange }: { name: string; value: AttendanceStatus | undefined; onChange: (next: AttendanceStatus | undefined) => void }) {
  const look = value ? LOOK[value] : null
  const Icon = look?.icon
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.92 }}
      onClick={() => onChange(NEXT[value ?? 'none'])}
      aria-label={`${name}: ${look ? look.label : 'not marked'}. Tap for ${NEXT[value ?? 'none'] ? LOOK[NEXT[value ?? 'none']!].label.toLowerCase() : 'not marked'}.`}
      className={`flex h-11 w-[7.25rem] shrink-0 items-center justify-center gap-1.5 rounded-xl border text-[14px] font-semibold transition-colors ${look ? look.cls : 'border-dashed border-line-2 text-dim hover:border-dim/70 hover:text-muted'}`}
    >
      {Icon ? (
        <motion.span key={value} initial={{ scale: 0.6, rotate: -8 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 500, damping: 18 }} className="flex">
          <Icon size={16} strokeWidth={2.5} />
        </motion.span>
      ) : null}
      {look ? look.label : 'Mark'}
    </motion.button>
  )
}

function TakeMode({ cls, swimmers }: { cls: SwimClass; swimmers: Map<string, Swimmer> }) {
  const [params] = useSearchParams()
  const [lessonId, setLessonId] = useState(() => pickDefaultLesson(cls, params.get('lesson')))
  const store = useStore((s) => s.setAttendance)
  const rows = useRef<(HTMLDivElement | null)[]>([])
  const pills = useRef<HTMLDivElement>(null)
  const doneCard = useRef<HTMLDivElement>(null)

  /** Marks one swimmer; the mark that completes the lesson gets a small celebration. */
  const setAttendance = (classId: string, swimmerId: string, lid: string, status: AttendanceStatus | undefined) => {
    const before = lessonHeadcount(cls, lid).marked
    store(classId, swimmerId, lid, status)
    const fresh = useStore.getState().classes.find((c) => c.id === classId)
    const total = fresh?.enrollments.length ?? 0
    if (fresh && status && before < total && lessonHeadcount(fresh, lid).marked === total) {
      buzz([10, 40, 18])
      requestAnimationFrame(() => burstFrom(doneCard.current))
    } else if (status) buzz()
  }

  const index = Math.max(0, cls.lessons.findIndex((l) => l.id === lessonId))
  const lesson = cls.lessons[index] ?? cls.lessons[0]
  const head = lessonHeadcount(cls, lesson.id)
  const members = cls.enrollments.filter((e) => swimmers.has(e.swimmerId))
  const unmarked = members.length - head.marked

  useEffect(() => {
    pills.current?.querySelector('[aria-pressed="true"]')?.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'smooth' })
  }, [lessonId])

  function onKey(e: KeyboardEvent<HTMLDivElement>, i: number, swimmerId: string) {
    const k = e.key.toLowerCase()
    const status = STATUSES.find((s) => LOOK[s].key.toLowerCase() === k)
    if (status) {
      e.preventDefault()
      setAttendance(cls.id, swimmerId, lesson.id, status)
      rows.current[Math.min(i + 1, members.length - 1)]?.focus()
    } else if (e.key === 'Backspace' || e.key === 'Delete') {
      setAttendance(cls.id, swimmerId, lesson.id, undefined)
    } else if (e.key === 'ArrowDown' || e.key === 'j') {
      e.preventDefault()
      rows.current[Math.min(i + 1, members.length - 1)]?.focus()
    } else if (e.key === 'ArrowUp' || e.key === 'k') {
      e.preventDefault()
      rows.current[Math.max(i - 1, 0)]?.focus()
    }
  }

  return (
    <div className="space-y-4">
      <div ref={pills} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0">
        {cls.lessons.map((l, i) => {
          const h = lessonHeadcount(cls, l.id)
          const done = h.marked === members.length && members.length > 0
          const active = l.id === lesson.id
          return (
            <button
              key={l.id}
              type="button"
              aria-pressed={active}
              onClick={() => setLessonId(l.id)}
              className={`relative flex shrink-0 flex-col items-start rounded-2xl border px-3.5 py-2 text-left transition-colors ${active ? 'border-aqua/50 bg-aqua/10' : 'border-line bg-panel hover:border-line-2'}`}
            >
              <span className="flex items-center gap-1.5 font-mono text-[11px] text-dim">
                L{i + 1}
                {done && <CheckCheck size={12} className="text-good" />}
                {l.date === isoDate() && <span className="rounded bg-aqua/20 px-1 text-[9px] font-semibold text-aqua">TODAY</span>}
              </span>
              <span className={`text-[13px] font-medium ${active ? 'text-fg' : 'text-muted'}`}>{l.date ? formatDate(l.date, { month: 'short', day: 'numeric' }) : `Lesson ${i + 1}`}</span>
            </button>
          )
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3.5">
          <div className="min-w-0">
            <div className="text-[15px] font-semibold">
              Lesson {index + 1}
              {lesson.date && <span className="font-normal text-muted"> · {formatDate(lesson.date)}</span>}
            </div>
            <div className="truncate text-[13px] text-muted">{lesson.topic || 'No topic yet'}</div>
          </div>
          <div className="flex items-center gap-2">
            <span className="mr-1 text-[13px] tabular-nums text-muted">
              <span className="font-medium text-good">{head.present} present</span> · <span className="font-medium text-warn">{head.late} late</span> ·{' '}
              <span className="font-medium text-bad">{head.absent} absent</span>
              {unmarked > 0 && <span className="text-dim"> · {unmarked} left</span>}
            </span>
            {head.marked > 0 && (
              <Button
                size="sm"
                variant="ghost"
                icon={<Eraser size={14} />}
                onClick={async () => {
                  const ok = await confirm({
                    title: `Clear lesson ${index + 1} attendance?`,
                    body: `This removes the ${head.marked} mark${head.marked === 1 ? '' : 's'} you’ve made for this lesson.`,
                    confirmLabel: 'Clear marks',
                    danger: true,
                  })
                  if (ok)
                    withUndo(`Cleared lesson ${index + 1}`, () => {
                      for (const m of members) setAttendance(cls.id, m.swimmerId, lesson.id, undefined)
                    })
                }}
              >
                Clear
              </Button>
            )}
            <Button
              size="sm"
              variant={unmarked ? 'primary' : 'secondary'}
              icon={<CheckCheck size={14} />}
              onClick={() =>
                withUndo(`Everyone else marked present for lesson ${index + 1}`, () => {
                  for (const m of members) if (!m.attendance[lesson.id]) setAttendance(cls.id, m.swimmerId, lesson.id, 'present')
                })
              }
              disabled={!unmarked}
            >
              Mark the rest present
            </Button>
          </div>
        </div>
        <div className="h-0.5 bg-fg/[0.05]">
          <motion.div className="h-full bg-aqua shadow-[0_0_10px_var(--color-aqua)]" animate={{ width: `${members.length ? (head.marked / members.length) * 100 : 0}%` }} transition={{ type: 'spring', stiffness: 120, damping: 20 }} />
        </div>

        <AnimatePresence initial={false}>
          {unmarked === 0 && members.length > 0 && (
            <motion.div
              key="done"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div ref={doneCard} className="flex flex-wrap items-center gap-3 border-b border-good/20 bg-good/[0.07] px-4 py-3.5">
                <motion.span initial={{ scale: 0.4, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 420, damping: 16 }} className="flex size-9 items-center justify-center rounded-full bg-good text-ink">
                  <Check size={19} strokeWidth={3} />
                </motion.span>
                <div className="min-w-0 flex-1">
                  <div className="text-[15px] font-semibold">Lesson {index + 1} attendance done</div>
                  <div className="text-[13px] text-muted">
                    {head.present} present{head.late ? ` · ${head.late} late` : ''}
                    {head.absent ? ` · ${head.absent} absent` : ''}
                  </div>
                </div>
                <ButtonLink to={`/app/classes/${cls.id}?tab=skills`} size="sm" variant="primary">
                  Check skills <ArrowRight size={14} />
                </ButtonLink>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {unmarked === members.length && members.length > 1 && (
          <div className="border-b border-line p-3 sm:hidden">
            <Button
              variant="secondary"
              size="lg"
              className="w-full"
              icon={<CheckCheck size={17} />}
              onClick={() => withUndo(`Everyone marked present for lesson ${index + 1}`, () => {
                for (const m of members) setAttendance(cls.id, m.swimmerId, lesson.id, 'present')
              })}
            >
              Everyone’s here
            </Button>
            <p className="mt-2 text-center text-xs text-dim">Then tap anyone who’s late or away.</p>
          </div>
        )}

        <div role="list" className="divide-y divide-line/70">
          {members.map((e, i) => {
            const swimmer = swimmers.get(e.swimmerId)!
            const value = e.attendance[lesson.id]
            return (
              <div
                key={e.swimmerId}
                role="listitem"
                ref={(el) => {
                  rows.current[i] = el
                }}
                tabIndex={0}
                onKeyDown={(ev) => onKey(ev, i, e.swimmerId)}
                className="flex items-center gap-3 px-4 py-3 outline-none transition-colors focus-visible:bg-aqua/[0.06] focus-visible:outline-none"
              >
                <Avatar name={swimmer.name} photo={swimmer.photo} size={40} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-medium">{swimmer.name}</div>
                  <div className="text-[12.5px] text-dim">{pct(attendanceSummary(e, cls.lessons).rate)} attendance</div>
                </div>
                <CycleButton name={swimmer.name} value={value} onChange={(next) => setAttendance(cls.id, e.swimmerId, lesson.id, next)} />
              </div>
            )
          })}
        </div>
      </div>
      <p className="hidden items-center gap-1.5 text-xs text-dim sm:flex">
        Tap a swimmer’s button to go present → late → absent. Keyboard: <Kbd>↑</Kbd>
        <Kbd>↓</Kbd> move, <Kbd>P</Kbd> present, <Kbd>L</Kbd> late, <Kbd>A</Kbd> absent, <Kbd>⌫</Kbd> clear
      </p>
    </div>
  )
}

function GridMode({ cls, swimmers }: { cls: SwimClass; swimmers: Map<string, Swimmer> }) {
  const setAttendance = useStore((s) => s.setAttendance)
  const markLesson = useStore((s) => s.markLesson)
  const today = isoDate()

  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 min-w-44 bg-panel px-4 py-3 text-left font-medium text-muted">Swimmer</th>
            {cls.lessons.map((l, i) => (
              <th key={l.id} className={`px-1 py-2 text-center font-normal ${l.date === today ? 'bg-aqua/[0.06]' : ''}`} title={l.topic || `Lesson ${i + 1}`}>
                <div className={`font-mono text-xs ${l.date === today ? 'text-aqua' : 'text-muted'}`}>L{i + 1}</div>
                <div className="font-mono text-[10px] text-dim">{l.date ? formatDate(l.date, { month: 'numeric', day: 'numeric' }) : '·'}</div>
                <button
                  type="button"
                  onClick={async () => {
                    // Only ask when it would overwrite someone marked late or absent.
                    const changed = cls.enrollments.filter((e) => e.attendance[l.id] && e.attendance[l.id] !== 'present').length
                    const ok =
                      !changed ||
                      (await confirm({
                        title: `Mark everyone present for lesson ${i + 1}?`,
                        body: `${changed} swimmer${changed === 1 ? ' is' : 's are'} marked late or absent. They’ll be changed to present.`,
                        confirmLabel: 'Mark everyone present',
                      }))
                    if (ok) withUndo(`Everyone present for lesson ${i + 1}`, () => markLesson(cls.id, l.id, 'present'))
                  }}
                  className="mt-1 rounded px-1 text-[10px] text-dim transition-colors hover:bg-good/10 hover:text-good"
                  title={`Mark everyone present for lesson ${i + 1}`}
                >
                  all ✓
                </button>
              </th>
            ))}
            <th className="px-4 py-3 text-right font-medium text-muted">Rate</th>
          </tr>
        </thead>
        <tbody>
          {cls.enrollments.map((e) => {
            const swimmer = swimmers.get(e.swimmerId)
            if (!swimmer) return null
            const sum = attendanceSummary(e, cls.lessons)
            return (
              <tr key={e.swimmerId} className="border-b border-line/60 last:border-0 hover:bg-fg/[0.02]">
                <td className="sticky left-0 z-10 bg-panel px-4 py-2">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={swimmer.name} photo={swimmer.photo} size={28} />
                    <span className="truncate font-medium">{swimmer.name}</span>
                  </div>
                </td>
                {cls.lessons.map((l, i) => {
                  const v = e.attendance[l.id]
                  const look = v ? LOOK[v] : undefined
                  const Icon = look?.icon
                  return (
                    <td key={l.id} className={`p-1 text-center ${l.date === today ? 'bg-aqua/[0.04]' : ''}`}>
                      <motion.button
                        type="button"
                        whileTap={{ scale: 0.85 }}
                        onClick={() => setAttendance(cls.id, e.swimmerId, l.id, nextStatus(v))}
                        aria-label={`${swimmer.name}, lesson ${i + 1}: ${look?.label ?? 'not marked'}`}
                        className={`inline-flex size-8 items-center justify-center rounded-lg border transition-colors ${look ? look.cls : 'border-dashed border-line-2 text-transparent hover:border-dim'}`}
                      >
                        {Icon && (
                          <motion.span key={v} initial={{ scale: 0.4 }} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 600, damping: 20 }} className="flex">
                            <Icon size={14} strokeWidth={2.75} />
                          </motion.span>
                        )}
                      </motion.button>
                    </td>
                  )
                })}
                <td className="px-4 py-2 text-right font-mono text-[13px] tabular-nums text-muted">{pct(sum.rate)}</td>
              </tr>
            )
          })}
        </tbody>
        <tfoot>
          <tr className="border-t border-line bg-fg/[0.015]">
            <td className="sticky left-0 z-10 bg-panel px-4 py-2 text-xs text-dim">Present or late</td>
            {cls.lessons.map((l) => {
              const h = lessonHeadcount(cls, l.id)
              return (
                <td key={l.id} className="py-2 text-center font-mono text-xs tabular-nums text-muted">
                  {h.marked ? h.present + h.late : '·'}
                </td>
              )
            })}
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
