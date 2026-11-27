// node --test test/past.test.mjs
// Past interviews: saved AI interviews are listed on Practise, a finished one opens read-only, and the
// newest unfinished one can be resumed. live.js's screen code runs in a small sandbox with a stand-in tower.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const live = require('../live.js');
const SOURCE = readFileSync(join(root, 'live.js'), 'utf8');
const APP = readFileSync(join(root, 'app.js'), 'utf8');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ABOUT = 'I was a barista at Harbour Cafe for three years.';
const QUESTIONS = ['Why this job?', 'Tell me about handling cash.', 'Tell me about a waiting line.', 'How do you show up?', 'How would you handle a return?'];
const A1 = { question: 'Why this job?', answer: 'I like helping people find what they need on a busy day.', follow: '', followAnswer: '' };
const A2 = { question: 'Tell me about handling cash.', answer: 'One Saturday the till was short and I recounted every note.', follow: '', followAnswer: '' };
const DEBRIEF = { items: [{ landed: 'Clear reason.', fix: 'Name the store.', stronger: 'I want to help people here.' }], overall: 'A steady start you can build on.' };

const finished = { id: 'done-1', at: '2026-11-20T18:00:00.000Z', mode: 'live', generic: false, note: '', questions: QUESTIONS, answers: [A1], debrief: DEBRIEF,
  state: { phase: 'review', pending: '', index: 1, follow: false, current: '', ended: true, userEnded: true, transcript: [{ who: 'interviewer', text: A1.question }, { who: 'you', text: A1.answer }] } };
const waiting = { id: 'open-1', at: '2026-11-26T09:00:00.000Z', mode: 'live', generic: false, note: '', questions: QUESTIONS, answers: [A1, A2], debrief: null,
  state: { phase: 'wait', pending: 'turn', index: 1, follow: false, current: A2.question, ended: false, userEnded: false, transcript: [{ who: 'interviewer', text: A1.question }, { who: 'you', text: A1.answer }, { who: 'interviewer', text: A2.question }, { who: 'you', text: A2.answer }] } };
// Saved before this change: no state, no wasLive.
const oldOpen = { id: 'old-1', at: '2026-11-10T09:00:00.000Z', mode: 'template', generic: true, note: 'These questions come from the ad, not a live interviewer.', questions: QUESTIONS, answers: [A1], debrief: null };
const oldLive = { id: 'old-2', at: '2026-11-09T09:00:00.000Z', mode: 'live', generic: false, note: '', questions: QUESTIONS, answers: [A1, A2], debrief: null };
const empty = { id: 'empty-1', at: '2026-11-27T09:00:00.000Z', mode: 'live', generic: false, note: '', questions: QUESTIONS, answers: [], debrief: null };

function sandbox(sessions, replies = [], confirmAnswer = true) {
  const calls = [];
  const ctx = {
    active: { role: 'Store associate', company: 'Maple & Thread', job: 'Greet every customer and handle cash accurately on the POS.', questions: QUESTIONS, aboutYou: { text: ABOUT }, liveSessions: JSON.parse(JSON.stringify(sessions)) },
    view: '', toasts: [], saves: 0, asked: [], screens: {}, actions: {},
    document: { getElementById: () => null },
    NextStepProvider: { requestInterview: async (prefs, path) => { calls.push(path); return replies.shift() || { ok: false, attempted: true, reason: 'codex' }; } },
    corePrefs: () => ({ provider: 'subscription' }),
    coreProviderReady: () => true,
    esc, iconBtn: () => '', I: { close: '', chev: '' },
    console
  };
  ctx.window = ctx;
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(`
    function show(v) { view = v; }
    function notify(m) { toasts.push(m); }
    function save() { saves += 1; }
    function confirm(q) { asked.push(q); return ${confirmAnswer}; }
  `, ctx);
  vm.runInContext(SOURCE, ctx, { filename: 'live.js' });
  return { ctx, calls, run: (code) => vm.runInContext(code, ctx) };
}
const settle = () => new Promise((r) => setTimeout(r, 0));

