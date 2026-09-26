import { Plus, Search, UserPlus } from 'lucide-react'
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

/** Add swimmers who already exist in the app to a class, or jump to creating a brand-new one. */
export function AddMemberDialog({ cls, onClose, onCreateNew }: Props) {
  const swimmers = useStore((s) => s.swimmers)
  const enroll = useStore((s) => s.enroll)
  const [q, setQ] = useState('')

  const available = useMemo(() => {
    const inClass = new Set(cls.enrollments.map((e) => e.swimmerId))
    const needle = q.trim().toLowerCase()
    return swimmers
      .filter((w) => !inClass.has(w.id))
      .filter((w) => !needle || w.name.toLowerCase().includes(needle))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [swimmers, cls.enrollments, q])

  const hasAny = swimmers.length > cls.enrollments.length

  return (
    <Modal
      open
      onClose={onClose}
      title="Add class members"
      description={hasAny ? 'Pick swimmers you already have, or create a new one.' : 'Create a swimmer to add to this class.'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Done
          </Button>
          <Button variant="primary" icon={<UserPlus size={15} />} onClick={onCreateNew}>
            New swimmer
          </Button>
        </>
      }
    >
      {hasAny ? (
        <div className="space-y-3">
          <div className="relative">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-dim" />
            <input className="input pl-9" placeholder="Search swimmers" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
          </div>
          <ul className="divide-y divide-line overflow-hidden rounded-xl border border-line">
            {available.map((w) => (
              <li key={w.id} className="flex items-center gap-3 px-3 py-2.5">
                <Avatar name={w.name} photo={w.photo} size={34} />
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{w.name}</span>
                <Button
                  size="sm"
                  icon={<Plus size={14} />}
                  onClick={() => {
                    enroll(cls.id, w.id)
                    toast(`${w.name} added to class`)
                  }}
                >
                  Add
                </Button>
              </li>
            ))}
            {!available.length && <li className="px-3 py-6 text-center text-sm text-muted">No matching swimmers.</li>}
          </ul>
        </div>
      ) : (
        <p className="py-6 text-center text-sm text-muted">
          Every swimmer you have is already in this class. Create a new one to keep going.
        </p>
      )}
    </Modal>
  )
}
