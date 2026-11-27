// node --test test/tower.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import http from 'node:http';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { createTowerServer, resolveBind, parseTailscaleIp, isTailscaleIPv4 } = require('../tower/server.js');
const course = require('../course.js');

const fix = JSON.parse(readFileSync(join(here, 'fixtures', 'courses', 'harbour-retail.json'), 'utf8'));
const retail = readFileSync(join(here, 'fixtures', 'courses', fix.adFile), 'utf8');
const SECRET = 'test-secret-value-32';
const TOKEN = 'SECRET_RESUME_TOKEN';
const MARKER = 'MARKER_AD_ONLY_ZX9';

function assemble(person) {
  return {
    requirements: person.requirements,
    course: person.lessons.map((lesson) => ({ title: lesson.title, minutes: 5, theme: null, body: lesson.body, exercise: lesson.exercise, done: false })),
    questions: person.questions.map((item) => item.q),
    questionInfo: person.questions.map((item) => ({ kind: item.kind, theme: null, source: item.source, probe: item.probe, include: item.include, useStory: item.useStory })),
    quizItems: person.quiz.map((item) => ({ ...item, options: item.options.slice() }))
  };
}
const goodCourse = assemble(fix);

function makeSpawn(write, exitCode, stderrText) {
  const state = { last: null, calls: 0 };
  const spawn = (bin, args) => {
    state.calls += 1;
    const schemaPath = args[args.indexOf('--output-schema') + 1];
    const out = args[args.indexOf('--output-last-message') + 1];
    state.last = { bin, args, schema: require('fs').readFileSync(schemaPath, 'utf8') };
    const child = new EventEmitter();
    child.stderr = new EventEmitter();
    child.stderr.resume = () => {};
    child.kill = () => { child.killed = true; state.last.killed = true; process.nextTick(() => child.emit('close', null)); };
    process.nextTick(() => {
      if (exitCode === 'hang') return;
      if (write) require('fs').writeFileSync(out, write);
      if (stderrText) child.stderr.emit('data', Buffer.from(stderrText));
      child.emit('close', exitCode || 0);
    });
    return child;
  };
  return { spawn, state };
}

function payload() {
  return {
    company: fix.company,
    role: fix.role,
    stage: fix.stage,
    interviewAt: fix.interviewAt,
    ad: retail + '\n' + MARKER,
    about: fix.about + ' ' + TOKEN,
    aboutSource: 'résumé',
    hints: { themes: ['Helping customers'], musts: ['Handle cash accurately', 'Clear criminal record check (vulnerable sector)'] }
  };
}

async function listen(opts) {
  const logs = [];
  const server = createTowerServer({ secret: SECRET, log: (line) => logs.push(line), tmpRoot: opts.tmpRoot, ...opts });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  return {
    server, logs, port,
    async call({ method = 'POST', path = '/generate', origin = 'https://shai-mate.github.io', auth = 'Bearer ' + SECRET, body, headers = {} } = {}) {
      const raw = body === undefined ? JSON.stringify(payload()) : body;
      const res = await new Promise((resolve, reject) => {
        const req = http.request({
          host: '127.0.0.1', port, path, method,
          headers: { origin, ...(auth ? { authorization: auth } : {}), 'content-type': 'application/json', ...headers }
        }, (response) => {
          const chunks = [];
          response.on('data', (chunk) => chunks.push(chunk));
          response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, text: Buffer.concat(chunks).toString('utf8') }));
        });
        req.on('error', reject);
        if (method !== 'GET' && method !== 'OPTIONS' && raw !== null) req.write(raw);
        req.end();
      });
      let json = null;
      try { json = JSON.parse(res.text); } catch { json = null; }
      return { ...res, json };
    },
    close() { return new Promise((resolve) => server.close(resolve)); }
  };
}

test('bind stays on localhost or a tailnet address', () => {
  assert.equal(resolveBind('127.0.0.1'), '127.0.0.1');
  assert.equal(resolveBind('::1'), '::1');
  assert.equal(resolveBind('100.64.0.1'), '100.64.0.1');
  assert.equal(resolveBind('100.127.255.254'), '100.127.255.254');
  assert.equal(isTailscaleIPv4('100.128.0.1'), false);
  assert.throws(() => resolveBind('0.0.0.0'));
  assert.throws(() => resolveBind('8.8.8.8'));
  assert.throws(() => resolveBind('192.168.1.9'));
  assert.equal(parseTailscaleIp('100.70.1.2\n'), '100.70.1.2');
  assert.throws(() => parseTailscaleIp('8.8.8.8'));
});

