/* Course providers. This slice ships "My subscription" (the tower running Codex).
   "Your own API key" and "OpenRouter" are slots only: they are not called yet.
   Keys and the tower secret stay in phone prefs. This file does not store them. */
(function (root) {
  'use strict';

  const SLOTS = [
    { id: 'none', label: 'On this phone', detail: 'General lessons from the ad. Nothing about you is sent.', available: true },
    { id: 'subscription', label: 'My subscription', detail: 'Lessons written for you, using Codex on your tower.', available: true },
    { id: 'byok', label: 'Your own API key', detail: 'Not turned on yet.', available: false },
    { id: 'openrouter', label: 'OpenRouter', detail: 'Not turned on yet.', available: false }
  ];
  const MESSAGES = {
    unconfigured: '',
    later: '',
    cancelled: '',
    timeout: 'The personal course took too long, so these are the general lessons.',
    unreachable: 'The personal course could not be reached, so these are the general lessons.',
    unauthorized: 'The tower did not accept the secret in Settings, so these are the general lessons.',
    large: 'The ad and your background were too long to send, so these are the general lessons.',
    limited: 'The tower is busy, so these are the general lessons.',
    invalid: 'The personal course did not come back in a usable shape, so these are the general lessons.',
    forbidden: 'That tower address is not allowed, so these are the general lessons.'
  };

  function extraFromWindow() {
    try {
      const raw = root.NEXTSTEP_TOWER_ORIGINS;
      return typeof raw === 'string' ? raw.split(/[\s,]+/).filter(Boolean) : [];
    } catch { return []; }
  }

  function allowedTowerUrl(value, extraOrigins) {
    const raw = String(value || '').trim();
    if (!raw) return '';
    let url;
    try { url = new URL(raw); } catch { return ''; }
    if (url.protocol !== 'https:') return '';
    if (url.username || url.password) return '';
    if (url.search || url.hash) return '';
    const host = url.hostname.toLowerCase();
    const tailscale = host.endsWith('.ts.net') && host.split('.').length >= 3;
    const extra = (Array.isArray(extraOrigins) ? extraOrigins : extraFromWindow()).some((item) => {
      try { return new URL(item).origin === url.origin; } catch { return false; }
    });
    if (!tailscale && !extra) return '';
    const path = url.pathname.replace(/\/+$/, '');
    if (path && path !== '/generate') return '';
    return url.origin + (path === '/generate' ? '/generate' : '');
  }

  function readSettings(prefs) {
    const p = prefs && typeof prefs === 'object' && !Array.isArray(prefs) ? prefs : {};
    const provider = SLOTS.some((slot) => slot.id === p.provider) ? p.provider : 'none';
    return {
      provider,
      towerUrl: typeof p.towerUrl === 'string' ? p.towerUrl.trim() : '',
      towerSecretSet: typeof p.towerSecret === 'string' && p.towerSecret.length > 0
    };
  }

  /* What a backup of prefs may contain. The secret itself never leaves this function. */
  function publicPrefs(prefs) {
    const settings = readSettings(prefs);
    const about = prefs && prefs.aboutYou && typeof prefs.aboutYou === 'object' ? prefs.aboutYou : null;
    return {
      provider: settings.provider,
      towerUrl: settings.towerUrl,
      towerSecretSet: settings.towerSecretSet,
      aboutYou: about && typeof about.text === 'string' ? { source: about.source || '', label: about.label || '', text: about.text } : null
    };
  }

  function providerReady(prefs, extraOrigins) {
    const settings = readSettings(prefs);
    if (settings.provider !== 'subscription') return false;
    return !!(allowedTowerUrl(settings.towerUrl, extraOrigins) && prefs && prefs.towerSecret);
  }

  function endpointFor(prefs, extraOrigins) {
    const base = allowedTowerUrl(prefs && prefs.towerUrl, extraOrigins);
    if (!base) return '';
    return base.endsWith('/generate') ? base : base + '/generate';
  }

  function requestBody(input) {
    const course = root.NextStepCourse;
    const materials = course && typeof course.courseMaterials === 'function' ? course.courseMaterials(input) : {};
    return {
      company: materials.company || '',
      role: materials.role || '',
      stage: materials.stage || 'Not sure yet',
      interviewAt: materials.interviewAt || '',
      ad: materials.ad || '',
      about: materials.about || '',
      aboutSource: materials.aboutSource || '',
      hints: materials.hints || { themes: [], musts: [] }
    };
  }

  function failure(reason, attempted) {
    return { ok: false, attempted: !!attempted, reason, message: MESSAGES[reason] || MESSAGES.invalid };
  }

  async function requestCourse(prefs, input, opts) {
    opts = opts || {};
    const extra = opts.extraOrigins;
    if (!providerReady(prefs, extra)) {
      const id = readSettings(prefs).provider;
      return failure(id === 'byok' || id === 'openrouter' ? 'later' : 'unconfigured', false);
    }
    const endpoint = endpointFor(prefs, extra);
    if (!endpoint) return failure('forbidden', true);
    const fetchImpl = opts.fetch || root.fetch;
    if (typeof fetchImpl !== 'function') return failure('unreachable', true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || 100000);
    const onAbort = () => ctrl.abort();
    if (opts.signal) {
      if (opts.signal.aborted) ctrl.abort();
      else opts.signal.addEventListener('abort', onAbort);
    }
    try {
      const res = await fetchImpl(endpoint, {
        method: 'POST',
        mode: 'cors',
        credentials: 'omit',
        cache: 'no-store',
        headers: { 'content-type': 'application/json', authorization: 'Bearer ' + prefs.towerSecret },
        body: JSON.stringify(requestBody(input)),
        signal: ctrl.signal
      });
      if (res.status === 401) return failure('unauthorized', true);
      if (res.status === 413) return failure('large', true);
      if (res.status === 429) return failure('limited', true);
      let data = null;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok || !data || data.ok === false || !data.course || typeof data.course !== 'object') return failure('invalid', true);
      return { ok: true, attempted: true, reason: '', message: '', course: data.course };
    } catch (err) {
      if (err && err.name === 'AbortError') return failure(opts.signal && opts.signal.aborted ? 'cancelled' : 'timeout', true);
      return failure('unreachable', true);
    } finally {
      clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
    }
  }

  const api = { SLOTS, allowedTowerUrl, readSettings, publicPrefs, providerReady, endpointFor, requestBody, requestCourse };
  root.NextStepProvider = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
