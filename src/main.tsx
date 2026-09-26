import { MotionConfig } from 'motion/react'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { preloadRoutes } from './routes'
import './index.css'
import { initTheme } from './lib/theme'
import { bootstrap } from './store/useSession'

initTheme()
void bootstrap()

// Offline app shell. Once registered, every route is fetched in the background so it's on the device before the
// Wi-Fi drops (service workers need HTTPS or localhost).
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker
      .register('/sw.js')
      .then(() => navigator.serviceWorker.ready)
      .then((reg) => {
        const urls = performance
          .getEntriesByType('resource')
          .map((e) => e.name)
          .filter((u) => u.startsWith(location.origin) && !u.includes('/api/'))
        reg.active?.postMessage({ type: 'cache-urls', urls })
        ;(window.requestIdleCallback ?? setTimeout)(() => preloadRoutes())
      })
      .catch(() => {})
  })
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MotionConfig reducedMotion="user">
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </MotionConfig>
  </StrictMode>,
)
