import { motion } from 'motion/react'
import { Archive, ArrowRight, CalendarCheck, CalendarDays, CheckCheck, FileText, ListChecks, Plus, Sparkles, Users, Waves } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast as sonner } from 'sonner'
import { Avatar } from '../components/ui/Avatar'
import { Button, ButtonLink } from '../components/ui/Button'
import { LevelChip, ProgressRing, Segmented, Stat } from '../components/ui/bits'
import { PROGRAMS, getLevel } from '../data/curriculum'
import { nextActions, type NextAction } from '../lib/actions'
import { formatDate, greeting, isoDate } from '../lib/dates'
import { buildDemoData } from '../lib/demo'
import { attendanceSummary, classSummary, lessonHeadcount, pct, skillProgress } from '../lib/stats'
import { forgetLegacyData, readLegacyData } from '../sync/engine'
import { useSession } from '../store/useSession'
import { useStore } from '../store/useStore'
import { openDialog, toast } from '../store/useUi'
import type { Swimmer, SwimClass } from '../types'

export default function Dashboard() {
  const classes = useStore((s) => s.classes)
  const swimmers = useStore((s) => s.swimmers)
  const user = useSession((s) => s.user)
  const [view, setView] = useState<'active' | 'archived'>('active')
  const [params, setParams] = useSearchParams()

  const active = classes.filter((c) => !c.archived)
  const archived = classes.filter((c) => c.archived)
  const shown = view === 'active' ? active : archived
  const today = isoDate()
  const todays = active
    .map((c) => ({ c, lesson: c.lessons.findIndex((l) => l.date === today) }))
    .filter((x) => x.lesson !== -1)
  const upcoming = todays.length ? null : nextLesson(active, today)
  const actions = nextActions(active, today)

  const totals = (() => {
    const rows = active.flatMap((c) => c.enrollments.map((e) => ({ e, c })))
    const rates = rows.map(({ e, c }) => attendanceSummary(e, c.lessons).rate).filter((r): r is number => r !== null)
    let pass = 0
    for (const { e, c } of rows) pass += skillProgress(e, c.skills).pass
    return { attendance: rates.length ? rates.reduce((a, b) => a + b, 0) / rates.length : null, passed: pass }
  })()

  // One-time offer to bring in data from the version before accounts existed.
  useEffect(() => {
    const legacy = readLegacyData()
    if (!legacy) return
    sonner('Found classes from the previous version of SwimTrack on this device.', {
      id: 'legacy-import',
      duration: Infinity,
      action: {
        label: 'Import',
        onClick: () => {
          useStore.getState().importData(legacy)
          forgetLegacyData()
          toast(`Imported ${legacy.classes.length} classes and ${legacy.swimmers.length} swimmers`)
        },
      },
      cancel: { label: 'Dismiss', onClick: forgetLegacyData },
    })
  }, [])

  useEffect(() => {
    if (params.get('welcome')) {
      setParams({}, { replace: true })
    }
  }, [params, setParams])

  const first = user?.name.split(/\s+/)[0] ?? 'coach'

  return (
    <div className="space-y-10">
      <section className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow mb-2">{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
          <h1 className="page-title">
            {greeting()}, <span className="accent">{first}.</span>
          </h1>
          <p className="mt-2 max-w-xl text-[15px] text-muted">
            {todays.length
              ? `You teach ${todays.length} class${todays.length === 1 ? '' : 'es'} today.`
              : active.length
                ? `${active.length} active class${active.length === 1 ? '' : 'es'}, ${swimmers.length} swimmer${swimmers.length === 1 ? '' : 's'}.`
                : 'Let’s set up your first class.'}
          </p>
        </div>
        <Button variant="primary" icon={<Plus size={16} />} onClick={() => openDialog('newClass')} className="max-sm:hidden">
          New class
        </Button>
      </section>

      {classes.length > 0 && (
        <section className="grid items-start gap-4 lg:grid-cols-2" aria-label="Today">
          {todays.map(({ c, lesson }, i) => (
            <motion.div key={c.id} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06, ease: [0.16, 1, 0.3, 1], duration: 0.5 }}>
              <TodayCard cls={c} lessonIndex={lesson} swimmers={swimmers} />
            </motion.div>
          ))}
          {!todays.length && upcoming && <NextUp {...upcoming} />}
          {actions.length > 0 ? <ActionsCard actions={actions} /> : <AllCaughtUp />}
        </section>
      )}

      {classes.length > 0 && <StatsCard totals={totals} active={active.length} swimmers={swimmers.length} />}

      {classes.length ? (
        <section>
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="eyebrow">Classes</h2>
            <div className="flex items-center gap-2">
              {archived.length > 0 && (
                <Segmented
                  size="sm"
                  label="Show"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: 'active', label: `Active · ${active.length}` },
                    { value: 'archived', label: <><Archive size={12} /> {archived.length}</> },
                  ]}
                />
              )}
              <Button size="sm" icon={<Plus size={14} />} onClick={() => openDialog('newClass')} className="sm:hidden">
                New
              </Button>
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((c, i) => (
              <motion.div key={c.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: Math.min(i, 8) * 0.05, ease: [0.16, 1, 0.3, 1] }}>
                <ClassCard cls={c} swimmers={swimmers} />
              </motion.div>
            ))}
            {view === 'active' && (
              <button
                type="button"
                onClick={() => openDialog('newClass')}
                className="group flex min-h-52 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line-2 text-sm text-muted transition-colors hover:border-aqua/50 hover:bg-aqua/[0.03] hover:text-aqua max-sm:min-h-24"
              >
                <span className="flex size-10 items-center justify-center rounded-xl border border-current/20 transition-transform group-hover:rotate-90">
                  <Plus size={18} />
                </span>
                New class
              </button>
            )}
          </div>
          {view === 'archived' && !archived.length && <p className="py-10 text-center text-sm text-muted">No archived classes.</p>}
        </section>
      ) : (
        <Onboarding />
      )}
    </div>
  )
}

