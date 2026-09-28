import { App } from '@capacitor/app'
import { useEffect, useState } from 'react'
import { fileToAvatar } from '../lib/image'
import { takePhotoDraft, type PhotoDraft } from '../native/photoDraft'
import { useStore } from '../store/useStore'
import { toast } from '../store/useUi'
import { SwimmerDialog } from './dialogs/SwimmerDialog'

interface Restored {
  draft: PhotoDraft
  photo: string
}

/** Phone app, signed in: reopens the swimmer form with the photo taken before Android closed the app. */
export function PhotoRestore() {
  const [restored, setRestored] = useState<Restored | null>(null)
  const swimmerId = restored?.draft.swimmerId
  const swimmer = useStore((s) => (swimmerId ? s.swimmers.find((w) => w.id === swimmerId) : undefined))

  useEffect(() => {
    const sub = App.addListener('appRestoredResult', async (result) => {
      if (result.pluginId !== 'Camera') return
      const draft = takePhotoDraft()
      const dataUrl = (result.data as { dataUrl?: string } | undefined)?.dataUrl
      if (!draft || !result.success || !dataUrl) return
      try {
        const blob = await (await fetch(dataUrl)).blob()
        const photo = await fileToAvatar(new File([blob], 'photo.jpg', { type: blob.type || 'image/jpeg' }))
        setRestored({ draft, photo })
      } catch {
        toast('Couldn’t bring back that photo. Try adding it again.', 'error')
      }
    })
    return () => void sub.then((h) => h.remove())
  }, [])

  if (!restored) return null
  const { draft, photo } = restored
  // If the swimmer was deleted meanwhile, this becomes a new swimmer with what was typed.
  return (
    <SwimmerDialog
      swimmer={swimmer}
      classId={swimmer ? undefined : draft.classId}
      initial={{ name: draft.name, notes: draft.notes, photo }}
      onClose={() => setRestored(null)}
    />
  )
}
