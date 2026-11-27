// node --test test/live-blip.test.mjs
// The AI interview survives a blip: live.js's screen code runs here in a small sandbox with a
// stand-in tower, so the retry, the choice and the debrief wording are checked end to end.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const SOURCE = readFileSync(join(root, 'live.js'), 'utf8');
const ABOUT = 'I was a barista at Harbour Cafe for three years. I trained two new hires and opened on Saturdays.';
const PREP = {
  role: 'Store associate',
  company: 'Maple & Thread',
  job: 'Greet every customer and handle cash accurately on the POS. Available evenings and weekends.',
  questions: ['Why this job?', 'Tell me about handling cash.', 'Tell me about a waiting line.', 'How do you show up?', 'How would you handle a return?'],
  aboutYou: { text: ABOUT },
  liveSessions: []
};
const TURN = { say: 'Thanks. Tell me about a time a customer was upset.', kind: 'question' };

function sandbox(replies) {
  const calls = [];
  const ctx = {
    active: JSON.parse(JSON.stringify(PREP)), view: '', toasts: [], saves: 0, screens: {}, actions: {},
    typed: '',
    document: { getElementById: (id) => (id === 'live-type' && ctx.typed ? { value: ctx.typed } : null) },
    NextStepProvider: {
      requestInterview: async (prefs, path) => {
        calls.push(path);
        const next = replies.shift();
        return typeof next === 'function' ? next() : next;
      }
    },
    corePrefs: () => ({ provider: 'subscription' }),
    coreProviderReady: () => true,
    esc: (s) => String(s ?? ''),
    iconBtn: () => '',
    I: { close: '' },
    console
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(`
    function show(v) { view = v; }
    function notify(m) { toasts.push(m); }
    function save() { saves += 1; }
  `, ctx);
  vm.runInContext(SOURCE, ctx, { filename: 'live.js' });
  return { ctx, calls, run: (code) => vm.runInContext(code, ctx) };
}
const fail = (reason) => ({ ok: false, attempted: true, reason });
const settle = () => new Promise((r) => setTimeout(r, 0));

test('a timeout is retried once on its own, then the interview waits with Try again', async () => {
  const { ctx, calls, run } = sandbox([fail('timeout'), fail('timeout')]);
  run('actions["open-live"]()');
  await settle(); await settle();
  assert.equal(calls.length, 2, 'one automatic retry, no more');
  assert.equal(ctx.view, 'live');
  const html = run('screens.live()');
  assert.match(html, /The interviewer didn't answer\./);
  assert.match(html, /The interviewer took too long to answer\./);
  assert.match(html, /data-action="live-retry">Try again</);
  assert.match(html, /data-action="live-general">Continue with general questions</);
  assert.equal(ctx.toasts.at(-1), 'The interviewer took too long to answer.');
  assert.equal(run('active.liveSessions[0].mode'), 'live', 'the interview stays live');
  assert.equal(run('active.liveSessions[0].generic'), false);
});

test('a retry that gets through carries on live, with no generic note', async () => {
  const { calls, run } = sandbox([fail('unreachable'), { ok: true, turn: TURN }]);
  run('actions["open-live"]()');
  await settle(); await settle();
  assert.equal(calls.length, 2);
  assert.equal(run('active.liveSessions[0].mode'), 'live');
  assert.match(run('screens.live()'), /a customer was upset/);
  assert.doesNotMatch(run('screens.live()'), /didn't answer|Generic interview/);
});

test('login and the other tower reasons wait at once, each with its own words', async () => {
  const words = {
    login: 'Codex on your tower needs signing in again. On the tower, run codex login, then try again.',
    codex: 'The tower could not run the interviewer this time.',
    unauthorized: 'The tower did not accept the secret in Settings.',
    limited: 'The tower is busy right now. Wait a minute, then try again.',
    offline: "You're offline. Try again when you have a connection, or continue with general questions."
  };
  for (const [reason, said] of Object.entries(words)) {
    const { ctx, calls, run } = sandbox([fail(reason)]);
    run('actions["open-live"]()');
    await settle();
    assert.equal(calls.length, 1, reason + ' is not retried on its own');
    assert.equal(ctx.toasts.at(-1), said);
    assert.equal(run('active.liveSessions[0].mode'), 'live');
    assert.equal(said.includes('—'), false);
  }
});

test('Try again asks again; Continue with general questions switches, and the debrief says it was live', async () => {
  const { ctx, calls, run } = sandbox([fail('codex'), { ok: true, turn: TURN }, fail('login')]);
  run('actions["open-live"]()');
  await settle();
  await run('actions["live-retry"]()');
  assert.equal(calls.length, 2);
  assert.match(run('screens.live()'), /a customer was upset/);
  assert.doesNotMatch(run('screens.live()'), /didn't answer/);
  // Answer, the next turn fails, and the person continues with general questions.
  ctx.typed = 'One Saturday a customer was upset about a return, so I listened, checked the receipt and offered an exchange.';
  run('actions["live-done"]()');
  await settle();
  assert.match(run('screens.live()'), /run codex login, then try again/);
  run('actions["live-general"]()');
  assert.equal(run('active.liveSessions[0].mode'), 'template');
  assert.equal(run('active.liveSessions[0].wasLive'), true);
  assert.equal(ctx.view, 'live');
  const shot = run('NextStepLive.cleanSessions(active.liveSessions)[0]');
  assert.equal(shot.wasLive, true, 'kept in saved interviews');
  const note = run('NextStepLive.genericNote(active.liveSessions[0])');
  assert.doesNotMatch(note, /was not connected/);
  assert.match(note, /stopped answering partway/);
});

test('an interview that was never live still says so', () => {
  const { run } = sandbox([]);
  const note = run('(() => { const s = NextStepLive.createSession(active, { provider: false }); return NextStepLive.genericNote(s); })()');
  assert.match(note, /A live interviewer was not connected/);
});
