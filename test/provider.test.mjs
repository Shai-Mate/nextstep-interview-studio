// node --test test/provider.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
require('../course.js');
const provider = require('../provider.js');

test('only a Tailscale https address, or an origin this copy allows, can be the tower', () => {
  const ok = provider.allowedTowerUrl('https://omarchy.tailnet.ts.net');
  assert.equal(ok, 'https://omarchy.tailnet.ts.net');
  assert.equal(provider.allowedTowerUrl('https://omarchy.tailnet.ts.net/generate'), 'https://omarchy.tailnet.ts.net/generate');
  assert.equal(provider.allowedTowerUrl('https://omarchy.tailnet.ts.net/secret'), '');
  assert.equal(provider.allowedTowerUrl('http://omarchy.tailnet.ts.net'), '');
  assert.equal(provider.allowedTowerUrl('https://user:pass@omarchy.tailnet.ts.net'), '');
  assert.equal(provider.allowedTowerUrl('https://evil.example'), '');
  assert.equal(provider.allowedTowerUrl('https://evil.ts.net.attacker.com'), '');
  assert.equal(provider.allowedTowerUrl('https://100.64.1.2'), '');
  assert.equal(provider.allowedTowerUrl('https://nextstep.example.com', ['https://nextstep.example.com']), 'https://nextstep.example.com');
});

test('a pasted tower note splits into the address and the secret', () => {
  const url = 'https://omarchy.tailnet.ts.net';
  const secret = 'a1b2c3d4e5f6789012345678abcdef90';
  assert.deepEqual(provider.splitTowerPaste(url + '\n' + secret), { url, secret });
  assert.deepEqual(provider.splitTowerPaste(secret + '\r\n' + url + '\n'), { url, secret });
  assert.deepEqual(provider.splitTowerPaste('Address: ' + url + '\nSecret: ' + secret), { url, secret });
  assert.deepEqual(provider.splitTowerPaste(url + '\nNEXTSTEP_TOWER_SECRET=' + secret + '\nHOST=127.0.0.1\nPORT=8787'), { url, secret });
  assert.deepEqual(provider.splitTowerPaste(url + '/generate ' + secret), { url, secret });
  assert.deepEqual(provider.splitTowerPaste('not a tower note\nstill not one'), { url: '', secret: '' });
  assert.equal(provider.splitTowerPaste('').url, '');
  const only = provider.splitTowerPaste('NEXTSTEP_TOWER_SECRET=' + secret);
  assert.equal(only.secret, secret);
  assert.equal(only.url, '');
});

test('the secret stays out of prefs that can be exported, and out of the generate body', () => {
  const prefs = { provider: 'subscription', towerUrl: 'https://omarchy.tailnet.ts.net', towerSecret: 'super-secret-value', readAloud: true, aboutYou: { source: 'resume', label: 'résumé', text: 'I was a barista at Harbour Cafe for three years and I trained two hires.' } };
  const pub = provider.publicPrefs(prefs);
  assert.equal(pub.towerSecretSet, true);
  assert.equal(JSON.stringify(pub).includes('super-secret-value'), false);
  assert.equal(provider.providerReady(prefs), true);
  assert.equal(provider.providerReady({ provider: 'none' }), false);
  assert.equal(provider.providerReady({ provider: 'byok', apiKey: 'sk-test' }), false);
  const body = provider.requestBody({ company: 'Maple & Thread', role: 'Store associate', job: 'x'.repeat(50), aboutYou: prefs.aboutYou, towerSecret: prefs.towerSecret });
  assert.equal(JSON.stringify(body).includes('super-secret-value'), false);
  assert.equal(Object.keys(body).sort().join(), 'about,aboutSource,ad,company,hints,interviewAt,role,stage');
  assert.match(body.about, /Harbour Cafe/);
});

