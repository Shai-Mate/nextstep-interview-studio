/* When to take a waiting service worker and reload the open page.
   Installed phones keep the old scripts until the new worker activates and the page reloads.
   Classic script. No network. */
(function (root) {
  'use strict';

  const version = '16';

  /* hadController: a worker was already running this page when it opened (an update, not the first install).
     event: 'installed' (a new worker is waiting) or 'controllerchange' (a new worker took over).
     reloadCount: how many automatic reloads this visit has already done. One is enough. */
  function decide(input) {
    const state = input || {};
    if (state.alreadyReloading || (state.reloadCount || 0) >= 1) return { skipWaiting: false, reload: false };
    if (!state.hadController) return { skipWaiting: false, reload: false };
    if (state.event === 'installed' || state.event === 'waiting') return { skipWaiting: true, reload: false };
    if (state.event === 'controllerchange') return { skipWaiting: false, reload: true };
    return { skipWaiting: false, reload: false };
  }

  function shouldCheck(reason) {
    return reason === 'open' || reason === 'visible';
  }

  const api = { version, decide, shouldCheck };
  root.NextStepUpdate = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