function pastHtml(prep) {
  const when = APP.match(/function corePastWhen\(at\) \{[\s\S]*?\n\}/);
  const fn = APP.match(/function corePastHtml\(p\) \{[\s\S]*?\n\}/);
  assert.ok(when && fn, 'app.js defines corePastHtml');
  return vm.runInNewContext(when[0] + fn[0] + '\ncorePastHtml(prep);', { esc, prep, I: { chev: '' }, NextStepLive: live, globalThis: { NextStepLive: live } });
}

test('Past interviews shows only when there is one, with date, live or generic, and finished or not', () => {
  assert.equal(pastHtml({ liveSessions: [] }), '');
  assert.equal(pastHtml({}), '');
  assert.equal(pastHtml({ liveSessions: [empty] }), '', 'one opened and left with no answers is not listed');
  const html = pastHtml({ liveSessions: [empty, waiting, finished, oldOpen] });
  assert.match(html, /<h2 class="kicker" id="past-title">Past interviews<\/h2>/);
  assert.match(html, /data-action="live-resume" data-id="open-1"[\s\S]*?Live · Unfinished[\s\S]*?Resume/);
  assert.match(html, /data-action="live-past" data-id="done-1"[\s\S]*?Live · Finished/);
  assert.match(html, /data-action="live-past" data-id="old-1"[\s\S]*?Generic · Unfinished/, 'an older unfinished one opens read-only; only the newest gets Resume');
  assert.equal((html.match(/Resume/g) || []).length, 1);
  assert.doesNotMatch(html, /style=|—/);
  assert.match(APP, /Spoken questions for this job, about 10 minutes<\/em><\/span>\$\{I\.chev\}<\/button>\n      \$\{corePastHtml\(p\)\}/, 'it sits under Practice the interview');
});

test('a finished interview opens its debrief and transcript read-only, and nothing is saved', () => {
  const { ctx, calls, run } = sandbox([finished]);
  run('actions["live-past"]({ dataset: { id: "done-1" } })');
  assert.equal(ctx.view, 'live-review');
  const html = run('screens["live-review"]()');
  assert.match(html, /A steady start you can build on\./);
  assert.match(html, /<summary>Transcript<\/summary>/);
  assert.match(html, /I like helping people find what they need/);
  assert.doesNotMatch(html, /<textarea|data-action="live-(talk|done|retry)"/);
  assert.equal(ctx.saves, 0);
  assert.equal(calls.length, 0);
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.active.liveSessions)), [finished]);
});

test('Resume restores the interview where it stood and asks again for the pending turn', async () => {
  const turn = { say: 'Thanks. Tell me about a time a customer was upset.', kind: 'question' };
  const { ctx, calls, run } = sandbox([finished, waiting], [{ ok: true, turn }]);
  await run('actions["live-resume"]({ dataset: { id: "open-1" } })');
  await settle();
  assert.deepEqual(calls, ['/interview/turn']);
  assert.equal(ctx.view, 'live');
  assert.match(run('screens.live()'), /a customer was upset/);
  const saved = ctx.active.liveSessions.find((s) => s.id === 'open-1');
  assert.equal(saved.answers.length, 2, 'the earlier answers are kept');
  assert.equal(saved.mode, 'live');
  assert.equal(saved.state.phase, 'listen');
  assert.equal(ctx.active.liveSessions.length, 2, 'resumed in place, not copied');
});

