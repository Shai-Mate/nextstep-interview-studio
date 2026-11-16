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
  './orb-gl.js?v=8',
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
// Precache straight from the network: GitHub Pages lets browsers keep files for 10 minutes, so a plain addAll could
// store a stale v7 index.html in this cache and leave the phone stuck on the old version. If the page that arrives
// still doesn't load this version's scripts (a stale copy somewhere on the way), give up: the old version keeps
// working and the browser retries the update on the next visit, instead of mixing versions.
const VERSION = CACHE.slice(CACHE.lastIndexOf('-v') + 2);
self.addEventListener('install', (event) => event.waitUntil(
  caches.open(CACHE)
    .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' })))
      .then(() => cache.match('./index.html'))
      .then((page) => (page ? page.text() : ''))
      .then((html) => { if (!html.includes('app.js?v=' + VERSION)) throw new Error('stale index.html, retry later'); }))
    .then(() => self.skipWaiting())
    .catch((err) => caches.delete(CACHE).then(() => { throw err; }))
));
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
