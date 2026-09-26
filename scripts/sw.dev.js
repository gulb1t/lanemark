/* SwimTrack service worker for `npm run dev`: network first, falling back to whatever was loaded before. */
/* global self, caches, fetch, URL, location, Response */

const CACHE = 'swimtrack-dev'

// The page that registered this worker loaded before it existed, so fetch the app shell now.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add('/'))
      .then(() => self.skipWaiting()),
  )
})
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

// The page reports the modules it loaded before this worker took over; keep copies of those too.
self.addEventListener('message', (event) => {
  if (event.data?.type !== 'cache-urls') return
  event.waitUntil(caches.open(CACHE).then((cache) => Promise.all(event.data.urls.map((u) => cache.add(u).catch(() => {})))))
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)
  if (url.origin !== location.origin || url.pathname.startsWith('/api/')) return
  // Every client route renders the same index.html, so pages share one cache entry.
  const key = request.mode === 'navigate' ? '/' : request
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone()
          void caches.open(CACHE).then((cache) => cache.put(key, copy))
        }
        return res
      })
      .catch(() => caches.match(key, { ignoreVary: true }).then((hit) => hit || Response.error())),
  )
})
