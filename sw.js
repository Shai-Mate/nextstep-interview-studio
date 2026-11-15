'use strict';
const CACHE = 'nextstep-phone-v6';
const ASSETS = [
  './index.html',
  './styles.css?v=6',
  './engine.js?v=6',
  './orb.js?v=6',
  './app.js?v=6',
  './pwa.js?v=6',
  './manifest.webmanifest?v=6',
  './nextstep_icon.svg?v=6',
  './favicon.png?v=6',
  './icon-192.png?v=6',
  './icon-512.png?v=6',
  './apple-touch-icon.png?v=6',
  './nextstep_icon_1024.png?v=6',
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
