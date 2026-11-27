// node --test test/flow.test.mjs
// The owner's personal course: a failed attempt stays on the writing screen with Try again and Use
// general lessons. flow.js runs here in a small sandbox with the real engine and course code and a
// stand-in tower.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(import.meta.url);
const PrepEngine = require('../engine.js');
const NextStepCourse = require('../course.js');
const fix = JSON.parse(readFileSync(join(root, 'test', 'fixtures', 'courses', 'harbour-retail.json'), 'utf8'));
const AD = readFileSync(join(root, 'test', 'fixtures', 'courses', fix.adFile), 'utf8');

function sandbox(replies) {
  const calls = [];
  const ctx = {
    screens: {}, binders: {}, actions: {}, records: [], active: null, view: '', lessonIndex: 0, renaming: false,
    shown: [], notes: [], saves: 0,
    PrepEngine, NextStepCourse,
    NextStepProvider: {
      providerReady: () => true,
      requestCourse: async () => { calls.push('course'); return replies.shift(); }
    },
    corePrefs: () => ({ provider: 'subscription' }),
    esc: (s) => String(s ?? ''),
    iconBtn: (action, label) => `<button type="button" data-action="${action}" aria-label="${label}"></button>`,
    I: { back: '' },
    performance: { now: () => 0 },
    AbortController,
    console
  };
  ctx.globalThis = ctx;
  vm.createContext(ctx);
  vm.runInContext(`
    function show(v) { view = v; shown.push(v); }
    function notify(m) { notes.push(m); }
    function persist() { saves += 1; }
  `, ctx);
  vm.runInContext(readFileSync(join(root, 'flow.js'), 'utf8'), ctx, { filename: 'flow.js' });
  ctx.draft = { role: fix.role, company: fix.company, job: AD, url: '', intake: {}, aboutYou: { source: 'resume', text: fix.about } };
  return { ctx, calls, run: (code) => vm.runInContext(code, ctx) };
}

const fail = (reason, message) => ({ ok: false, attempted: true, reason, message });

test('a failed personal course stays on the writing screen until the person chooses', async () => {
  const { ctx, calls, run } = sandbox([fail('offline', "You're offline. Try again when you have a connection, or use the general lessons now.")]);
  await run('flowBuild("")');
  assert.equal(ctx.view, 'writing');
  assert.equal(ctx.records.length, 0, 'nothing built or saved');
  assert.equal(ctx.saves, 0);
  assert.ok(ctx.draft && ctx.draft.job === AD, 'the draft is kept, nothing to retype');
  const html = run('screens.writing()');
  assert.match(html, /You're offline\. Try again when you have a connection, or use the general lessons now\./);
  assert.match(html, /data-action="writing-retry">Try again</);
  assert.match(html, /data-action="writing-general">Use general lessons</);
  // The same topbar as the other flow screens, so the title clears the status bar in the installed app.
  assert.match(html, /^<div class="screen" data-screen="writing">\s*<div class="topbar"><button type="button" data-action="cancel-writing" aria-label="Back to About you">/);
  assert.equal(calls.length, 1);
});

test('Try again sends the same draft, and a course that comes back is saved', async () => {
  const course = NextStepCourse; // the fixture course, as a tower would return it
  const generated = {
    requirements: fix.requirements,
    course: fix.lessons.map((l) => ({ title: l.title, minutes: 5, theme: null, body: l.body, exercise: l.exercise, done: false })),
    questions: fix.questions.map((q) => q.q),
    questionInfo: fix.questions.map((q) => ({ kind: q.kind, theme: null, source: q.source, probe: q.probe, include: q.include, useStory: q.useStory })),
    quizItems: fix.quiz.map((q) => ({ ...q, options: q.options.slice() }))
  };
  assert.ok(course);
  const { ctx, calls, run } = sandbox([fail('login', 'Codex on your tower needs signing in again. On the tower, run codex login, then try again.'), { ok: true, course: generated }]);
  await run('flowBuild("")');
  assert.match(run('screens.writing()'), /run codex login, then try again/);
  await run('actions["writing-retry"]()');
  assert.equal(calls.length, 2);
  assert.equal(ctx.records.length, 1);
  assert.equal(ctx.records[0].generatedBy, 'subscription');
  assert.equal(ctx.view, 'decode');
  assert.equal(run('flowWriteFailed'), null);
});

test('Use general lessons is the explicit second choice, and never calls the tower', async () => {
  const { ctx, calls, run } = sandbox([fail('timeout', 'The personal course took too long.')]);
  await run('flowBuild("")');
  run('flowWriteFailed = null');
  assert.match(run('screens.writing()'), /^<div class="screen" data-screen="writing">\s*<div class="topbar">/, 'the waiting screen has it too');
  run('flowWriteFailed = { message: "x" }');
  await run('actions["writing-general"]()');
  assert.equal(calls.length, 1, 'general lessons do not try the tower again');
  assert.equal(ctx.records.length, 1);
  assert.equal(ctx.records[0].generatedBy, 'template');
  assert.equal(ctx.view, 'decode');
});

test('on a rewrite, a failure or the general choice leaves the old preparation as it was', async () => {
  const { ctx, run } = sandbox([fail('codex', 'The tower could not write the course this time.')]);
  const old = PrepEngine.create({ job: AD, role: fix.role, company: fix.company });
  old.id = 'prep-old';
  old.notes = { 'lesson-0': 'Keep me' };
  ctx.records.push(old);
  const before = JSON.stringify(old);
  ctx.draft.replaceId = 'prep-old';
  await run('flowBuild("")');
  assert.equal(ctx.view, 'writing');
  await run('actions["writing-general"]()');
  assert.equal(ctx.records.length, 1);
  assert.equal(ctx.records[0], old);
  assert.equal(JSON.stringify(old), before);
  assert.equal(ctx.view, 'today');
});
