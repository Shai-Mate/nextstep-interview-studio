// node --test test/update.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = join(here, '..');
const require = createRequire(import.meta.url);
const update = require('../update.js');
const read = (name) => readFileSync(join(root, name), 'utf8');

test('a waiting update activates once, and the first install does not reload', () => {
  assert.deepEqual(update.decide({ hadController: false, event: 'installed' }), { skipWaiting: false, reload: false });
  assert.deepEqual(update.decide({ hadController: false, event: 'controllerchange' }), { skipWaiting: false, reload: false });
  assert.deepEqual(update.decide({ hadController: true, event: 'installed' }), { skipWaiting: true, reload: false });
  assert.deepEqual(update.decide({ hadController: true, event: 'waiting' }), { skipWaiting: true, reload: false });
  assert.deepEqual(update.decide({ hadController: true, event: 'controllerchange' }), { skipWaiting: false, reload: true });
  assert.deepEqual(update.decide({ hadController: true, event: 'controllerchange', alreadyReloading: true }), { skipWaiting: false, reload: false });
  assert.deepEqual(update.decide({ hadController: true, event: 'controllerchange', reloadCount: 1 }), { skipWaiting: false, reload: false });
  assert.deepEqual(update.decide({ hadController: true, event: 'installing' }), { skipWaiting: false, reload: false });
});

test('the app checks for an update when it opens and when it becomes visible', () => {
  assert.equal(update.shouldCheck('open'), true);
  assert.equal(update.shouldCheck('visible'), true);
  assert.equal(update.shouldCheck('hidden'), false);
  assert.equal(update.shouldCheck(''), false);
});

test('the shipped version matches the service worker cache and every ?v=', () => {
  const version = update.version;
  assert.match(read('sw.js'), new RegExp("const CACHE = 'nextstep-phone-v" + version + "'"));
  assert.match(read('index.html'), new RegExp('app\\.js\\?v=' + version));
  assert.match(read('pwa.js'), /SKIP_WAITING/);
  assert.match(read('pwa.js'), /registration\.update\(\)/);
  assert.match(read('sw.js'), /clients\.claim\(\)/);
  assert.match(read('sw.js'), /skipWaiting\(\)/);
  for (const name of ['index.html', 'sw.js', 'manifest.webmanifest', 'privacy.html']) {
    const text = read(name);
    const versions = text.match(/\?v=\d+/g) || [];
    assert.ok(versions.length > 0, name);
    for (const found of versions) assert.equal(found, '?v=' + version, name + ' ' + found);
  }
  assert.match(read('app.js'), /coreAppVersion\(\)/);
  assert.match(read('app.js'), /Version \$\{esc\(coreAppVersion\(\)\)\}/);
});
