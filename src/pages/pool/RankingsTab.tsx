import { Trophy } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { LevelChip, Segmented, Switch } from '../../components/ui/bits'
import { getLevel } from '../../data/curriculum'
import { api } from '../../lib/api'
import { caughtUp, rank, summarize } from '../../lib/overview'
import { setPool, type InstructorProgress, type Pool } from '../../store/usePool'
import { toast } from '../../store/useUi'
import { InstructorRanking, RankBadge, Score, ScoringNote } from './bits'
import { attempt, classLink, useDemo, useUserId } from './data'

export function RankingsTab({ pool, instructors }: { pool: Pool; instructors: InstructorProgress[] }) {
  const [view, setView] = useState<'instructors' | 'classes'>('instructors')
  const demo = useDemo()
  const userId = useUserId()
  const [saving, setSaving] = useState(false)

  async function share(on: boolean) {
    if (demo) return setPool({ ...pool, shareLeaderboard: on })
    setSaving(true)
    const res = await attempt(() => api<{ pool: Pool }>('/pool', 'PATCH', { shareLeaderboard: on }))
    setSaving(false)
    if (res) {
      setPool(res.pool, userId)
      toast(on ? 'Instructors can see the leaderboard' : 'Leaderboard hidden from instructors')
    }
  }

  const classes = rank(
    instructors.flatMap((i) => i.classes.map((cls) => ({ cls, who: i }))),
    (r) => caughtUp(r.cls),
    (r) => r.cls.name,
  )

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden">
        <div className="flex flex-wrap items-start justify-between gap-4 px-5 pt-5 sm:px-6">
          <div className="max-w-xl">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold">
              <Trophy size={16} className="text-aqua" /> Rankings
            </h2>
            <p className="mt-1 text-[13.5px] text-muted">
              <ScoringNote />
            </p>
          </div>
          <Segmented
            size="sm"
            label="Rank"
            value={view}
            onChange={setView}
            options={[
              { value: 'instructors', label: 'Instructors' },
              { value: 'classes', label: 'Classes' },
            ]}
          />
        </div>
        {view === 'instructors' ? (
          <InstructorRanking
            rows={instructors.map((i) => {
              const s = summarize(i.classes)
              return { id: i.id, name: i.name, you: i.you, classes: s.classes, swimmers: s.swimmers, score: s.caughtUp }
            })}
          />
        ) : (
          <ol className="mt-3 divide-y divide-line border-t border-line">
            {classes.map(({ item: { cls, who }, rank: place, score }) => (
              <li key={`${who.id}:${cls.id}`}>
                <Link to={classLink(who.id, who.you, cls.id)} className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-fg/[0.025] sm:px-6">
                  <RankBadge place={place} />
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <LevelChip level={getLevel(cls.levelId)} />
                      <span className="truncate text-[14px] font-medium">{cls.name}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-[12.5px] text-dim">
                      {who.name} · Lesson {Math.max(cls.past, cls.taught)} of {cls.lessons}
                    </span>
                  </span>
                  <Score value={score} className="w-28 shrink-0 sm:w-48" />
                </Link>
              </li>
            ))}
          </ol>
        )}
      </section>

      <section className="card flex items-center gap-4 p-5 sm:px-6">
        <div className="min-w-0 flex-1">
          <h2 className="text-[15px] font-semibold">Show the leaderboard to instructors</h2>
          <p className="mt-0.5 text-[13.5px] text-muted">They’d see everyone’s name and caught-up score, nothing about anyone’s classes. Off by default.</p>
        </div>
        <Switch checked={pool.shareLeaderboard} onChange={share} label="Show the leaderboard to instructors" disabled={saving} />
      </section>
    </div>
  )
}