test('CORS, auth, size, and a schema-backed Codex run', async () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'nextstep-tower-'));
  const codex = makeSpawn(JSON.stringify(goodCourse));
  const app = await listen({ spawn: codex.spawn, tmpRoot, timeoutMs: 2000 });
  try {
    const health = await app.call({ method: 'GET', path: '/health', body: null, auth: '' });
    assert.equal(health.json.ok, true);

    const preflight = await app.call({ method: 'OPTIONS', body: null });
    assert.equal(preflight.status, 204);
    assert.equal(preflight.headers['access-control-allow-origin'], 'https://shai-mate.github.io');
    assert.match(preflight.headers['access-control-allow-headers'], /authorization/);

    const evil = await app.call({ origin: 'https://evil.example' });
    assert.equal(evil.status, 403);
    assert.equal(evil.headers['access-control-allow-origin'], undefined);

    const missing = await app.call({ auth: '' });
    assert.equal(missing.status, 401);
    const wrong = await app.call({ auth: 'Bearer nope-not-the-secret' });
    assert.equal(wrong.status, 401);

    const huge = await new Promise((resolve) => {
      const req = new EventEmitter();
      req.method = 'POST';
      req.url = '/generate';
      req.headers = { origin: 'https://shai-mate.github.io', authorization: 'Bearer ' + SECRET, 'content-length': '250000' };
      req.resume = () => {};
      const res = { writeHead(status) { this.status = status; }, end(text) { resolve({ status: this.status, text }); } };
      app.server.handle(req, res);
    });
    assert.equal(huge.status, 413);
    assert.equal(huge.text.includes(TOKEN), false);

    const ok = await app.call();
    assert.equal(ok.status, 200, ok.text);
    assert.equal(ok.json.ok, true);
    assert.equal(ok.json.course.course[0].title, fix.lessons[0].title);
    assert.equal(ok.text.includes(TOKEN), false);
    assert.equal(ok.text.includes(MARKER), false);
    assert.equal(JSON.stringify(app.logs).includes(TOKEN), false);
    assert.equal(JSON.stringify(app.logs).includes(MARKER), false);
    assert.equal(JSON.stringify(app.logs).includes(SECRET), false);

    const args = codex.state.last.args;
    assert.equal(args[0], 'exec');
    for (const flag of ['--ephemeral', '--skip-git-repo-check', '--sandbox', '--output-schema', '--output-last-message', '--color']) {
      assert.ok(args.includes(flag), flag);
    }
    assert.equal(args[args.indexOf('--sandbox') + 1], 'read-only');
    assert.equal(args.includes('--json'), false);
    assert.equal(args.includes('--yolo'), false);
    assert.equal(args.includes('danger-full-access'), false);
    const prompt = args[args.length - 1];
    assert.match(prompt, new RegExp(TOKEN));
    assert.match(prompt, /Harbour Cafe/);
    assert.match(prompt, /handle cash accurately/);
    assert.match(prompt, new RegExp(MARKER));
    const schema = JSON.parse(codex.state.last.schema);
    assert.equal(schema.additionalProperties, false);
    assert.deepEqual(course.schemaStrict(schema), []);
  } finally {
    await app.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a timeout, bad Codex output, and the rate limit never echo the résumé', async () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'nextstep-tower-'));
  const hangingCodex = makeSpawn(null, 'hang');
  const hanging = await listen({ spawn: hangingCodex.spawn, tmpRoot, timeoutMs: 40 });
  try {
    const timed = await hanging.call();
    assert.equal(timed.status, 504);
    assert.equal(timed.json.reason, 'timeout');
    assert.equal(timed.text.includes(TOKEN), false);
    assert.equal(hangingCodex.state.last.killed, true);
  } finally { await hanging.close(); }

  const brokenCodex = makeSpawn('not-json');
  const broken = await listen({ spawn: brokenCodex.spawn, tmpRoot, timeoutMs: 2000 });
  try {
    const bad = await broken.call();
    assert.equal(bad.status, 502);
    assert.equal(bad.json.reason, 'invalid');
    assert.equal(bad.text.includes(TOKEN), false);
    assert.equal(JSON.stringify(broken.logs).includes(TOKEN), false);
  } finally { await broken.close(); }

  const limitedCodex = makeSpawn(JSON.stringify(goodCourse));
  const limited = await listen({ maxPerMinute: 2, timeoutMs: 2000, tmpRoot, spawn: limitedCodex.spawn });
  try {
    assert.equal((await limited.call()).status, 200);
    assert.equal((await limited.call()).status, 200);
    const third = await limited.call();
    assert.equal(third.status, 429);
    assert.equal(third.json.reason, 'limited');
    assert.equal(limitedCodex.state.calls, 2);
    assert.equal(third.text.includes(TOKEN), false);
  } finally {
    await limited.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('a lapsed Codex login says login on every route, never echoes stderr, and shows on /health', async () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'nextstep-tower-'));
  const STDERR = 'ERROR: unexpected status 401 Unauthorized: token_revoked. Please log in again. STDERR_ONLY_QX7 ' + TOKEN;
  const lapsed = makeSpawn(null, 1, STDERR);
  const app = await listen({ spawn: lapsed.spawn, tmpRoot, timeoutMs: 2000, interviewTimeoutMs: 2000, maxPerMinute: 20 });
  try {
    const fresh = await app.call({ method: 'GET', path: '/health', body: null, auth: '' });
    assert.deepEqual(fresh.json, { ok: true, codex: null }, 'nothing run yet');
    for (const path of ['/generate', '/interview/turn', '/interview/debrief']) {
      const res = await app.call({ path });
      assert.equal(res.status, 502, path + ' ' + res.text);
      assert.deepEqual(res.json, { ok: false, reason: 'login' }, path);
      for (const secretish of ['STDERR_ONLY_QX7', 'token_revoked', TOKEN, MARKER]) assert.equal(res.text.includes(secretish), false, path + ' echoes ' + secretish);
    }
    const logs = JSON.stringify(app.logs);
    for (const secretish of ['STDERR_ONLY_QX7', 'token_revoked', TOKEN, MARKER, SECRET]) assert.equal(logs.includes(secretish), false, 'logs hold ' + secretish);
    const health = await app.call({ method: 'GET', path: '/health', body: null, auth: '' });
    assert.equal(health.status, 200);
    assert.deepEqual(Object.keys(health.json).sort(), ['codex', 'ok']);
    assert.deepEqual(Object.keys(health.json.codex).sort(), ['at', 'ok', 'reason']);
    assert.equal(health.json.codex.ok, false);
    assert.equal(health.json.codex.reason, 'login');
    assert.ok(!Number.isNaN(Date.parse(health.json.codex.at)));
    assert.equal(health.text.includes('STDERR_ONLY_QX7'), false);
  } finally { await app.close(); }

  const other = makeSpawn(null, 2, 'stream error: connection reset by peer');
  const broken = await listen({ spawn: other.spawn, tmpRoot, timeoutMs: 2000 });
  try {
    const res = await broken.call();
    assert.deepEqual([res.status, res.json], [502, { ok: false, reason: 'codex' }], 'any other non-zero exit stays codex');
    assert.equal((await broken.call({ method: 'GET', path: '/health', body: null, auth: '' })).json.codex.reason, 'codex');
  } finally { await broken.close(); }

  const good = makeSpawn(JSON.stringify(goodCourse));
  const healthy = await listen({ spawn: good.spawn, tmpRoot, timeoutMs: 2000 });
  try {
    assert.equal((await healthy.call()).status, 200);
    const h = await healthy.call({ method: 'GET', path: '/health', body: null, auth: '' });
    assert.equal(h.json.codex.ok, true);
    assert.equal(h.json.codex.reason, null);
  } finally {
    await healthy.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});

