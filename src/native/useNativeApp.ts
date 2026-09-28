import { App, type URLOpenListenerEvent } from '@capacitor/app'
import { Keyboard } from '@capacitor/keyboard'
import { SplashScreen } from '@capacitor/splash-screen'
import { SystemBars, SystemBarsStyle, type PluginListenerHandle } from '@capacitor/core'
import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTheme } from '../lib/theme'
import { useSession } from '../store/useSession'
import { onAppState } from './lock'
import { IS_APP, SITE_URL } from './platform'

/** Screens where the back button leaves the app instead of going back. */
const ROOTS = new Set(['/', '/app', '/login'])

/** Closes whatever is open on top (sheet, dialog, menu, tour). Returns false when nothing was. */
function closeTopLayer(): boolean {
  const dialog = document.querySelector<HTMLDialogElement>('dialog[open]')
  if (dialog) {
    dialog.close()
    return true
  }
  if (!document.querySelector('[role=dialog], [role=alertdialog], [role=menu]')) return false
  // Sheets, menus and the tour all close on Esc.
  const target = document.activeElement ?? document.body
  target.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', code: 'Escape', bubbles: true, cancelable: true }))
  return true
}

/**
 * The Android side of the app: the back button, links that open the app (invites, email links), the status bar
 * following the theme, hiding the splash screen once React has drawn, and locking after time away.
 */
export function useNativeApp() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!IS_APP) return
    const subs: Promise<PluginListenerHandle>[] = [
      App.addListener('backButton', () => {
        if (closeTopLayer()) return
        if (ROOTS.has(location.pathname)) void App.minimizeApp()
        else if (history.length > 1 && history.state?.idx > 0) navigate(-1)
        else navigate('/app', { replace: true })
      }),
      // App Links: https://swimtrack.fly.dev/... opened from an email or a message lands on that screen here.
      App.addListener('appUrlOpen', ({ url }: URLOpenListenerEvent) => {
        try {
          const u = new URL(url)
          if (u.origin === new URL(SITE_URL).origin) navigate(u.pathname + u.search + u.hash)
        } catch {
          /* not a link we know */
        }
      }),
      App.addListener('appStateChange', ({ isActive }) => onAppState(isActive, useSession.getState().status === 'signedIn')),
      Keyboard.addListener('keyboardWillShow', () => document.documentElement.classList.add('keyboard-open')),
      Keyboard.addListener('keyboardWillHide', () => document.documentElement.classList.remove('keyboard-open')),
    ]
    void SplashScreen.hide({ fadeOutDuration: 250 })
    return () => subs.forEach((s) => void s.then((h) => h.remove()))
  }, [navigate])

  const theme = useTheme((s) => s.resolved)
  useEffect(() => {
    if (!IS_APP) return
    // "Dark" means light icons, for a dark background.
    void SystemBars.setStyle({ style: theme === 'dark' ? SystemBarsStyle.Dark : SystemBarsStyle.Light }).catch(() => undefined)
  }, [theme])
}
