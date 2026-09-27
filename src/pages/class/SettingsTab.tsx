import { Archive, ArchiveRestore, Copy, RotateCcw, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/bits'
import { LEVELS, PROGRAMS, LEVEL_BY_ID } from '../../data/curriculum'
import { MAX_LESSONS, useStore } from '../../store/useStore'
import { confirm, toast, withUndo } from '../../store/useUi'
import type { ProgramId, SwimClass } from '../../types'

const PROGRAM_IDS = Object.keys(PROGRAMS) as ProgramId[]

export function SettingsTab({ cls }: { cls: SwimClass }) {
  const navigate = useNavigate()
  const updateClass = useStore((s) => s.updateClass)
  const setLessonCount = useStore((s) => s.setLessonCount)
  const resetSkills = useStore((s) => s.resetSkills)
  const deleteClass = useStore((s) => s.deleteClass)
  const duplicateClass = useStore((s) => s.duplicateClass)
  const archiveClass = useStore((s) => s.archiveClass)

  async function changeLevel(levelId: string) {
    updateClass(cls.id, { levelId })
    const level = LEVEL_BY_ID[levelId]
    const ok = await confirm({
      title: `Use the ${level.name} skills?`,
      body: 'Replace this class’s skill list with the preset for the new level. Marks on skills that also exist in the new level are kept, others are deleted. Cancel keeps your current skills as they are.',
      confirmLabel: 'Replace skills',
      danger: true,
    })
    if (ok) withUndo(`Skills replaced with ${level.name}`, () => resetSkills(cls.id))
  }

  async function reset() {
    const ok = await confirm({
      title: 'Reset skills to the preset?',
      body: 'Your custom skills and edits are replaced by the preset list for this level.',
      confirmLabel: 'Reset skills',
      danger: true,
    })
    if (ok) withUndo('Skills reset to preset', () => resetSkills(cls.id))
  }

  /** Resolves true when the count was applied, false when the user backed out. */
  async function changeCount(next: number): Promise<boolean> {
    const n = Math.min(MAX_LESSONS, Math.max(1, Math.round(next) || 1))
    if (n < cls.lessons.length) {
      const dropped = cls.lessons.slice(n)
      if (cls.enrollments.some((e) => dropped.some((l) => e.attendance[l.id]))) {
        const ok = await confirm({
          title: `Reduce to ${n} lessons?`,
          body: 'Attendance recorded on the removed lessons will be deleted.',
          confirmLabel: 'Remove lessons',
          danger: true,
        })
        if (!ok) return false
      }
    }
    setLessonCount(cls.id, n)
    return true
  }

  async function remove() {
    const ok = await confirm({
      title: `Delete “${cls.name}”?`,
      body: 'This removes the class with its attendance, lesson plans and progress. Swimmers stay in your Swimmers list.',
      confirmLabel: 'Delete class',
      danger: true,
    })
    if (ok) {
      navigate('/app')
      withUndo(`Deleted “${cls.name}”`, () => deleteClass(cls.id))
    }
  }

  async function toggleArchive() {
    if (!cls.archived) {
      const ok = await confirm({
        title: `Archive “${cls.name}”?`,
        body: 'It moves out of your class list and off your to-do list. Everything is kept, and you can restore it any time from Archived.',
        confirmLabel: 'Archive class',
      })
      if (!ok) return
    }
    withUndo(cls.archived ? 'Class restored' : 'Class archived', () => archiveClass(cls.id, !cls.archived))
  }

  function duplicate() {
    const id = duplicateClass(cls.id)
    if (id) {
      toast('Class duplicated with a clean slate')
      navigate(`/app/classes/${id}`)
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <section className="card space-y-5 p-5">
        <h2 className="text-sm font-semibold">Class details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Class name">
            <input className="input" value={cls.name} maxLength={120} onChange={(e) => updateClass(cls.id, { name: e.target.value })} />
          </Field>
          <Field label="Level preset">
            <select className="input" value={cls.levelId} onChange={(e) => changeLevel(e.target.value)}>
              {PROGRAM_IDS.map((p) => (
                <optgroup key={p} label={PROGRAMS[p].label}>
                  {LEVELS.filter((l) => l.program === p).map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </Field>
          <Field label="Session">
            <input className="input" value={cls.session} maxLength={60} onChange={(e) => updateClass(cls.id, { session: e.target.value })} placeholder="Spring 2026" />
          </Field>
          <Field label="Day & time">
            <input className="input" value={cls.schedule} maxLength={80} onChange={(e) => updateClass(cls.id, { schedule: e.target.value })} placeholder="Tue 5:30 PM" />
          </Field>
          <Field label="Number of lessons" hint={`1 to ${MAX_LESSONS}. Extra lessons are added at the end.`}>
            <LessonCountInput count={cls.lessons.length} onCommit={changeCount} />
          </Field>
        </div>
      </section>

      <aside className="space-y-3">
        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Skills</h2>
          <p className="text-[13px] text-muted">
            {cls.skills.length} skills in this class. Edit them from the Skills tab, or start over from the level preset.
          </p>
          <Button size="sm" icon={<RotateCcw size={14} />} onClick={reset}>
            Reset to preset
          </Button>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">Next session</h2>
          <p className="text-[13px] text-muted">Duplicate keeps the roster and skills but clears lessons, attendance and progress.</p>
          <Button size="sm" icon={<Copy size={14} />} onClick={duplicate}>
            Duplicate class
          </Button>
        </section>
        <section className="card space-y-3 p-5">
          <h2 className="text-sm font-semibold">{cls.archived ? 'Archived' : 'Session over?'}</h2>
          <p className="text-[13px] text-muted">
            {cls.archived ? 'This class is hidden from your main list but kept for history.' : 'Archive the class to keep its history without cluttering your list.'}
          </p>
          <Button size="sm" icon={cls.archived ? <ArchiveRestore size={14} /> : <Archive size={14} />} onClick={toggleArchive}>
            {cls.archived ? 'Restore class' : 'Archive class'}
          </Button>
        </section>
        <section className="card space-y-3 border-bad/20 p-5">
          <h2 className="text-sm font-semibold text-bad">Danger zone</h2>
          <Button size="sm" variant="danger" icon={<Trash2 size={14} />} onClick={remove}>
            Delete class
          </Button>
        </section>
      </aside>
    </div>
  )
}

/** Applies the number on blur or Enter, so typing "10" never passes through a destructive "1". */
function LessonCountInput({ count, onCommit }: { count: number; onCommit: (n: number) => Promise<boolean> }) {
  const [draft, setDraft] = useState(String(count))
  const [seen, setSeen] = useState(count)
  // Follow external changes (e.g. the stepper on the Lessons tab) unless the user is mid-edit.
  if (seen !== count) {
    setSeen(count)
    setDraft(String(count))
  }
  const commit = async () => {
    const n = Number(draft)
    if (!Number.isFinite(n) || n === count) return setDraft(String(count))
    // When applied, the render-time sync above picks up the new count; otherwise snap back.
    if (!(await onCommit(n))) setDraft(String(count))
  }
  return (
    <input
      className="input"
      type="number"
      min={1}
      max={MAX_LESSONS}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
    />
  )
}
