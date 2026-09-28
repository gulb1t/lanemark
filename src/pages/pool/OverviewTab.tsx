import { motion } from 'motion/react'
import { ArrowRight, CalendarCheck, Check, ChevronDown, FileText, ListChecks, Users } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Avatar } from '../../components/ui/Avatar'
import { LevelChip, Stat } from '../../components/ui/bits'
import { getLevel } from '../../data/curriculum'
import { attentionNotes, caughtUp, classStatus, rank, summarize, type ClassProgress } from '../../lib/overview'
import { pct } from '../../lib/stats'
import type { InstructorProgress } from '../../store/usePool'
import { RankBadge, Score, StatusPill } from './bits'
import { classLink } from './data'

interface Row {
  cls: ClassProgress
  who: InstructorProgress
}

export function OverviewTab({ instructors, onRankings }: { instructors: InstructorProgress[]; onRankings: () => void }) {
  const all = instructors.flatMap((i) => i.classes)
  const totals = summarize(all)
  const onTrack = all.filter((c) => ['on-track', 'finished'].includes(classStatus(c))).length
  const started = all.filter((c) => !['empty', 'upcoming'].includes(classStatus(c))).length
  const attention: Row[] = instructors
    .flatMap((i) => i.classes.map((cls) => ({ cls, who: i })))
    .filter((r) => classStatus(r.cls) === 'behind')
    .sort((a, b) => (caughtUp(a.cls) ?? 1) - (caughtUp(b.cls) ?? 1))
  const top = rank(
    instructors,
    (i) => summarize(i.classes).caughtUp,
    (i) => i.name,
  ).slice(0, 5)

  if (!all.length)
    return (
      <div className="card flex flex-col items-center gap-2 border-dashed px-6 py-14 text-center">
        <span className="icon-tile size-12">
          <Users size={20} />
        </span>
        <h2 className="mt-2 font-semibold">No classes yet</h2>
        <p className="max-w-sm text-sm text-muted">Once your instructors join and set up their classes, every class shows up here. Invite them from Team.</p>
      </div>
    )

  return (
    <div className="space-y-4">
      <section className="grid auto-rows-fr grid-cols-2 gap-3 md:grid-cols-4" aria-label="Pool totals" data-tour="pool-totals">
        <Stat
          label="Caught up"
          value={totals.caughtUp === null ? null : totals.caughtUp * 100}
          format={(n) => `${Math.round(n)}%`}
          sub={`${onTrack} of ${started} classes on track`}
          meter={totals.caughtUp}
          accent="var(--color-aqua)"
          icon={<Check size={15} />}
        />
        <Stat
          label="Attendance"
          value={totals.attendanceRate === null ? null : totals.attendanceRate * 100}
          format={(n) => `${Math.round(n)}%`}
          sub="average, marked lessons"
          meter={totals.attendanceRate}
          accent="var(--color-good)"
          icon={<CalendarCheck size={15} />}
        />
        <Stat
          label="Skills assessed"
          value={totals.assessed === null ? null : totals.assessed * 100}
          format={(n) => `${Math.round(n)}%`}
          sub={`${totals.passed} swimmer${totals.passed === 1 ? '' : 's'} passed so far`}
          meter={totals.assessed}
          accent="var(--p-patrol)"
          icon={<ListChecks size={15} />}
        />
        <Stat
          label="Report cards"
          value={totals.reportsDone}
          sub={`of ${totals.swimmers} swimmers`}
          meter={totals.swimmers ? totals.reportsDone / totals.swimmers : null}
          accent="var(--color-blue)"
          icon={<FileText size={15} />}
        />
      </section>

      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]">
        <NeedsAttention rows={attention} />
        <section className="card flex flex-col overflow-hidden" aria-labelledby="top-h">
          <div className="flex items-baseline justify-between px-5 pt-5">
            <h2 id="top-h" className="text-[16px] font-bold">
              Most caught up
            </h2>
            <button type="button" onClick={onRankings} className="inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-fg">
              Rankings <ArrowRight size={14} />
            </button>
          </div>
          <ol className="mt-2 flex-1 divide-y divide-line">
            {top.map(({ item, rank: place, score }) => (
              <li key={item.id} className="flex items-center gap-3 px-5 py-3">
                <RankBadge place={place} />
                <Avatar name={item.name} size={30} />
                <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                  {item.name}
                  {item.you && <span className="ml-1.5 text-[12px] font-normal text-dim">(you)</span>}
                </span>
                <span className="text-[13px] font-semibold tabular-nums">{pct(score)}</span>
              </li>
            ))}
          </ol>
        </section>
      </div>

      <InstructorTable instructors={instructors} />
    </div>
  )
}

