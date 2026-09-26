import { motion } from 'motion/react'
import { ArrowRight, CircleCheck, CircleDashed, FileText, PenLine, Printer, Wand2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { PrintReports } from '../../components/PrintReports'
import { Avatar } from '../../components/ui/Avatar'
import { Button, ButtonLink } from '../../components/ui/Button'
import { EmptyState, ProgressBar } from '../../components/ui/bits'
import { nextLevelLabel, printReports } from '../../lib/print'
import { draftComment } from '../../lib/report'
import { isReportDone } from '../../lib/reportRules'
import { firstName, passedLevel, skillProgress } from '../../lib/stats'
import { useSession } from '../../store/useSession'
import { useStore } from '../../store/useStore'
import { toast, withUndo } from '../../store/useUi'
import type { Enrollment, Swimmer, SwimClass } from '../../types'

export function ReportsTab({ cls, swimmers }: { cls: SwimClass; swimmers: Map<string, Swimmer> }) {
  const user = useSession((s) => s.user)
  const rows = cls.enrollments
    .map((e) => ({ e, swimmer: swimmers.get(e.swimmerId) }))
    .filter((r): r is { e: Enrollment; swimmer: Swimmer } => Boolean(r.swimmer))

  if (!rows.length) return <EmptyState icon={<FileText size={22} />} title="No swimmers yet" body="Add swimmers to write their report cards." />

  const done = rows.filter((r) => isReportDone(r.e, cls.skills)).length
  const written = rows.filter((r) => r.e.comment.trim()).length
  const unassessed = rows.filter((r) => skillProgress(r.e, cls.skills).unmarked > 0).length
  const nextUp = rows.find((r) => !isReportDone(r.e, cls.skills)) ?? rows[0]
  const workspace = (id: string) => `/app/classes/${cls.id}/reports/${id}`

  function draftMissing() {
    const missing = rows.filter((r) => !r.e.comment.trim())
    withUndo(`Drafted ${missing.length} comment${missing.length === 1 ? '' : 's'}`, () => {
      for (const { e, swimmer } of missing) {
        useStore.getState().setComment(cls.id, swimmer.id, draftComment(swimmer.name, cls.skills, e.skills, passedLevel(e, cls.skills)))
      }
    })
  }

  function print() {
    if (written < rows.length) toast(`${rows.length - written} report card${rows.length - written === 1 ? ' has' : 's have'} no comment yet`, 'error')
    printReports()
  }

  return (
    <div className="space-y-4">
      <div className="card flex flex-wrap items-center gap-5 p-5">
        <div className="min-w-52 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="font-display text-xl font-bold">
              {done} of {rows.length} done
            </span>
            {unassessed > 0 && <span className="text-xs text-warn">{unassessed} with unassessed skills</span>}
          </div>
          <ProgressBar value={done / rows.length} color="var(--color-good)" className="mt-2.5" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Wand2 size={15} />} onClick={draftMissing} disabled={written === rows.length}>
            Draft missing
          </Button>
          <Button icon={<Printer size={15} />} onClick={print}>
            Print all
          </Button>
          <ButtonLink variant="primary" to={workspace(nextUp.swimmer.id)} icon={<PenLine size={15} />}>
            {done === rows.length ? 'Review cards' : done ? 'Continue writing' : 'Start writing'}
          </ButtonLink>
        </div>
      </div>

      <ul className="grid gap-3 md:grid-cols-2">
        {rows.map(({ e, swimmer }, i) => {
          const passed = passedLevel(e, cls.skills)
          const p = skillProgress(e, cls.skills)
          const ok = isReportDone(e, cls.skills)
          return (
            <motion.li key={swimmer.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i, 10) * 0.03 }}>
              <Link to={workspace(swimmer.id)} className="card spotlight group flex w-full items-start gap-3 p-4 text-left transition-transform active:scale-[0.99]">
                <Avatar name={swimmer.name} photo={swimmer.photo} size={42} />
                <div className="relative min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="truncate text-[15px] font-semibold">{swimmer.name}</span>
                    <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${passed ? 'border-good/30 bg-good/10 text-good' : 'border-warn/30 bg-warn/10 text-warn'}`}>
                      {passed ? 'Passing' : `${p.pass}/${p.total}`}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted">
                    {e.comment || <span className="italic text-dim">No comment yet. Tap to write {firstName(swimmer.name)}’s.</span>}
                  </p>
                  <div className="mt-2 text-[12px] text-dim">Next: {nextLevelLabel(cls, e)}</div>
                </div>
                <span className="relative flex flex-col items-end gap-3">
                  {ok ? <CircleCheck size={18} className="text-good" aria-label="Done" /> : <CircleDashed size={18} className="text-dim" aria-label="Not done" />}
                  <ArrowRight size={15} className="text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-fg" />
                </span>
              </Link>
            </motion.li>
          )
        })}
      </ul>

      <PrintReports cls={cls} rows={rows} instructor={user ? firstName(user.name) : ''} />
    </div>
  )
}
