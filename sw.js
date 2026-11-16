'use strict';
const CACHE = 'nextstep-phone-v8';
const ASSETS = [
  './index.html',
  './styles.css?v=8',
  './engine.js?v=8',
  './orb.js?v=8',
  './app.js?v=8',
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

function askClient(client) {
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => resolve('timeout'), 400);
    channel.port1.onmessage = (event) => {
      clearTimeout(timer);
      resolve(event.data);
    };
    try {
      client.postMessage({ type: 'nextstep-update' }, [channel.port2]);
    } catch (err) {
      clearTimeout(timer);
      resolve('timeout');
    }
  });
}

function refreshClient(client) {
  askClient(client).then((reply) => {
    if (reply === 'defer' || reply === 'reload' || reply === 'ready') return;
    client.navigate(client.url).catch(() => {});
  });
}

self.addEventListener('activate', (event) => event.waitUntil((async () => {
  const keys = await caches.keys();
  await Promise.all(keys.filter((key) => key.startsWith('nextstep-phone-') && key !== CACHE).map((key) => caches.delete(key)));
  await self.clients.claim();
  const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
  windows.forEach(refreshClient);
})()));

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (!url.pathname.startsWith(new URL('./', self.location).pathname)) return;
  if (url.pathname.endsWith('/sw.js')) return;

  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(event.request);
        if (fresh && fresh.ok && fresh.type === 'basic') {
          const cache = await caches.open(CACHE);
          await cache.put('./index.html', fresh.clone());
        }
        return fresh;
      } catch (err) {
        const cached = await caches.match('./index.html');
        if (cached) return cached;
        throw err;
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    const cached = await cache.match(event.request);
    const refresh = fetch(event.request).then((response) => {
      if (response && response.ok && response.type === 'basic') cache.put(event.request, response.clone());
      return response;
    }).catch(() => null);
    if (cached) return cached;
    const response = await refresh;
    if (response) return response;
    return new Response('', { status: 504, statusText: 'Offline' });
  })());
});
