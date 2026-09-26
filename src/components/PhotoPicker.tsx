import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { fileToAvatar } from '../lib/image'
import { toast } from '../store/useUi'
import { Avatar } from './ui/Avatar'
import { Button } from './ui/Button'

interface Props {
  name: string
  photo?: string
  onChange: (photo: string | undefined) => void
}

export function PhotoPicker({ name, photo, onChange }: Props) {
  const input = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  async function onFile(file: File | undefined) {
    if (!file) return
    setBusy(true)
    try {
      onChange(await fileToAvatar(file))
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Could not read that image.', 'error')
    } finally {
      setBusy(false)
      if (input.current) input.current.value = ''
    }
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar name={name || '?'} photo={photo} size={72} />
      <div className="flex flex-wrap gap-2">
        <Button size="sm" icon={<Camera size={14} />} onClick={() => input.current?.click()} disabled={busy}>
          {photo ? 'Change photo' : 'Add photo'}
        </Button>
        {photo && (
          <Button size="sm" variant="ghost" icon={<Trash2 size={14} />} onClick={() => onChange(undefined)}>
            Remove
          </Button>
        )}
        <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
      </div>
    </div>
  )
}
