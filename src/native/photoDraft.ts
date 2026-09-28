/**
 * Android can close SwimTrack while the camera app is open (phones short on memory do). When it reopens, the photo
 * arrives as a "restored result" and the swimmer form is gone, so the form is kept here first and reopened with it
 * (see PhotoRestore).
 */
export interface PhotoDraft {
  swimmerId?: string
  classId?: string
  name: string
  notes: string
}

const KEY = 'swimtrack:photo-draft'

export function savePhotoDraft(draft: PhotoDraft) {
  try {
    localStorage.setItem(KEY, JSON.stringify(draft))
  } catch {
    /* no storage: nothing to restore later */
  }
}

/** The photo came back normally (or was cancelled): nothing to restore. */
export function clearPhotoDraft() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    /* ignore */
  }
}

/** Reads the kept form and forgets it. */
export function takePhotoDraft(): PhotoDraft | null {
  try {
    const raw = localStorage.getItem(KEY)
    localStorage.removeItem(KEY)
    return raw ? (JSON.parse(raw) as PhotoDraft) : null
  } catch {
    return null
  }
}
