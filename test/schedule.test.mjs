// node --test test/schedule.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const PrepEngine = require('../engine.js');

const noon = (y, m, d) => new Date(y, m - 1, d, 12, 0, 0);
const lessons = (n, done = 0) => Array.from({ length: n }, (_, i) => ({ title: 'Lesson ' + (i + 1), minutes: 5, done: i < done, body: '', exercise: '' }));

test('no interview date means no schedule', () => {
  assert.equal(PrepEngine.schedule({ course: lessons(4), created: noon(2026, 11, 22).toISOString() }, noon(2026, 11, 22)), null);
});

test('a past interview is not paced', () => {
  const plan = PrepEngine.schedule({ course: lessons(4), interviewAt: '2026-11-01', created: noon(2026, 11, 1).toISOString() }, noon(2026, 11, 22));
  assert.equal(plan.past, true);
  assert.equal(plan.required, 0);
});

test('remaining minutes are split across the days left, including interview day', () => {
  const plan = PrepEngine.schedule({
    course: lessons(4),
    interviewAt: '2026-11-25',
    created: noon(2026, 11, 22).toISOString()
  }, noon(2026, 11, 22));
  assert.equal(plan.past, false);
  assert.equal(plan.total, 20);
  assert.equal(plan.remaining, 20);
  assert.equal(plan.daysLeft, 4);
  assert.equal(plan.required, 5);
  assert.equal(plan.missed, false);
  assert.equal(plan.block.length, 1);
  assert.equal(plan.block[0].title, 'Lesson 1');
  assert.deepEqual(plan.days.map((d) => d.date), ['2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25']);
});

test('missed days put their minutes back into the pot, so the daily target rises', () => {
  const created = noon(2026, 11, 20).toISOString();
  const missed = PrepEngine.schedule({
    course: lessons(4),
    interviewAt: '2026-11-24',
    created
  }, noon(2026, 11, 22));
  assert.equal(missed.missedDays, 2);
  assert.equal(missed.required, 7);
  assert.ok(missed.required > 4, 'higher than the first day share of 4');
  assert.equal(missed.block.length, 2);
  assert.equal(missed.days.find((d) => d.date === '2026-11-20').missed, true);
  assert.equal(missed.days.find((d) => d.date === '2026-11-22').today, true);

  const keptUp = PrepEngine.schedule({
    course: lessons(4, 1),
    interviewAt: '2026-11-24',
    created,
    dayLog: { '2026-11-20': { minutes: 5, lessons: 1 } }
  }, noon(2026, 11, 22));
  assert.equal(keptUp.days.find((d) => d.date === '2026-11-20').missed, false);
  assert.equal(keptUp.days.find((d) => d.date === '2026-11-21').missed, true);
  assert.equal(keptUp.required, 5);
  assert.equal(keptUp.block.length, 1);
  assert.equal(keptUp.block[0].title, 'Lesson 2');

  const legacy = PrepEngine.schedule({
    course: lessons(4, 1),
    interviewAt: '2026-11-24',
    created
  }, noon(2026, 11, 22));
  assert.equal(legacy.days.find((d) => d.date === '2026-11-20').missed, false);
  assert.equal(legacy.required, keptUp.required);
});

test('a chosen daily minute count does not hide a higher catch-up target', () => {
  const plan = PrepEngine.schedule({
    course: lessons(8),
    interviewAt: '2026-11-23',
    created: noon(2026, 11, 22).toISOString(),
    dailyMinutes: 15
  }, noon(2026, 11, 22));
  assert.equal(plan.total, 40);
  assert.equal(plan.required, 20);
  assert.equal(plan.chosen, 15);
  assert.equal(plan.over, true);
});
