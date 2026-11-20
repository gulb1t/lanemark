import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Splash } from './components/Splash'
import { Overlays } from './components/ui/Overlays'
import { guidePath, isGuideTarget } from './lib/guideLinks'
import { useSpotlight } from './lib/hooks'
import { pageMeta } from './lib/seo'
import { AppLock } from './native/AppLock'
import { useLock } from './native/lock'
import { IS_APP } from './native/platform'
import { useNativeApp } from './native/useNativeApp'
import { load } from './routes'
import { enterDemo, useSession } from './store/useSession'
import { useStore } from './store/useStore'

const Landing = lazy(load.landing)
const AuthPages = {
  Login: lazy(load.login),
  Signup: lazy(load.signup),
  Verify: lazy(load.verify),
  Forgot: lazy(load.forgot),
  Reset: lazy(load.reset),
  VerifyEmail: lazy(load.verifyEmail),
  UnlockStep: lazy(load.unlockStep),
}
const AppShell = lazy(load.shell)
const Dashboard = lazy(load.dashboard)
const ClassPage = lazy(load.classPage)
const SwimmersPage = lazy(load.swimmers)
const SwimmerProfile = lazy(load.swimmer)
const CurriculumPage = lazy(load.curriculum)
const SettingsPage = lazy(load.settings)
const PoolPage = lazy(load.pool)
const PoolClassPage = lazy(load.poolClass)
const ReportWorkspace = lazy(load.reports)
const Privacy = lazy(load.privacy)
const Help = lazy(load.help)
const NotFound = lazy(load.notFound)

function RequireSession() {
  const status = useSession((s) => s.status)
  const offer = useLock((s) => s.offer)
  const location = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'signedOut') return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  // First sign-in on a phone: finish signing in (the fingerprint question) before the app and its tours appear.
  if (offer) return <AuthPages.UnlockStep />
  return <Outlet />
}

function GuestOnly({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status)
  if (status === 'loading') return <Splash />
  if (status === 'signedIn') return <Navigate to="/app" replace />
  return children
}

/** The phone app has no marketing page: it opens on your classes, or on sign-in. */
function AppHome() {
  const status = useSession((s) => s.status)
  if (status === 'loading') return <Splash />
  return <Navigate to={status === 'signedOut' ? '/login' : '/app'} replace />
}

function DemoEntry() {
  const navigate = useNavigate()
  const status = useSession((s) => s.status)
  const [params] = useSearchParams()
  const go = params.get('go')
  useEffect(() => {
    if (status === 'loading') return
    // `?go=` comes from the Help page's "Try it" buttons: open that screen in whatever classes are loaded.
    const land = () => navigate(isGuideTarget(go) ? guidePath(go, useStore.getState().classes) : '/app', { replace: true })
    // Signed-in users go to their own classes instead of being swapped into the sandbox.
    if (status === 'signedIn' || status === 'demo') land()
    else void enterDemo().then(land)
  }, [navigate, status, go])
  return <Splash />
}

export default function App() {
  useSpotlight()
  useNativeApp()
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
    document.title = pageMeta(pathname).title
  }, [pathname])

  return (
    <>
      <ErrorBoundary key={pathname}>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/" element={IS_APP ? <AppHome /> : <Landing />} />
          <Route path="/login" element={<GuestOnly><AuthPages.Login /></GuestOnly>} />
          <Route path="/login/verify" element={<GuestOnly><AuthPages.Verify /></GuestOnly>} />
          <Route path="/signup" element={<GuestOnly><AuthPages.Signup /></GuestOnly>} />
          <Route path="/forgot-password" element={<AuthPages.Forgot />} />
          <Route path="/reset-password" element={<AuthPages.Reset />} />
          <Route path="/verify-email" element={<AuthPages.VerifyEmail />} />
          <Route path="/demo" element={<DemoEntry />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/help" element={<Help />} />
          <Route element={<RequireSession />}>
            <Route path="/app/classes/:classId/reports/:swimmerId" element={<ReportWorkspace />} />
            <Route path="/app" element={<AppShell />}>
              <Route index element={<Dashboard />} />
              <Route path="classes/:classId" element={<ClassPage />} />
              <Route path="swimmers" element={<SwimmersPage />} />
              <Route path="swimmers/:swimmerId" element={<SwimmerProfile />} />
              <Route path="curriculum" element={<CurriculumPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="pool" element={<PoolPage />} />
              <Route path="pool/:memberId/classes/:classId" element={<PoolClassPage />} />
              <Route path="*" element={<NotFound />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound standalone />} />
        </Routes>
      </Suspense>
      </ErrorBoundary>
      <Overlays />
      {IS_APP && <AppLock />}
      <div className="grain" aria-hidden />
    </>
  )
}
