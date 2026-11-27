// node --test test/feedback.test.mjs
// Send feedback has no backend yet: the stub keeps the note on this phone and never uses the network.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(join(root, name), 'utf8');
const require = createRequire(import.meta.url);

test('feedback.js is precached and loaded at the shipped version', () => {
  const v = require('../update.js').version;
  assert.ok(read('sw.js').includes(`'./feedback.js?v=${v}'`), 'sw.js precaches feedback.js');
  assert.ok(read('index.html').includes(`<script src="feedback.js?v=${v}" defer></script>`), 'index.html loads feedback.js');
  assert.match(read('index.html'), /<div id="feedback" class="sheet-wrap" hidden>/);
});

test('the feedback stub saves the note on this phone and makes no network call', async () => {
  const items = new Map();
  const calls = [];
  const trap = (name) => (...args) => { calls.push(name); throw Error(name + ' must not be called'); };
  Object.assign(globalThis, {
    localStorage: { getItem: (k) => (items.has(k) ? items.get(k) : null), setItem: (k, v) => items.set(k, String(v)), removeItem: (k) => items.delete(k) },
    fetch: trap('fetch'), XMLHttpRequest: trap('XMLHttpRequest'), WebSocket: trap('WebSocket')
  });
  Object.defineProperty(globalThis, 'navigator', { value: { sendBeacon: trap('sendBeacon') }, configurable: true });
  const fb = require('../feedback.js');
  const res = await fb.send({ text: '  The quiz was too easy.  ', contact: 'synthetic@example.test', version: '15', screen: 'privacy' });
  assert.deepEqual(res, { ok: false, saved: true, message: "Feedback sending isn't switched on yet. Your note is saved on this phone." });
  assert.deepEqual(calls, []);
  const saved = fb.saved();
  assert.equal(saved.length, 1);
  assert.equal(saved[0].text, 'The quiz was too easy.');
  assert.equal(saved[0].contact, 'synthetic@example.test');
  assert.equal(saved[0].screen, 'privacy');
  assert.equal((await fb.send({ text: '   ' })).saved, false, 'an empty note is not saved');
  fb.clear();
  assert.deepEqual(fb.saved(), []);
  const src = read('feedback.js');
  assert.ok(!/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket\(/.test(src.replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '')), 'no network API in the code');
  assert.match(src, /TODO\(backend\): Shai to choose the endpoint/);
});

test('the old GitHub feedback links are gone and the CSP is unchanged', () => {
  for (const f of ['app.js', 'interview.js']) {
    assert.ok(!read(f).includes('issues/new'), f + ' has no GitHub issue link');
    assert.match(read(f), /data-feedback="(privacy|interview)">Send feedback<\/button>/);
  }
  assert.ok(!read('interview.js').includes('IV_FEEDBACK_URL'));
  assert.match(read('index.html'), /connect-src 'self' https:\/\/nextstep-extract\.shaimate\.workers\.dev https:\/\/\*\.ts\.net;/);
});
