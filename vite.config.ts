import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

/**
 * Emits /sw.js with this build's files baked in, so the app shell works offline. Scripts, styles, icons and the
 * Latin font files are precached; other font subsets are cached the first time a page needs them.
 */
function serviceWorker(): Plugin {
  return {
    name: 'service-worker',
    // The dev server gets a network-first worker, so offline can be tried without a production build.
    configureServer(server) {
      server.middlewares.use('/sw.js', (_req, res) => {
        res.setHeader('Content-Type', 'text/javascript')
        res.setHeader('Cache-Control', 'no-cache')
        res.end(readFileSync('scripts/sw.dev.js'))
      })
    },
    generateBundle(_options, bundle) {
      const built = Object.keys(bundle).filter((f) => /\.(js|css|svg|png)$/.test(f) || /latin-(wght|400).*\.woff2$/.test(f))
      // Files at the top of public/ only: guide screenshots in public/guide/ load when the Help page shows them, and
      // og.png is only for link previews.
      const pub = readdirSync('public').filter((f) => f !== 'sw.js' && f !== 'og.png' && statSync(`public/${f}`).isFile())
      const assets = [...built, ...pub].map((f) => `/${f}`)
      const version = createHash('sha256').update(assets.join()).digest('hex').slice(0, 12)
      const source = readFileSync('scripts/sw.template.js', 'utf8').replace("'__VERSION__'", JSON.stringify(version)).replace('__ASSETS__', JSON.stringify(assets))
      this.emitFile({ type: 'asset', fileName: 'sw.js', source })
    },
  }
}

// https://vite.dev/config/
// `vite build --mode app` builds the Android app's screens into dist-app/: no service worker (the files are already
// on the phone), and the API is the live server unless APP_API_URL says otherwise.
export default defineConfig(({ mode }) => ({
  plugins: [react(), tailwindcss(), mode === 'app' ? null : serviceWorker()],
  define:
    mode === 'app'
      ? {
          'import.meta.env.VITE_APP': JSON.stringify('1'),
          'import.meta.env.VITE_API_URL': JSON.stringify(process.env.APP_API_URL ?? 'https://lanemark.fly.dev'),
        }
      : {},
  build: mode === 'app' ? { outDir: 'dist-app', emptyOutDir: true } : {},
  // The API runs on :8787 in development; the browser only ever talks to the Vite origin.
  server: { proxy: { '/api': process.env.API_PROXY ?? 'http://localhost:8787' } },
  test: { environment: 'node', include: ['src/**/*.test.ts', 'server/**/*.test.ts'], testTimeout: 20000, setupFiles: ['src/test/setup.ts'] },
}))
