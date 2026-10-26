// Офлайн-кеш. При обновлении приложения меняется номер версии.
var C = 'rostok-v2-8';
var F = ['./', 'index.html', 'app.js?v=2.8', 'plan.js?v=2.8', 'courses.js?v=2.8', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png', 'apple-touch-icon.png'];
self.addEventListener('install', function (e) { e.waitUntil(caches.open(C).then(function (c) { return c.addAll(F); })); self.skipWaiting(); });
self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (k) { return Promise.all(k.filter(function (x) { return x !== C; }).map(function (x) { return caches.delete(x); })); }));
  self.clients.claim();
});
// Сначала сеть (чтобы новые уроки приходили сразу), без сети — из кеша.
self.addEventListener('fetch', function (e) {
  if (e.request.method !== 'GET') return;
  e.respondWith(fetch(e.request).then(function (r) {
    if (r.ok && new URL(e.request.url).origin === location.origin) { var cp = r.clone(); caches.open(C).then(function (c) { c.put(e.request, cp); }); }
    return r;
  }).catch(function () {
    return caches.match(e.request).then(function (m) { return m || caches.match('index.html'); });
  }));
});
