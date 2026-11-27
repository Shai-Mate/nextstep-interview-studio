/* NextStep tower: POST /generate for one signed-in Codex CLI.
   Bind to 127.0.0.1 and publish with `tailscale serve`, or bind a Tailscale address.
   Never bind a public address. The résumé and the ad are not logged. */
'use strict';

const http = require('http');
const { isIP } = require('net');
const course = require('../course.js');
const live = require('../live.js');
const { runCodex } = require('./codex.js');

const ALLOWED_ORIGIN = 'https://shai-mate.github.io';
const MAX_BODY = 200000;
const MAX_PER_MINUTE = 8;

function isTailscaleIPv4(host) {
  if (isIP(host) !== 4) return false;
  const parts = host.split('.').map(Number);
  const value = ((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3];
  const start = (100 << 24) + (64 << 16);
  const end = (100 << 24) + (128 << 16);
  return value >= start >>> 0 && value < end >>> 0;
}

function resolveBind(host) {
  const value = String(host || '127.0.0.1').trim().replace(/^\[|\]$/g, '');
  if (value === '127.0.0.1' || value === '::1') return value;
  if (isTailscaleIPv4(value)) return value;
  throw Error('Refusing to listen on ' + value + '. Use 127.0.0.1 with tailscale serve, or a 100.64.0.0/10 tailnet address.');
}

function parseTailscaleIp(stdout) {
  const ip = String(stdout || '').trim().split(/\s+/)[0];
  if (!isTailscaleIPv4(ip)) throw Error('tailscale ip -4 did not return a tailnet address.');
  return ip;
}

function safeEqual(left, right) {
  const crypto = require('crypto');
  const a = Buffer.from(String(left));
  const b = Buffer.from(String(right));
  if (a.length !== b.length) {
    crypto.timingSafeEqual(a, a);
    return false;
  }
  return crypto.timingSafeEqual(a, b);
}

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };
    const declared = Number(req.headers['content-length'] || 0);
    if (Number.isFinite(declared) && declared > limit) {
      if (typeof req.resume === 'function') req.resume();
      done({ overflow: true, raw: '' });
      return;
    }
    const chunks = [];
    let total = 0;
    req.on('data', (chunk) => {
      total += chunk.length;
      if (total > limit) {
        done({ overflow: true, raw: '' });
        if (typeof req.destroy === 'function') req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => done({ overflow: false, raw: Buffer.concat(chunks).toString('utf8') }));
    req.on('error', (err) => { if (!settled) { settled = true; reject(err); } });
  });
}

function corsFor(origin, allowed) {
  if (origin !== allowed) return null;
  return {
    'access-control-allow-origin': allowed,
    'access-control-allow-methods': 'POST, OPTIONS',
    'access-control-allow-headers': 'content-type, authorization',
    vary: 'Origin'
  };
}

