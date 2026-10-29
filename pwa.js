'use strict';
const offlineStatus=document.querySelector('#offline-status');
if('serviceWorker' in navigator&&window.isSecureContext){
 navigator.serviceWorker.register('./sw.js',{scope:'./',updateViaCache:'none'}).then(()=>navigator.serviceWorker.ready).then(()=>{offlineStatus.textContent='Ready for offline use · saved on this device';}).catch(()=>{offlineStatus.textContent='Online mode · offline setup unavailable. Your preparations still save on this device.';});
}else offlineStatus.textContent='Online mode · use HTTPS in Safari or Chrome to install';
window.addEventListener('offline',()=>{offlineStatus.textContent='Offline · you can keep preparing on this device';});
window.addEventListener('online',()=>{offlineStatus.textContent='Online · your preparations stay on this device';});
