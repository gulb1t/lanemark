import { logout } from '../store/useSession'
import { confirm } from '../store/useUi'

/** Signs out, warning first if edits made offline would be lost. Resolves true when signed out. */
export async function signOut(navigate: (to: string) => void): Promise<boolean> {
  const { unsynced } = await logout()
  if (unsynced) {
    const ok = await confirm({
      title: 'Sign out with unsynced changes?',
      body: `${unsynced} change${unsynced === 1 ? ' hasn’t' : 's haven’t'} reached the server yet (you seem to be offline). Signing out now deletes ${unsynced === 1 ? 'it' : 'them'} from this device.`,
      confirmLabel: 'Sign out anyway',
      danger: true,
    })
    if (!ok) return false
    await logout({ force: true })
  }
  navigate('/login')
  return true
}