function createTowerServer(options) {
  const opts = options || {};
  const secret = String(opts.secret || '');
  const allowed = opts.allowedOrigin || ALLOWED_ORIGIN;
  const hits = opts.hits || [];
  const log = typeof opts.log === 'function' ? opts.log : () => {};
  const run = opts.runCodex || runCodex;
  // The last Codex result, in memory only: enough for /health to tell a lapsed login from a timeout.
  // ok means Codex ran and answered; a course or turn that then fails its checks is still ok here
  // (the reply to the phone says invalid), because Codex itself is working.
  let lastCodex = null;
  const remember = (ok, reason) => { lastCodex = { ok, reason: ok ? null : reason, at: new Date().toISOString() }; };
  const FAILURES = ['timeout', 'codex', 'invalid', 'login'];
  const failure = (err) => {
    const reason = err && FAILURES.includes(err.code) ? err.code : 'codex';
    remember(false, reason);
    return reason;
  };

  async function handle(req, res) {
    const started = Date.now();
    const origin = req.headers.origin || '';
    const cors = corsFor(origin, allowed);
    const send = (status, body) => {
      const headers = {
        'content-type': 'application/json; charset=utf-8',
        'cache-control': 'no-store',
        'x-content-type-options': 'nosniff'
      };
      if (cors) Object.keys(cors).forEach((key) => { headers[key] = cors[key]; });
      const raw = JSON.stringify(body);
      res.writeHead(status, headers);
      res.end(raw);
      log({ status, reason: body && body.reason ? body.reason : (body && body.ok ? 'ok' : ''), ms: Date.now() - started });
    };
    const url = new URL(req.url || '/', 'http://tower.local');
    const interviewPath = url.pathname === '/interview/turn' || url.pathname === '/interview/debrief';
    if (req.method === 'GET' && url.pathname === '/health') return send(200, { ok: true, codex: lastCodex });
    if (url.pathname !== '/generate' && !interviewPath) return send(404, { ok: false, reason: 'missing' });
    if (!cors) return send(403, { ok: false, reason: 'forbidden' });
    if (req.method === 'OPTIONS') {
      res.writeHead(204, cors);
      res.end();
      log({ status: 204, reason: 'preflight', ms: Date.now() - started });
      return;
    }
    if (req.method !== 'POST') return send(405, { ok: false, reason: 'method' });
    const header = String(req.headers.authorization || '');
    const token = header.startsWith('Bearer ') ? header.slice(7) : '';
    if (!secret || !token || !safeEqual(token, secret)) {
      if (typeof req.resume === 'function') req.resume();
      return send(401, { ok: false, reason: 'unauthorized' });
    }
    const now = Date.now();
    while (hits.length && now - hits[0] > 60000) hits.shift();
    if (hits.length >= (opts.maxPerMinute || MAX_PER_MINUTE)) {
      if (typeof req.resume === 'function') req.resume();
      return send(429, { ok: false, reason: 'limited' });
    }
    let body;
    try { body = await readBody(req, interviewPath ? (opts.interviewMaxBody || 80000) : (opts.maxBody || MAX_BODY)); }
    catch { return send(400, { ok: false, reason: 'invalid' }); }
    if (body.overflow) return send(413, { ok: false, reason: 'large' });
    let data;
    try { data = JSON.parse(body.raw || ''); }
    catch { return send(400, { ok: false, reason: 'invalid' }); }
    if (interviewPath) {
      const ad = String(data.ad || '').trim();
      if (ad.length < 40) return send(400, { ok: false, reason: 'short' });
      hits.push(now);
      const prompt = url.pathname === '/interview/debrief' ? live.buildDebriefPrompt(data) : live.buildTurnPrompt(data);
      const schema = url.pathname === '/interview/debrief' ? live.debriefSchema : live.turnSchema;
      try {
        const generated = await run({
          prompt,
          schema,
          timeoutMs: opts.interviewTimeoutMs || 40000,
          bin: opts.codexBin,
          spawn: opts.spawn,
          tmpRoot: opts.tmpRoot
        });
        remember(true);
        const checked = url.pathname === '/interview/debrief'
          ? live.validateDebrief(generated, Array.isArray(data.answers) ? data.answers.length : 0)
          : live.validateTurn(generated);
        if (!checked.ok) return send(502, { ok: false, reason: 'invalid' });
        if (url.pathname === '/interview/debrief') return send(200, { ok: true, debrief: checked.value });
        return send(200, { ok: true, turn: checked.value });
      } catch (err) {
        const reason = failure(err);
        return send(reason === 'timeout' ? 504 : 502, { ok: false, reason });
      }
    }
    const prepared = course.courseMaterials(data);
    if (prepared.ad.length < 40 || prepared.about.length < 40) return send(400, { ok: false, reason: 'short' });
    hits.push(now);
    try {
      const generated = await run({
        prompt: course.buildCoursePrompt(prepared),
        schema: course.courseSchema,
        timeoutMs: opts.timeoutMs || 90000,
        bin: opts.codexBin,
        spawn: opts.spawn,
        tmpRoot: opts.tmpRoot
      });
      remember(true);
      const checked = course.validateCourse(generated, {
        ad: prepared.ad,
        about: prepared.about,
        company: prepared.company,
        role: prepared.role
      });
      if (!checked.ok) return send(502, { ok: false, reason: 'invalid' });
      return send(200, { ok: true, course: checked.value });
    } catch (err) {
      const reason = failure(err);
      return send(reason === 'timeout' ? 504 : 502, { ok: false, reason });
    }
  }

  const server = http.createServer((req, res) => {
    handle(req, res).catch(() => {
      if (!res.headersSent) {
        res.writeHead(500, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
        res.end(JSON.stringify({ ok: false, reason: 'codex' }));
      }
    });
  });
  server.handle = handle;
  return server;
}

function main() {
  const secret = process.env.NEXTSTEP_TOWER_SECRET || '';
  if (secret.length < 16) {
    console.error('Set NEXTSTEP_TOWER_SECRET to a random string of at least 16 characters.');
    process.exit(1);
  }
  let host = process.env.HOST || '127.0.0.1';
  if (host === 'tailscale') {
    const { execFileSync } = require('child_process');
    host = parseTailscaleIp(execFileSync('tailscale', ['ip', '-4'], { encoding: 'utf8', timeout: 5000 }));
  }
  try { host = resolveBind(host); }
  catch (err) {
    console.error(err.message);
    process.exit(1);
  }
  const port = Number(process.env.PORT || 8787);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('PORT must be a number from 1 to 65535.');
    process.exit(1);
  }
  const server = createTowerServer({ secret });
  server.listen(port, host, () => {
    console.log('NextStep tower listening on http://' + host + ':' + port + '/');
  });
}

module.exports = { createTowerServer, resolveBind, parseTailscaleIp, isTailscaleIPv4, ALLOWED_ORIGIN, MAX_BODY };

if (require.main === module) main();
