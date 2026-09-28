import { ArrowLeft, CalendarCheck, CircleCheck, CircleDashed, Eye, FileSpreadsheet, ListChecks, Printer, StickyNote, Users } from 'lucide-react'
import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PrintReports } from '../components/PrintReports'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { EmptyState, LevelChip, Segmented, Spinner } from '../components/ui/bits'
import { getLevel } from '../data/curriculum'
import { api, errorMessage } from '../lib/api'
import { classCsv, csvFileName } from '../lib/csv'
import { formatDate } from '../lib/dates'
import { demoClassDetail } from '../lib/demoPool'
import { nextLevelLabel, printReports } from '../lib/print'
import { isReportDone } from '../lib/reportRules'
import { attendanceSummary, firstName, initials, passedLevel, pct, scheduleNote, skillProgress } from '../lib/stats'
import { usePool } from '../store/usePool'
import { toast } from '../store/useUi'
import { saveFile } from '../lib/files'
import { IS_APP } from '../native/platform'
import type { AttendanceStatus, Enrollment, Swimmer, SwimClass } from '../types'
import { useDemo } from './pool/data'

interface Detail {
  instructor: { id: string; name: string }
  class: SwimClass
  swimmers: Swimmer[]
}

type Tab = 'swimmers' | 'attendance' | 'skills'

/** A pool member's class as a supervisor sees it: everything the instructor recorded, view-only. */
export default function PoolClassPage() {
  const { memberId = '', classId = '' } = useParams()
  const demo = useDemo()
  const poolName = usePool((s) => s.pool?.name)
  const [remote, setRemote] = useState<{ key: string; detail?: Detail; error?: string } | null>(null)
  const key = `${memberId}/${classId}`

  useEffect(() => {
    if (demo) return
    let live = true
    api<Detail>(`/pool/members/${encodeURIComponent(memberId)}/classes/${encodeURIComponent(classId)}`)
      .then((detail) => live && setRemote({ key, detail }))
      .catch((err) => live && setRemote({ key, error: errorMessage(err) }))
    return () => {
      live = false
    }
  }, [demo, memberId, classId, key])

  const local = useMemo(() => (demo ? demoClassDetail(memberId, classId) : null), [demo, memberId, classId])
  const current = remote?.key === key ? remote : null
  const detail = demo ? local : (current?.detail ?? null)
  const error = demo ? (local ? null : 'That class isn’t in the demo pool.') : (current?.error ?? null)

  const back = (
    <Link to="/app/pool" className="inline-flex items-center gap-1.5 text-[13px] font-medium text-muted hover:text-fg">
      <ArrowLeft size={14} /> {poolName ?? 'Pool'}
    </Link>
  )
  if (error)
    return (
      <div className="space-y-6">
        {back}
        <EmptyState icon={<Eye size={22} />} title="Can’t open this class" body={error} />
      </div>
    )
  if (!detail)
    return (
      <div className="space-y-6">
        {back}
        <div className="flex items-center gap-2 py-10 text-sm text-muted">
          <Spinner size={14} /> Opening the class…
        </div>
      </div>
    )
  return <ClassView detail={detail} back={back} />
}

