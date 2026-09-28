import { Check, Search, UserPlus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useStore } from '../../store/useStore'
import { toast } from '../../store/useUi'
import type { SwimClass } from '../../types'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'

interface Props {
  cls: SwimClass
  onClose: () => void
  onCreateNew: () => void
}

/**
 * Add swimmers you already have to a class: tick the ones you want, then confirm with the button that says how many.
 * Nothing changes until that button is pressed, so a stray tap can't put someone in the wrong class.
 */
export function AddMemberDialog({ cls, onClose, onCreateNew }: Props) {
  const swimmers = useStore((s) => s.swimmers)
  const enroll = useStore((s) => s.enroll)
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Set<string>>(() => new Set())

  const available = useMemo(() => {
    const inClass = new Set(cls.enrollments.map((e) => e.swimmerId))
    const needle = q.trim().toLowerCase()
    return swimmers
      .filter((w) => !inClass.has(w.id))
      .filter((w) => !needle || w.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [swimmers, cls.enrollments, q])

  const hasAny = swimmers.length > cls.enrollments.length
  const toggle = (id: string) =>
    setPicked((p) => {
      const next = new Set(p)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })

  function add() {
    const names = swimmers.filter((w) => picked.has(w.id)).map((w) => w.name)
    for (const id of picked) enroll(cls.id, id)
    toast(picked.size === 1 ? `${names[0]} added to ${cls.name}` : `${picked.size} swimmers added to ${cls.name}`)
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Add swimmers to this class"
      description={hasAny ? 'Tick everyone you want to add, then press Add.' : 'Everyone you have is already in this class.'}
      footer={
        <>
          <Button variant="ghost" icon={<UserPlus size={15} />} onClick={onCreateNew} className="mr-auto">
            New swimmer
          </Button>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={add} disabled={!picked.size}>
            {picked.size ? `Add ${picked.size} swimmer${picked.size === 1 ? '' : 's'}` : 'Add'}
          </Button>
        </>
      }
    >
      {hasAny ? (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input className="input pl-9" placeholder="Search your swimmers" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto rounded-xl border border-line">
            {available.map((w) => {
              const on = picked.has(w.id)
              return (
                <li key={w.id}>
                  <label className={`flex cursor-pointer items-center gap-3 px-3 py-2.5 transition-colors ${on ? 'bg-aqua/[0.07]' : 'hover:bg-fg/[0.03]'}`}>
                    <input type="checkbox" className="peer sr-only" checked={on} onChange={() => toggle(w.id)} />
                    <span
                      className={`flex size-5 shrink-0 items-center justify-center rounded-md border transition-colors peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-aqua ${on ? 'border-aqua bg-aqua text-ink' : 'border-line-2'}`}
                    >
                      {on && <Check size={13} strokeWidth={3} />}
                    </span>
                    <Avatar name={w.name} size={34} />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium">{w.name}</span>
                  </label>
                </li>
              )
            })}
            {!available.length && <li className="px-3 py-6 text-center text-sm text-muted">No swimmers match “{q.trim()}”.</li>}
          </ul>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted">Use New swimmer to add someone you haven’t entered yet.</p>
      )}
    </Modal>
  )
}
