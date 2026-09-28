import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { Motion } from './components/Motion'
import { preloadRoutes } from './routes'
import './index.css'
import { initEffects } from './lib/effects'
import { initTextSize } from './lib/textSize'
import { initTheme } from './lib/theme'
import { IS_APP } from './native/platform'
import { bootstrap } from './store/useSession'

initTheme()
initTextSize()
initEffects()
void bootstrap()
// Lets the stylesheet go easier on heavy effects inside the phone app.
if (IS_APP) document.documentElement.classList.add('in-app')

// Offline app shell. Once registered, every route is fetched in the background so it's on the device before the
// Wi-Fi drops (service workers need HTTPS or localhost). The phone app already has every file on the phone.
if (!IS_APP && 'serviceWorker' in navigator) {
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
    <Motion>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </Motion>
  </StrictMode>,
)
