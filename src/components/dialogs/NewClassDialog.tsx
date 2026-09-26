import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { LEVELS, LEVEL_BY_ID, PROGRAMS } from '../../data/curriculum'
import { DEFAULT_LESSONS, MAX_LESSONS, useStore } from '../../store/useStore'
import { useUi } from '../../store/useUi'
import type { ProgramId } from '../../types'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Field, LevelChip } from '../ui/bits'

const PROGRAM_IDS = Object.keys(PROGRAMS) as ProgramId[]

function guessSession(d = new Date()) {
  const season = ['Winter', 'Winter', 'Spring', 'Spring', 'Spring', 'Summer', 'Summer', 'Summer', 'Fall', 'Fall', 'Fall', 'Winter'][d.getMonth()]
  return `${season} ${d.getFullYear()}`
}

export function NewClassDialog({ onClose }: { onClose: () => void }) {
  const addClass = useStore((s) => s.addClass)
  const navigate = useNavigate()

  const [preset] = useState(() => (useUi.getState().presetLevelId && LEVEL_BY_ID[useUi.getState().presetLevelId!]) || LEVEL_BY_ID.sw1)
  const [program, setProgram] = useState<ProgramId>(preset.program)
  const [levelId, setLevelId] = useState(preset.id)
  const [name, setName] = useState('')
  const [session, setSession] = useState(guessSession)
  const [schedule, setSchedule] = useState('')
  const [lessons, setLessons] = useState(DEFAULT_LESSONS)

  const level = LEVEL_BY_ID[levelId]
  const levels = LEVELS.filter((l) => l.program === program)

  function pickProgram(p: ProgramId) {
    setProgram(p)
    setLevelId(LEVELS.find((l) => l.program === p)!.id)
  }

  function submit(e: FormEvent) {
    e.preventDefault()
    const id = addClass({ levelId, name, session, schedule, lessonCount: lessons })
    onClose()
    navigate(`/app/classes/${id}`)
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="New class"
      description="Pick a preset level. Its skills are copied into the class and stay fully editable."
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="new-class-form">
            Create class
          </Button>
        </>
      }
    >
      <form id="new-class-form" onSubmit={submit} className="space-y-5">
        <div>
          <span className="mb-2 block text-[13px] font-medium text-muted">Program</span>
          <div className="flex flex-wrap gap-1.5">
            {PROGRAM_IDS.map((p) => {
              const active = p === program
              const hue = PROGRAMS[p].hue
              return (
                <button
                  key={p}
                  type="button"
                  aria-pressed={active}
                  onClick={() => pickProgram(p)}
                  className="rounded-lg border px-3 py-1.5 text-[13px] font-medium transition-colors"
                  style={active ? { color: hue, borderColor: `color-mix(in oklab, ${hue} 45%, transparent)`, background: `color-mix(in oklab, ${hue} 10%, transparent)` } : { borderColor: 'var(--color-line-2)', color: 'var(--color-muted)' }}
                >
                  {PROGRAMS[p].label}
                </button>
              )
            })}
          </div>
        </div>

        <div>
          <span className="mb-2 block text-[13px] font-medium text-muted">Level</span>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {levels.map((l) => {
              const active = l.id === levelId
              return (
                <button
                  key={l.id}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setLevelId(l.id)}
                  className={`rounded-xl border p-3 text-left transition-colors ${active ? 'border-aqua/50 bg-aqua/[0.07]' : 'border-line-2 hover:border-dim'}`}
                >
                  <LevelChip level={l} />
                  <div className="mt-1.5 text-[13px] font-medium leading-snug">{l.name.replace(/^Swimmer \d+: /, '')}</div>
                  <div className="mt-0.5 text-xs text-dim">{l.skills.length} skills</div>
                </button>
              )
            })}
          </div>
          {level && <p className="mt-2 text-[13px] text-muted">{level.blurb}</p>}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Session">
            <input className="input" value={session} maxLength={60} onChange={(e) => setSession(e.target.value)} placeholder="Spring 2026" />
          </Field>
          <Field label="Day & time">
            <input className="input" value={schedule} maxLength={80} onChange={(e) => setSchedule(e.target.value)} placeholder="Tue 5:30 PM" />
          </Field>
          <Field label="Class name" hint="Leave blank to use the level and time.">
            <input className="input" value={name} maxLength={120} onChange={(e) => setName(e.target.value)} placeholder={level?.name} />
          </Field>
          <Field label="Number of lessons" hint={`Most sessions run ${DEFAULT_LESSONS}. Change it any time.`}>
            <input
              className="input"
              type="number"
              min={1}
              max={MAX_LESSONS}
              value={lessons}
              onChange={(e) => setLessons(Number(e.target.value))}
            />
          </Field>
        </div>
      </form>
    </Modal>
  )
}
