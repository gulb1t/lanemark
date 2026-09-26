import { motion, Reorder, useDragControls } from 'motion/react'
import { Check, CheckCheck, ChevronDown, GripVertical, Info, LayoutGrid, ListChecks, Minus, Pencil, Plus, RotateCcw, Trash2, UserRound } from 'lucide-react'
import { Fragment, useMemo, useState } from 'react'
import { toast as sonner } from 'sonner'
import { burstFrom } from '../../components/fx/bubbles'
import { Avatar } from '../../components/ui/Avatar'
import { Button, IconButton } from '../../components/ui/Button'
import { EmptyState, ProgressRing, Segmented } from '../../components/ui/bits'
import { categoriesOf, getLevel } from '../../data/curriculum'
import { ELEMENT_LABEL } from '../../data/mustSees'
import { firstName, passedLevel, skillProgress } from '../../lib/stats'
import { useStore } from '../../store/useStore'
import { confirm, toast, withUndo } from '../../store/useUi'
import type { Skill, SkillStatus, Swimmer, SwimClass } from '../../types'

const CYCLE: (SkillStatus | undefined)[] = [undefined, 'pass', 'incomplete']
const nextStatus = (s: SkillStatus | undefined) => CYCLE[(CYCLE.indexOf(s) + 1) % CYCLE.length]

function mustSeeTitle(skill: Skill) {
  if (!skill.mustSees) return skill.name
  const lines = Object.entries(skill.mustSees).map(([el, text]) => `${ELEMENT_LABEL[el]}: ${text}`)
  return `${skill.name}\n\n${lines.join('\n')}`
}

/** Sets a mark and celebrates when it completes the swimmer's level. */
function useMark(cls: SwimClass, swimmers: Map<string, Swimmer>) {
  const [anchors] = useState(() => new Map<string, HTMLElement | null>())
  const mark = (swimmerId: string, skillId: string, status: SkillStatus | undefined) => {
    const before = cls.enrollments.find((e) => e.swimmerId === swimmerId)
    const wasPassed = before ? passedLevel(before, cls.skills) : false
    useStore.getState().setSkillStatus(cls.id, swimmerId, skillId, status)
    const after = useStore.getState().classes.find((c) => c.id === cls.id)?.enrollments.find((e) => e.swimmerId === swimmerId)
    try {
      navigator.vibrate?.(!wasPassed && after && passedLevel(after, cls.skills) ? [12, 50, 12, 50, 24] : 8)
    } catch {
      /* unsupported */
    }
    if (!wasPassed && after && passedLevel(after, cls.skills)) {
      burstFrom(anchors.get(swimmerId) ?? null)
      const level = getLevel(cls.levelId)
      sonner.success(`${swimmers.get(swimmerId)?.name ?? 'Swimmer'} passed every skill${level ? ` in ${level.name}` : ''}!`, {
        description: 'Their report card will use the passing template.',
      })
    }
  }
  return { mark, anchors }
}

export function SkillsTab({ cls, swimmers }: { cls: SwimClass; swimmers: Map<string, Swimmer> }) {
  const [editing, setEditing] = useState(false)
  const [view, setView] = useState<'matrix' | 'swimmer'>(() => (window.matchMedia('(max-width: 639px)').matches ? 'swimmer' : 'matrix'))

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        {editing ? (
          <p className="text-[13px] text-muted">Drag to reorder. Rename, add or remove skills. This only changes this class.</p>
        ) : (
          <Segmented
            label="Skills view"
            value={view}
            onChange={setView}
            options={[
              { value: 'matrix', label: <><LayoutGrid size={14} /> Everyone</> },
              { value: 'swimmer', label: <><UserRound size={14} /> One swimmer</> },
            ]}
          />
        )}
        <Button size="sm" variant={editing ? 'primary' : 'secondary'} icon={editing ? <Check size={14} /> : <Pencil size={14} />} onClick={() => setEditing((v) => !v)}>
          {editing ? 'Done editing' : 'Edit skills'}
        </Button>
      </div>

      {editing ? (
        <SkillEditor cls={cls} />
      ) : !cls.skills.length ? (
        <EmptyState icon={<ListChecks size={22} />} title="This class has no skills" body="Add your own, or reset to the preset for this level." action={<Button variant="primary" onClick={() => setEditing(true)}>Edit skills</Button>} />
      ) : !cls.enrollments.length ? (
        <EmptyState icon={<ListChecks size={22} />} title="Add swimmers to check off skills" body="Head to the Roster tab and add members first." />
      ) : view === 'matrix' ? (
        <SkillMatrix cls={cls} swimmers={swimmers} />
      ) : (
        <BySwimmer cls={cls} swimmers={swimmers} />
      )}
    </div>
  )
}

