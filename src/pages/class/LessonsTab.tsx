import { motion } from 'motion/react'
import { CalendarRange, Minus, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Button, IconButton } from '../../components/ui/Button'
import { Popover } from '../../components/ui/Popover'
import { addDays, formatDate, isoDate } from '../../lib/dates'
import { lessonHeadcount } from '../../lib/stats'
import { MAX_LESSONS, useStore } from '../../store/useStore'
import { withUndo } from '../../store/useUi'
import type { SwimClass } from '../../types'

export function LessonsTab({ cls }: { cls: SwimClass }) {
  const addLesson = useStore((s) => s.addLesson)
  const removeLesson = useStore((s) => s.removeLesson)
  const updateLesson = useStore((s) => s.updateLesson)
  const setLessonCount = useStore((s) => s.setLessonCount)
  const today = isoDate()

  function remove(lessonId: string, n: number) {
    withUndo(`Lesson ${n} deleted`, () => removeLesson(cls.id, lessonId))
  }

  function fillDates(start: string, everyDays: number) {
    withUndo('Lesson dates filled in', () => {
      cls.lessons.forEach((l, i) => updateLesson(cls.id, l.id, { date: addDays(start, i * everyDays) }))
    })
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
          <div className="flex items-center rounded-xl border border-line-2 bg-panel">
            <IconButton
              label="Remove last lesson"
              onClick={() => withUndo(`Lesson ${cls.lessons.length} removed`, () => setLessonCount(cls.id, cls.lessons.length - 1))}
              disabled={cls.lessons.length <= 1}
            >
              <Minus size={15} />
            </IconButton>
            <span className="w-9 text-center font-mono text-sm tabular-nums" aria-live="polite">
              {cls.lessons.length}
            </span>
            <IconButton label="Add a lesson" onClick={() => addLesson(cls.id)} disabled={cls.lessons.length >= MAX_LESSONS}>
              <Plus size={15} />
            </IconButton>
          </div>
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
                <IconButton label={`Delete lesson ${i + 1}`} tone="danger" disabled={cls.lessons.length <= 1} onClick={() => remove(l.id, i + 1)}>
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
  return (
    <Popover
      label="Fill lesson dates"
      trigger={({ toggle }) => (
        <Button size="sm" icon={<CalendarRange size={14} />} onClick={toggle}>
          Fill dates
        </Button>
      )}
    >
      {(close) => (
        <form
          className="w-64 space-y-3 p-2"
          onSubmit={(e) => {
            e.preventDefault()
            onFill(start, every)
            close()
          }}
        >
          <div className="text-sm font-semibold">Schedule every lesson</div>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">First lesson</span>
            <input type="date" className="input" value={start} onChange={(e) => setStart(e.target.value)} required />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-muted">Repeat</span>
            <select className="input" value={every} onChange={(e) => setEvery(Number(e.target.value))}>
              <option value={7}>Weekly</option>
              <option value={1}>Daily (camps, intensives)</option>
              <option value={2}>Every 2 days</option>
              <option value={3}>Every 3 days</option>
              <option value={14}>Every 2 weeks</option>
            </select>
          </label>
          <Button type="submit" variant="primary" size="sm" className="w-full">
            Fill dates
          </Button>
        </form>
      )}
    </Popover>
  )
}
