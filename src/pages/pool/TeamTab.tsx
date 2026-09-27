import { Copy, Link2, LogOut, MoreHorizontal, RefreshCw, ShieldCheck, UserMinus, Users } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Avatar } from '../../components/ui/Avatar'
import { Button } from '../../components/ui/Button'
import { Field } from '../../components/ui/bits'
import { MenuItem, Popover } from '../../components/ui/Popover'
import { api } from '../../lib/api'
import { formatCode, setPool, type Pool, type PoolMember, type PoolRole } from '../../store/usePool'
import { confirm, toast } from '../../store/useUi'
import { RoleChip } from './bits'
import { attempt, useDemo, useUserId } from './data'

const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

export function TeamTab({ pool }: { pool: Pool }) {
  const demo = useDemo()
  const userId = useUserId()
  const [name, setName] = useState(pool.name)
  const [saving, setSaving] = useState(false)
  const supervisors = pool.members.filter((m) => m.role === 'supervisor').length

  /** The demo has no server: edits apply to the pool in this browser. */
  function localEdit(members: PoolMember[], extra: Partial<Pool> = {}) {
    setPool({ ...pool, ...extra, members, memberCount: members.length })
  }

  async function rename(e: FormEvent) {
    e.preventDefault()
    if (demo) return localEdit(pool.members, { name: name.trim() })
    setSaving(true)
    const res = await attempt(() => api<{ pool: Pool }>('/pool', 'PATCH', { name }))
    setSaving(false)
    if (res) {
      setPool(res.pool, userId)
      toast('Pool renamed')
    }
  }

  async function newCode() {
    const ok = await confirm({
      title: 'Make a new invite code?',
      body: 'The current code and link stop working. People already in the pool stay in it.',
      confirmLabel: 'New code',
    })
    if (!ok) return
    if (demo) return localEdit(pool.members, { inviteCode: Array.from({ length: 8 }, () => CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)]).join('') })
    const res = await attempt(() => api<{ inviteCode: string }>('/pool/invite-code', 'POST'))
    if (res) setPool({ ...pool, inviteCode: res.inviteCode }, userId)
  }

  async function setRole(m: PoolMember, role: PoolRole) {
    if (demo) {
      if (role === 'instructor' && m.role === 'supervisor' && supervisors === 1) return toast('A pool needs at least one supervisor.', 'error')
      return localEdit(pool.members.map((x) => (x.id === m.id ? { ...x, role } : x)))
    }
    const res = await attempt(() => api<{ pool: Pool }>(`/pool/members/${m.id}`, 'PATCH', { role }))
    if (res) {
      setPool(res.pool, userId)
      toast(role === 'supervisor' ? `${m.name} is now a supervisor` : `${m.name} is now an instructor`)
    }
  }

  async function remove(m: PoolMember) {
    const ok = await confirm({
      title: `Remove ${m.name} from the pool?`,
      body: 'You stop seeing their classes’ numbers. Their classes and swimmers stay in their account.',
      confirmLabel: 'Remove',
      danger: true,
    })
    if (!ok) return
    if (demo) return localEdit(pool.members.filter((x) => x.id !== m.id))
    const res = await attempt(() => api<{ pool: Pool }>(`/pool/members/${m.id}`, 'DELETE'))
    if (res) setPool(res.pool, userId)
  }

  async function leave() {
    const ok = await confirm({
      title: `Leave ${pool.name}?`,
      body: 'You stop seeing the overview. Your own classes stay as they are.',
      confirmLabel: 'Leave pool',
      danger: true,
    })
    if (!ok) return
    if (demo) return toast('The demo’s pool stays so you can look around.')
    if (await attempt(() => api('/pool/leave', 'POST'))) {
      setPool(null, userId)
      toast(`You left ${pool.name}`)
    }
  }

  async function close() {
    const ok = await confirm({
      title: `Close ${pool.name}?`,
      body: 'Everyone leaves the pool and the invite code stops working. Nobody loses any classes or swimmers.',
      confirmLabel: 'Close pool',
      danger: true,
    })
    if (!ok) return
    if (demo) return toast('The demo’s pool stays so you can look around.')
    if (await attempt(() => api('/pool', 'DELETE'))) {
      setPool(null, userId)
      toast(`${pool.name} is closed`)
    }
  }

  const link = pool.inviteCode ? `${location.origin}/app/pool?code=${pool.inviteCode}` : ''
  const copy = async (text: string, what: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast(`${what} copied`)
    } catch {
      toast(text)
    }
  }

  return (
    <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      <section className="card overflow-hidden" aria-labelledby="team-h">
        <div className="flex items-baseline justify-between px-5 pt-5 sm:px-6">
          <h2 id="team-h" className="text-[16px] font-semibold">
            People
          </h2>
          <span className="text-xs text-dim">
            {supervisors} supervisor{supervisors === 1 ? '' : 's'} · {pool.memberCount - supervisors} instructor{pool.memberCount - supervisors === 1 ? '' : 's'}
          </span>
        </div>
        <ul className="mt-3 divide-y divide-line border-t border-line">
          {pool.members.map((m) => (
            <li key={m.id} className="flex items-center gap-3 px-5 py-3 sm:px-6">
              <Avatar name={m.name} size={36} />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                  <span className="truncate text-[14.5px] font-medium">{m.name}</span>
                  {m.you && <span className="text-[12px] text-dim">(you)</span>}
                  <RoleChip role={m.role} />
                </span>
                <span className="block truncate text-[12.5px] text-dim">
                  {m.email}
                  <span className="max-sm:hidden"> · joined {new Date(m.joinedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</span>
                </span>
              </span>
              {!m.you && (
                <Popover
                  label={`Manage ${m.name}`}
                  trigger={({ toggle, open }) => (
                    <button
                      type="button"
                      onClick={toggle}
                      aria-expanded={open}
                      aria-label={`Manage ${m.name}`}
                      className="inline-flex size-9 items-center justify-center rounded-full text-dim transition-colors hover:bg-fg/[0.06] hover:text-fg"
                    >
                      <MoreHorizontal size={17} />
                    </button>
                  )}
                >
                  {(closeMenu) => (
                    <>
                      {m.role === 'instructor' ? (
                        <MenuItem icon={<ShieldCheck size={15} />} onSelect={() => (closeMenu(), void setRole(m, 'supervisor'))}>
                          Make supervisor
                        </MenuItem>
                      ) : (
                        <MenuItem icon={<Users size={15} />} onSelect={() => (closeMenu(), void setRole(m, 'instructor'))}>
                          Make instructor
                        </MenuItem>
                      )}
                      <MenuItem tone="danger" icon={<UserMinus size={15} />} onSelect={() => (closeMenu(), void remove(m))}>
                        Remove from pool
                      </MenuItem>
                    </>
                  )}
                </Popover>
              )}
            </li>
          ))}
        </ul>
        <p className="border-t border-line px-5 py-3 text-[12.5px] text-dim sm:px-6">
          Supervisors see the overview and manage the pool. Instructors only see their own classes.
        </p>
      </section>

      <div className="space-y-4">
        <section className="card p-5 sm:p-6" aria-labelledby="invite-h">
          <h2 id="invite-h" className="text-[16px] font-semibold">
            Invite instructors
          </h2>
          <p className="mt-1 text-[13.5px] text-muted">
            Send the link, or have them enter the code under Pool. Anyone with it can join, so make a new one if it gets around.
          </p>
          {pool.inviteCode && (
            <div className="mt-4 rounded-2xl border border-line bg-panel-2/50 px-4 py-3 text-center font-mono text-[22px] font-semibold tracking-[0.18em]">
              {formatCode(pool.inviteCode)}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="primary" size="sm" icon={<Link2 size={14} />} onClick={() => copy(link, 'Invite link')}>
              Copy link
            </Button>
            <Button size="sm" icon={<Copy size={14} />} onClick={() => copy(formatCode(pool.inviteCode ?? ''), 'Code')}>
              Copy code
            </Button>
            <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={newCode}>
              New code
            </Button>
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <form onSubmit={rename} className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Pool name">
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required />
              </Field>
            </div>
            <Button type="submit" loading={saving} disabled={name.trim().length < 2 || name.trim() === pool.name}>
              Save
            </Button>
          </form>
          <div className="mt-6 flex flex-wrap gap-2 border-t border-line pt-5">
            {supervisors > 1 && (
              <Button variant="ghost" size="sm" icon={<LogOut size={14} />} onClick={leave}>
                Leave pool
              </Button>
            )}
            <Button variant="danger" size="sm" onClick={close}>
              Close pool
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