function Cell({ value, onClick, label }: { value: SkillStatus | undefined; onClick: () => void; label: string }) {
  return (
    <motion.button
      type="button"
      whileTap={{ scale: 0.82 }}
      onClick={onClick}
      aria-label={label}
      className={`inline-flex size-8 items-center justify-center rounded-lg border transition-colors ${
        value === 'pass' ? 'border-good/45 bg-good/15 text-good' : value === 'incomplete' ? 'border-bad/45 bg-bad/15 text-bad' : 'border-dashed border-line-2 hover:border-dim'
      }`}
    >
      {value === 'pass' && (
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <motion.path d="M4 12.5l5 5L20 6.5" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.25, ease: 'easeOut' }} />
        </svg>
      )}
      {value === 'incomplete' && (
        <motion.span initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} className="flex">
          <Minus size={15} strokeWidth={3} />
        </motion.span>
      )}
    </motion.button>
  )
}

function SkillMatrix({ cls, swimmers }: { cls: SwimClass; swimmers: Map<string, Swimmer> }) {
  const categories = useMemo(() => categoriesOf(cls.skills), [cls.skills])
  const { mark, anchors } = useMark(cls, swimmers)
  const members = cls.enrollments.filter((e) => swimmers.has(e.swimmerId))

  function passRow(skill: Skill) {
    withUndo(`Everyone passed “${skill.name}”`, () => {
      for (const e of members) if (e.skills[skill.id] !== 'pass') mark(e.swimmerId, skill.id, 'pass')
    })
  }

  return (
    <div className="card overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-line">
            <th className="sticky left-0 z-10 min-w-64 bg-panel px-4 py-3 text-left font-medium text-muted">Skill</th>
            {members.map((e) => {
              const swimmer = swimmers.get(e.swimmerId)!
              const p = skillProgress(e, cls.skills)
              const done = passedLevel(e, cls.skills)
              return (
                <th key={e.swimmerId} className="min-w-20 px-2 py-3 text-center font-normal">
                  <div className="flex flex-col items-center gap-1" ref={(el) => void anchors.set(e.swimmerId, el)}>
                    <ProgressRing value={p.ratio} size={38} stroke={2.5} color={done ? 'var(--color-good)' : 'var(--color-aqua)'}>
                      <Avatar name={swimmer.name} photo={swimmer.photo} size={30} />
                    </ProgressRing>
                    <span className="max-w-20 truncate text-xs font-medium text-fg">{firstName(swimmer.name)}</span>
                    <span className={`font-mono text-[10px] ${done ? 'text-good' : 'text-dim'}`}>
                      {p.pass}/{p.total}
                    </span>
                  </div>
                </th>
              )
            })}
            <th className="w-10" />
          </tr>
        </thead>
        <tbody>
          {categories.map((cat) => (
            <Fragment key={cat}>
              <tr className="bg-fg/[0.025]">
                <td colSpan={members.length + 2} className="sticky left-0 px-4 py-1.5">
                  <span className="eyebrow">{cat}</span>
                </td>
              </tr>
              {cls.skills
                .filter((s) => s.category === cat)
                .map((skill) => (
                  <tr key={skill.id} className="group border-b border-line/50 hover:bg-fg/[0.02]">
                    <th scope="row" className="sticky left-0 z-10 bg-panel px-4 py-2 text-left align-middle font-normal" title={mustSeeTitle(skill)}>
                      <span className="flex items-start gap-1.5 leading-snug">
                        {skill.name}
                        {skill.mustSees && <Info size={12} className="mt-1 shrink-0 text-dim" aria-label="Has must-see comments" />}
                      </span>
                    </th>
                    {members.map((e) => (
                      <td key={e.swimmerId} className="p-1 text-center">
                        <Cell
                          value={e.skills[skill.id]}
                          onClick={() => mark(e.swimmerId, skill.id, nextStatus(e.skills[skill.id]))}
                          label={`${swimmers.get(e.swimmerId)?.name}, ${skill.name}: ${e.skills[skill.id] === 'pass' ? 'passed' : e.skills[skill.id] === 'incomplete' ? 'incomplete' : 'not assessed'}`}
                        />
                      </td>
                    ))}
                    <td className="pr-2">
                      <IconButton label={`Pass “${skill.name}” for everyone`} size="sm" onClick={() => passRow(skill)} className="opacity-0 transition-opacity focus-visible:opacity-100 group-hover:opacity-100">
                        <CheckCheck size={14} />
                      </IconButton>
                    </td>
                  </tr>
                ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function BySwimmer({ cls, swimmers }: { cls: SwimClass; swimmers: Map<string, Swimmer> }) {
  const members = cls.enrollments.filter((e) => swimmers.has(e.swimmerId))
  const [selected, setSelected] = useState(members[0]?.swimmerId)
  const [openSkill, setOpenSkill] = useState<string | null>(null)
  const { mark, anchors } = useMark(cls, swimmers)
  const e = members.find((m) => m.swimmerId === selected) ?? members[0]
  const swimmer = swimmers.get(e.swimmerId)!
  const p = skillProgress(e, cls.skills)
  const done = passedLevel(e, cls.skills)

  return (
    <div className="space-y-4">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 no-scrollbar sm:mx-0 sm:px-0">
        {members.map((m) => {
          const w = swimmers.get(m.swimmerId)!
          const pr = skillProgress(m, cls.skills)
          const active = m.swimmerId === e.swimmerId
          return (
            <button
              key={m.swimmerId}
              type="button"
              aria-pressed={active}
              onClick={() => setSelected(m.swimmerId)}
              className={`flex shrink-0 flex-col items-center gap-1.5 rounded-2xl border px-3 py-2.5 transition-colors ${active ? 'border-aqua/50 bg-aqua/10' : 'border-line bg-panel hover:border-line-2'}`}
            >
              <ProgressRing value={pr.ratio} size={42} stroke={2.5} color={passedLevel(m, cls.skills) ? 'var(--color-good)' : 'var(--color-aqua)'}>
                <Avatar name={w.name} photo={w.photo} size={34} />
              </ProgressRing>
              <span className={`max-w-16 truncate text-xs font-medium ${active ? 'text-fg' : 'text-muted'}`}>{firstName(w.name)}</span>
            </button>
          )
        })}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5" ref={(el) => void anchors.set(e.swimmerId, el)}>
          <Avatar name={swimmer.name} photo={swimmer.photo} size={40} />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{swimmer.name}</div>
            <div className={`font-mono text-xs ${done ? 'text-good' : 'text-muted'}`}>{done ? 'Every skill passed' : `${p.pass} passed · ${p.incomplete} incomplete · ${p.unmarked} to assess`}</div>
          </div>
          <ProgressRing value={p.ratio} size={44} stroke={4} color={done ? 'var(--color-good)' : 'var(--color-aqua)'}>
            <span className="font-mono text-[10px] font-semibold">{Math.round(p.ratio * 100)}%</span>
          </ProgressRing>
        </div>
        {categoriesOf(cls.skills).map((cat) => (
          <div key={cat}>
            <div className="border-b border-line/60 bg-fg/[0.025] px-4 py-1.5">
              <span className="eyebrow">{cat}</span>
            </div>
            <ul className="divide-y divide-line/60">
              {cls.skills
                .filter((s) => s.category === cat)
                .map((skill) => {
                  const v = e.skills[skill.id]
                  const expanded = openSkill === skill.id
                  return (
                    <li key={skill.id} className="px-4 py-2.5">
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setOpenSkill(expanded ? null : skill.id)} className="flex min-w-0 flex-1 items-start gap-1.5 text-left text-[14px] leading-snug" disabled={!skill.mustSees}>
                          {skill.mustSees && <ChevronDown size={14} className={`mt-0.5 shrink-0 text-dim transition-transform ${expanded ? 'rotate-180' : ''}`} />}
                          <span>{skill.name}</span>
                        </button>
                        <div className="flex gap-1.5">
                          {(['pass', 'incomplete'] as const).map((s) => {
                            const on = v === s
                            return (
                              <motion.button
                                key={s}
                                type="button"
                                whileTap={{ scale: 0.88 }}
                                aria-pressed={on}
                                aria-label={`${skill.name}: ${s === 'pass' ? 'passed' : 'incomplete'}`}
                                onClick={() => mark(e.swimmerId, skill.id, on ? undefined : s)}
                                className={`flex h-10 w-12 items-center justify-center rounded-xl border transition-colors ${on ? (s === 'pass' ? 'border-good/45 bg-good/15 text-good' : 'border-bad/45 bg-bad/15 text-bad') : 'border-line-2 text-dim hover:text-muted'}`}
                              >
                                {s === 'pass' ? <Check size={17} strokeWidth={2.75} /> : <Minus size={17} strokeWidth={2.75} />}
                              </motion.button>
                            )
                          })}
                        </div>
                      </div>
                      {expanded && skill.mustSees && (
                        <motion.dl initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-2 space-y-1.5 overflow-hidden rounded-xl border border-line bg-ink/40 p-3 text-[13px]">
                          {Object.entries(skill.mustSees).map(([el, text]) => (
                            <div key={el} className="grid gap-x-3 sm:grid-cols-[6.5rem_1fr]">
                              <dt className="eyebrow pt-0.5">{ELEMENT_LABEL[el]}</dt>
                              <dd className="text-muted">{text}</dd>
                            </div>
                          ))}
                        </motion.dl>
                      )}
                    </li>
                  )
                })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  )
}

function SkillEditor({ cls }: { cls: SwimClass }) {
  const { addSkill, updateSkill, removeSkill, resetSkills, reorderSkills } = useStore.getState()
  const categories = categoriesOf(cls.skills)
  const level = getLevel(cls.levelId)
  const [name, setName] = useState('')
  const [category, setCategory] = useState(
    () => [...categories].sort((a, b) => cls.skills.filter((s) => s.category === b).length - cls.skills.filter((s) => s.category === a).length)[0] ?? 'Custom',
  )

  function remove(skill: Skill) {
    withUndo(`Removed “${skill.name}”`, () => removeSkill(cls.id, skill.id))
  }

  async function reset() {
    const ok = await confirm({
      title: `Reset to the ${level?.name ?? 'preset'} skills?`,
      body: 'Your custom skills and edits are replaced by the preset list. Marks on skills that still exist are kept.',
      confirmLabel: 'Reset skills',
      danger: true,
    })
    if (ok) {
      withUndo('Skills reset to preset', () => resetSkills(cls.id))
    }
  }

  function add() {
    if (!name.trim()) return
    addSkill(cls.id, { name, category })
    toast(`Added “${name.trim()}”`)
    setName('')
  }

  return (
    <div className="space-y-4">
      <datalist id="skill-categories">
        {categories.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {categories.map((cat) => {
        const inCat = cls.skills.filter((s) => s.category === cat)
        return (
          <section key={cat} className="card overflow-hidden">
            <div className="border-b border-line bg-fg/[0.025] px-4 py-2">
              <span className="eyebrow">{cat}</span>
            </div>
            <Reorder.Group axis="y" values={inCat} onReorder={(next) => reorderSkills(cls.id, cat, next.map((s) => s.id))} className="divide-y divide-line/60">
              {inCat.map((skill) => (
                <EditorRow key={skill.id} skill={skill} onRename={(n) => updateSkill(cls.id, skill.id, { name: n })} onRecategorise={(c) => updateSkill(cls.id, skill.id, { category: c })} onRemove={() => remove(skill)} />
              ))}
            </Reorder.Group>
          </section>
        )
      })}

      <form
        className="card flex flex-wrap items-end gap-3 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          add()
        }}
      >
        <label className="min-w-56 flex-1">
          <span className="mb-1.5 block text-[13px] font-medium text-muted">New skill</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Front crawl, 50 m" maxLength={300} />
        </label>
        <label className="w-full sm:w-52">
          <span className="mb-1.5 block text-[13px] font-medium text-muted">Category</span>
          <input className="input" list="skill-categories" value={category} onChange={(e) => setCategory(e.target.value)} maxLength={80} />
        </label>
        <Button variant="primary" type="submit" icon={<Plus size={15} />} disabled={!name.trim()}>
          Add skill
        </Button>
      </form>

      <div className="flex justify-end">
        <Button size="sm" variant="ghost" icon={<RotateCcw size={14} />} onClick={reset}>
          Reset to preset
        </Button>
      </div>
    </div>
  )
}

function EditorRow({ skill, onRename, onRecategorise, onRemove }: { skill: Skill; onRename: (n: string) => void; onRecategorise: (c: string) => void; onRemove: () => void }) {
  const controls = useDragControls()
  return (
    <Reorder.Item value={skill} dragListener={false} dragControls={controls} className="relative flex flex-wrap items-center gap-2 bg-panel px-3 py-2 sm:flex-nowrap" whileDrag={{ scale: 1.015, boxShadow: '0 12px 30px -10px rgb(0 0 0 / 0.45)', zIndex: 10 }}>
      <button
        type="button"
        aria-label="Drag to reorder"
        onPointerDown={(e) => controls.start(e)}
        className="order-1 flex size-9 cursor-grab touch-none items-center justify-center rounded-lg text-dim hover:bg-fg/[0.06] hover:text-fg active:cursor-grabbing"
      >
        <GripVertical size={16} />
      </button>
      <input className="input order-2 min-w-0 flex-1" aria-label="Skill name" value={skill.name} onChange={(e) => onRename(e.target.value)} maxLength={300} />
      <IconButton label="Remove skill" tone="danger" className="order-3 sm:order-4" onClick={onRemove}>
        <Trash2 size={15} />
      </IconButton>
      <CategoryInput value={skill.category} onCommit={onRecategorise} />
    </Reorder.Item>
  )
}

/** Commits on blur or Enter so the row doesn't jump between groups while typing. */
function CategoryInput({ value, onCommit }: { value: string; onCommit: (v: string) => void }) {
  const [draft, setDraft] = useState(value)
  const [seen, setSeen] = useState(value)
  if (seen !== value) {
    setSeen(value)
    setDraft(value)
  }
  const commit = () => {
    const next = draft.trim()
    if (next && next !== value) onCommit(next)
    else setDraft(value)
  }
  return (
    <input
      className="input order-4 basis-full sm:order-3 sm:w-44 sm:basis-auto"
      aria-label="Category"
      list="skill-categories"
      value={draft}
      maxLength={80}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), e.currentTarget.blur())}
    />
  )
}
