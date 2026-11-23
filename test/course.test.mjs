// node --test test/course.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const PrepEngine = require('../engine.js');
const course = require('../course.js');

const load = (name) => JSON.parse(readFileSync(join(here, 'fixtures', 'courses', name), 'utf8'));
const adOf = (fix) => readFileSync(join(here, 'fixtures', 'courses', fix.adFile), 'utf8');

function assemble(fix) {
  return {
    requirements: fix.requirements,
    course: fix.lessons.map((lesson) => ({
      title: lesson.title,
      minutes: 5,
      theme: null,
      body: lesson.body,
      exercise: lesson.exercise,
      done: false
    })),
    questions: fix.questions.map((item) => item.q),
    questionInfo: fix.questions.map((item) => ({
      kind: item.kind,
      theme: null,
      source: item.source,
      probe: item.probe,
      include: item.include,
      useStory: item.useStory
    })),
    quizItems: fix.quiz.map((item) => ({ q: item.q, options: item.options.slice(), correct: item.correct, why: item.why }))
  };
}
function contextFor(fix) {
  return { ad: adOf(fix), about: fix.about, company: fix.company, role: fix.role };
}

test('the schema is strict enough for Codex --output-schema', () => {
  assert.deepEqual(course.schemaStrict(course.courseSchema), []);
  assert.equal(course.courseSchema.additionalProperties, false);
  assert.ok(course.courseSchema.required.includes('questionInfo'));
});