/** Today's lesson for one class, with attendance one tap away. */
function TodayCard({ cls, lessonIndex, swimmers }: { cls: SwimClass; lessonIndex: number; swimmers: Swimmer[] }) {
  const level = getLevel(cls.levelId)
  const lesson = cls.lessons[lessonIndex]
  const head = lessonHeadcount(cls, lesson.id)
  const total = cls.enrollments.length
  const taken = total > 0 && head.marked === total
  const hue = level ? PROGRAMS[level.program].hue : 'var(--color-aqua)'
  const members = cls.enrollments.map((e) => swimmers.find((w) => w.id === e.swimmerId)).filter((w): w is Swimmer => Boolean(w))
  const base = `/app/classes/${cls.id}`
  return (
    <article className="card relative overflow-hidden p-5 sm:p-6">
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: `radial-gradient(120% 90% at 100% 0%, color-mix(in oklab, ${hue} 14%, transparent), transparent 55%)` }} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[13px] text-muted">
            <span className="rounded-full bg-aqua/15 px-2 py-0.5 text-[11.5px] font-semibold text-aqua">Today</span>
            <LevelChip level={level} />
            Lesson {lessonIndex + 1} of {cls.lessons.length}
          </div>
          <h3 className="mt-2 truncate font-display text-[1.35rem] font-bold leading-tight tracking-tight">{cls.name}</h3>
          <p className="mt-1 truncate text-[14px] text-muted">{lesson.topic || 'No topic planned'}</p>
        </div>
        <Link to={base} aria-label={`Open ${cls.name}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-full text-dim transition-colors hover:bg-fg/[0.06] hover:text-fg">
          <ArrowRight size={17} />
        </Link>
      </div>
      <div className="relative mt-5 flex items-center justify-between gap-3">
        <div className="flex -space-x-2">
          {members.slice(0, 6).map((w) => (
            <Avatar key={w.id} name={w.name} photo={w.photo} size={30} className="ring-2 ring-panel" />
          ))}
          {members.length > 6 && <span className="inline-flex size-[30px] items-center justify-center rounded-full bg-panel-2 text-[11px] text-muted ring-2 ring-panel">+{members.length - 6}</span>}
        </div>
        <span className={`text-[13px] ${taken ? 'font-medium text-good' : 'text-muted'}`}>
          {taken ? (
            <span className="inline-flex items-center gap-1.5">
              <CheckCheck size={15} /> {head.present + head.late} here
            </span>
          ) : head.marked ? (
            `${head.marked} of ${total} marked`
          ) : (
            `${total} swimmer${total === 1 ? '' : 's'}`
          )}
        </span>
      </div>
      <div className="relative mt-5 grid grid-cols-[1fr_auto] gap-2">
        {taken ? (
          <ButtonLink to={`${base}?tab=skills`} variant="primary" size="lg" icon={<ListChecks size={17} />}>
            Check skills
          </ButtonLink>
        ) : (
          <ButtonLink to={`${base}?tab=attendance&lesson=${lesson.id}`} variant="primary" size="lg" icon={<CalendarCheck size={17} />}>
            Take attendance
          </ButtonLink>
        )}
        <ButtonLink to={taken ? `${base}?tab=attendance&lesson=${lesson.id}` : `${base}?tab=skills`} variant="outline" size="lg" aria-label={taken ? 'Attendance' : 'Skills'}>
          {taken ? <CalendarCheck size={17} /> : <ListChecks size={17} />}
        </ButtonLink>
      </div>
    </article>
  )
}

const ACTION_ICON = { attendance: CalendarCheck, reports: FileText, skills: ListChecks, dates: CalendarDays }
const ACTION_TONE = { attendance: 'text-warn bg-warn/12', reports: 'text-blue bg-blue/12', skills: 'text-aqua bg-aqua/12', dates: 'text-muted bg-fg/[0.06]' }

function ActionsCard({ actions }: { actions: NextAction[] }) {
  const [all, setAll] = useState(false)
  const list = all ? actions : actions.slice(0, 4)
  return (
    <section className="card overflow-hidden" aria-labelledby="todo-h">
      <div className="flex items-baseline justify-between px-5 pt-5">
        <h2 id="todo-h" className="text-[16px] font-bold">
          To do
        </h2>
        <span className="text-xs text-dim">{actions.length} item{actions.length === 1 ? '' : 's'}</span>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {list.map((a) => {
          const Icon = ACTION_ICON[a.kind]
          return (
            <li key={a.id}>
              <Link to={a.to} className="group flex min-h-16 items-center gap-3.5 px-5 py-3 transition-colors hover:bg-fg/[0.025]">
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl ${ACTION_TONE[a.kind]}`}>
                  <Icon size={17} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14.5px] font-medium">{a.title}</span>
                  <span className="block truncate text-[12.5px] text-dim">
                    {a.className} · {a.detail}
                  </span>
                </span>
                <ArrowRight size={16} className="shrink-0 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
              </Link>
            </li>
          )
        })}
      </ul>
      {actions.length > 4 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="w-full border-t border-line px-5 py-3 text-left text-[13px] font-semibold text-muted hover:text-fg">
          {all ? 'Show less' : `Show ${actions.length - 4} more`}
        </button>
      )}
    </section>
  )
}

