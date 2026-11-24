// node --test test/live.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import http from 'node:http';

const require = createRequire(import.meta.url);
const live = require('../live.js');
const provider = require('../provider.js');
const { createTowerServer } = require('../tower/server.js');

const ABOUT = 'I was a barista at Harbour Cafe for three years. I trained two new hires and opened on Saturdays. One Saturday the till was short and I recounted it with Priya Shah.';
const THIN = 'I helped.';
const SOLID = 'I was a barista at Harbour Cafe for three years. One Saturday the till was short, so I stayed and recounted every note with Priya Shah, and we found the missing eighteen dollars before we closed the shop for the night.';

function prep() {
  return {
    role: 'Store associate',
    company: 'Maple & Thread',
    job: 'Greet every customer and handle cash accurately on the POS. Available evenings and weekends. A criminal record check is required.',
    questions: [
      'What made you want to apply for the store associate job?',
      'Tell me about a time you handled cash when something did not add up.',
      'Tell me about a time you helped someone while a line was waiting.',
      'How do you make sure people can count on you to show up?',
      'Walk me through how you would handle a return.',
      'What questions would you like to ask about the job?',
      'Have you completed a criminal record check?'
    ],
    aboutYou: { text: ABOUT }
  };
}

test('a generic interview asks five or six ad questions and follows up once when the answer is thin', () => {
  const session = live.createSession(prep(), { provider: false });
  session.about = ABOUT;
  assert.equal(session.generic, true);
  assert.equal(session.questions.length >= 5 && session.questions.length <= 6, true);
  assert.equal(session.questions.some((q) => /criminal record/i.test(q)), false);
  assert.match(session.current, /store associate|cash|helped|count on you|return|questions/i);

  let steps = 0;
  while (session.phase !== 'review' && steps < 20) {
    steps += 1;
    const thin = session.answers.length === 0 && !session.follow;
    const result = live.applyAnswer(session, thin ? THIN : SOLID);
    assert.equal(result.ok, true, result.reason);
  }
  assert.equal(session.phase, 'review');
  assert.equal(session.answers.length, session.questions.length);
  assert.equal(session.answers[0].follow.length > 0, true);
  assert.equal(session.answers[1].follow, '');
  assert.equal(session.debrief.items.length, session.answers.length);
  assert.match(session.debrief.overall, /practice/i);
  assert.equal(JSON.stringify(session.debrief).includes('Northwind'), false);
  assert.match(session.debrief.items[0].stronger, /Harbour Cafe/);
});

test('schemas reject a bad turn and a short debrief, and a live follow-up stays on the same question', () => {
  assert.equal(live.validateTurn({ say: 'Tell me about the till.', kind: 'question', extra: true }).ok, false);
  assert.equal(live.validateTurn({ say: 'Have you completed a criminal record check?', kind: 'question' }).reason, 'checks');
  assert.equal(live.validateTurn({ say: 'Hi', kind: 'question' }).ok, false);
  const session = live.createSession(prep(), { provider: true });
  session.about = ABOUT;
  const opening = live.applyTurn(session, { say: 'What made you want this store job?', kind: 'question' });
  assert.equal(opening.effect, 'speak');
  assert.equal(live.applyAnswer(session, SOLID).effect, 'request-turn');
  const follow = live.applyTurn(session, { say: 'What did you do when the till was short?', kind: 'follow' });
  assert.equal(follow.effect, 'speak');
  assert.equal(session.index, 0);
  assert.equal(live.applyTurn(session, { say: 'And another follow-up?', kind: 'follow' }).ok, false);
  assert.equal(live.applyAnswer(session, SOLID).effect, 'request-turn');
  assert.equal(live.applyTurn(session, { say: 'Thanks, that is enough.', kind: 'done' }).reason, 'early');
  for (let i = session.answers.length; i < 5; i++) {
    live.applyTurn(session, { say: 'Question ' + (i + 1) + ' about the shop floor?', kind: 'question' });
    live.applyAnswer(session, SOLID);
  }
  const done = live.applyTurn(session, { say: 'Thank you, that is the end of our practice.', kind: 'done' });
  assert.equal(done.effect, 'request-debrief');
  const debrief = {
    items: session.answers.map(() => ({ landed: 'You named a real moment.', fix: 'Keep the story to four sentences.', stronger: 'I recounted the till at Harbour Cafe with Priya Shah.' })),
    overall: 'You can tell a real story. This is practice, not a hiring verdict.'
  };
  assert.equal(live.applyDebrief(session, debrief).effect, 'review');
  assert.equal(live.validateDebrief({ items: debrief.items.slice(0, 1), overall: debrief.overall }, session.answers.length).ok, false);
});

