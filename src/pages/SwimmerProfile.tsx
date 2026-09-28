import { motion } from 'motion/react'
import { ArrowRight, ChevronLeft, Pencil, Plus, Trash2, UserPlus } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { SwimmerDialog } from '../components/dialogs/SwimmerDialog'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { LevelChip, ProgressBar, ProgressRing } from '../components/ui/bits'
import { MenuItem, Popover } from '../components/ui/Popover'
import { PROGRAMS, getLevel } from '../data/curriculum'
import { attendanceSummary, passedLevel, pct, skillProgress } from '../lib/stats'
import { useIsMobile } from '../lib/hooks'
import { useStore } from '../store/useStore'
import { confirm, toast, withUndo } from '../store/useUi'
import NotFound from './NotFound'

export default function SwimmerProfile() {
  const { swimmerId } = useParams()
  const swimmer = useStore((s) => s.swimmers.find((w) => w.id === swimmerId))
  const classes = useStore((s) => s.classes)
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const mobile = useIsMobile()

  if (!swimmer) return <NotFound what="swimmer" />

  const history = classes
    .map((c) => ({ c, e: c.enrollments.find((e) => e.swimmerId === swimmer.id) }))
    .filter((x): x is { c: (typeof classes)[number]; e: NonNullable<typeof x.e> } => Boolean(x.e))
  const available = classes.filter((c) => !c.archived && !c.enrollments.some((e) => e.swimmerId === swimmer.id))
  const levelsPassed = history.filter(({ c, e }) => passedLevel(e, c.skills)).length
  const allAttendance = history.map(({ c, e }) => attendanceSummary(e, c.lessons))
  const marked = allAttendance.reduce((n, a) => n + a.marked, 0)
  const attended = allAttendance.reduce((n, a) => n + a.present + a.late, 0)

  async function remove() {
    const ok = await confirm({
      title: `Delete ${swimmer!.name}?`,
      body: history.length
        ? `They’ll be removed from ${history.length} class${history.length === 1 ? '' : 'es'} along with their attendance and skill records.`
        : 'This swimmer isn’t in any class.',
      confirmLabel: 'Delete swimmer',
      danger: true,
    })
    if (!ok) return
    navigate('/app/swimmers')
    withUndo(`${swimmer!.name} deleted`, () => useStore.getState().deleteSwimmer(swimmer!.id))
  }

  return (
    <div className="space-y-8">
      <Link to="/app/swimmers" className="inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-fg">
        <ChevronLeft size={15} /> Swimmers
      </Link>

      <section className="card relative overflow-hidden p-6 sm:p-8">
        <div className="relative flex flex-wrap items-center gap-4 sm:gap-6">
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 20 }}>
            <Avatar name={swimmer.name} size={mobile ? 64 : 96} className="shadow-[var(--glow)]" />
          </motion.div>
          {/* basis-48: on phones the buttons wrap below instead of crushing the name into a sliver. */}
          <div className="min-w-0 flex-1 basis-48">
            <h1 className="page-title">{swimmer.name}</h1>
            <p className="mt-2 max-w-xl whitespace-pre-wrap text-[14.5px] leading-relaxed text-muted">{swimmer.notes || 'No notes yet.'}</p>
          </div>
          <div className="flex gap-2">
            <Button icon={<Pencil size={15} />} onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button variant="danger" icon={<Trash2 size={15} />} onClick={remove} aria-label="Delete swimmer" />
          </div>
        </div>
        <dl className="relative mt-8 grid grid-cols-3 gap-3 border-t border-line pt-6">
          {[
            ['Classes', String(history.length)],
            ['Levels passed', String(levelsPassed)],
            ['Attendance', marked ? pct(attended / marked) : '—'],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="eyebrow">{label}</dt>
              <dd className="mt-1 font-display text-2xl font-bold tracking-tight">{value}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="eyebrow">Classes</h2>
          {available.length > 0 && (
            <Popover
              label="Add to class"
              trigger={({ toggle }) => (
                <Button size="sm" icon={<UserPlus size={14} />} onClick={toggle}>
                  Add to class
                </Button>
              )}
            >
              {(close) =>
                available.map((c) => (
                  <MenuItem
                    key={c.id}
                    icon={<Plus size={15} />}
                    onSelect={async () => {
                      close()
                      const ok = await confirm({ title: `Add ${swimmer.name} to ${c.name}?`, body: 'They’ll show up in its attendance, skills and report cards.', confirmLabel: 'Add to class' })
                      if (!ok) return
                      useStore.getState().enroll(c.id, swimmer.id)
                      toast(`Added to ${c.name}`)
                    }}
                  >
                    {c.name}
                  </MenuItem>
                ))
              }
            </Popover>
          )}
        </div>
        {history.length ? (
          <ul className="grid gap-3 md:grid-cols-2">
            {history.map(({ c, e }, i) => {
              const level = getLevel(c.levelId)
              const p = skillProgress(e, c.skills)
              const a = attendanceSummary(e, c.lessons)
              const passed = passedLevel(e, c.skills)
              const hue = level ? PROGRAMS[level.program].hue : 'var(--color-aqua)'
              return (
                <motion.li key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
                  <Link to={`/app/classes/${c.id}?tab=skills`} className="card spotlight group flex items-center gap-4 p-4">
                    <ProgressRing value={p.ratio} size={56} stroke={4} color={passed ? 'var(--color-good)' : hue}>
                      <span className="tabular-nums text-[11px] font-semibold">{Math.round(p.ratio * 100)}%</span>
                    </ProgressRing>
                    <div className="relative min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <LevelChip level={level} />
                        {c.archived && <span className="text-[11px] text-dim">archived</span>}
                      </div>
                      <div className="mt-1 truncate text-[15px] font-semibold">{c.name}</div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted">
                        <span className="w-20">Attendance</span>
                        <ProgressBar value={a.rate ?? 0} color="var(--color-good)" className="flex-1" />
                        <span className="w-9 text-right tabular-nums">{pct(a.rate)}</span>
                      </div>
                    </div>
                    <ArrowRight size={16} className="relative text-dim transition-transform group-hover:translate-x-1 group-hover:text-aqua" />
                  </Link>
                </motion.li>
              )
            })}
          </ul>
        ) : (
          <p className="card px-5 py-8 text-center text-sm text-muted">Not in any class yet.</p>
        )}
      </section>

      {editing && <SwimmerDialog swimmer={swimmer} onClose={() => setEditing(false)} />}
    </div>
  )
}
