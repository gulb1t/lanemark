import { motion } from 'motion/react'
import { CalendarRange, ChevronDown, ChevronRight, Minus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton } from '../../components/ui/Button'
import { Modal } from '../../components/ui/Modal'
import { PickerSheet, Select } from '../../components/ui/Picker'
import { Field } from '../../components/ui/bits'
import { Popover } from '../../components/ui/Popover'
import { addDays, formatDate, isoDate } from '../../lib/dates'
import { usePhoneLayout } from '../../lib/hooks'
import { lessonHeadcount } from '../../lib/stats'
import { MAX_LESSONS, useStore } from '../../store/useStore'
import { confirm, withUndo } from '../../store/useUi'
import type { Lesson, SwimClass } from '../../types'

export function LessonsTab({ cls }: { cls: SwimClass }) {
  const addLesson = useStore((s) => s.addLesson)
  const removeLesson = useStore((s) => s.removeLesson)
  const updateLesson = useStore((s) => s.updateLesson)
  const setLessonCount = useStore((s) => s.setLessonCount)
  const today = isoDate()
  const phone = usePhoneLayout()
  const [editing, setEditing] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  /** What deleting a lesson would lose, in words, or null when it's empty. */
  function loses(l: Lesson) {
    const marks = lessonHeadcount(cls, l.id).marked
    const parts = [l.topic.trim() && 'its topic', l.notes.trim() && 'notes', marks && `attendance for ${marks} swimmer${marks === 1 ? '' : 's'}`].filter(Boolean)
    return parts.length ? parts.join(', ').replace(/, ([^,]*)$/, ' and $1') : null
  }

  async function remove(lesson: Lesson, n: number) {
    const lost = loses(lesson)
    const ok = await confirm({
      title: `Delete lesson ${n}?`,
      body: lost ? `This also deletes ${lost}. Later lessons move up one.` : 'Later lessons move up one.',
      confirmLabel: 'Delete lesson',
      danger: true,
    })
    if (ok) withUndo(`Lesson ${n} deleted`, () => removeLesson(cls.id, lesson.id))
  }

  async function removeLast() {
    const last = cls.lessons[cls.lessons.length - 1]
    const lost = last && loses(last)
    // An empty lesson at the end goes straight away; one with anything in it asks first.
    if (lost && !(await confirm({ title: `Remove lesson ${cls.lessons.length}?`, body: `This also deletes ${lost}.`, confirmLabel: 'Remove lesson', danger: true }))) return
    withUndo(`Lesson ${cls.lessons.length} removed`, () => setLessonCount(cls.id, cls.lessons.length - 1))
  }

  async function fillDates(start: string, everyDays: number) {
    const dated = cls.lessons.filter((l) => l.date).length
    if (dated && !(await confirm({ title: 'Replace the lesson dates?', body: `${dated} lesson${dated === 1 ? ' already has a date' : 's already have dates'}. They’ll all be set from ${formatDate(start)}.`, confirmLabel: 'Replace dates' }))) return
    withUndo('Lesson dates filled in', () => {
      cls.lessons.forEach((l, i) => updateLesson(cls.id, l.id, { date: addDays(start, i * everyDays) }))
    })
  }

  const stepper = (
    <div className="flex items-center rounded-xl border border-line-2 bg-panel">
      <IconButton label="Remove last lesson" onClick={removeLast} disabled={cls.lessons.length <= 1}>
        <Minus size={15} />
      </IconButton>
      <span className="w-9 text-center text-sm font-medium tabular-nums" aria-live="polite">
        {cls.lessons.length}
      </span>
      <IconButton label="Add a lesson" onClick={() => addLesson(cls.id)} disabled={cls.lessons.length >= MAX_LESSONS}>
        <Plus size={15} />
      </IconButton>
    </div>
  )

  // Phones: one line per lesson; tapping one opens it in a sheet instead of three fields per lesson on the page.
  if (phone) {
    const open = cls.lessons.find((l) => l.id === editing)
    const n = open ? cls.lessons.indexOf(open) + 1 : 0
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <DateFiller onFill={fillDates} firstDate={cls.lessons[0]?.date} />
          {stepper}
        </div>
        <ol className="card divide-y divide-line overflow-hidden">
          {cls.lessons.map((l, i) => {
            const h = lessonHeadcount(cls, l.id)
            const isToday = l.date === today
            return (
              <li key={l.id}>
                <button type="button" onClick={() => setEditing(l.id)} className={`flex w-full items-center gap-3 px-4 py-3 text-left transition-colors active:bg-fg/[0.05] ${isToday ? 'bg-aqua/[0.06]' : ''}`}>
                  <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl border text-[14px] font-semibold tabular-nums ${isToday ? 'border-aqua/50 bg-aqua/15 text-aqua' : 'border-line-2 bg-panel-2 text-muted'}`}>{i + 1}</span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 text-[13px] text-muted">
                      {l.date ? formatDate(l.date, { weekday: 'short', month: 'short', day: 'numeric' }) : 'No date'}
                      {isToday && <span className="rounded-full bg-aqua/20 px-1.5 text-[11px] font-semibold text-aqua">Today</span>}
                    </span>
                    <span className={`block truncate text-[15px] ${l.topic ? 'font-medium' : 'text-dim'}`}>{l.topic || 'No topic yet'}</span>
                  </span>
                  {h.marked > 0 && <span className="shrink-0 text-[12.5px] tabular-nums text-dim">{h.present + h.late}/{h.marked} in</span>}
                  <ChevronRight size={17} className="shrink-0 text-dim" />
                </button>
              </li>
            )
          })}
        </ol>
        {cls.lessons.length < MAX_LESSONS && (
          <Button variant="ghost" icon={<Plus size={15} />} onClick={() => addLesson(cls.id)}>
            Add lesson
          </Button>
        )}
        <Modal
          open={Boolean(open)}
          onClose={() => setEditing(null)}
          title={`Lesson ${n}`}
          footer={
            open && (
              <>
                <Button variant="ghost" className="mr-auto !text-bad" icon={<Trash2 size={15} />} disabled={cls.lessons.length <= 1} onClick={() => { const l = open; setEditing(null); void remove(l, n) }}>
                  Delete
                </Button>
                <Button variant="primary" onClick={() => setEditing(null)}>
                  Done
                </Button>
              </>
            )
          }
        >
          {open && (
            <div className="space-y-4">
              <Field label="Date">
                <input type="date" className="input" value={open.date} onChange={(e) => updateLesson(cls.id, open.id, { date: e.target.value })} />
              </Field>
              <Field label="Topic">
                <button type="button" onClick={() => setPicking(true)} className="input flex items-center gap-2 text-left">
                  <span className={`min-w-0 flex-1 truncate ${open.topic ? '' : 'text-dim'}`}>{open.topic || 'Choose a skill or type your own'}</span>
                  <ChevronDown size={16} className="shrink-0 text-dim" />
                </button>
              </Field>
              <Field label="Notes">
                <textarea className="input min-h-24 resize-y" placeholder="Equipment, games, reminders…" value={open.notes} maxLength={2000} onChange={(e) => updateLesson(cls.id, open.id, { notes: e.target.value })} />
              </Field>
            </div>
          )}
        </Modal>
        {open && (
          <PickerSheet
            open={picking}
            onClose={() => setPicking(false)}
            title="Lesson topic"
            custom="Search skills or type a topic"
            value={open.topic}
            options={cls.skills.map((sk) => ({ value: sk.name, label: sk.name, group: sk.category }))}
            onPick={(v) => updateLesson(cls.id, open.id, { topic: v })}
          />
        )}
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <datalist id="lesson-topic-suggestions">
        {cls.skills.map((s) => (
          <option key={s.id} value={s.name} />
        ))}
      </datalist>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13px] text-muted">Plan each lesson. Topic suggestions come from this class’s skills.</p>
        <div className="flex items-center gap-2">
          <DateFiller onFill={fillDates} firstDate={cls.lessons[0]?.date} />
          {stepper}
        </div>
      </div>

      <ol className="relative space-y-2.5">
        <span aria-hidden className="absolute bottom-6 left-[1.6rem] top-6 hidden w-px bg-gradient-to-b from-aqua/40 via-line to-transparent sm:block" />
        {cls.lessons.map((l, i) => {
          const h = lessonHeadcount(cls, l.id)
          const isToday = l.date === today
          const past = l.date && l.date < today
          return (
            <motion.li
              key={l.id}
              layout
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i, 12) * 0.025 }}
              // Phones: number, date and actions on one row, then topic and notes at full width.
              className={`card grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 p-3 sm:flex sm:items-start sm:gap-3 ${isToday ? 'border-aqua/40 shadow-[var(--glow)]' : ''}`}
            >
              <div
                className={`relative z-10 flex size-10 shrink-0 flex-col items-center justify-center rounded-xl border font-mono text-sm ${isToday ? 'border-aqua/50 bg-aqua/15 text-aqua' : past ? 'border-line-2 bg-panel-2 text-dim' : 'border-line-2 bg-panel-2 text-muted'}`}
              >
                {i + 1}
              </div>
              <div className="contents min-w-0 flex-1 gap-2 sm:grid sm:grid-cols-[10rem_1fr]">
                <div className="relative">
                  <input type="date" className="input" aria-label={`Lesson ${i + 1} date`} value={l.date} onChange={(e) => updateLesson(cls.id, l.id, { date: e.target.value })} />
                  {isToday && <span className="absolute -top-2 right-2 rounded bg-aqua px-1.5 font-mono text-[9px] font-bold leading-4 text-aqua-fg">TODAY</span>}
                </div>
                <input
                  className="input max-sm:col-span-3"
                  aria-label={`Lesson ${i + 1} topic`}
                  list="lesson-topic-suggestions"
                  placeholder="Topic, e.g. Front crawl breathing"
                  value={l.topic}
                  maxLength={200}
                  onChange={(e) => updateLesson(cls.id, l.id, { topic: e.target.value })}
                />
                <textarea
                  className="input min-h-10 resize-y max-sm:col-span-3 sm:col-span-2"
                  aria-label={`Lesson ${i + 1} notes`}
                  rows={1}
                  placeholder="Notes, equipment, games…"
                  value={l.notes}
                  maxLength={2000}
                  onChange={(e) => updateLesson(cls.id, l.id, { notes: e.target.value })}
                />
              </div>
              <div className="col-start-3 row-start-1 flex items-center gap-1 sm:flex-col sm:items-end sm:gap-1">
                <span className="font-mono text-xs tabular-nums text-dim" title="Present or late / marked">
                  {h.marked ? `${h.present + h.late}/${h.marked} in` : l.date ? formatDate(l.date, { weekday: 'short' }) : '—'}
                </span>
                <IconButton label={`Delete lesson ${i + 1}`} tone="danger" disabled={cls.lessons.length <= 1} onClick={() => remove(l, i + 1)}>
                  <Trash2 size={15} />
                </IconButton>
              </div>
            </motion.li>
          )
        })}
      </ol>

      {cls.lessons.length < MAX_LESSONS && (
        <Button variant="ghost" icon={<Plus size={15} />} onClick={() => addLesson(cls.id)}>
          Add lesson
        </Button>
      )}
    </div>
  )
}

function DateFiller({ onFill, firstDate }: { onFill: (start: string, every: number) => void; firstDate?: string }) {
  const [start, setStart] = useState(firstDate || isoDate())
  const [every, setEvery] = useState(7)
  const phone = usePhoneLayout()
  const [open, setOpen] = useState(false)
  const form = (close: () => void) => (
    <form
      className={phone ? 'space-y-4' : 'w-64 space-y-3 p-2'}
      onSubmit={(e) => {
        e.preventDefault()
        onFill(start, every)
        close()
      }}
    >
      {!phone && <div className="text-sm font-semibold">Schedule every lesson</div>}
      <Field label="First lesson">
        <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} required />
      </Field>
      <Field label="Repeat">
        <Select
          label="Repeat"
          value={String(every)}
          onChange={(v) => setEvery(Number(v))}
          options={[
            { value: '7', label: 'Weekly' },
            { value: '1', label: 'Daily (camps, intensives)' },
            { value: '2', label: 'Every 2 days' },
            { value: '3', label: 'Every 3 days' },
            { value: '14', label: 'Every 2 weeks' },
          ]}
        />
      </Field>
      <Button type="submit" variant="primary" size={phone ? 'md' : 'sm'} className="w-full">
        Fill dates
      </Button>
    </form>
  )
  const trigger = (toggle: () => void) => (
    <Button size="sm" icon={<CalendarRange size={14} />} onClick={toggle}>
      Fill dates
    </Button>
  )
  // A popover is too narrow for a phone, so there it's a sheet.
  if (phone)
    return (
      <>
        {trigger(() => setOpen(true))}
        <Modal open={open} onClose={() => setOpen(false)} title="Schedule every lesson" description="Sets every lesson’s date from the first one.">
          {form(() => setOpen(false))}
        </Modal>
      </>
    )
  return (
    <Popover label="Fill lesson dates" trigger={({ toggle }) => trigger(toggle)}>
      {(close) => form(close)}
    </Popover>
  )
}
