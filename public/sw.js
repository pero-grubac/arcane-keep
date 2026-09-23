// ─── Offline support ──────────────────────────────────────────────────────────
// The game has no backend and no asset files beyond the build, so once it has
// loaded it can run entirely from cache.
//
// Nothing is precached: Vite fingerprints its bundles, and this file cannot know
// their names. Instead everything is cached as it is fetched, which after the
// first visit is the whole game.
//
//   • The page itself is network-first, so a new deploy is picked up as soon as
//     there is a connection, with the cached copy as the offline fallback.
//   • Fingerprinted bundles never change under the same name, so cache-first.
//   • Everything else (fonts, icons) is served from cache and refreshed behind.

const CACHE = 'arcane-keep-v1'

self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

async function networkFirst(request) {
  const cache = await caches.open(CACHE)
  try {
    const response = await fetch(request)
    if (response.ok) cache.put(request, response.clone())
    return response
  } catch {
    return (await cache.match(request)) ?? (await cache.match('./')) ?? Response.error()
  }
}

async function cacheFirst(request) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  if (hit) return hit
  const response = await fetch(request)
  if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
  return response
}

async function staleWhileRevalidate(request, event) {
  const cache = await caches.open(CACHE)
  const hit = await cache.match(request)
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone())
      return response
    })
    .catch(() => hit ?? Response.error())
  if (hit) {
    event.waitUntil(refresh)
    return hit
  }
  return refresh
}

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return
  const url = new URL(request.url)

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request))
  } else if (url.origin === self.location.origin && url.pathname.includes('/assets/')) {
    event.respondWith(cacheFirst(request))
  } else if (url.origin === self.location.origin || url.hostname.endsWith('fonts.googleapis.com')
    || url.hostname.endsWith('fonts.gstatic.com')) {
    event.respondWith(staleWhileRevalidate(request, event))
  }
})
