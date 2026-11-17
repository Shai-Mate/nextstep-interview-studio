'use strict';
/* Offline setup and install help.
   Registers the service worker (it only caches this app's own files) and tailors the #install sheet to the device:
   iPhone Safari, other iPhone browsers, in-app browsers (Instagram, Facebook, LinkedIn, Messenger...), Android, computer.
   On browsers that offer it (Android Chrome, desktop Chrome/Edge) the sheet shows a real "Install app" button.
   Exposes window.NextStepInstall = { canPrompt(), prompt(), platform, installed } for the rest of the app,
   and fires a 'nextstep-install-change' event on window whenever canPrompt() or installed may have changed.
   No network calls, no tracking. */
(function () {
  const byId = (id) => document.getElementById(id);
  const sheet = byId('install');
  const offlineStatus = byId('offline-status');
  const say = (text) => { if (offlineStatus) offlineStatus.textContent = text; };

  if ('serviceWorker' in navigator && window.isSecureContext) {
    navigator.serviceWorker.register('./sw.js', { scope: './', updateViaCache: 'none' })
      .then(() => navigator.serviceWorker.ready)
      .then(() => say('Ready to work offline · everything stays on this device'))
      .catch(() => say('Offline setup is not available here, but your work still saves on this device.'));
  } else say('Online only here · open the https link in Safari or Chrome to install');
  window.addEventListener('offline', () => say("You're offline · you can keep practising on this device"));
  window.addEventListener('online', () => say('Back online · your work stays on this device'));

  const ua = navigator.userAgent || '';
  const iOS = /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  // In-app browsers cannot add to the Home Screen and may not keep storage. "; wv)" marks any Android WebView.
  const inApp = /FBAN|FBAV|FB_IAB|FBIOS|Instagram|LinkedInApp|Messenger|Snapchat|musical_ly|BytedanceWebview|Pinterest|MicroMessenger|\bLine\/|GSA\/|Barcelona|; wv\)/.test(ua);
  const otherIOSBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|YaBrowser|DuckDuckGo|Ddg\//.test(ua);
  const platform = inApp ? 'in-app' : iOS ? (otherIOSBrowser ? 'ios-browser' : 'ios-safari') : android ? 'android' : 'desktop';

  const matches = (query) => !!(window.matchMedia && window.matchMedia(query).matches);
  const standalone = () => navigator.standalone === true || matches('(display-mode: standalone)');
  // <html class="is-installed"> lets CSS hide install nudges in the installed app. navigator.standalone covers iOS, where
  // the Home Screen app can report display-mode: fullscreen instead of standalone (iOS 17, WebKit bug 264218).
  const markInstalled = () => { document.documentElement.classList.toggle('is-installed', standalone()); };
  markInstalled();
  let added = false; // the browser reported a finished install in this tab
  let deferred = null; // the saved beforeinstallprompt event, usable once

  const state = () => (standalone() ? 'installed' : added ? 'added' : platform);
  const canPrompt = () => !!deferred && !standalone() && !added;
  const changed = () => {
    markInstalled();
    render();
    window.dispatchEvent(new Event('nextstep-install-change'));
  };

  async function prompt() {
    const event = deferred;
    if (!event || !canPrompt()) return 'unavailable';
    deferred = null;
    changed();
    try {
      await event.prompt();
      const choice = await event.userChoice;
      if (choice && choice.outcome === 'accepted') {
        added = true;
        changed();
        return 'accepted';
      }
      return 'dismissed';
    } catch {
      return 'unavailable';
    }
  }

  window.NextStepInstall = Object.freeze({
    platform,
    get installed() { return standalone() || added; },
    canPrompt,
    prompt
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault(); // offer it calmly from the install sheet instead of a surprise banner
    deferred = event;
    changed();
  });
  window.addEventListener('appinstalled', () => {
    added = true;
    deferred = null;
    changed();
  });

  if (!sheet) return;
  const title = byId('install-title');
  const lede = byId('install-lede');
  const installNow = byId('install-now');
  const done = byId('install-done');
  const urlText = byId('install-url');
  const copyButton = byId('install-copy');
  const copyLabel = byId('install-copy-label');
  const titles = {
    'in-app': iOS ? 'Open this page in Safari first' : 'Open this page in your browser first',
    desktop: 'Install NextStep',
    installed: "You're using the app",
    added: 'NextStep is installed'
  };
  const appUrl = location.origin + location.pathname.replace(/index\.html$/, '');
  const browserName = iOS ? 'Safari' : android ? 'Chrome' : 'your browser';
  if (urlText) urlText.textContent = appUrl;
  sheet.querySelectorAll('[data-browser]').forEach((el) => { el.textContent = browserName; });

  function render() {
    if (!sheet) return;
    const now = state();
    sheet.querySelectorAll('[data-install-for]').forEach((el) => { el.hidden = !el.dataset.installFor.split(' ').includes(now); });
    if (title) title.textContent = titles[now] || 'Put NextStep on your Home Screen';
    if (lede) lede.hidden = now === 'in-app' || now === 'installed' || now === 'added';
    const offer = canPrompt();
    if (installNow) installNow.hidden = !offer;
    if (done) {
      done.className = offer ? 'text-btn' : 'primary';
      done.textContent = offer ? 'Not now' : 'Done';
    }
  }

  if (installNow) installNow.addEventListener('click', () => { prompt(); });
  if (copyButton && copyLabel && urlText) {
    copyButton.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(appUrl);
        copyLabel.textContent = 'Link copied. Paste it into ' + browserName + '.';
      } catch {
        urlText.hidden = false;
        const range = document.createRange();
        range.selectNodeContents(urlText);
        const selection = window.getSelection();
        if (selection) { selection.removeAllRanges(); selection.addRange(range); }
        copyLabel.textContent = 'Press and hold the link below to copy it';
      }
    });
  }

  // Focus moves into the sheet when it opens and back to where it was when it closes; Escape closes it.
  // While it is open the app behind it is inert, so Tab and screen readers stay in the sheet (#install is not inside #app).
  const appRoot = byId('app');
  let opener = null;
  if (window.MutationObserver) {
    new MutationObserver(() => {
      if (!sheet.hidden) {
        render();
        opener = document.activeElement;
        if (appRoot) appRoot.inert = true;
        if (title) title.focus({ preventScroll: true });
      } else {
        if (appRoot) appRoot.inert = false;
        if (opener && opener.isConnected && typeof opener.focus === 'function') opener.focus({ preventScroll: true });
        opener = null;
      }
    }).observe(sheet, { attributes: true, attributeFilter: ['hidden'] });
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !sheet.hidden) sheet.hidden = true;
  });
  if (window.matchMedia) {
    const mode = window.matchMedia('(display-mode: standalone)');
    if (mode.addEventListener) mode.addEventListener('change', changed);
  }
  render();
})();