function ClassView({ detail, back }: { detail: Detail; back: ReactNode }) {
  const { class: cls, instructor } = detail
  const [tab, setTab] = useState<Tab>('swimmers')
  const swimmers = useMemo(() => new Map(detail.swimmers.map((w) => [w.id, w])), [detail.swimmers])
  const rows = cls.enrollments.map((e) => ({ e, swimmer: swimmers.get(e.swimmerId) })).filter((r): r is { e: Enrollment; swimmer: Swimmer } => Boolean(r.swimmer))
  const level = getLevel(cls.levelId)
  const taught = cls.lessons.filter((l) => cls.enrollments.some((e) => e.attendance[l.id])).length
  const done = rows.filter((r) => isReportDone(r.e, cls.skills)).length
  const note = scheduleNote(cls)

  function downloadCsv() {
    const name = csvFileName(cls)
    void saveFile(name, classCsv(cls, swimmers), 'text/csv;charset=utf-8').then((done) => done && !IS_APP && toast(`Downloaded ${name}`))
  }

  return (
    <div className="space-y-8">
      <div className="space-y-4">
        {back}
        <section className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2 text-[13px] text-muted">
              <LevelChip level={level} />
              <span>{instructor.name}’s class</span>
              <span className="inline-flex items-center gap-1 rounded-full bg-fg/[0.06] px-2 py-0.5 text-[11.5px] font-semibold text-muted">
                <Eye size={12} /> View only
              </span>
            </div>
            <h1 className="page-title break-words">{cls.name}</h1>
            <p className="mt-2 text-[15px] text-muted">
              {[cls.session, note, `${taught} of ${cls.lessons.length} lessons taught`, `${done} of ${rows.length} report cards done`].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button icon={<FileSpreadsheet size={15} />} onClick={downloadCsv} disabled={!rows.length}>
              Spreadsheet
            </Button>
            <Button variant="primary" icon={<Printer size={15} />} onClick={printReports} disabled={!rows.length}>
              Print report cards
            </Button>
          </div>
        </section>
      </div>

      <Segmented
        label="Show"
        value={tab}
        onChange={setTab}
        options={[
          {
            value: 'swimmers',
            label: (
              <>
                <Users size={14} /> Swimmers
              </>
            ),
          },
          {
            value: 'attendance',
            label: (
              <>
                <CalendarCheck size={14} /> Attendance
              </>
            ),
          },
          {
            value: 'skills',
            label: (
              <>
                <ListChecks size={14} /> Skills
              </>
            ),
          },
        ]}
      />

      {!rows.length ? (
        <EmptyState icon={<Users size={22} />} title="No swimmers yet" body={`${firstName(instructor.name)} hasn’t added anyone to this class.`} />
      ) : tab === 'swimmers' ? (
        <SwimmerCards cls={cls} rows={rows} />
      ) : tab === 'attendance' ? (
        <AttendanceGrid cls={cls} rows={rows} />
      ) : (
        <SkillsGrid cls={cls} rows={rows} />
      )}

      <PrintReports cls={cls} rows={rows} instructor={firstName(instructor.name)} />
    </div>
  )
}

type Rows = { e: Enrollment; swimmer: Swimmer }[]

function SwimmerCards({ cls, rows }: { cls: SwimClass; rows: Rows }) {
  return (
    <ul className="grid gap-3 md:grid-cols-2">
      {rows.map(({ e, swimmer }) => {
        const p = skillProgress(e, cls.skills)
        const a = attendanceSummary(e, cls.lessons)
        const passed = passedLevel(e, cls.skills)
        const ok = isReportDone(e, cls.skills)
        return (
          <li key={swimmer.id} className="card flex items-start gap-3 p-4">
            <Avatar name={swimmer.name} photo={swimmer.photo} size={42} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-[15px] font-semibold">{swimmer.name}</span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${passed ? 'border-good/30 bg-good/10 text-good' : 'border-warn/30 bg-warn/10 text-warn'}`}
                >
                  {passed ? 'Passing' : `${p.pass}/${p.total}`}
                </span>
                <span className="ml-auto shrink-0">
                  {ok ? (
                    <CircleCheck size={17} className="text-good" aria-label="Report card done" />
                  ) : (
                    <CircleDashed size={17} className="text-dim" aria-label="Report card not done" />
                  )}
                </span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{e.comment || <span className="italic text-dim">No comment written yet.</span>}</p>
              {swimmer.notes && (
                <p className="mt-2 flex items-start gap-1.5 text-[12.5px] text-dim">
                  <StickyNote size={13} className="mt-0.5 shrink-0" /> {swimmer.notes}
                </p>
              )}
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-dim">
                <span>
                  Here {a.present + a.late} of {a.marked} {a.late > 0 && `(${a.late} late)`}
                </span>
                <span>Next: {nextLevelLabel(cls, e)}</span>
              </div>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const MARK: Record<AttendanceStatus, { letter: string; tone: string; label: string }> = {
  present: { letter: 'P', tone: 'bg-good/15 text-good', label: 'Present' },
  late: { letter: 'L', tone: 'bg-warn/15 text-warn', label: 'Late' },
  absent: { letter: 'A', tone: 'bg-bad/15 text-bad', label: 'Absent' },
}

/** Swimmers down the side, lessons across, like the paper attendance sheet. */
function AttendanceGrid({ cls, rows }: { cls: SwimClass; rows: Rows }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-panel px-4 py-3 text-left font-semibold">Swimmer</th>
            {cls.lessons.map((l, i) => (
              <th key={l.id} className="px-1.5 py-3 text-center font-normal text-dim" title={l.topic || undefined}>
                <span className="block font-mono text-[12px] font-semibold text-muted">{i + 1}</span>
                <span className="block whitespace-nowrap text-[11px]">{l.date ? formatDate(l.date, { month: 'short', day: 'numeric' }) : '—'}</span>
              </th>
            ))}
            <th className="px-4 py-3 text-right font-semibold">Rate</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ e, swimmer }) => (
            <tr key={swimmer.id}>
              <td className="sticky left-0 z-10 max-w-32 truncate border-t sm:max-w-44 border-line bg-panel px-4 py-2.5 font-medium">{swimmer.name}</td>
              {cls.lessons.map((l) => {
                const m = e.attendance[l.id]
                return (
                  <td key={l.id} className="border-t border-line px-1.5 py-2.5 text-center">
                    {m ? (
                      <span
                        className={`inline-flex size-6 items-center justify-center rounded-md font-mono text-[11.5px] font-bold ${MARK[m].tone}`}
                        title={MARK[m].label}
                      >
                        {MARK[m].letter}
                      </span>
                    ) : (
                      <span className="text-dim">·</span>
                    )}
                  </td>
                )
              })}
              <td className="border-t border-line px-4 py-2.5 text-right font-mono tabular-nums">{pct(attendanceSummary(e, cls.lessons).rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Skills down the side (their names are long), swimmers across. */
function SkillsGrid({ cls, rows }: { cls: SwimClass; rows: Rows }) {
  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-[13px]">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-panel px-4 py-3 text-left font-semibold">Skill</th>
            {rows.map(({ swimmer }) => (
              <th key={swimmer.id} className="px-1.5 py-3 text-center font-normal" title={swimmer.name}>
                <span className="inline-flex size-7 items-center justify-center rounded-full bg-fg/[0.06] font-mono text-[10.5px] font-semibold text-muted">
                  {initials(swimmer.name)}
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {cls.skills.map((s) => (
            <tr key={s.id}>
              <td className="sticky left-0 z-10 max-w-40 truncate border-t sm:max-w-64 border-line bg-panel px-4 py-2.5" title={s.name}>
                {s.name}
              </td>
              {rows.map(({ e, swimmer }) => {
                const v = e.skills[s.id]
                return (
                  <td key={swimmer.id} className="border-t border-line px-1.5 py-2.5 text-center">
                    {v === 'pass' ? (
                      <span className="font-bold text-good" title={`${swimmer.name}: passed`}>
                        ✓
                      </span>
                    ) : v === 'incomplete' ? (
                      <span className="font-bold text-warn" title={`${swimmer.name}: not yet`}>
                        ✗
                      </span>
                    ) : (
                      <span className="text-dim" title={`${swimmer.name}: not assessed`}>
                        ·
                      </span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
