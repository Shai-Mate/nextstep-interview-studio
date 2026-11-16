'use strict';
const offlineStatus = document.querySelector('#offline-status');

function focusedField() {
  const el = document.activeElement;
  if (!el) return null;
  if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') return el;
  return null;
}

let registration = null;
let reloadQueued = false;
let reloading = false;
const allowReload = 'serviceWorker' in navigator && !!navigator.serviceWorker.controller;
const RELOAD_FLAG = 'nextstep.sw-reload';

function tryReload() {
  if (reloading) return;
  if (sessionStorage.getItem(RELOAD_FLAG) === '1') return;
  if (focusedField()) {
    reloadQueued = true;
    return;
  }
  reloading = true;
  reloadQueued = false;
  sessionStorage.setItem(RELOAD_FLAG, '1');
  location.reload();
}

function requestReload() {
  if (!allowReload || reloading) return;
  setTimeout(tryReload, 0);
}

setTimeout(() => sessionStorage.removeItem(RELOAD_FLAG), 1500);

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('controllerchange', requestReload);
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'nextstep-update') return;
    const typing = !!focusedField();
    const reply = allowReload ? (typing ? 'defer' : 'reload') : 'ready';
    if (event.ports && event.ports[0]) event.ports[0].postMessage(reply);
    if (allowReload) requestReload();
  });
  document.addEventListener('focusout', () => {
    setTimeout(() => { if (reloadQueued) tryReload(); }, 0);
  });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    if (registration) registration.update().catch(() => {});
    if (reloadQueued) tryReload();
  });
}

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' }).then((reg) => {
    registration = reg;
    return reg.update().catch(() => reg);
  }).then(() => navigator.serviceWorker.ready).then(() => {
    offlineStatus.textContent = 'Ready for offline use · saved on this device';
  }).catch(() => {
    offlineStatus.textContent = 'Online mode · offline setup unavailable. Your preparations still save on this device.';
  });
} else if (offlineStatus) {
  offlineStatus.textContent = 'Online mode · use HTTPS in Safari or Chrome to install';
}

window.addEventListener('offline', () => { if (offlineStatus) offlineStatus.textContent = 'Offline · you can keep preparing on this device'; });
window.addEventListener('online', () => { if (offlineStatus) offlineStatus.textContent = 'Online · your preparations stay on this device'; });
