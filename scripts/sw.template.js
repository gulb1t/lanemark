/* SwimTrack service worker. Generated at build time by the `service-worker` plugin in vite.config.ts. */
/* global self, caches, fetch, URL, location, setTimeout */

const VERSION = '__VERSION__'
const PRECACHE = __ASSETS__
const CACHE = `swimtrack-${VERSION}`
const SHELL = '/index.html'

// Keep the app shell and this build's assets on the device so the app opens with no signal.
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll([SHELL, ...PRECACHE])))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('swimtrack-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

// Page loads: try the network briefly (fresh build, fresh CSP), fall back to the cached shell on flaky pool Wi-Fi.
function navigate(request) {
  const network = fetch(request).then((res) => {
    if (res.ok && res.headers.get('content-type')?.includes('text/html')) {
      const copy = res.clone()
      void caches.open(CACHE).then((cache) => cache.put(SHELL, copy))
    }
    return res
  })
  const timeout = new Promise((resolve) => setTimeout(resolve, 3500))
  return Promise.race([network, timeout])
    .then((res) => res || caches.match(SHELL, { ignoreVary: true }).then((hit) => hit || network))
    .catch(() => caches.match(SHELL, { ignoreVary: true }))
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  // Never touch the API: the sync engine has its own offline queue.
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return

  if (request.mode === 'navigate') {
    event.respondWith(navigate(request))
    return
  }

  // Hashed assets and icons never change under the same URL: cache first, fill the cache as they're used.
  event.respondWith(
    caches.match(request, { ignoreVary: true }).then(
      (hit) =>
        hit ||
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            void caches.open(CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        }),
    ),
  )
})
