/*
 * Guest kiosk service worker (scope: /f/).
 * Lets an installed branch app open even when the iPad's Wi-Fi is down at launch.
 * Submissions are not handled here — the page's own offline queue retries them.
 * Plain ES2017 on purpose: the iPads run iOS 15.
 */
var CACHE = 'fb-guest-v1'

self.addEventListener('install', function () {
  self.skipWaiting()
})

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches
      .keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (k) { return k.indexOf('fb-guest-') === 0 && k !== CACHE }).map(function (k) { return caches.delete(k) })
        )
      })
      .then(function () { return self.clients.claim() })
  )
})

function put(request, response) {
  if (response && (response.ok || response.type === 'opaque')) {
    var copy = response.clone()
    caches.open(CACHE).then(function (cache) { cache.put(request, copy) })
  }
  return response
}

function networkFirst(request) {
  return fetch(request)
    .then(function (res) { return put(request, res) })
    .catch(function () {
      return caches.match(request).then(function (hit) {
        return hit || Promise.reject(new Error('offline'))
      })
    })
}

function cacheFirst(request) {
  return caches.match(request).then(function (hit) {
    return hit || fetch(request).then(function (res) { return put(request, res) })
  })
}

// The page sends what it loaded before this worker took control, so the very
// first visit is enough to make the app open offline.
self.addEventListener('message', function (event) {
  var data = event.data || {}
  if (data.type !== 'precache' || !Array.isArray(data.urls)) return
  event.waitUntil(
    caches.open(CACHE).then(function (cache) {
      return Promise.all(
        data.urls.map(function (u) {
          return fetch(u, { credentials: 'same-origin' })
            .then(function (res) { if (res.ok || res.type === 'opaque') return cache.put(u, res) })
            .catch(function () {})
        })
      )
    })
  )
})

self.addEventListener('fetch', function (event) {
  var req = event.request
  if (req.method !== 'GET') return
  var url = new URL(req.url)

  // The branch's form page, and the branch's details (name, logo URL).
  if (req.mode === 'navigate' || /^\/api\/public\/locations\/[^/]+\/$/.test(url.pathname)) {
    event.respondWith(networkFirst(req))
    return
  }
  // Content-hashed build files, branch logos/icons, and Google Fonts never change under the same URL.
  if (
    url.pathname.indexOf('/assets/') === 0 ||
    /^\/api\/public\/(locations\/[^/]+\/)?(logo\/|icon-)/.test(url.pathname) ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(cacheFirst(req))
  }
})