function NeedsAttention({ rows }: { rows: Row[] }) {
  const [all, setAll] = useState(false)
  const shown = all ? rows : rows.slice(0, 4)
  if (!rows.length)
    return (
      <section className="card flex items-center gap-4 p-5" data-tour="pool-attention">
        <span className="icon-tile size-11 shrink-0 !rounded-xl !shadow-none">
          <Check size={19} />
        </span>
        <div>
          <h2 className="text-[16px] font-bold">Every class is on track</h2>
          <p className="mt-0.5 text-[13.5px] text-muted">Attendance is taken, skills are being assessed and report cards are keeping up.</p>
        </div>
      </section>
    )
  return (
    <section className="card flex flex-col overflow-hidden" aria-labelledby="attn-h" data-tour="pool-attention">
      <div className="flex items-baseline justify-between px-5 pt-5">
        <h2 id="attn-h" className="text-[16px] font-bold">
          Needs attention
        </h2>
        <span className="text-xs text-dim">
          {rows.length} class{rows.length === 1 ? '' : 'es'}
        </span>
      </div>
      <ul className="mt-2 divide-y divide-line">
        {shown.map(({ cls, who }) => (
          <li key={`${who.id}:${cls.id}`}>
            <Link to={classLink(who.id, who.you, cls.id)} className="group flex items-center gap-3.5 px-5 py-3 transition-colors hover:bg-fg/[0.025]">
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <LevelChip level={getLevel(cls.levelId)} />
                  <span className="truncate text-[14px] font-medium">{cls.name}</span>
                </span>
                <span className="mt-0.5 block truncate text-[12.5px] text-dim">
                  {who.name} · {attentionNotes(cls).join(' · ') || 'Falling behind'}
                </span>
              </span>
              <span className="text-[13px] font-semibold tabular-nums text-warn">{pct(caughtUp(cls))}</span>
              <ArrowRight size={15} className="shrink-0 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
            </Link>
          </li>
        ))}
      </ul>
      {rows.length > 4 && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-auto w-full border-t border-line px-5 py-3 text-left text-[13px] font-semibold text-muted hover:text-fg"
        >
          {all ? 'Show less' : `Show ${rows.length - 4} more`}
        </button>
      )}
    </section>
  )
}

const COLS = 'md:grid md:grid-cols-[minmax(0,1.7fr)_repeat(4,minmax(0,0.75fr))_minmax(0,1.3fr)_2rem] md:items-center md:gap-4'

