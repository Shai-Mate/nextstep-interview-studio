'use strict';
const CACHE = 'nextstep-phone-v4';
const ASSETS = [
  './index.html',
  './styles.css?v=4',
  './engine.js?v=4',
  './orb.js?v=4',
  './app.js?v=4',
  './pwa.js?v=4',
  './manifest.webmanifest?v=4',
  './favicon.png?v=4',
  './icon-192.png?v=4',
  './icon-512.png?v=4',
  './apple-touch-icon.png?v=4',
  './nextstep_icon_1024.png?v=4',
  './noise.png',
  './fonts/dm-sans-400.woff2',
  './fonts/dm-sans-500.woff2',
  './fonts/dm-sans-600.woff2',
  './fonts/newsreader-italic.woff2'
];
self.addEventListener('install', (event) => event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', (event) => event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('nextstep-phone-') && key !== CACHE).map((key) => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then((cached) => cached || fetch(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request)));
});
