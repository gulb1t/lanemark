import { motion } from 'motion/react'
import { Archive, CalendarCheck, ChevronLeft, ChevronRight, ClipboardList, FileText, ListChecks, Settings, Users } from 'lucide-react'
import { useEffect, useMemo, useRef } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Tour, type TourStep } from '../components/Tour'
import { LevelChip } from '../components/ui/bits'
import { PROGRAMS, getLevel } from '../data/curriculum'
import { formatDate, isoDate } from '../lib/dates'
import { usePhoneLayout } from '../lib/hooks'
import { isReportDone } from '../lib/reportRules'
import { lessonHeadcount, passedLevel, scheduleNote, skillProgress } from '../lib/stats'
import { useStore } from '../store/useStore'
import type { Swimmer, SwimClass } from '../types'
import { AttendanceTab } from './class/AttendanceTab'
import { LessonsTab } from './class/LessonsTab'
import { ReportsTab } from './class/ReportsTab'
import { RosterTab } from './class/RosterTab'
import { SettingsTab } from './class/SettingsTab'
import { SkillsTab } from './class/SkillsTab'
import NotFound from './NotFound'

const TABS = [
  { id: 'roster', label: 'Swimmers', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'skills', label: 'Skills', icon: ListChecks },
  { id: 'lessons', label: 'Lessons', icon: ClipboardList },
  { id: 'reports', label: 'Report cards', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

type TabId = (typeof TABS)[number]['id']

const CLASS_TOUR: TourStep[] = [
  {
    target: '[role=tablist][aria-label="Class sections"]',
    title: 'Everything for this class',
    body: 'Its swimmers, attendance, skills, lesson plans and report cards each have a tab.',
  },
  {
    target: '[data-tour=tab-attendance]',
    title: 'Attendance',
    body: 'Open this when a lesson starts. Tap a swimmer’s button once for present, twice for late, three times for absent. Or mark the rest present.',
  },
  { target: '[data-tour=tab-skills]', title: 'Skills', body: 'Check off skills for the whole class in one grid, or one swimmer at a time.' },
  { target: '[data-tour=tab-reports]', title: 'Report cards', body: 'At the end of the session, write and print the cards here, one swimmer at a time.' },
]

export default function ClassPage() {
  const { classId } = useParams()
  const cls = useStore((s) => s.classes.find((c) => c.id === classId))
  const swimmers = useStore((s) => s.swimmers)
  const [params, setParams] = useSearchParams()
  const swimmerMap = useMemo(() => new Map<string, Swimmer>(swimmers.map((w) => [w.id, w])), [swimmers])
  const strip = useRef<HTMLDivElement>(null)
  const requested = params.get('tab')
  const phone = usePhoneLayout()

  // On phones the tab strip scrolls sideways; keep the current tab in view instead of cut off at the edge.
  useEffect(() => {
    const el = strip.current
    const on = el?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (!el || !on) return
    const left = on.offsetLeft - el.offsetLeft
    if (left < el.scrollLeft || left + on.offsetWidth > el.scrollLeft + el.clientWidth - 32) el.scrollTo({ left: left - 16, behavior: 'smooth' })
  }, [requested])

  if (!cls) return <NotFound what="class" />

  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : 'roster'
  const level = getLevel(cls.levelId)
  const hue = level ? PROGRAMS[level.program].hue : '#8b94a1'
  const content = (
    <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
      {tab === 'roster' && <RosterTab cls={cls} swimmers={swimmerMap} />}
      {tab === 'attendance' && <AttendanceTab cls={cls} swimmers={swimmerMap} />}
      {tab === 'skills' && <SkillsTab cls={cls} swimmers={swimmerMap} />}
      {tab === 'lessons' && <LessonsTab cls={cls} />}
      {tab === 'reports' && <ReportsTab cls={cls} swimmers={swimmerMap} />}
      {tab === 'settings' && <SettingsTab cls={cls} />}
    </motion.div>
  )

  // Phones: the class opens on a short menu, and each part opens as its own screen (the back button returns).
  if (phone) {
    if (!requested || !TABS.some((t) => t.id === requested))
      return <ClassHub cls={cls} hue={hue} level={level} open={(id) => setParams({ tab: id })} />
    const current = TABS.find((t) => t.id === tab)!
    return (
      <div className="space-y-5">
        <div className="no-print">
          <button
            type="button"
            onClick={() => (history.state?.idx > 0 ? history.back() : setParams({}, { replace: true }))}
            className="-ml-1 mb-2 inline-flex max-w-full items-center gap-1 text-[14px] font-medium text-muted hover:text-fg"
          >
            <ChevronLeft size={18} className="shrink-0" /> <span className="truncate">{cls.name}</span>
          </button>
          <h1 className="page-title !text-[1.7rem]">{current.id === 'settings' ? 'Class settings' : current.label}</h1>
        </div>
        {content}
      </div>
    )
  }

  return (
    <div className="space-y-5 sm:space-y-7">
      <Tour id="class" steps={CLASS_TOUR} />
      <div className="no-print relative">
        <Link to="/app" className="relative mb-3 inline-flex sm:mb-5 items-center gap-1 text-[13px] text-muted transition-colors hover:text-fg">
          <ChevronLeft size={15} /> All classes
        </Link>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <LevelChip level={level} />
              {cls.session && <span className="font-mono text-xs text-dim">{cls.session}</span>}
              {/* Phones: the counts ride along on this line instead of taking a row of their own. */}
              <span className="font-mono text-xs text-dim sm:hidden">
                · {cls.enrollments.length} swimmers · {cls.lessons.length} lessons
              </span>
              {cls.archived && (
                <span className="inline-flex items-center gap-1 rounded-md border border-line-2 px-1.5 py-0.5 text-[11px] text-muted">
                  <Archive size={11} /> Archived
                </span>
              )}
            </div>
            <h1 className="page-title max-sm:!text-[1.7rem]">{cls.name}</h1>
            {scheduleNote(cls) && <p className="mt-1 text-sm text-muted sm:mt-1.5">{scheduleNote(cls)}</p>}
          </div>
          <dl className="flex gap-6 font-mono text-sm tabular-nums text-muted max-sm:hidden">
            {[
              [cls.enrollments.length, 'swimmers'],
              [cls.lessons.length, 'lessons'],
              [cls.skills.length, 'skills'],
            ].map(([n, label]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dd className="text-xl font-semibold text-fg">{n}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="no-print sticky top-[calc(3.5rem+env(safe-area-inset-top))] z-20 -mx-4 border-b border-line bg-ink/90 px-4 backdrop-blur-xl md:top-[5.25rem] sm:mx-0 sm:rounded-2xl sm:border sm:border-line sm:bg-panel/70 sm:px-1.5">
        <div
          ref={strip}
          role="tablist"
          aria-label="Class sections"
          className="flex gap-0.5 overflow-x-auto py-1.5 no-scrollbar max-sm:pr-8 max-sm:[mask-image:linear-gradient(90deg,#000_calc(100%-2.5rem),transparent)]"
        >
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = id === tab
            return (
              <button
                key={id}
                data-tour={`tab-${id}`}
                role="tab"
                aria-selected={active}
                onClick={() => setParams(id === 'roster' ? {} : { tab: id }, { replace: true })}
                className={`relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-[14px] font-medium transition-colors sm:px-3.5 sm:text-[13.5px] ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
              >
                {active && (
                  <motion.span
                    layoutId="class-tab"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: `color-mix(in oklab, ${hue} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hue} 35%, transparent)` }}
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                  />
                )}
                <Icon size={15} className="relative max-sm:hidden" style={active ? { color: hue } : undefined} />
                <span className="relative">{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {content}
    </div>
  )
}

/** The phone's class screen: what's next, then one tile per part of the class with where it stands. */
function ClassHub({ cls, hue, level, open }: { cls: SwimClass; hue: string; level: ReturnType<typeof getLevel>; open: (id: TabId) => void }) {
  const today = isoDate()
  const lesson = cls.lessons.find((l) => l.date === today) ?? cls.lessons.find((l) => l.date && l.date > today) ?? cls.lessons.find((l) => !l.date)
  const lessonNo = lesson ? cls.lessons.indexOf(lesson) + 1 : 0
  const head = lesson ? lessonHeadcount(cls, lesson.id) : null
  const toAssess = cls.enrollments.reduce((n, e) => n + skillProgress(e, cls.skills).unmarked, 0)
  const passed = cls.enrollments.filter((e) => passedLevel(e, cls.skills)).length
  const cards = cls.enrollments.filter((e) => isReportDone(e, cls.skills)).length
  const n = cls.enrollments.length
  const tiles: { id: TabId; label: string; status: string }[] = [
    { id: 'roster', label: 'Swimmers', status: `${n} in this class` },
    { id: 'skills', label: 'Skills', status: toAssess ? `${toAssess} to assess` : `${passed} of ${n} passed` },
    { id: 'lessons', label: 'Lessons', status: `${cls.lessons.length} planned` },
    { id: 'reports', label: 'Report cards', status: `${cards} of ${n} done` },
    { id: 'attendance', label: 'Attendance', status: 'Every lesson' },
    { id: 'settings', label: 'Class settings', status: 'Name, level, archive' },
  ]
  return (
    <div className="space-y-5">
      <div>
        <Link to="/app" className="mb-3 inline-flex items-center gap-1 text-[14px] font-medium text-muted hover:text-fg">
          <ChevronLeft size={18} /> Classes
        </Link>
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <LevelChip level={level} />
          {cls.session && <span className="text-[13px] text-dim">{cls.session}</span>}
          {cls.archived && (
            <span className="inline-flex items-center gap-1 rounded-md border border-line-2 px-1.5 py-0.5 text-[11px] text-muted">
              <Archive size={11} /> Archived
            </span>
          )}
        </div>
        <h1 className="page-title !text-[1.7rem]">{cls.name}</h1>
        {scheduleNote(cls) && <p className="mt-1 text-sm text-muted">{scheduleNote(cls)}</p>}
      </div>

      {lesson && n > 0 && (
        <button
          type="button"
          data-tour="tab-attendance"
          onClick={() => open('attendance')}
          className="card flex w-full items-center gap-4 p-4 text-left transition-transform active:scale-[0.99]"
          style={{ borderColor: `color-mix(in oklab, ${hue} 35%, transparent)` }}
        >
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: `color-mix(in oklab, ${hue} 16%, transparent)`, color: hue }}>
            <CalendarCheck size={22} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[13px] text-muted">
              {lesson.date === today ? 'Today' : lesson.date ? formatDate(lesson.date, { weekday: 'short', month: 'short', day: 'numeric' }) : 'Next'} · Lesson {lessonNo}
            </span>
            <span className="block truncate text-[16px] font-semibold">{head && head.marked === n ? 'Attendance done' : 'Take attendance'}</span>
            {lesson.topic && <span className="block truncate text-[13px] text-muted">{lesson.topic}</span>}
          </span>
          <ChevronRight size={18} className="shrink-0 text-dim" />
        </button>
      )}

      <div className="grid grid-cols-2 gap-3">
        {tiles.map(({ id, label, status }) => {
          const Icon = TABS.find((t) => t.id === id)!.icon
          return (
            <button key={id} type="button" data-tour={`tab-${id}`} onClick={() => open(id)} className="card flex min-h-[6.5rem] flex-col items-start justify-between gap-3 p-4 text-left transition-transform active:scale-[0.98]">
              <Icon size={20} style={{ color: hue }} />
              <span className="min-w-0">
                <span className="block text-[15px] font-semibold leading-tight">{label}</span>
                <span className="mt-0.5 block text-[12.5px] leading-snug text-muted">{status}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
