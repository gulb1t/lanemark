import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { Navigate, Outlet, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import { ErrorBoundary } from './components/ErrorBoundary'
import { Splash } from './components/Splash'
import { Overlays } from './components/ui/Overlays'
import { useSpotlight } from './lib/hooks'
import { load } from './routes'
import { enterDemo, useSession } from './store/useSession'

const Landing = lazy(load.landing)
const AuthPages = {
  Login: lazy(load.login),
  Signup: lazy(load.signup),
  Verify: lazy(load.verify),
  Forgot: lazy(load.forgot),
  Reset: lazy(load.reset),
  VerifyEmail: lazy(load.verifyEmail),
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
const NotFound = lazy(load.notFound)

function RequireSession() {
  const status = useSession((s) => s.status)
  const location = useLocation()
  if (status === 'loading') return <Splash />
  if (status === 'signedOut') return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />
  return <Outlet />
}

function GuestOnly({ children }: { children: ReactNode }) {
  const status = useSession((s) => s.status)
  if (status === 'loading') return <Splash />
  if (status === 'signedIn') return <Navigate to="/app" replace />
  return children
}

function DemoEntry() {
  const navigate = useNavigate()
  const status = useSession((s) => s.status)
  useEffect(() => {
    if (status === 'loading') return
    // Signed-in users go to their own classes instead of being swapped into the sandbox.
    if (status === 'signedIn' || status === 'demo') navigate('/app', { replace: true })
    else void enterDemo().then(() => navigate('/app', { replace: true }))
  }, [navigate, status])
  return <Splash />
}

export default function App() {
  useSpotlight()
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0 })
  }, [pathname])

  return (
    <>
      <ErrorBoundary key={pathname}>
      <Suspense fallback={<Splash />}>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<GuestOnly><AuthPages.Login /></GuestOnly>} />
          <Route path="/login/verify" element={<GuestOnly><AuthPages.Verify /></GuestOnly>} />
          <Route path="/signup" element={<GuestOnly><AuthPages.Signup /></GuestOnly>} />
          <Route path="/forgot-password" element={<AuthPages.Forgot />} />
          <Route path="/reset-password" element={<AuthPages.Reset />} />
          <Route path="/verify-email" element={<AuthPages.VerifyEmail />} />
          <Route path="/demo" element={<DemoEntry />} />
          <Route path="/privacy" element={<Privacy />} />
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
      <div className="grain" aria-hidden />
    </>
  )
}