test('a resume that fails gets the blip handling', async () => {
  const { ctx, calls, run } = sandbox([waiting], [{ ok: false, attempted: true, reason: 'timeout' }, { ok: false, attempted: true, reason: 'timeout' }]);
  await run('actions["live-resume"]({ dataset: { id: "open-1" } })');
  await settle(); await settle();
  assert.equal(calls.length, 2, 'one automatic retry');
  assert.match(run('screens.live()'), /The interviewer didn't answer\./);
  assert.equal(ctx.active.liveSessions[0].mode, 'live');
});

test('sessions saved before this change still load, list and resume', () => {
  const clean = live.cleanSessions([oldOpen, oldLive]);
  assert.equal(clean.length, 2);
  assert.equal(clean[0].state, null);
  assert.deepEqual(live.pastSessions({ liveSessions: [oldOpen, oldLive] }).map((s) => [s.id, s.finished, s.resume]), [['old-1', false, true], ['old-2', false, false]]);
  const generic = live.resumeSession(oldOpen, ABOUT);
  assert.equal(generic.phase, 'listen');
  assert.equal(generic.index, 1);
  assert.equal(generic.current, QUESTIONS[1]);
  assert.equal(generic.transcript[0].text, A1.question);
  const liveOne = live.resumeSession(oldLive, ABOUT);
  assert.deepEqual([liveOne.phase, liveOne.pending, liveOne.answers.length], ['wait', 'turn', 2]);
  assert.equal(live.resumeSession(finished, ABOUT), null, 'a finished one is not resumed');
  // The backup restore runs saved sessions through cleanSessions too, and keeps the new state.
  assert.match(APP, /const sessions = NextStepLive\.cleanSessions\(p\.liveSessions\);/);
  const restored = live.cleanSessions(JSON.parse(JSON.stringify([waiting])))[0];
  assert.deepEqual([restored.state.pending, restored.state.transcript.length], ['turn', 4]);
});

test('starting a new interview while one is unfinished asks first', () => {
  const kept = sandbox([waiting], [], false);
  kept.run('actions["open-live"]()');
  assert.deepEqual(kept.ctx.asked, ['Start a new one? The unfinished one stays in Past interviews.']);
  assert.equal(kept.ctx.active.liveSessions.length, 1, 'cancelled: nothing new started');
  const fresh = sandbox([finished]);
  fresh.run('actions["open-live"]()');
  assert.deepEqual(fresh.ctx.asked, [], 'no question when nothing is unfinished');
});

test('at the cap, the unfinished interview really stays: the oldest finished one goes first', () => {
  const done = (n) => ({ ...finished, id: 'done-' + n, at: '2026-11-1' + n + 'T09:00:00.000Z' });
  // 7 finished interviews newer than the unfinished one, and then a new one is started.
  const saved = [1, 2, 3, 4, 5, 6, 7].map(done).concat([waiting]);
  const { ctx, run } = sandbox(saved);
  run('actions["open-live"]()');
  const ids = ctx.active.liveSessions.map((s) => s.id);
  assert.equal(ids.length, 8);
  assert.ok(ids.includes('open-1'), 'the unfinished one is kept, as the question promised');
  assert.equal(ids.includes('done-7'), false, 'the oldest finished one went instead');
  assert.equal(ctx.asked.length, 1);
  // With nothing finished, the newest unfinished and the new one stay; the oldest other one goes.
  const open = (n) => ({ ...waiting, id: 'open-' + n });
  const trimmed = live.trimSessions([{ ...empty, id: 'new' }, ...[1, 2, 3, 4, 5, 6, 7, 8].map(open)], 'new');
  assert.deepEqual(trimmed.map((s) => s.id), ['new', 'open-1', 'open-2', 'open-3', 'open-4', 'open-5', 'open-6', 'open-7']);
});

test('Resume keeps the position: a pending live turn keeps its question, and generic after live carries on', async () => {
  // Live, Q2 answered, turn pending: the caption keeps Q2 and the next turn moves the count on.
  const back = live.resumeSession(waiting, ABOUT);
  assert.deepEqual([back.phase, back.pending, back.current, back.index], ['wait', 'turn', A2.question, 1]);
  assert.equal(live.applyTurn(back, { say: 'Tell me about a time a customer was upset.', kind: 'question' }).ok, true);
  assert.equal(back.index, 2, 'the count moves on after the resumed turn');
  // Generic after live: the live part reached question 6, the generic list has 5, and one is on screen.
  const switched = { ...waiting, id: 'switched', mode: 'template', generic: true, wasLive: true,
    state: { ...waiting.state, phase: 'listen', pending: '', index: 5, current: QUESTIONS[4] } };
  const again = live.resumeSession(switched, ABOUT);
  assert.deepEqual([again.phase, again.current, again.debrief], ['listen', QUESTIONS[4], null], 'not ended at once');
  assert.equal(again.index, 4);
  const answered = live.applyAnswer(again, 'At Harbour Cafe a regular brought back a bag of beans that was the wrong grind. I listened first, checked the receipt, apologised, and offered an exchange or a refund. I ground a fresh bag while she waited, and she came back the next week.');
  assert.equal(answered.effect, 'review', 'answering it finishes the interview');
  // useTemplate keeps the index inside the generic list too.
  const s = live.createSession({ questions: QUESTIONS }, { provider: true });
  s.index = 6;
  live.useTemplate(s, ABOUT);
  assert.ok(s.index <= s.questions.length - 1);
  assert.equal(s.current, s.questions[s.index]);
});

test('a slow reply from an interview that was ended never lands in the resumed one', async () => {
  let releaseB;
  const lateB = new Promise((r) => { releaseB = r; });
  const turnA = { say: 'Thanks. Tell me about a time a customer was upset.', kind: 'question' };
  const turnB = { say: 'B opening question that must not appear in A.', kind: 'question' };
  const { ctx, calls, run } = sandbox([finished, waiting], [lateB, { ok: true, turn: turnA }]);
  run('actions["open-live"]()'); // interview B asks for its opening question, and the tower is slow
  await settle();
  run('actions["live-end"]()'); // B is ended before its reply comes
  await run('actions["live-resume"]({ dataset: { id: "open-1" } })'); // A asks its own pending turn
  await settle();
  assert.deepEqual(calls, ['/interview/turn', '/interview/turn'], 'A sent its own request');
  releaseB({ ok: true, turn: turnB }); // B's reply finally arrives
  await settle(); await settle();
  const a = ctx.active.liveSessions.find((s) => s.id === 'open-1');
  assert.equal(JSON.stringify(a).includes('B opening question'), false);
  assert.equal(a.state.current, turnA.say);
  assert.match(run('screens.live()'), /a customer was upset/);
});

test('an older unfinished interview opens read-only, with its answers and no debrief', () => {
  const { ctx, calls, run } = sandbox([waiting, oldOpen]);
  run('actions["live-past"]({ dataset: { id: "old-1" } })');
  assert.equal(ctx.view, 'live-review');
  const html = run('screens["live-review"]()');
  assert.match(html, /An unfinished interview/);
  assert.match(html, /Unfinished, so there is no debrief\./);
  assert.match(html, /I like helping people find what they need/);
  assert.match(html, /<summary>Transcript<\/summary>/);
  assert.doesNotMatch(html, /What landed|<textarea|data-action="live-(talk|done|retry|resume)"/);
  assert.equal(ctx.saves, 0);
  assert.equal(calls.length, 0);
});

test('at the cap, an empty interview goes before a finished one', () => {
  const done = (n) => ({ ...finished, id: 'f' + n });
  const list = [{ ...empty, id: 'new' }, ...[1, 2, 3, 4, 5, 6, 7].map(done), { ...empty, id: 'left-empty' }];
  assert.deepEqual(live.trimSessions(list, 'new').map((s) => s.id), ['new', 'f1', 'f2', 'f3', 'f4', 'f5', 'f6', 'f7']);
  // The one being saved is kept even while it is still empty.
  assert.ok(live.trimSessions([{ ...empty, id: 'new' }, ...[1, 2, 3, 4, 5, 6, 7, 8].map(done)], 'new').some((s) => s.id === 'new'));
});
