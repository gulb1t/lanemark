import { IS_APP } from '../native/platform'

/**
 * Hands a file to the person: a download on the website, the share sheet in the phone app (save to Files or
 * Drive, email it, open it in Sheets). Resolves to false when they closed the share sheet without choosing.
 */
export async function saveFile(name: string, text: string, type: string): Promise<boolean> {
  if (IS_APP) {
    const [{ Directory, Encoding, Filesystem }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')])
    const { uri } = await Filesystem.writeFile({ path: name, data: text, directory: Directory.Cache, encoding: Encoding.UTF8 })
    try {
      await Share.share({ title: name, files: [uri], dialogTitle: `Save or send ${name}` })
      return true
    } catch {
      return false
    }
  }
  const url = URL.createObjectURL(new Blob([text], { type }))
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return true
}

/** Opens the phone's share sheet with some text (the app), or copies it (the website). Returns what happened. */
export async function shareOrCopy(text: string, dialogTitle = 'Share'): Promise<'shared' | 'copied' | 'failed'> {
  if (IS_APP) {
    const { Share } = await import('@capacitor/share')
    try {
      await Share.share({ text, dialogTitle })
      return 'shared'
    } catch {
      return 'failed'
    }
  }
  try {
    await navigator.clipboard.writeText(text)
    return 'copied'
  } catch {
    return 'failed'
  }
}
