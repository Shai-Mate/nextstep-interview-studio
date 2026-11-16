'use strict';
const CACHE = 'nextstep-phone-v8';
// Not precached on purpose: share-card.png (only read by link-preview scrapers) and nextstep_icon_1024.png
// (only read from the manifest when the app is installed, which needs a connection anyway).
const ASSETS = [
  './index.html',
  './privacy.html',
  './styles.css?v=8',
  './flow.css?v=8',
  './interview.css?v=8',
  './launch.css?v=8',
  './engine.js?v=8',
  './coach.js?v=8',
  './orb.js?v=8',
  './app.js?v=8',
  './flow.js?v=8',
  './interview.js?v=8',
  './pwa.js?v=8',
  './manifest.webmanifest?v=8',
  './nextstep_icon.svg?v=8',
  './favicon.png?v=8',
  './icon-192.png?v=8',
  './icon-512.png?v=8',
  './apple-touch-icon.png?v=8',
  './noise.png',
  './fonts/dm-sans-400.woff2',
  './fonts/dm-sans-500.woff2',
  './fonts/dm-sans-600.woff2',
  './fonts/newsreader-italic.woff2'
];
const SCOPE = new URL('./', self.location).pathname;
const SHELL = new URL('./index.html', self.location).href;
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('nextstep-phone-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(SCOPE)) return;
  if (request.mode === 'navigate') {
    // A page is served as itself: cached copy first (query ignored, a folder URL means index.html), then the network,
    // and offline the cached app shell, so ./privacy.html shows the privacy page and the app still opens offline.
    const page = url.pathname.endsWith('/') ? SHELL : url.href;
    event.respondWith(
      caches.match(page, { ignoreSearch: true })
        .then((cached) => cached || fetch(request))
        .catch(() => caches.match(SHELL).then((shell) => shell || Response.error()))
    );
    return;
  }
  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
