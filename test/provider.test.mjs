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
  assert.match(denied.message, /general lessons/);
});