function AllCaughtUp() {
  return (
    <section className="card flex items-center gap-4 p-5">
      <span className="icon-tile size-11 shrink-0 !rounded-xl !shadow-none">
        <CheckCheck size={19} />
      </span>
      <div>
        <h2 className="text-[16px] font-bold">All caught up</h2>
        <p className="mt-0.5 text-[13.5px] text-muted">Attendance is taken, skills are assessed and report cards are on track.</p>
      </div>
    </section>
  )
}

function nextLesson(classes: SwimClass[], today: string) {
  let best: { cls: SwimClass; index: number } | null = null
  for (const c of classes) {
    const i = c.lessons.findIndex((l) => l.date > today)
    if (i !== -1 && (!best || c.lessons[i].date < best.cls.lessons[best.index].date)) best = { cls: c, index: i }
  }
  return best
}

function NextUp({ cls, index }: { cls: SwimClass; index: number }) {
  const lesson = cls.lessons[index]
  return (
    <section className="card flex flex-col p-5">
      <h2 className="text-[16px] font-bold">Next class</h2>
      <p className="mt-3 font-display text-[1.6rem] font-bold leading-tight tracking-tight">{formatDate(lesson.date, { weekday: 'long' })}</p>
      <p className="text-[13.5px] text-muted">{formatDate(lesson.date, { month: 'long', day: 'numeric' })}</p>
      <div className="mt-4 flex items-center gap-2 text-[14px]">
        <LevelChip level={getLevel(cls.levelId)} />
        <span className="truncate font-medium">{cls.name}</span>
      </div>
      <p className="mt-1 text-[13px] text-dim">
        Lesson {index + 1}
        {lesson.topic ? ` · ${lesson.topic}` : ''}
      </p>
      <ButtonLink to={`/app/classes/${cls.id}?tab=lessons`} size="sm" className="mt-5 self-start">
        Plan the lesson
      </ButtonLink>
    </section>
  )
}

function StatsCard({ totals, active, swimmers }: { totals: { attendance: number | null; passed: number }; active: number; swimmers: number }) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Active classes" value={active} accent="var(--color-aqua)" icon={<Waves size={15} />} />
      <Stat label="Swimmers" value={swimmers} accent="var(--color-blue)" icon={<Users size={15} />} />
      <Stat label="Attendance" value={totals.attendance === null ? null : totals.attendance * 100} format={(n) => `${Math.round(n)}%`} sub="average, marked lessons" accent="var(--color-good)" icon={<CalendarCheck size={15} />} />
      <Stat label="Skills passed" value={totals.passed} sub="across active rosters" accent="var(--p-patrol)" icon={<ListChecks size={15} />} />
    </section>
  )
}

