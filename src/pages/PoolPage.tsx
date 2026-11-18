import { Building2, Check, Link2, LogOut, RefreshCw, Trophy, Users } from 'lucide-react'
import { useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tour, type TourStep } from '../components/Tour'
import { Avatar } from '../components/ui/Avatar'
import { Button } from '../components/ui/Button'
import { Select } from '../components/ui/Picker'
import { Field, Segmented, Spinner } from '../components/ui/bits'
import { api } from '../lib/api'
import { timeAgo, useNow } from '../lib/hooks'
import { formatCode, setPool, usePool, type Pool } from '../store/usePool'
import { confirm, toast } from '../store/useUi'
import { InstructorRanking, ScoringNote, WhatTheySee } from './pool/bits'
import { attempt, useOverview, useUserId } from './pool/data'
import { OverviewTab } from './pool/OverviewTab'
import { RankingsTab } from './pool/RankingsTab'
import { TeamTab } from './pool/TeamTab'
import { shareOrCopy } from '../lib/files'
import { IS_APP, SITE_URL } from '../native/platform'

type Tab = 'overview' | 'rankings' | 'team'

const POOL_TOUR: TourStep[] = [
  { target: '[data-tour=pool-totals]', title: 'Your pool at a glance', body: 'How caught up every class is, the attendance rate, skills checked and report cards done.' },
  {
    target: '[data-tour=pool-attention]',
    title: 'Classes that need a hand',
    body: 'Anything that’s behind, and why. Tap a class to see it in full (you can look, not edit).',
  },
  {
    target: '[data-tour=pool-tabs]',
    title: 'Rankings and your team',
    body: 'Rankings shows which classes and instructors are most caught up. Team is where you manage people.',
  },
  { target: '[data-tour=pool-invite]', title: 'Invite your instructors', body: 'Tap to copy the invite link and send it to your staff. They join in one step.' },
]

export default function PoolPage() {
  const pool = usePool((s) => s.pool)
  const ready = usePool((s) => s.status === 'ready')
  if (!ready)
    return (
      <div className="flex items-center gap-2 py-20 text-sm text-muted">
        <Spinner size={14} /> Loading your pool…
      </div>
    )
  if (!pool) return <NoPool />
  return pool.role === 'supervisor' ? <SupervisorView pool={pool} /> : <InstructorView pool={pool} />
}

function PageHeader({ pool, sub, actions }: { pool: Pool; sub: ReactNode; actions?: ReactNode }) {
  return (
    <section className="flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        <div className="eyebrow mb-2 max-md:hidden">Pool</div>
        <h1 className="page-title break-words">{pool.name}</h1>
        <p className="mt-2 text-[15px] text-muted">{sub}</p>
      </div>
      {actions}
    </section>
  )
}

// Not in a pool

function NoPool() {
  const userId = useUserId()
  const [params, setParams] = useSearchParams()
  const invited = params.get('code') ?? ''
  const [code, setCode] = useState(invited.length === 8 ? formatCode(invited.toUpperCase()) : invited)
  const [name, setName] = useState('')
  const [busy, setBusy] = useState<'join' | 'start' | null>(null)

  async function join(e: FormEvent) {
    e.preventDefault()
    setBusy('join')
    const res = await attempt(() => api<{ pool: Pool }>('/pool/join', 'POST', { code }))
    setBusy(null)
    if (!res) return
    setPool(res.pool, userId)
    setParams({}, { replace: true })
    toast(`You joined ${res.pool.name}`)
  }

  async function start(e: FormEvent) {
    e.preventDefault()
    setBusy('start')
    const res = await attempt(() => api<{ pool: Pool }>('/pool', 'POST', { name }))
    setBusy(null)
    if (!res) return
    setPool(res.pool, userId)
    toast(`${res.pool.name} is set up. Invite your instructors from Team.`)
  }

  const shares = (
    <section className="card p-5 sm:p-6">
      <h2 className="mb-4 text-[16px] font-semibold">What a pool shares</h2>
      <WhatTheySee />
    </section>
  )

  return (
    <div className="space-y-8">
      <section>
        <div className="eyebrow mb-2 max-md:hidden">Pool</div>
        <h1 className="page-title">{invited ? 'You’re invited to a pool' : 'Work as a team'}</h1>
        <p className="mt-2 max-w-2xl text-[15px] text-muted">
          In a pool, supervisors can see every class (attendance, skills and report cards) without anyone sending a spreadsheet. They can look, print and export, but only
          you can change your classes.
        </p>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <form onSubmit={join} className={`card flex flex-col p-5 sm:p-6 ${invited ? 'border-aqua/40' : ''}`}>
          <span className="icon-tile size-10 !rounded-xl">
            <Users size={18} />
          </span>
          <h2 className="mt-4 text-[16px] font-semibold">Join with a code</h2>
          <p className="mt-1 text-[13.5px] text-muted">For instructors. Your supervisor has the code.</p>
          <div className="mt-4 flex-1">
            <Field label="Invite code">
              <input
                className="input font-mono uppercase tracking-[0.12em]"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="ABCD-2345"
                autoCapitalize="characters"
                autoComplete="off"
                spellCheck={false}
                maxLength={20}
                required
              />
            </Field>
          </div>
          <Button type="submit" variant="primary" className="mt-4 self-start" loading={busy === 'join'} disabled={code.replace(/[^a-z0-9]/gi, '').length < 8}>
            Join pool
          </Button>
        </form>

        {/* Someone arriving from an invite sees what joining shares right next to the button. */}
        {invited ? (
          shares
        ) : (
          <form onSubmit={start} className="card flex flex-col p-5 sm:p-6">
            <span className="icon-tile size-10 !rounded-xl">
              <Building2 size={18} />
            </span>
            <h2 className="mt-4 text-[16px] font-semibold">Start a pool</h2>
            <p className="mt-1 text-[13.5px] text-muted">For supervisors and head instructors. You’ll get a code to share with your staff.</p>
            <div className="mt-4 flex-1">
              <Field label="Pool or facility name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Maple Community Centre" maxLength={80} required />
              </Field>
            </div>
            <Button type="submit" className="mt-4 self-start" loading={busy === 'start'} disabled={name.trim().length < 2}>
              Start pool
            </Button>
          </form>
        )}
      </div>

      {!invited && shares}
    </div>
  )
}

