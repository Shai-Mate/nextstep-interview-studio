// node --test test/name.test.mjs
// The product is "Next Step" (two words) on screen, while the identifiers that hold people's saved
// work keep their old spelling: renaming a storage key would lose everything already saved.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => readFileSync(join(root, name), 'utf8');

test('the Home Screen name is "Next Step" and the saved-work identifiers are unchanged', () => {
  const manifest = JSON.parse(read('manifest.webmanifest'));
  assert.equal(manifest.name, 'Next Step Interview Studio');
  assert.equal(manifest.short_name, 'Next Step');
  assert.match(read('index.html'), /<meta name="apple-mobile-web-app-title" content="Next Step">/);
  const app = read('app.js');
  assert.match(app, /const KEY = 'nextstep\.preparations\.v1';/);
  assert.match(app, /const CORE_PREFS_KEY = 'nextstep\.prefs\.v1';/);
  assert.match(app, /'nextstep-saved-data\.json'/);
  assert.match(read('interview.js'), /const IV_PREFS_KEY = 'nextstep\.prefs\.v1';/);
  assert.match(read('pwa.js'), /new Event\('nextstep-install-change'\)/);
  assert.match(read('sw.js'), /const CACHE = 'nextstep-phone-v\d+';/);
});
