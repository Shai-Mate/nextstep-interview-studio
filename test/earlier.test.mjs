// node --test test/earlier.test.mjs
// Notes a rewritten course had no place for are shown, read-only, in the Answer bank.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const app = readFileSync(join(root, 'app.js'), 'utf8');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function render(prep) {
  const kinds = app.match(/const CORE_EARLIER_KIND = [^\n]*\n/);
  const fn = app.match(/function coreEarlierHtml\(p\) \{[\s\S]*?\n\}/);
  assert.ok(kinds && fn, 'app.js defines coreEarlierHtml');
  return vm.runInNewContext(kinds[0] + fn[0] + '\ncoreEarlierHtml(prep);', { esc, prep });
}

test('the earlier plan section shows each kept note, escaped, only when there is one', () => {
  const html = render({ earlierNotes: [
    { kind: 'answer', about: 'Tell me about a time you helped a customer.', text: 'A real STAR story I wrote' },
    { kind: 'lesson', about: 'Cash handling <basics>', text: 'Count twice & <b>sign</b>' }
  ] });
  assert.match(html, /<h2 id="earlier-title">From your earlier plan<\/h2>/);
  assert.match(html, /Question: Tell me about a time you helped a customer\./);
  assert.match(html, /A real STAR story I wrote/);
  assert.match(html, /Lesson: Cash handling &lt;basics&gt;/);
  assert.match(html, /Count twice &amp; &lt;b&gt;sign&lt;\/b&gt;/);
  assert.doesNotMatch(html, /<b>sign/);
  assert.doesNotMatch(html, /style=|<textarea|<input|—/, 'read-only, no inline style, no em dashes');
  for (const none of [{}, { earlierNotes: [] }, { earlierNotes: [{ kind: 'answer', about: 'x', text: '  ' }] }, null]) assert.equal(render(none), '');
  assert.match(app, /\$\{coreEarlierHtml\(p\)\}\n    <\/div>`;\n  \},\n  quiz\(\)/, 'it sits at the bottom of the Answer bank');
});