test('ending early still debriefs, and a failed live turn falls back to the ad', () => {
  const session = live.createSession(prep(), { provider: false });
  session.about = ABOUT;
  live.applyAnswer(session, SOLID);
  const ended = live.endSession(session);
  assert.equal(ended.effect, 'review');
  assert.equal(session.debrief.items.length, 1);

  const liveSession = live.createSession(prep(), { provider: true });
  live.useTemplate(liveSession, ABOUT);
  assert.equal(liveSession.generic, true);
  assert.match(liveSession.note, /generic questions/);
  assert.equal(liveSession.phase, 'listen');
  assert.ok(liveSession.current);
});

test('the phone calls the interview routes with the bearer secret kept out of the body', async () => {
  const session = live.createSession(prep(), { provider: true });
  live.applyTurn(session, { say: 'What made you want this store job?', kind: 'question' });
  live.applyAnswer(session, 'SECRET_ANSWER_TOKEN ' + SOLID);
  const body = live.turnPayload(session, prep());
  assert.equal(JSON.stringify(body).includes('towerSecret'), false);
  assert.match(body.ad, /POS/);
  let seen;
  const prefs = { provider: 'subscription', towerUrl: 'https://omarchy.tailnet.ts.net', towerSecret: 'super-secret-value' };
  const result = await provider.requestInterview(prefs, '/interview/turn', body, {
    fetch: async (url, opts) => {
      seen = { url, opts };
      return { ok: true, status: 200, json: async () => ({ ok: true, turn: { say: 'Tell me about a busy Saturday.', kind: 'question' } }) };
    }
  });
  assert.equal(result.ok, true);
  assert.equal(seen.url, 'https://omarchy.tailnet.ts.net/interview/turn');
  assert.equal(seen.opts.headers.authorization, 'Bearer super-secret-value');
  assert.equal(seen.opts.body.includes('super-secret-value'), false);
  assert.equal(provider.interviewUrl(prefs, '/interview/secret'), '');
});

test('the tower interview routes require the secret and return schema JSON', async () => {
  const tmpRoot = mkdtempSync(join(tmpdir(), 'nextstep-live-'));
  const spawn = (bin, args) => {
    const out = args[args.indexOf('--output-last-message') + 1];
    require('fs').writeFileSync(out, JSON.stringify({ say: 'What made you want this store job?', kind: 'question' }));
    const child = new EventEmitter();
    child.stderr = { resume() {} };
    child.kill = () => {};
    process.nextTick(() => child.emit('close', 0));
    return child;
  };
  const server = createTowerServer({ secret: 'test-secret-value-32', spawn, tmpRoot, interviewTimeoutMs: 2000 });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const call = (auth, path, payload) => new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port, path, method: 'POST',
      headers: { origin: 'https://shai-mate.github.io', authorization: auth, 'content-type': 'application/json' }
    }, (res) => {
      const chunks = [];
      res.on('data', (chunk) => chunks.push(chunk));
      res.on('end', () => resolve({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }));
    });
    req.on('error', reject);
    req.end(JSON.stringify(payload));
  });
  try {
    const denied = await call('Bearer nope', '/interview/turn', { ad: prep().job });
    assert.equal(denied.status, 401);
    const ok = await call('Bearer test-secret-value-32', '/interview/turn', {
      ad: prep().job + ' SECRET_AD_TOKEN',
      about: ABOUT,
      company: 'Maple & Thread',
      role: 'Store associate',
      questions: ['What made you want this job?'],
      transcript: [],
      answerCount: 0,
      follow: false,
      userEnded: false
    });
    assert.equal(ok.status, 200, ok.text);
    assert.match(ok.text, /What made you want this store job/);
    assert.equal(ok.text.includes('SECRET_AD_TOKEN'), false);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    rmSync(tmpRoot, { recursive: true, force: true });
  }
});