test('the login check reads only Codex sign-in errors, never the echoed ad', () => {
  const { failureCode } = require('../tower/codex.js');
  // Real lines from a revoked login on the tower (the account and ids replaced).
  for (const s of [
    'ERROR: unexpected status 401 Unauthorized: {"error":{"code":"token_revoked"}}',
    'ERROR: Your refresh token was revoked. Please log out and sign in again.',
    'Error: Not logged in. Run codex login.',
    'error: token_revoked'
  ]) assert.equal(failureCode('user\nSome ad text\n' + s), 'login', s);
  // The reviewer's repros: ad text echoed back by codex exec, then an unrelated error.
  const ads = [
    'Benefits: health, dental, 401(k) match.\nERROR: stream disconnected before completion: model overloaded',
    'You will log in to the POS at the start of each shift.\nERROR: rate limit reached, try again in 20s',
    'Prevent unauthorized access to the stockroom.\nERROR: context window exceeded'
  ];
  for (const s of ads) assert.equal(failureCode('user\n' + s), 'codex', s);
  // A prompt line that happens to look like an error is the ad, not Codex.
  const prompt = 'Role: cashier\nERROR: please log in again if the till locks.\nShifts: weekends';
  assert.equal(failureCode('user\n' + prompt + '\nERROR: model overloaded', prompt), 'codex');
  for (const s of ['', 'model overloaded', 'HTTP 429 too many requests', 'exit 4010', 'Please log in to the staff portal']) assert.equal(failureCode(s), 'codex', s);
});

test('the interview has its own limit of 20 a minute, and courses keep 8', async () => {
  const { MAX_PER_MINUTE, INTERVIEW_PER_MINUTE } = require('../tower/server.js');
  assert.deepEqual([MAX_PER_MINUTE, INTERVIEW_PER_MINUTE], [8, 20]);
  const tmpRoot = mkdtempSync(join(tmpdir(), 'nextstep-tower-'));
  const codex = makeSpawn(null, 1, 'ERROR: model overloaded');
  const app = await listen({ spawn: codex.spawn, tmpRoot, timeoutMs: 2000, interviewTimeoutMs: 2000 });
  try {
    for (let i = 0; i < 8; i += 1) assert.equal((await app.call({ path: '/generate' })).status, 502, 'course ' + (i + 1));
    const ninth = await app.call({ path: '/generate' });
    assert.deepEqual([ninth.status, ninth.json.reason], [429, 'limited']);
    // Spent courses do not hold up the interview.
    const paths = ['/interview/turn', '/interview/debrief'];
    for (let i = 0; i < 20; i += 1) assert.equal((await app.call({ path: paths[i % 2] })).status, 502, 'interview ' + (i + 1));
    for (const path of paths) {
      const over = await app.call({ path });
      assert.deepEqual([over.status, over.json.reason], [429, 'limited'], path);
    }
    assert.equal(codex.state.calls, 28, 'Codex ran only inside the limits');
  } finally {
    await app.close();
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
