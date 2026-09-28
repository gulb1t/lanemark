import { motion } from 'motion/react'
import { ArrowRight, CircleCheck, FileSpreadsheet, FileText, MoreHorizontal, PenLine, Printer, Sparkles } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PrintReports } from '../../components/PrintReports'
import { Avatar } from '../../components/ui/Avatar'
import { Button, ButtonLink } from '../../components/ui/Button'
import { EmptyState, ProgressBar } from '../../components/ui/bits'
import { MenuItem, Popover } from '../../components/ui/Popover'
import { classCsv, csvFileName } from '../../lib/csv'
import { nextLevelLabel, printReports } from '../../lib/print'
import { draftComment } from '../../lib/report'
import { isReportDone } from '../../lib/reportRules'
import { firstName, passedLevel, skillProgress } from '../../lib/stats'
import { useSession } from '../../store/useSession'
import { useStore } from '../../store/useStore'
import { saveFile } from '../../lib/files'
import { IS_APP } from '../../native/platform'
import { confirm, toast, withUndo } from '../../store/useUi'
import type { Enrollment, Swimmer, SwimClass } from '../../types'

/** What's left on one card, in plain words. */
function missing(e: Enrollment, cls: SwimClass): string {
  const unmarked = skillProgress(e, cls.skills).unmarked
  const parts = [unmarked && `${unmarked} skill${unmarked === 1 ? '' : 's'} to check`, !e.comment.trim() && 'needs a comment'].filter(Boolean)
  return parts.join(' · ')
}

export function ReportsTab({ cls, swimmers }: { cls: SwimClass; swimmers: Map<string, Swimmer> }) {
  const user = useSession((s) => s.user)
  const rows = cls.enrollments.map((e) => ({ e, swimmer: swimmers.get(e.swimmerId) })).filter((r): r is { e: Enrollment; swimmer: Swimmer } => Boolean(r.swimmer))

  if (!rows.length) return <EmptyState icon={<FileText size={22} />} title="No swimmers yet" body="Add swimmers to this class, and their report cards show up here." />

  const done = rows.filter((r) => isReportDone(r.e, cls.skills)).length
  const unwritten = rows.filter((r) => !r.e.comment.trim())
  const nextUp = rows.find((r) => !isReportDone(r.e, cls.skills)) ?? rows[0]
  const workspace = (id: string) => `/app/classes/${cls.id}/reports/${id}`

  async function draftMissing() {
    const ok = await confirm({
      title: `Write ${unwritten.length} comment${unwritten.length === 1 ? '' : 's'} for you?`,
      body: `SwimTrack writes a comment for everyone who doesn’t have one yet, from their skills, in the manual’s words. Comments you’ve already written aren’t touched. Read them over before printing.`,
      confirmLabel: 'Write them',
    })
    if (!ok) return
    withUndo(`Wrote ${unwritten.length} comment${unwritten.length === 1 ? '' : 's'}`, () => {
      for (const { e, swimmer } of unwritten) {
        useStore.getState().setComment(cls.id, swimmer.id, draftComment(swimmer.name, cls.skills, e.skills, passedLevel(e, cls.skills)))
      }
    })
  }

  /** The whole class as a spreadsheet, for supervisors and front-desk records. */
  function downloadCsv() {
    const name = csvFileName(cls)
    void saveFile(name, classCsv(cls, swimmers), 'text/csv;charset=utf-8').then((done) => done && !IS_APP && toast(`Downloaded ${name}`))
  }

  function print() {
    if (unwritten.length) toast(`${unwritten.length} report card${unwritten.length === 1 ? ' has' : 's have'} no comment yet`, 'error')
    printReports()
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 sm:p-6" data-tour="reports-start">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
          <div className="min-w-56 flex-1">
            <div className="flex items-baseline justify-between gap-3">
              <span className="font-display text-xl font-bold">
                {done} of {rows.length} done
              </span>
            </div>
            <ProgressBar value={done / rows.length} color="var(--color-good)" className="mt-2.5" />
            <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
              {['Check skills', 'Write the comment', 'Print'].map((t, i) => (
                <li key={t} className="flex items-center gap-1.5">
                  <span className="flex size-4.5 items-center justify-center rounded-full bg-fg/[0.08] text-[10.5px] font-bold text-fg">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <ButtonLink variant="primary" to={workspace(nextUp.swimmer.id)} icon={<PenLine size={15} />}>
              {done === rows.length ? 'Review cards' : done ? `Continue with ${firstName(nextUp.swimmer.name)}` : 'Start writing'}
            </ButtonLink>
            <Button icon={<Printer size={15} />} onClick={print}>
              Print all
            </Button>
            <Popover
              label="More"
              trigger={({ toggle, open }) => (
                <Button variant="ghost" onClick={toggle} aria-expanded={open} aria-label="More report card options" icon={<MoreHorizontal size={17} />} />
              )}
            >
              {(close) => (
                <>
                  <MenuItem icon={<Sparkles size={15} />} onSelect={() => (close(), void draftMissing())} hint={unwritten.length ? `${unwritten.length}` : undefined}>
                    {unwritten.length ? 'Write the missing comments' : 'Every card has a comment'}
                  </MenuItem>
                  <MenuItem icon={<FileSpreadsheet size={15} />} onSelect={() => (close(), downloadCsv())}>
                    Download as a spreadsheet
                  </MenuItem>
                </>
              )}
            </Popover>
          </div>
        </div>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map(({ e, swimmer }, i) => {
          const passed = passedLevel(e, cls.skills)
          const ok = isReportDone(e, cls.skills)
          return (
            <motion.li key={swimmer.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
              <Link to={workspace(swimmer.id)} className="card spotlight group flex w-full items-start gap-3 p-4 text-left transition-transform active:scale-[0.99]">
                <Avatar name={swimmer.name} photo={swimmer.photo} size={42} />
                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{swimmer.name}</span>
                    {ok ? (
                      <span className="inline-flex shrink-0 items-center gap-1 text-[12.5px] font-semibold text-good">
                        <CircleCheck size={14} /> Done
                      </span>
                    ) : (
                      <span className="shrink-0 text-[12.5px] font-medium text-warn">{missing(e, cls)}</span>
                    )}
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">{e.comment || <span className="italic text-dim">No comment yet.</span>}</p>
                  <div className="mt-2 text-[12px] text-dim">
                    {passed ? 'Passed' : 'Not passed yet'} · Next: {nextLevelLabel(cls, e)}
                  </div>
                </div>
                <ArrowRight size={16} className="relative mt-1 shrink-0 text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
              </Link>
            </motion.li>
          )
        })}
      </ul>

      <PrintReports cls={cls} rows={rows} instructor={user ? firstName(user.name) : ''} />
    </div>
  )
}
