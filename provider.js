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
    /* Shown on the writing screen above Try again and Use general lessons, so they say only what went
       wrong. Only the owner sees them: only the owner has a tower set up. */
    timeout: 'The personal course took too long.',
    unreachable: 'The tower could not be reached.',
    offline: "You're offline. Try again when you have a connection, or use the general lessons now.",
    unauthorized: 'The tower did not accept the secret in Settings.',
    large: 'The ad and your background are too long to send.',
    limited: 'The tower is busy right now.',
    invalid: 'The personal course did not come back in a usable shape.',
    forbidden: 'That tower address is not allowed.',
    login: 'Codex on your tower needs signing in again. On the tower, run codex login, then try again.',
    codex: 'The tower could not write the course this time.'
  };
  const offline = (opts) => {
    const nav = opts && opts.navigator !== undefined ? opts.navigator : root.navigator;
    return !!nav && nav.onLine === false;
  };
  // Reasons the tower itself names in a failed reply; anything else is treated as "invalid".
  const TOWER_REASONS = ['login', 'codex', 'timeout'];
  const towerReason = (data) => (data && data.ok === false && TOWER_REASONS.includes(data.reason) ? data.reason : '');

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

  function stripGenerate(url) {
    return String(url || '').replace(/\/generate$/, '');
  }

  /* One paste can hold both lines from the tower note: the https address and the secret, in either order.
     Labels such as "Secret:" or NEXTSTEP_TOWER_SECRET= are accepted. Other env lines are ignored. */
  function splitTowerPaste(text, extraOrigins) {
    const raw = String(text || '').replace(/\u0000/g, '').replace(/^\uFEFF/, '').trim();
    if (!raw) return { url: '', secret: '' };
    const lines = raw.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    let url = '';
    let secret = '';
    const leftovers = [];
    const takeUrl = (value) => {
      const allowed = allowedTowerUrl(String(value || '').replace(/^['"]|['"]$/g, '').replace(/[),.;]+$/, ''), extraOrigins);
      if (!allowed || url) return false;
      url = stripGenerate(allowed);
      return true;
    };
    for (const line of lines) {
      const labeled = line.match(/^(?:export\s+)?([A-Za-z][A-Za-z0-9_]*)\s*[:=]\s*(.*)$/);
      if (labeled) {
        const key = labeled[1].toLowerCase();
        const value = labeled[2].trim().replace(/^['"]|['"]$/g, '');
        if (/secret|token|password/.test(key)) {
          if (value && !secret) secret = value;
          continue;
        }
        if (/url|address|host|tower|endpoint/.test(key)) {
          takeUrl(value);
          continue;
        }
        if (labeled[1] === labeled[1].toUpperCase()) continue;
      }
      if (takeUrl(line)) continue;
      const bits = line.split(/\s+/);
      const rest = [];
      let foundUrl = false;
      for (const bit of bits) {
        if (takeUrl(bit)) foundUrl = true;
        else rest.push(bit);
      }
      if (foundUrl) {
        if (!secret && rest.length === 1) secret = rest[0].replace(/^['"]|['"]$/g, '');
        continue;
      }
      leftovers.push(line.replace(/^['"]|['"]$/g, ''));
    }
    if (!secret) {
      const plain = leftovers.filter((line) => line && !/^https?:/i.test(line));
      if (plain.length === 1) secret = plain[0];
      else {
        const token = plain.find((line) => !/\s/.test(line) && line.length >= 8);
        if (token) secret = token;
      }
    }
    return { url, secret };
  }

  function towerOrigin(prefs, extraOrigins) {
    const base = allowedTowerUrl(prefs && prefs.towerUrl, extraOrigins);
    if (!base) return '';
    return base.replace(/\/generate$/, '');
  }

  function endpointFor(prefs, extraOrigins) {
    const origin = towerOrigin(prefs, extraOrigins);
    return origin ? origin + '/generate' : '';
  }

  function interviewUrl(prefs, path, extraOrigins) {
    const origin = towerOrigin(prefs, extraOrigins);
    if (!origin) return '';
    if (path !== '/interview/turn' && path !== '/interview/debrief') return '';
    return origin + path;
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
    if (offline(opts)) return failure('offline', true);
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
      if (res.status === 504) return failure('timeout', true);
      let data = null;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok && towerReason(data)) return failure(towerReason(data), true);
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

  async function requestInterview(prefs, path, body, opts) {
    opts = opts || {};
    const extra = opts.extraOrigins;
    if (!providerReady(prefs, extra)) return failure('unconfigured', false);
    const endpoint = interviewUrl(prefs, path, extra);
    if (!endpoint) return failure('forbidden', true);
    if (offline(opts)) return failure('offline', true);
    const fetchImpl = opts.fetch || root.fetch;
    if (typeof fetchImpl !== 'function') return failure('unreachable', true);
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs || (path === '/interview/debrief' ? 70000 : 50000));
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
        body: JSON.stringify(body || {}),
        signal: ctrl.signal
      });
      if (res.status === 401) return failure('unauthorized', true);
      if (res.status === 413) return failure('large', true);
      if (res.status === 429) return failure('limited', true);
      if (res.status === 504) return failure('timeout', true);
      let data = null;
      try { data = await res.json(); } catch { data = null; }
      if (!res.ok && towerReason(data)) return failure(towerReason(data), true);
      if (!res.ok || !data || data.ok === false) return failure('invalid', true);
      if (path === '/interview/debrief') {
        if (!data.debrief) return failure('invalid', true);
        return { ok: true, attempted: true, reason: '', message: '', debrief: data.debrief };
      }
      if (!data.turn) return failure('invalid', true);
      return { ok: true, attempted: true, reason: '', message: '', turn: data.turn };
    } catch (err) {
      if (err && err.name === 'AbortError') return failure(opts.signal && opts.signal.aborted ? 'cancelled' : 'timeout', true);
      return failure('unreachable', true);
    } finally {
      clearTimeout(timer);
      if (opts.signal) opts.signal.removeEventListener('abort', onAbort);
    }
  }

  const api = { SLOTS, allowedTowerUrl, readSettings, publicPrefs, providerReady, splitTowerPaste, endpointFor, interviewUrl, requestBody, requestCourse, requestInterview };
  root.NextStepProvider = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
