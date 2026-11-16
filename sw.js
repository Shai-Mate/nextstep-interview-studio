'use strict';
const CACHE = 'nextstep-phone-v8';
const ASSETS = [
  './index.html',
  './styles.css?v=8',
  './flow.css?v=8',
  './interview.css?v=8',
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
  './nextstep_icon_1024.png?v=8',
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
