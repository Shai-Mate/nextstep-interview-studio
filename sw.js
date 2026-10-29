'use strict';
const CACHE='nextstep-phone-v2';
const ASSETS=['./index.html','./styles.css?v=2','./engine.js?v=2','./app.js?v=2','./pwa.js?v=2','./manifest.webmanifest?v=2','./icon-192.png?v=2','./icon-512.png?v=2','./apple-touch-icon.png?v=2'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('nextstep-phone-')&&key!==CACHE).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);
 if(event.request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL('./',self.location).pathname))return;
 if(event.request.mode==='navigate'){
  event.respondWith(caches.match('./index.html').then(cached=>cached||fetch(event.request)));return;
 }
 event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request)));
});
