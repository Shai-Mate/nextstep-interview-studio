// node --test test/opening.test.mjs
// Public users have no tower, so the first screen is always Welcome. The personal course (Connect) is an
// owner-only feature reached from On this device, then Personal course, or from the Generic lessons card.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'app.js'), 'utf8');

function openingView(sandbox) {
  const src = app.match(/function coreOpeningView\(\) \{[\s\S]*?\n\}/);
  assert.ok(src, 'app.js defines coreOpeningView');
  return vm.runInNewContext(src[0] + '\ncoreOpeningView();', sandbox);
}

test('the opening view is Welcome when nothing is set up', () => {
  const nothing = { corePrefs: () => ({}), coreProviderReady: () => false, sessionStorage: { getItem: () => null }, connectReturn: '' };
  assert.equal(openingView(nothing), 'welcome');
  assert.equal(openingView({ ...nothing, coreProviderReady: () => true }), 'welcome');
  assert.match(app, /document\.addEventListener\('DOMContentLoaded', \(\) => show\(coreOpeningView\(\)\)\);/);
});

test('the personal course is labelled owner only and stays one tap away', () => {
  assert.match(app, /Personal course \(owner only\)/);
  assert.match(app, /Needs a private server set up by the app's owner/);
  assert.match(app, /data-action="connect-ai">Personal course \(owner only\)<\/button>/);
  assert.match(app, /Built from this ad, the same for everyone who uses this ad\./);
  assert.ok(!/<span>Connect AI<\/span>/.test(app), 'no Connect AI call to action');
});
