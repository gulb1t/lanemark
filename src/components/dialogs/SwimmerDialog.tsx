import { useState, type FormEvent } from 'react'
import { useStore } from '../../store/useStore'
import { confirm, toast } from '../../store/useUi'
import type { Swimmer } from '../../types'
import { PhotoPicker } from '../PhotoPicker'
import { Button } from '../ui/Button'
import { Modal } from '../ui/Modal'
import { Field } from '../ui/bits'

interface Props {
  /** Edit this swimmer; omit to create a new one. */
  swimmer?: Swimmer
  /** When creating, also enrol the new swimmer in this class. */
  classId?: string
  onClose: () => void
  /** Called with the new swimmer's id after creating one. */
  onCreated?: (id: string) => void
  /** Start from these instead of the swimmer's saved details (a form brought back after the camera). */
  initial?: { name: string; notes: string; photo?: string }
}

/** Mount to open, unmount (via onClose) to close. State initialises from props each time it mounts. */
export function SwimmerDialog({ swimmer, classId, onClose, onCreated, initial }: Props) {
  const addSwimmer = useStore((s) => s.addSwimmer)
  const updateSwimmer = useStore((s) => s.updateSwimmer)
  const swimmers = useStore((s) => s.swimmers)

  const [name, setName] = useState(initial?.name ?? swimmer?.name ?? '')
  const [notes, setNotes] = useState(initial?.notes ?? swimmer?.notes ?? '')
  const [photo, setPhoto] = useState(initial ? initial.photo : swimmer?.photo)

  const valid = name.trim().length > 0

  async function submit(e: FormEvent) {
    e.preventDefault()
    if (!valid) return
    // The most common slip is adding someone who's already there (from last session, or a double tap).
    const twin = swimmers.find((w) => w.id !== swimmer?.id && w.name.trim().toLowerCase() === name.trim().toLowerCase())
    if (
      twin &&
      !swimmer &&
      !(await confirm({
        title: `You already have a ${twin.name}`,
        body: classId ? 'Add a second swimmer with the same name? To put the existing one in this class, cancel and choose them from your swimmers instead.' : 'Add a second swimmer with the same name?',
        confirmLabel: 'Add another',
      }))
    )
      return
    if (swimmer) {
      updateSwimmer(swimmer.id, { name: name.trim(), notes, photo })
      toast('Swimmer updated')
    } else {
      const id = addSwimmer({ name, notes, photo }, classId)
      toast(classId ? `${name.trim()} added to class` : 'Swimmer added')
      if (onCreated) return onCreated(id)
    }
    onClose()
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={swimmer ? 'Edit swimmer' : 'New swimmer'}
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="swimmer-form" disabled={!valid}>
            {swimmer ? 'Save changes' : classId ? 'Add to class' : 'Add swimmer'}
          </Button>
        </>
      }
    >
      <form id="swimmer-form" onSubmit={submit} className="space-y-5">
        <PhotoPicker name={name} photo={photo} onChange={setPhoto} draft={() => ({ swimmerId: swimmer?.id, classId, name, notes })} />
        <Field label="Full name">
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="First and last name" autoFocus maxLength={120} />
        </Field>
        <Field label="Notes" hint="Allergies, goals, things to remember on deck. Seen by you and, if you’re in a pool, its supervisors.">
          <textarea className="input min-h-24 resize-y" value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={4000} />
        </Field>
      </form>
    </Modal>
  )
}