function Onboarding() {
  const status = useSession((s) => s.status)
  return (
    <div className="grid gap-4 md:grid-cols-3">
      {[
        { n: 1, icon: <Plus size={18} />, title: 'Create a class', body: 'Pick a Swim for Life level. Skills and distances come preloaded.', action: <Button variant="primary" size="sm" onClick={() => openDialog('newClass')}>New class</Button> },
        { n: 2, icon: <Users size={18} />, title: 'Add your swimmers', body: 'Names, photos and notes. Swimmers can be in several classes.', action: <Button size="sm" onClick={() => openDialog('newSwimmer')}>New swimmer</Button> },
        {
          n: 3,
          icon: <Sparkles size={18} />,
          title: 'Or look around first',
          body: status === 'demo' ? 'Load two sample classes with swimmers, attendance and progress.' : 'Load two sample classes into your account. Delete them any time.',
          action: (
            <Button
              size="sm"
              onClick={() => {
                useStore.getState().importData(buildDemoData())
                toast('Sample classes added')
              }}
            >
              Load samples
            </Button>
          ),
        },
      ].map((s, i) => (
        <motion.div key={s.n} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }} className="card spotlight flex flex-col p-6">
          <div className="flex items-center justify-between">
            <span className="icon-tile size-10 !rounded-xl">{s.icon}</span>
            <span className="font-mono text-xs text-dim">0{s.n}</span>
          </div>
          <h3 className="mt-5 text-[16px] font-semibold">{s.title}</h3>
          <p className="mt-1.5 flex-1 text-[14px] leading-relaxed text-muted">{s.body}</p>
          <div className="mt-5">{s.action}</div>
        </motion.div>
      ))}
    </div>
  )
}

function ClassCard({ cls, swimmers }: { cls: SwimClass; swimmers: Swimmer[] }) {
  const level = getLevel(cls.levelId)
  const s = classSummary(cls)
  const hue = level ? PROGRAMS[level.program].hue : '#8b94a1'
  const taught = cls.lessons.filter((l) => cls.enrollments.some((e) => e.attendance[l.id])).length
  const members = cls.enrollments.map((e) => swimmers.find((w) => w.id === e.swimmerId)).filter((w): w is Swimmer => Boolean(w))

  return (
    <Link to={`/app/classes/${cls.id}`} className="card spotlight group block h-full overflow-hidden p-5 transition-transform duration-300 hover:-translate-y-0.5 active:scale-[0.99]">
      <span aria-hidden className="pointer-events-none absolute inset-0 rounded-[inherit]" style={{ background: `linear-gradient(180deg, color-mix(in oklab, ${hue} 10%, transparent), transparent 42%)` }} />
      <div className="relative flex items-start justify-between gap-3">
        <LevelChip level={level} />
        <span className="font-mono text-[11px] text-dim">{cls.session}</span>
      </div>
      <h3 className="relative mt-3 line-clamp-2 text-[17px] font-semibold leading-snug tracking-tight">{cls.name}</h3>
      {cls.schedule && (
        <p className="relative mt-1 flex items-center gap-1.5 text-[13px] text-muted">
          <CalendarDays size={13} />
          {cls.schedule}
        </p>
      )}
      <div className="relative mt-5 flex items-center gap-4">
        <ProgressRing value={s.skillRatio ?? 0} size={52} stroke={4.5} color={hue}>
          <span className="font-mono text-[11px] font-semibold">{pct(s.skillRatio)}</span>
        </ProgressRing>
        <div className="min-w-0 flex-1 space-y-1.5 text-[12.5px]">
          <div className="flex justify-between text-muted">
            <span>Attendance</span>
            <span className="font-mono text-fg">{pct(s.attendanceRate)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Lessons</span>
            <span className="font-mono text-fg">
              {taught}/{s.lessons}
            </span>
          </div>
        </div>
      </div>
      <div className="relative mt-5 flex items-center justify-between border-t border-line pt-4">
        <div className="flex -space-x-2">
          {members.slice(0, 5).map((w) => (
            <Avatar key={w.id} name={w.name} photo={w.photo} size={28} className="ring-2 ring-panel" />
          ))}
          {members.length > 5 && (
            <span className="inline-flex size-7 items-center justify-center rounded-full bg-panel-2 font-mono text-[10px] text-muted ring-2 ring-panel">+{members.length - 5}</span>
          )}
          {!members.length && <span className="text-[13px] text-dim">No swimmers yet</span>}
        </div>
        <ArrowRight size={16} className="text-dim transition-transform group-hover:translate-x-1 group-hover:text-aqua" />
      </div>
    </Link>
  )
}
