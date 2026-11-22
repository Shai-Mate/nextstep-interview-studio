/* NextStep extract Worker.
   POST /extract { "url": "https://..." } -> { ok, text, company, role } or { ok:false, reason }.
   The page is fetched for this request only. Nothing is stored. No secrets live here.
   CORS allows only the GitHub Pages origin (ALLOWED_ORIGIN). */

import { extractJob, isBlockedUrl, isPrivateAddress } from './extract.js';

const DEFAULT_ORIGIN = 'https://shai-mate.github.io';
const MAX_BYTES = 1500000;
const MAX_REDIRECTS = 3;
const TIMEOUT_MS = 8000;
const MAX_BODY = 8000;
const MAX_PER_MINUTE = 30;

const hits = new Map();

function json(body, status) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' }
  });
}

function withCors(res, origin) {
  const headers = new Headers(res.headers);
  headers.set('access-control-allow-origin', origin);
  headers.set('access-control-allow-methods', 'POST, OPTIONS');
  headers.set('access-control-allow-headers', 'content-type');
  headers.set('vary', 'Origin');
  return new Response(res.body, { status: res.status, headers });
}

function tooMany(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60000);
  if (recent.length >= MAX_PER_MINUTE) {
    hits.set(ip, recent);
    return true;
  }
  recent.push(now);
  hits.set(ip, recent);
  if (hits.size > 4000) hits.clear();
  return false;
}

async function lookupHost(host, fetchImpl) {
  const ips = [];
  for (const type of ['A', 'AAAA']) {
    let res;
    try {
      res = await fetchImpl('https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(host) + '&type=' + type, {
        headers: { accept: 'application/dns-json' },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch {
      return null;
    }
    if (!res || !res.ok) return null;
    let data;
    try { data = await res.json(); } catch { return null; }
    const answers = data && Array.isArray(data.Answer) ? data.Answer : [];
    for (const row of answers) {
      const kind = type === 'A' ? 1 : 28;
      if (row && row.type === kind && typeof row.data === 'string') ips.push(row.data);
    }
  }
  return ips;
}

async function readLimited(res) {
  const declared = Number(res.headers.get('content-length') || 0);
  if (declared > MAX_BYTES) return { overflow: true, bytes: new Uint8Array() };
  if (!res.body || typeof res.body.getReader !== 'function') {
    const buf = new Uint8Array(await res.arrayBuffer());
    return buf.byteLength > MAX_BYTES ? { overflow: true, bytes: new Uint8Array() } : { overflow: false, bytes: buf };
  }
  const reader = res.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > MAX_BYTES) {
      try { await reader.cancel(); } catch { /* already over the cap */ }
      return { overflow: true, bytes: new Uint8Array() };
    }
    chunks.push(step.value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return { overflow: false, bytes };
}

async function fetchPage(target, fetchImpl, lookup) {
  let current = target;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const blocked = isBlockedUrl(current);
    if (blocked) return { ok: false, reason: blocked === 'invalid' ? 'invalid' : 'blocked' };
    const host = new URL(current).hostname;
    const literal = /^\d/.test(host) || host.includes(':') || host.startsWith('[');
    if (!literal) {
      const ips = await lookup(host);
      if (!ips || !ips.length || ips.some((ip) => isPrivateAddress(ip))) return { ok: false, reason: 'blocked' };
    }
    let res;
    try {
      res = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        headers: {
          accept: 'text/html,application/xhtml+xml,application/json;q=0.8,text/plain;q=0.5',
          'user-agent': 'NextStepExtract/1.0 (+https://shai-mate.github.io/nextstep-interview-studio/)'
        },
        signal: AbortSignal.timeout(TIMEOUT_MS)
      });
    } catch (err) {
      const name = err && err.name;
      return { ok: false, reason: name === 'TimeoutError' || name === 'AbortError' ? 'timeout' : 'unreachable' };
    }
    if ([301, 302, 303, 307, 308].includes(res.status)) {
      const loc = res.headers.get('location');
      if (!loc) return { ok: false, reason: 'empty' };
      try { current = new URL(loc, current).href; } catch { return { ok: false, reason: 'invalid' }; }
      continue;
    }
    if (res.status === 401 || res.status === 403) return { ok: false, reason: 'login' };
    if (!res.ok) return { ok: false, reason: 'empty' };
    const type = res.headers.get('content-type') || '';
    if (type && !/text\/html|application\/xhtml\+xml|text\/plain|application\/json/i.test(type)) return { ok: false, reason: 'empty' };
    const body = await readLimited(res);
    if (body.overflow) return { ok: false, reason: 'large' };
    if (body.bytes.includes(0)) return { ok: false, reason: 'empty' };
    const html = new TextDecoder('utf-8', { fatal: false }).decode(body.bytes);
    return extractJob(html, current);
  }
  return { ok: false, reason: 'blocked' };
}

/**
 * @param {Request} request
 * @param {{ ALLOWED_ORIGIN?: string }} env
 * @param {{ fetch?: typeof fetch, lookup?: (host: string) => Promise<string[]|null> }} [deps]
 */
export async function handle(request, env, deps) {
  const origin = (env && env.ALLOWED_ORIGIN) || DEFAULT_ORIGIN;
  const fetchImpl = (deps && deps.fetch) || fetch;
  const lookup = (deps && deps.lookup) || ((host) => lookupHost(host, fetchImpl));
  const url = new URL(request.url);
  if (url.pathname !== '/extract') return json({ ok: false, reason: 'notfound' }, 404);
  if (request.method === 'OPTIONS') return withCors(new Response(null, { status: 204 }), origin);
  if (request.method !== 'POST') return withCors(json({ ok: false, reason: 'notfound' }, 405), origin);
  if (request.headers.get('Origin') !== origin) return json({ ok: false, reason: 'forbidden' }, 403);
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  if (tooMany(ip)) return withCors(json({ ok: false, reason: 'limited' }, 429), origin);
  let payload;
  try {
    const raw = await request.text();
    if (raw.length > MAX_BODY) return withCors(json({ ok: false, reason: 'invalid' }, 400), origin);
    payload = JSON.parse(raw);
  } catch {
    return withCors(json({ ok: false, reason: 'invalid' }, 400), origin);
  }
  const target = payload && typeof payload.url === 'string' ? payload.url.trim() : '';
  if (!target || target.length > 2000) return withCors(json({ ok: false, reason: 'invalid' }, 400), origin);
  const result = await fetchPage(target, fetchImpl, lookup);
  const status = result.ok ? 200 : result.reason === 'invalid' || result.reason === 'blocked' ? 400 : 422;
  return withCors(json(result, status), origin);
}

export default {
  fetch(request, env) {
    return handle(request, env);
  }
};
