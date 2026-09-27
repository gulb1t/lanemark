/** Route code, split per page. */
export const load = {
  landing: () => import('./pages/Landing'),
  login: () => import('./pages/auth/Login'),
  signup: () => import('./pages/auth/Signup'),
  verify: () => import('./pages/auth/Verify'),
  forgot: () => import('./pages/auth/ForgotPassword'),
  reset: () => import('./pages/auth/ResetPassword'),
  verifyEmail: () => import('./pages/auth/VerifyEmail'),
  shell: () => import('./components/AppShell'),
  dashboard: () => import('./pages/Dashboard'),
  classPage: () => import('./pages/ClassPage'),
  swimmers: () => import('./pages/SwimmersPage'),
  swimmer: () => import('./pages/SwimmerProfile'),
  curriculum: () => import('./pages/CurriculumPage'),
  settings: () => import('./pages/SettingsPage'),
  pool: () => import('./pages/PoolPage'),
  reports: () => import('./pages/ReportWorkspace'),
  privacy: () => import('./pages/Privacy'),
  notFound: () => import('./pages/NotFound'),
}

/** Fetches every route's code so the whole app is cached for offline use. */
export function preloadRoutes() {
  for (const fn of Object.values(load)) void fn().catch(() => {})
}
