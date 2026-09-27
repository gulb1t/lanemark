import { motion } from 'motion/react'
import { FileText, Pencil, Plus, UserMinus, Users } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { AddMemberDialog } from '../../components/dialogs/AddMemberDialog'
import { SwimmerDialog } from '../../components/dialogs/SwimmerDialog'
import { Avatar } from '../../components/ui/Avatar'
import { Button, ButtonLink, IconButton } from '../../components/ui/Button'
import { EmptyState, ProgressBar, ProgressRing } from '../../components/ui/bits'
import { attendanceSummary, passedLevel, pct, skillProgress } from '../../lib/stats'
import { useStore } from '../../store/useStore'
import { confirm, withUndo } from '../../store/useUi'
import type { Enrollment, Swimmer, SwimClass } from '../../types'

type Dialog = { kind: 'add' } | { kind: 'new' } | { kind: 'edit'; swimmer: Swimmer } | null

export function RosterTab({ cls, swimmers }: { cls: SwimClass; swimmers: Map<string, Swimmer> }) {
  const [dialog, setDialog] = useState<Dialog>(null)

  const members = cls.enrollments
    .map((e) => ({ e, swimmer: swimmers.get(e.swimmerId) }))
    .filter((m): m is { e: Enrollment; swimmer: Swimmer } => Boolean(m.swimmer))

  async function remove(swimmer: Swimmer, e: Enrollment) {
    const records = Object.keys(e.attendance).length + Object.keys(e.skills).length + (e.comment.trim() ? 1 : 0)
    const ok = await confirm({
      title: `Remove ${swimmer.name} from this class?`,
      body: records
        ? `Their attendance, skill marks and report card for ${cls.name} are removed too. They stay in your Swimmers list.`
        : `They stay in your Swimmers list, so you can add them back any time.`,
      confirmLabel: 'Remove from class',
      danger: true,
    })
    if (ok) withUndo(`${swimmer.name} removed from class`, () => useStore.getState().unenroll(cls.id, swimmer.id))
  }

  return (
    <div>
      {members.length ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {members.map(({ e, swimmer }, i) => {
            const att = attendanceSummary(e, cls.lessons)
            const prog = skillProgress(e, cls.skills)
            const passed = passedLevel(e, cls.skills)
            return (
              <motion.article
                key={swimmer.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i, 10) * 0.035 }}
                className="card spotlight flex flex-col p-4"
              >
                <div className="relative flex items-start gap-3">
                  <Link to={`/app/swimmers/${swimmer.id}`} className="rounded-full" aria-label={`Open ${swimmer.name}`}>
                    <ProgressRing value={prog.ratio} size={62} stroke={3} color={passed ? 'var(--color-good)' : 'var(--color-aqua)'}>
                      <Avatar name={swimmer.name} photo={swimmer.photo} size={50} />
                    </ProgressRing>
                  </Link>
                  <div className="min-w-0 flex-1 pt-1">
                    <Link to={`/app/swimmers/${swimmer.id}`} className="block truncate text-[15px] font-semibold hover:underline">
                      {swimmer.name}
                    </Link>
                    <p className="mt-0.5 line-clamp-2 text-[13px] text-muted">{swimmer.notes || <span className="text-dim">No notes</span>}</p>
                  </div>
                  <div className="-mr-1.5 -mt-1 flex">
                    <IconButton label={`Edit ${swimmer.name}`} onClick={() => setDialog({ kind: 'edit', swimmer })}>
                      <Pencil size={15} />
                    </IconButton>
                    <IconButton label={`Remove ${swimmer.name} from class`} tone="danger" onClick={() => remove(swimmer, e)}>
                      <UserMinus size={15} />
                    </IconButton>
                  </div>
                </div>

                <div className="relative mt-4 grid grid-cols-2 gap-4">
                  <div>
                    <div className="eyebrow mb-1.5 flex justify-between">
                      <span>Skills</span>
                      <span className={passed ? 'text-good' : 'text-muted'}>
                        {prog.pass}/{prog.total}
                      </span>
                    </div>
                    <ProgressBar value={prog.ratio} color={passed ? 'var(--color-good)' : 'var(--color-aqua)'} />
                  </div>
                  <div>
                    <div className="eyebrow mb-1.5 flex justify-between">
                      <span>Attendance</span>
                      <span className="text-muted">{pct(att.rate)}</span>
                    </div>
                    <ProgressBar value={att.rate ?? 0} color="var(--color-good)" />
                  </div>
                </div>

                <div className="relative mt-4 flex items-center justify-between border-t border-line pt-3">
                  <span className="font-mono text-xs text-dim">
                    {prog.incomplete ? <span className="text-warn">{prog.incomplete} not yet</span> : passed ? <span className="text-good">Level passed</span> : `${prog.unmarked} to assess`}
                  </span>
                  <ButtonLink size="sm" icon={<FileText size={14} />} to={`/app/classes/${cls.id}/reports/${swimmer.id}`}>
                    Report card
                  </ButtonLink>
                </div>
              </motion.article>
            )
          })}
          <button
            type="button"
            onClick={() => setDialog({ kind: 'add' })}
            className="group flex min-h-48 flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-line-2 text-sm text-muted transition-colors hover:border-aqua/50 hover:bg-aqua/[0.03] hover:text-aqua"
          >
            <span className="flex size-10 items-center justify-center rounded-xl border border-current/20 transition-transform group-hover:rotate-90">
              <Plus size={18} />
            </span>
            Add swimmers
          </button>
        </div>
      ) : (
        <EmptyState
          icon={<Users size={22} />}
          title="No swimmers in this class"
          body="Add swimmers to start taking attendance and checking off skills."
          action={
            <Button variant="primary" icon={<Plus size={16} />} onClick={() => setDialog({ kind: 'add' })}>
              Add swimmers
            </Button>
          }
        />
      )}

      {dialog?.kind === 'add' && <AddMemberDialog cls={cls} onClose={() => setDialog(null)} onCreateNew={() => setDialog({ kind: 'new' })} />}
      {dialog?.kind === 'new' && <SwimmerDialog classId={cls.id} onClose={() => setDialog(null)} />}
      {dialog?.kind === 'edit' && <SwimmerDialog key={dialog.swimmer.id} swimmer={dialog.swimmer} onClose={() => setDialog(null)} />}
    </div>
  )
}