test('two fixture courses are specific to that person and that ad', () => {
  for (const name of ['harbour-retail.json', 'lantern-apprentice.json']) {
    const fix = load(name);
    const result = course.validateCourse(assemble(fix), contextFor(fix));
    assert.equal(result.ok, true, name + ' ' + JSON.stringify(result.errors || result.reason));
    const blob = JSON.stringify(result.value).toLowerCase();
    for (const token of fix.personal) assert.match(blob, new RegExp(token, 'i'), name + ' ' + token);
    assert.match(blob, new RegExp(fix.adLine.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'), name);
    assert.equal(result.value.course.length >= 6, true);
    assert.equal(result.value.questions.length, result.value.questionInfo.length);
    assert.ok(result.value.quizItems.every((item) => item.correct >= 0 && item.correct < item.options.length));
    assert.ok(result.value.course.every((lesson) => lesson.done === false && lesson.body && lesson.exercise));
  }
});

test('schema rejects bad shapes', () => {
  const fix = load('harbour-retail.json');
  const good = assemble(fix);
  const ctx = contextFor(fix);
  const reject = (value, reason) => {
    const result = course.validateCourse(value, ctx);
    assert.equal(result.ok, false);
    assert.equal(result.reason, reason);
  };
  const short = assemble(fix);
  short.questions = short.questions.slice(0, 7);
  short.questionInfo = short.questionInfo.slice(0, 7);
  reject(short, 'schema');
  const mismatch = assemble(fix);
  mismatch.questionInfo = mismatch.questionInfo.slice(0, 7);
  reject(mismatch, 'schema');
  const badCorrect = assemble(fix);
  badCorrect.quizItems[0] = { ...badCorrect.quizItems[0], correct: 3 };
  reject(badCorrect, 'schema');
  const missingStory = assemble(fix);
  delete missingStory.questionInfo[0].useStory;
  reject(missingStory, 'schema');
  const extra = assemble(fix);
  extra.note = 'hello';
  reject(extra, 'schema');
  const extraLesson = assemble(fix);
  extraLesson.course[0] = { ...extraLesson.course[0], tip: 'nope' };
  reject(extraLesson, 'schema');
  assert.equal(course.validateCourse(good, ctx).ok, true);
});

test('checks, invented employers, and generic exercises are rejected', () => {
  const fix = load('harbour-retail.json');
  const ctx = contextFor(fix);
  const clearance = assemble(fix);
  clearance.questions[0] = 'Have you completed a criminal record check for this store?';
  clearance.questionInfo[0] = { ...clearance.questionInfo[0], useStory: 'Tell them about your criminal record check.' };
  assert.equal(course.validateCourse(clearance, ctx).reason, 'checks');
  const invented = assemble(fix);
  invented.course[0] = {
    ...invented.course[0],
    body: invented.course[0].body + ' You also led nights at Northwind Logistics before Harbour Cafe.'
  };
  const inventedResult = course.validateCourse(invented, ctx);
  assert.equal(inventedResult.reason, 'invented');
  assert.match(inventedResult.errors.join(' '), /Northwind Logistics/);
  const generic = assemble(fix);
  generic.course[1] = {
    ...generic.course[1],
    exercise: 'Say in one sentence what this job is for, then write down one true example from your life.'
  };
  assert.equal(course.validateCourse(generic, ctx).reason, 'generic');
  const thin = assemble(fix);
  thin.course = thin.course.map((lesson) => ({
    ...lesson,
    body: 'This job is about customers and cash. Read the ad again and think about what they might ask. Keep your answer short and polite when you practise it out loud today.',
    exercise: 'Read the ad once more and underline two lines you want to talk about.'
  }));
  thin.questionInfo = thin.questionInfo.map((info) => ({ ...info, useStory: 'Use a true example from the ad and keep it short.' }));
  assert.equal(course.validateCourse(thin, ctx).reason, 'thin');
});

test('the prompt names this person and this ad, and drops check lines from the hints', () => {
  const fix = load('harbour-retail.json');
  const prompt = course.buildCoursePrompt({
    company: fix.company,
    role: fix.role,
    stage: fix.stage,
    interviewAt: fix.interviewAt,
    about: fix.about,
    aboutSource: fix.aboutSource,
    ad: adOf(fix),
    hints: { themes: ['Helping customers'], musts: ['Clear criminal record check (vulnerable sector)', 'Handle cash accurately'] }
  });
  assert.equal(course.instructions.includes('—'), false);
  assert.equal(course.instructions.includes('–'), false);
  assert.match(prompt, /Harbour Cafe/);
  assert.match(prompt, /Priya Shah/);
  assert.match(prompt, /handle cash accurately/);
  assert.match(prompt, /Screening/);
  assert.match(prompt, /2026-12-03/);
  assert.match(prompt, /résumé/);
  const musts = prompt.split('MUST-HAVES ALREADY READ FROM THE AD')[1].split('ABOUT YOU')[0];
  assert.match(musts, /Handle cash accurately/);
  assert.doesNotMatch(musts, /criminal record/i);
  assert.match(prompt, /Never invent/);
  assert.match(prompt, /Do not write a generic exercise/);
});

test('a good payload becomes the preparation, and a bad or empty one falls back to the template', () => {
  const fix = load('harbour-retail.json');
  const input = {
    job: adOf(fix),
    role: fix.role,
    company: fix.company,
    intake: { stage: 'Screening' },
    interviewAt: fix.interviewAt,
    aboutYou: { source: 'resume', text: fix.about }
  };
  const good = course.finishCourse(input, assemble(fix));
  assert.equal(good.schema, 1);
  assert.equal(good.generatedBy, 'subscription');
  assert.equal(good.questions[0], fix.questions[0].q);
  assert.equal(good.questionInfo[0].useStory, fix.questions[0].useStory);
  assert.equal(good.course[0].title, fix.lessons[0].title);
  assert.equal(good.course[0].done, false);
  assert.equal(good.aboutYou.label, 'résumé');
  assert.equal(good.interviewAt, '2026-12-03');
  assert.equal(good.questions.length, good.questionInfo.length);
  assert.ok(good.notes && good.quiz && good.quiz.answers);
  assert.equal(JSON.stringify(good).includes('towerSecret'), false);

  const template = PrepEngine.create(input);
  for (const generated of [null, undefined, {}, { course: [] }]) {
    const fell = course.finishCourse(input, generated);
    assert.deepEqual(fell.questions, template.questions);
    assert.deepEqual(fell.course.map((lesson) => lesson.title), template.course.map((lesson) => lesson.title));
    assert.equal(fell.schema, 1);
    if (generated === null || generated === undefined) assert.equal(fell.generatedBy, undefined);
    else {
      assert.equal(fell.generatedBy, 'template');
      assert.match(fell.generateNote, /general lessons/);
    }
  }
  const lantern = load('lantern-apprentice.json');
  const other = course.finishCourse({
    job: adOf(lantern),
    role: lantern.role,
    company: lantern.company,
    aboutYou: { source: 'answers', text: lantern.about },
    interviewAt: lantern.interviewAt
  }, assemble(lantern));
  assert.equal(other.generatedBy, 'subscription');
  assert.match(other.course.map((lesson) => lesson.exercise).join(' '), /Lantern Homes/);
  assert.match(other.questions.join(' '), /lockout/i);
});
