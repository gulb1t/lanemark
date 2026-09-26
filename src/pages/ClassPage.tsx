import { motion } from 'motion/react'
import { Archive, CalendarCheck, ChevronLeft, ClipboardList, FileText, ListChecks, Settings, Users } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { LevelChip } from '../components/ui/bits'
import { PROGRAMS, getLevel } from '../data/curriculum'
import { useStore } from '../store/useStore'
import type { Swimmer } from '../types'
import { AttendanceTab } from './class/AttendanceTab'
import { LessonsTab } from './class/LessonsTab'
import { ReportsTab } from './class/ReportsTab'
import { RosterTab } from './class/RosterTab'
import { SettingsTab } from './class/SettingsTab'
import { SkillsTab } from './class/SkillsTab'
import NotFound from './NotFound'

const TABS = [
  { id: 'roster', label: 'Roster', icon: Users },
  { id: 'attendance', label: 'Attendance', icon: CalendarCheck },
  { id: 'skills', label: 'Skills', icon: ListChecks },
  { id: 'lessons', label: 'Lessons', icon: ClipboardList },
  { id: 'reports', label: 'Report cards', icon: FileText },
  { id: 'settings', label: 'Settings', icon: Settings },
] as const

type TabId = (typeof TABS)[number]['id']

export default function ClassPage() {
  const { classId } = useParams()
  const cls = useStore((s) => s.classes.find((c) => c.id === classId))
  const swimmers = useStore((s) => s.swimmers)
  const [params, setParams] = useSearchParams()
  const swimmerMap = useMemo(() => new Map<string, Swimmer>(swimmers.map((w) => [w.id, w])), [swimmers])

  if (!cls) return <NotFound what="class" />

  const requested = params.get('tab')
  const tab: TabId = TABS.some((t) => t.id === requested) ? (requested as TabId) : 'roster'
  const level = getLevel(cls.levelId)
  const hue = level ? PROGRAMS[level.program].hue : '#8b94a1'

  return (
    <div className="space-y-7">
      <div className="no-print relative">
        <Link to="/app" className="relative mb-5 inline-flex items-center gap-1 text-[13px] text-muted transition-colors hover:text-fg">
          <ChevronLeft size={15} /> All classes
        </Link>
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <LevelChip level={level} />
              {cls.session && <span className="font-mono text-xs text-dim">{cls.session}</span>}
              {cls.archived && (
                <span className="inline-flex items-center gap-1 rounded-md border border-line-2 px-1.5 py-0.5 text-[11px] text-muted">
                  <Archive size={11} /> Archived
                </span>
              )}
            </div>
            <h1 className="page-title max-sm:!text-[1.7rem]">{cls.name}</h1>
            {cls.schedule && <p className="mt-1.5 text-sm text-muted">{cls.schedule}</p>}
          </div>
          <dl className="flex gap-6 font-mono text-sm tabular-nums text-muted">
            {[
              [cls.enrollments.length, 'swimmers'],
              [cls.lessons.length, 'lessons'],
              [cls.skills.length, 'skills'],
            ].map(([n, label]) => (
              <div key={label} className="flex items-baseline gap-1.5">
                <dd className="text-xl font-semibold text-fg">{n}</dd>
                <dt>{label}</dt>
              </div>
            ))}
          </dl>
        </div>
      </div>

      <div className="no-print sticky top-[4.5rem] z-20 -mx-4 bg-ink/70 px-4 backdrop-blur-xl sm:top-[5.25rem] sm:mx-0 sm:rounded-2xl sm:border sm:border-line sm:bg-panel/70 sm:px-1.5">
        <div role="tablist" aria-label="Class sections" className="flex gap-0.5 overflow-x-auto py-1.5 no-scrollbar">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = id === tab
            return (
              <button
                key={id}
                role="tab"
                aria-selected={active}
                onClick={() => setParams(id === 'roster' ? {} : { tab: id }, { replace: true })}
                className={`relative flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-[13.5px] font-medium transition-colors ${active ? 'text-fg' : 'text-muted hover:text-fg'}`}
              >
                {active && (
                  <motion.span
                    layoutId="class-tab"
                    className="absolute inset-0 rounded-xl"
                    style={{ background: `color-mix(in oklab, ${hue} 14%, transparent)`, boxShadow: `inset 0 0 0 1px color-mix(in oklab, ${hue} 35%, transparent)` }}
                    transition={{ type: 'spring', stiffness: 480, damping: 38 }}
                  />
                )}
                <Icon size={15} className="relative" style={active ? { color: hue } : undefined} />
                <span className="relative">{label}</span>
              </button>
            )
          })}
        </div>
      </div>

      <motion.div key={tab} role="tabpanel" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
        {tab === 'roster' && <RosterTab cls={cls} swimmers={swimmerMap} />}
        {tab === 'attendance' && <AttendanceTab cls={cls} swimmers={swimmerMap} />}
        {tab === 'skills' && <SkillsTab cls={cls} swimmers={swimmerMap} />}
        {tab === 'lessons' && <LessonsTab cls={cls} />}
        {tab === 'reports' && <ReportsTab cls={cls} swimmers={swimmerMap} />}
        {tab === 'settings' && <SettingsTab cls={cls} />}
      </motion.div>
    </div>
  )
}