function InstructorTable({ instructors }: { instructors: InstructorProgress[] }) {
  const [open, setOpen] = useState<string | null>(null)
  const rows = [...instructors].sort((a, b) => (summarize(b.classes).caughtUp ?? -1) - (summarize(a.classes).caughtUp ?? -1) || a.name.localeCompare(b.name))
  return (
    <section className="card overflow-hidden" aria-labelledby="inst-h">
      <h2 id="inst-h" className="px-5 pt-5 text-[16px] font-bold">
        Instructors
      </h2>
      <div className={`mt-3 hidden border-b border-line px-5 pb-2 text-[11.5px] font-semibold uppercase tracking-wider text-dim ${COLS}`} aria-hidden>
        <span>Instructor</span>
        <span>Classes</span>
        <span>Attendance</span>
        <span>Skills</span>
        <span>Reports</span>
        <span>Caught up</span>
        <span />
      </div>
      <ul className="divide-y divide-line max-md:mt-2">
        {rows.map((i) => {
          const s = summarize(i.classes)
          const expanded = open === i.id
          return (
            <li key={i.id}>
              <button
                type="button"
                onClick={() => setOpen(expanded ? null : i.id)}
                aria-expanded={expanded}
                className={`w-full px-5 py-3.5 text-left transition-colors hover:bg-fg/[0.025] ${COLS}`}
              >
                <span className="flex min-w-0 items-center gap-3">
                  <Avatar name={i.name} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className="truncate text-[14.5px] font-medium">{i.name}</span>
                      {i.you && <span className="text-[12px] text-dim">(you)</span>}
                    </span>
                    <span className="block truncate text-[12.5px] text-dim">
                      {s.classes} class{s.classes === 1 ? '' : 'es'} · {s.swimmers} swimmer{s.swimmers === 1 ? '' : 's'}
                      {s.behind > 0 && <span className="text-warn"> · {s.behind} behind</span>}
                    </span>
                  </span>
                  <ChevronDown size={16} className={`shrink-0 text-dim transition-transform md:hidden ${expanded ? 'rotate-180' : ''}`} />
                </span>
                <Cell>{s.classes}</Cell>
                <Cell>{pct(s.attendanceRate)}</Cell>
                <Cell>{pct(s.assessed)}</Cell>
                <Cell>
                  {s.reportsDone}/{s.swimmers}
                </Cell>
                <Score value={s.caughtUp} className="max-md:mt-3" />
                <ChevronDown size={16} className={`hidden justify-self-end text-dim transition-transform md:block ${expanded ? 'rotate-180' : ''}`} />
              </button>
              {expanded && <ClassList who={i} />}
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function Cell({ children }: { children: ReactNode }) {
  return <span className="hidden text-[13px] tabular-nums text-muted md:block">{children}</span>
}

function ClassList({ who }: { who: InstructorProgress }) {
  const classes = who.classes
  if (!classes.length) return <p className="border-t border-line bg-fg/[0.015] px-5 py-4 text-[13px] text-dim">No active classes.</p>
  return (
    <motion.ul initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="divide-y divide-line border-t border-line bg-fg/[0.015]">
      {classes.map((c) => {
        const status = classStatus(c)
        const notes = attentionNotes(c)
        return (
          <li key={c.id}>
            <Link to={classLink(who.id, who.you, c.id)} className={`group block px-5 py-3 transition-colors hover:bg-fg/[0.03] md:pl-[4.25rem] ${COLS}`}>
              <span className="min-w-0">
                <span className="flex min-w-0 items-center gap-2">
                  <LevelChip level={getLevel(c.levelId)} />
                  <span className="truncate text-[13.5px] font-medium">{c.name}</span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-dim">
                  <StatusPill status={status} />
                  <span>
                    Lesson {Math.max(c.past, c.taught)} of {c.lessons}
                  </span>
                  {notes.length > 0 && status === 'behind' && <span className="text-warn">{notes.join(' · ')}</span>}
                </span>
                <span className="mt-1.5 block tabular-nums text-[12px] text-dim md:hidden">
                  Attendance {pct(c.attendanceRate)} · Skills {pct(c.assessed)} · Reports {c.reportsDone}/{c.swimmers}
                </span>
              </span>
              <Cell>
                {c.swimmers} swimmer{c.swimmers === 1 ? '' : 's'}
              </Cell>
              <Cell>{pct(c.attendanceRate)}</Cell>
              <Cell>{pct(c.assessed)}</Cell>
              <Cell>
                {c.reportsDone}/{c.swimmers}
              </Cell>
              <Score value={caughtUp(c)} className="max-md:mt-2" />
              <ArrowRight size={15} className="hidden justify-self-end text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg md:block" />
            </Link>
          </li>
        )
      })}
    </motion.ul>
  )
}