// Instructor

function InstructorView({ pool }: { pool: Pool }) {
  const userId = useUserId()
  const { data, error } = useOverview(pool)
  const supervisors = pool.members.filter((m) => m.role === 'supervisor')

  async function leave() {
    const ok = await confirm({
      title: `Leave ${pool.name}?`,
      body: 'Supervisors stop seeing your classes straight away. Your classes and swimmers stay exactly as they are.',
      confirmLabel: 'Leave pool',
      danger: true,
    })
    if (!ok) return
    if (await attempt(() => api('/pool/leave', 'POST'))) {
      setPool(null, userId)
      toast(`You left ${pool.name}`)
    }
  }

  const board = data && 'leaderboard' in data ? data.leaderboard : null
  return (
    <div className="space-y-8">
      <PageHeader pool={pool} sub={`You’re an instructor here · ${pool.memberCount} ${pool.memberCount === 1 ? 'person' : 'people'}`} />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold">What your supervisors see</h2>
          <p className="mt-1 text-[13.5px] text-muted">They see your classes as of your last sync, and can print or export them.</p>
          <div className="mt-5">
            <WhatTheySee />
          </div>
        </section>
        <section className="card p-5 sm:p-6">
          <h2 className="text-[16px] font-semibold">Supervisors</h2>
          <ul className="mt-4 space-y-3">
            {supervisors.map((m) => (
              <li key={m.id} className="flex items-center gap-3">
                <Avatar name={m.name} size={34} />
                <span className="text-[14.5px] font-medium">{m.name}</span>
              </li>
            ))}
          </ul>
          <Button variant="ghost" size="sm" icon={<LogOut size={14} />} className="mt-6 -ml-3" onClick={leave}>
            Leave pool
          </Button>
        </section>
      </div>

      {pool.shareLeaderboard && (
        <section className="card overflow-hidden">
          <div className="px-5 pt-5 sm:px-6">
            <h2 className="flex items-center gap-2 text-[16px] font-semibold">
              <Trophy size={16} className="text-aqua" /> Leaderboard
            </h2>
            <p className="mt-1 text-[13.5px] text-muted">
              <ScoringNote />
            </p>
          </div>
          {error && <p className="px-5 pt-4 text-sm text-bad sm:px-6">{error}</p>}
          {!board && !error && (
            <div className="flex items-center gap-2 px-5 py-6 text-sm text-muted sm:px-6">
              <Spinner size={14} /> Loading…
            </div>
          )}
          {board && <InstructorRanking rows={board.map((r) => ({ id: r.id, name: r.name, you: r.you, classes: r.classes, swimmers: null, score: r.caughtUp }))} />}
        </section>
      )}
    </div>
  )
}

// Supervisor

