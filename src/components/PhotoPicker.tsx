import { Camera, Trash2 } from 'lucide-react'
import { useRef, useState } from 'react'
import { fileToAvatar } from '../lib/image'
import { IS_APP } from '../native/platform'
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

  /** The app asks the phone: take a photo, or pick one (Android's photo picker, no storage permission needed). */
  async function fromPhone() {
    const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera')
    try {
      const photo = await Camera.getPhoto({
        source: CameraSource.Prompt,
        resultType: CameraResultType.DataUrl,
        quality: 85,
        width: 1024,
        correctOrientation: true,
        promptLabelHeader: 'Swimmer photo',
        promptLabelPhoto: 'Choose from your photos',
        promptLabelPicture: 'Take a photo',
        promptLabelCancel: 'Cancel',
      })
      if (!photo.dataUrl) return
      const blob = await (await fetch(photo.dataUrl)).blob()
      await onFile(new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }))
    } catch {
      /* closed without choosing */
    }
  }

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
        <Button size="sm" icon={<Camera size={14} />} onClick={() => (IS_APP ? void fromPhone() : input.current?.click())} disabled={busy}>
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