test('an unconfigured phone does not call the network, and a tower call sends the bearer only in the header', async () => {
  const skipped = await provider.requestCourse({ provider: 'none' }, { job: 'hello' }, { fetch: () => { throw Error('called'); } });
  assert.equal(skipped.attempted, false);
  assert.equal(skipped.reason, 'unconfigured');
  const later = await provider.requestCourse({ provider: 'openrouter' }, {}, { fetch: () => { throw Error('called'); } });
  assert.equal(later.reason, 'later');
  let seen;
  const fetchImpl = async (url, opts) => {
    seen = { url, opts };
    return { ok: true, status: 200, json: async () => ({ ok: true, course: { requirements: ['a'] } }) };
  };
  const prefs = { provider: 'subscription', towerUrl: 'https://omarchy.tailnet.ts.net/', towerSecret: 'super-secret-value' };
  const result = await provider.requestCourse(prefs, {
    company: 'Maple & Thread',
    role: 'Store associate',
    job: 'Greet customers and handle cash accurately on the shop floor each day.',
    aboutYou: { source: 'resume', text: 'I was a barista at Harbour Cafe for three years and I trained two hires.' }
  }, { fetch: fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(seen.url, 'https://omarchy.tailnet.ts.net/generate');
  assert.equal(seen.opts.headers.authorization, 'Bearer super-secret-value');
  assert.equal(seen.opts.body.includes('super-secret-value'), false);
  assert.equal(seen.opts.credentials, 'omit');
  const denied = await provider.requestCourse(prefs, { job: 'x', aboutYou: { text: 'y' } }, {
    fetch: async () => ({ ok: false, status: 401, json: async () => ({ ok: false, reason: 'unauthorized' }) })
  });
  assert.equal(denied.attempted, true);
  assert.equal(denied.reason, 'unauthorized');
  assert.equal(denied.message, 'The tower did not accept the secret in Settings.');
});

test('the tower naming a lapsed Codex login, or a Codex failure, reaches the owner in plain words', async () => {
  const prefs = { provider: 'subscription', towerUrl: 'https://omarchy.tailnet.ts.net/', towerSecret: 'super-secret-value' };
  const replying = (status, body) => ({ fetch: async () => ({ ok: false, status, json: async () => body }) });
  const input = { job: 'Greet customers and handle cash accurately on the shop floor each day.', aboutYou: { text: 'I was a barista at Harbour Cafe for three years.' } };
  const login = await provider.requestCourse(prefs, input, replying(502, { ok: false, reason: 'login' }));
  assert.deepEqual([login.reason, login.message], ['login', 'Codex on your tower needs signing in again. On the tower, run codex login, then try again.']);
  const codex = await provider.requestCourse(prefs, input, replying(502, { ok: false, reason: 'codex' }));
  assert.deepEqual([codex.reason, codex.message], ['codex', 'The tower could not write the course this time.']);
  const slow = await provider.requestCourse(prefs, input, replying(504, { ok: false, reason: 'timeout' }));
  assert.equal(slow.reason, 'timeout');
  const odd = await provider.requestCourse(prefs, input, replying(502, { ok: false, reason: 'something-new' }));
  assert.equal(odd.reason, 'invalid', 'an unknown reason is still treated as invalid');
  for (const path of ['/interview/turn', '/interview/debrief']) {
    const res = await provider.requestInterview(prefs, path, { ad: input.job }, replying(502, { ok: false, reason: 'login' }));
    assert.equal(res.reason, 'login', path);
  }
  for (const msg of [login.message, codex.message]) assert.equal(msg.includes('\u2014'), false);
});

test('a tower 504 is a timeout, and an offline phone does not try the tower at all', async () => {
  const prefs = { provider: 'subscription', towerUrl: 'https://omarchy.tailnet.ts.net/', towerSecret: 'super-secret-value' };
  const input = { job: 'Greet customers and handle cash accurately on the shop floor each day.', aboutYou: { text: 'I was a barista at Harbour Cafe for three years.' } };
  const bare = await provider.requestCourse(prefs, input, { fetch: async () => ({ ok: false, status: 504, json: async () => { throw Error('no body'); } }) });
  assert.deepEqual([bare.reason, bare.message], ['timeout', 'The personal course took too long.']);
  let called = 0;
  const off = await provider.requestCourse(prefs, input, { navigator: { onLine: false }, fetch: async () => { called += 1; throw Error('no network'); } });
  assert.equal(called, 0);
  assert.deepEqual([off.reason, off.attempted, off.message], ['offline', true, "You're offline. Try again when you have a connection, or use the general lessons now."]);
  const on = await provider.requestCourse(prefs, input, { navigator: { onLine: true }, fetch: async () => ({ ok: true, status: 200, json: async () => ({ ok: true, course: { requirements: ['a'] } }) }) });
  assert.equal(on.ok, true);
});

test('a backup carries the personal course setup but never the secret, and restore fills only empty settings', async () => {
  const { readFileSync } = await import('node:fs');
  const SECRET = 'super-secret-value-never-exported';
  const prefs = {
    provider: 'subscription',
    towerUrl: 'https://omarchy.tailnet.ts.net/',
    towerSecret: SECRET,
    aboutYou: { source: 'resume', label: 'résumé', text: 'I was a barista at Harbour Cafe for three years.' }
  };
  // The export is built exactly as app.js builds it: the preparations plus publicPrefs(corePrefs()).
  const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
  assert.match(app, /payload\.prefs = NextStepProvider\.publicPrefs\(corePrefs\(\)\)/);
  assert.doesNotMatch(app.slice(app.indexOf('function coreBackupPayload'), app.indexOf('function exportBackup')), /towerSecret/);
  const exported = JSON.stringify({ schema: 1, preparations: [{ id: 'p1', notes: {} }], prefs: provider.publicPrefs(prefs) }, null, 2);
  assert.equal(exported.includes(SECRET), false, 'the secret is never in an export');
  assert.equal(exported.includes('towerSecret"'), false);
  const saved = JSON.parse(exported).prefs;
  assert.deepEqual([saved.provider, saved.towerUrl, saved.aboutYou.text], ['subscription', 'https://omarchy.tailnet.ts.net/', prefs.aboutYou.text]);

  // An empty phone gets the setup, but no secret.
  const fresh = provider.restorePrefs({}, saved);
  assert.equal(fresh.changed, true);
  assert.equal(fresh.prefs.provider, 'subscription');
  assert.equal(fresh.prefs.towerUrl, 'https://omarchy.tailnet.ts.net/');
  assert.equal(fresh.prefs.aboutYou.text, prefs.aboutYou.text);
  assert.equal('towerSecret' in fresh.prefs, false);
  // A phone that already has settings keeps every one of them, including its secret.
  const mine = { provider: 'subscription', towerUrl: 'https://other.tailnet.ts.net/', towerSecret: 'mine-only', aboutYou: { text: 'My own words.' }, readAloud: true };
  const kept = provider.restorePrefs(mine, { ...saved, provider: 'byok', towerSecret: 'from-the-file' });
  assert.equal(kept.changed, false);
  assert.deepEqual(kept.prefs, mine);
  // A backup's secret field, or a tower address that is not allowed, is never applied.
  const odd = provider.restorePrefs({}, { towerSecret: 'from-the-file', towerUrl: 'https://evil.example.com/' });
  assert.equal(odd.changed, false);
  assert.deepEqual(odd.prefs, {});
});
