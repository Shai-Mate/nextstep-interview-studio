'use strict';
const CACHE = 'nextstep-phone-v3';
const ASSETS = [
  './',
  './index.html',
  './styles.css',
  './engine.js',
  './app.js',
  './legacy.js',
  './ui.js',
  './api.js',
  './files.js',
  './pwa.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './shared/text.js',
  './shared/messages.js',
  './shared/schema.js',
  './shared/grounding.js',
  './shared/onboarding.js',
  './shared/plan-path.js',
  './shared/grade-rubric.js',
  './shared/fixture-match.js',
  './shared/docx.js',
  './shared/v2-feedback.js',
  './shared/records.js',
  './shared/backup.js',
  './fixtures/packs.js',
  './fixtures/trnt-4cc1eae081ce53ed.role.json',
  './vendor/pdfjs/pdf.min.mjs',
  './vendor/pdfjs/pdf.worker.min.mjs'
];
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting())));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('nextstep-phone-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  if (url.pathname.startsWith(new URL('./api/', self.location).pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.match('./index.html').then(cached => cached || fetch(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request, { ignoreSearch: true }).then(cached => cached || fetch(event.request)));
});
