import { motion } from 'motion/react'
import { Check, EyeOff, ShieldCheck } from 'lucide-react'
import { Avatar } from '../../components/ui/Avatar'
import { rank, type ClassStatus } from '../../lib/overview'
import { pct } from '../../lib/stats'
import type { PoolRole } from '../../store/usePool'

const STATUS: Record<ClassStatus, { label: string; tone: string }> = {
  'on-track': { label: 'On track', tone: 'text-good bg-good/12' },
  behind: { label: 'Behind', tone: 'text-warn bg-warn/14' },
  upcoming: { label: 'Not started', tone: 'text-muted bg-fg/[0.06]' },
  finished: { label: 'Finished', tone: 'text-blue bg-blue/12' },
  empty: { label: 'No swimmers', tone: 'text-dim bg-fg/[0.05]' },
}

export function StatusPill({ status }: { status: ClassStatus }) {
  const s = STATUS[status]
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${s.tone}`}>{s.label}</span>
}

const scoreColor = (v: number | null) => (v === null ? 'var(--color-dim)' : v >= 0.9 ? 'var(--color-good)' : v >= 0.75 ? 'var(--color-aqua)' : 'var(--color-warn)')

/** Caught-up share as a bar and a number. */
export function Score({ value, className = '' }: { value: number | null; className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[0.08]" aria-hidden>
        <motion.div
          className="h-full origin-left rounded-full"
          style={{ background: scoreColor(value) }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: value ?? 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <span className="w-10 text-right font-mono text-[13px] font-semibold tabular-nums">{pct(value)}</span>
    </div>
  )
}

export function RoleChip({ role }: { role: PoolRole }) {
  return role === 'supervisor' ? (
    <span className="inline-flex items-center gap-1 rounded-full bg-aqua/12 px-2 py-0.5 text-[11px] font-semibold text-aqua">
      <ShieldCheck size={11} /> Supervisor
    </span>
  ) : null
}

/** What joining a pool shares, in plain words. Shown before joining and to every member afterwards. */
export function WhatTheySee() {
  const sees = ['Your class names and levels', 'Lessons taught and attendance rates', 'How many skills are assessed and passed', 'How many report cards are done']
  const never = ['Swimmers’ names, photos or notes', 'Anyone’s individual marks or attendance', 'Report card comments']
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
          <Check size={14} className="text-good" /> Supervisors see counts
        </h3>
        <ul className="space-y-1.5 text-[13.5px] text-muted">
          {sees.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
      <div>
        <h3 className="mb-2 flex items-center gap-2 text-[13px] font-semibold">
          <EyeOff size={14} className="text-dim" /> Never
        </h3>
        <ul className="space-y-1.5 text-[13.5px] text-muted">
          {never.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}

export function ScoringNote() {
  return (
    <>
      Scored on how caught up the records are for this point in the session: attendance taken, skills assessed as lessons go by, and report cards finished near the end.
      Swimmers are never ranked.
    </>
  )
}

const MEDAL = ['#d4a72c', '#9aa6b2', '#b87b4b']

export function RankBadge({ place }: { place: number }) {
  const medal = MEDAL[place - 1]
  return (
    <span
      className="inline-flex size-7 shrink-0 items-center justify-center rounded-full font-mono text-[12px] font-bold tabular-nums"
      style={medal ? { color: medal, background: `color-mix(in oklab, ${medal} 16%, transparent)` } : { color: 'var(--color-dim)' }}
    >
      {place}
    </span>
  )
}

export interface RankRow {
  id: string
  name: string
  you: boolean
  classes: number
  swimmers: number | null
  score: number | null
}

export function InstructorRanking({ rows }: { rows: RankRow[] }) {
  const ranked = rank(
    rows,
    (r) => r.score,
    (r) => r.name,
  )
  const unranked = rows.filter((r) => r.score === null)
  return (
    <>
      <ol className="mt-3 divide-y divide-line border-t border-line">
        {ranked.map(({ item, rank: place, score }) => (
          <li key={item.id} className={`flex items-center gap-3 px-5 py-3 sm:px-6 ${item.you ? 'bg-aqua/[0.05]' : ''}`}>
            <RankBadge place={place} />
            <Avatar name={item.name} size={32} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[14.5px] font-medium">
                {item.name}
                {item.you && <span className="ml-1.5 text-[12px] font-normal text-dim">(you)</span>}
              </span>
              <span className="block text-[12.5px] text-dim">
                {item.classes} class{item.classes === 1 ? '' : 'es'}
                {item.swimmers !== null && <span className="max-sm:hidden"> · {item.swimmers} swimmers</span>}
              </span>
            </span>
            <Score value={score} className="w-28 shrink-0 sm:w-48" />
          </li>
        ))}
      </ol>
      {unranked.length > 0 && (
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-dim sm:px-6">Not ranked yet, nothing due so far: {unranked.map((r) => r.name).join(', ')}</p>
      )}
    </>
  )
}