function SupervisorView({ pool }: { pool: Pool }) {
  const [params, setParams] = useSearchParams()
  const tab = (['overview', 'rankings', 'team'] as const).find((t) => t === params.get('tab')) ?? 'overview'
  const setTab = (t: Tab) => setParams(t === 'overview' ? {} : { tab: t }, { replace: true })
  const overview = useOverview(pool)
  const now = useNow()
  const [session, setSession] = useState('all')

  const instructors = useMemo(() => {
    const list = overview.data && 'instructors' in overview.data ? overview.data.instructors : []
    return session === 'all' ? list : list.map((i) => ({ ...i, classes: i.classes.filter((c) => c.session === session) }))
  }, [overview.data, session])
  const sessions = useMemo(() => {
    const list = overview.data && 'instructors' in overview.data ? overview.data.instructors : []
    return [...new Set(list.flatMap((i) => i.classes.map((c) => c.session)).filter(Boolean))].sort()
  }, [overview.data])
  const classCount = instructors.reduce((n, i) => n + i.classes.length, 0)

  return (
    <div className="space-y-8">
      <PageHeader
        pool={pool}
        sub={`${pool.memberCount} ${pool.memberCount === 1 ? 'person' : 'people'} · ${classCount} active class${classCount === 1 ? '' : 'es'}`}
        actions={<InviteButton pool={pool} />}
      />

      <Tour id="pool" steps={POOL_TOUR} when={tab === 'overview' && Boolean(overview.data)} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div data-tour="pool-tabs">
          <Segmented
            label="Section"
            value={tab}
            onChange={setTab}
            options={[
              { value: 'overview', label: 'Overview' },
              { value: 'rankings', label: 'Rankings' },
              { value: 'team', label: <>Team · {pool.memberCount}</> },
            ]}
          />
        </div>
        {tab !== 'team' && (
          <div className="flex items-center gap-2 text-[12.5px] text-dim">
            {sessions.length > 1 && (
              <Select
                className="h-8 w-auto py-0 pr-8 text-[13px]"
                label="Session"
                value={session}
                onChange={setSession}
                options={[{ value: 'all', label: 'All sessions' }, ...sessions.map((s) => ({ value: s, label: s }))]}
              />
            )}
            {overview.at && <span className="max-sm:hidden">Updated {timeAgo(overview.at, now)}</span>}
            <button
              type="button"
              onClick={overview.reload}
              aria-label="Refresh"
              className="inline-flex size-8 items-center justify-center rounded-full text-dim transition-colors hover:bg-fg/[0.06] hover:text-fg"
            >
              <RefreshCw size={14} className={overview.busy ? 'animate-spin' : ''} />
            </button>
          </div>
        )}
      </div>

      {tab !== 'team' && overview.error && <p className="text-sm text-bad">{overview.error}</p>}
      {tab !== 'team' && !overview.data && !overview.error && (
        <div className="flex items-center gap-2 py-10 text-sm text-muted">
          <Spinner size={14} /> Adding up every class…
        </div>
      )}
      {overview.data && tab === 'overview' && <OverviewTab instructors={instructors} onRankings={() => setTab('rankings')} />}
      {overview.data && tab === 'rankings' && <RankingsTab pool={pool} instructors={instructors} />}
      {tab === 'team' && <TeamTab pool={pool} />}
    </div>
  )
}

function InviteButton({ pool }: { pool: Pool }) {
  const [copied, setCopied] = useState(false)
  if (!pool.inviteCode) return null
  const link = `${SITE_URL}/app/pool?code=${pool.inviteCode}`
  async function copy() {
    const res = await shareOrCopy(IS_APP ? `Join ${pool.name} on Lanemark: ${link}` : link, 'Send the invite')
    if (res === 'copied') {
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } else if (res === 'failed' && !IS_APP) toast(`Invite code: ${formatCode(pool.inviteCode!)}`)
  }
  return (
    <button
      type="button"
      onClick={copy}
      className="group flex items-center gap-3 rounded-2xl border border-line bg-panel/70 py-2 pl-3.5 pr-2 text-left transition-colors hover:border-line-2"
      aria-label={`Copy invite link. Code ${formatCode(pool.inviteCode)}`}
      data-tour="pool-invite"
    >
      <span>
        <span className="block text-[11px] font-semibold uppercase tracking-wider text-dim">Invite code</span>
        <span className="block font-mono text-[15px] font-semibold tracking-[0.12em]">{formatCode(pool.inviteCode)}</span>
      </span>
      <span
        className={`inline-flex size-9 items-center justify-center rounded-xl transition-colors ${copied ? 'bg-good/15 text-good' : 'bg-fg/[0.06] text-muted group-hover:text-fg'}`}
      >
        {copied ? <Check size={16} /> : <Link2 size={16} />}
      </span>
    </button>
  )
}
