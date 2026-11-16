// Tests for the local answer coach (coach.js). Run: node --test test/
// All job ads and answers here are fictional practice data.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const Coach = require('../coach.js');

const IDS = ['structure', 'ownership', 'evidence', 'relevance', 'length', 'clarity'];
const check = (r, id) => r.checks.find((c) => c.id === id);
const words = (n, w = 'word') => Array.from({ length: n }, () => w).join(' ');

// Fictional contexts shaped like PrepEngine.analyze() output and questionInfo items.
const retail = {
  question: 'Tell me about a time you helped a customer when the store was busy.',
  info: { kind: 'behavioural', theme: 'customer', source: 'Greet every customer and help them find what they need', probe: 'Patience under pressure', include: ['A real time you helped a busy customer', 'What you did step by step', 'How it turned out'] },
  analysis: { skills: ['POS system'], keywords: ['customer service', 'restock shelves', 'inventory counts', 'sales floor'], requirements: [{ text: 'Greet every customer and help them find what they need', kind: 'duty', themes: [], score: 3 }] }
};
const trades = {
  question: 'Tell me about a time you found a fault in a circuit.',
  info: { kind: 'behavioural', source: 'Troubleshoot circuits using a multimeter', include: ['How you stayed safe', 'The steps you took'] },
  analysis: { skills: ['multimeter', 'lockout/tagout', 'blueprints'], keywords: ['electrical code', 'safety procedures', 'job sites'] }
};
const care = {
  question: 'Tell me about a time you noticed a change in someone you cared for.',
  info: { kind: 'behavioural', source: "Observe changes in a resident's condition and report them to the nurse in charge", include: ['What you noticed', 'Who you told'] },
  analysis: { skills: ['PointClickCare', 'CPR', 'First Aid'], keywords: ['personal care', 'infection prevention', 'mechanical lifts'] }
};
const tech = {
  question: 'Tell me about a project you are proud of.',
  info: { kind: 'behavioural', source: 'Build accessible, responsive interfaces in React and TypeScript', include: ['Your part', 'The tools you used'] },
  analysis: { skills: ['React', 'TypeScript', 'Jest', 'Git'], keywords: ['accessible', 'responsive interfaces', 'unit tests'] }
};
const cafe = {
  question: 'Tell me about a time you stayed calm during a rush.',
  info: { kind: 'behavioural', source: 'stay calm and friendly during the morning rush', include: ['A real busy shift', 'What you did'] },
  analysis: { skills: ['Square', 'Food Safe'], keywords: ['espresso drinks', 'morning rush', 'small team'] }
};

const STRONG = {
  retail: 'Last December at my part-time job at a clothing store, the store was packed and a customer was upset because she could not find a coat in her size. My task was to help her before her bus left. I greeted her, listened to what she needed and checked our stockroom. I found the last coat in her size, rang it up on the POS system and showed her our exchange policy. She thanked me and came back the next week with her sister.',
  trades: 'On a renovation job last spring, the homeowner said the kitchen lights kept tripping the breaker. I needed to find the fault safely. I locked out the panel, tested the circuit with a multimeter and traced the problem to a loose neutral in a junction box. I fixed the connection, re-tested it with my journeyperson and explained to the homeowner what we found. The lights have worked since then and the homeowner booked us again for the basement.',
  care: 'One evening on my unit, I noticed a resident was not eating and seemed more confused than usual. I checked her vitals, reported the change to the nurse in charge and charted it in PointClickCare. The nurse found she had an infection and started treatment early. Her family thanked me the next day.',
  tech: 'In my bootcamp project we built a travel planner in React. I was responsible for the booking form. I wrote the components in TypeScript, added Jest tests and fixed three accessibility bugs we found with a screen reader. The page load time dropped from 4 seconds to 1.5 seconds and our instructor used it as an example for the next group.',
  cafe: 'One Saturday at the cafe where I worked, two baristas called in sick and the line was out the door. We had to keep orders moving. I took over the register, called out each order clearly and made the espresso drinks while my coworker steamed milk. We served about 120 people in the morning rush and only one order had to be remade.'
};

test('live() returns the contract shape and is cheap', () => {
  const r = Coach.live('I greeted her and checked the back, so she was happy.');
  assert.deepEqual(Object.keys(r).sort(), ['seconds', 'star', 'words']);
  assert.deepEqual(Object.keys(r.star).sort(), ['action', 'result', 'situation', 'task']);
  for (const v of Object.values(r.star)) assert.equal(typeof v, 'boolean');
  assert.equal(r.words, 11);
  assert.equal(r.star.action, true);
  assert.equal(r.star.result, true);
});

test('review() returns the contract shape with six checks in order', () => {
  const r = Coach.review(STRONG.retail, retail);
  assert.deepEqual(Object.keys(r).sort(), ['checks', 'echoed', 'missing', 'seconds', 'star', 'starScore', 'summary', 'words']);
  assert.deepEqual(r.checks.map((c) => c.id), IDS);
  for (const c of r.checks) {
    assert.deepEqual(Object.keys(c).sort(), ['detail', 'id', 'ok', 'title']);
    assert.equal(typeof c.ok, 'boolean');
    assert.ok(c.title.length > 3 && c.detail.length > 8, c.id);
    assert.ok(!/\.\s+\p{Lu}/u.test(c.detail.replace(/\d\.\d/g, '')), `one sentence: ${c.detail}`);
  }
  assert.ok(Array.isArray(r.echoed) && Array.isArray(r.missing) && r.missing.length <= 3);
  assert.equal(typeof r.summary, 'string');
  assert.ok(Number.isInteger(r.starScore) && r.starScore >= 0 && r.starScore <= 4);
});

test('a strong answer gets all four parts and kind, specific feedback', () => {
  const r = Coach.review(STRONG.retail, retail);
  assert.deepEqual(r.star, { situation: true, task: true, action: true, result: true });
  assert.equal(r.starScore, 4);
  assert.equal(check(r, 'structure').title, 'Situation, Task, Action, Result');
  assert.equal(check(r, 'structure').ok, true);
  assert.equal(check(r, 'ownership').ok, true);
  assert.match(check(r, 'ownership').detail, /“greeted”/);
  assert.equal(check(r, 'evidence').ok, true);
  assert.equal(check(r, 'relevance').ok, true);
  assert.ok(r.echoed.includes('POS system'));
  assert.equal(check(r, 'clarity').ok, true);
  assert.match(r.summary, /^All 4 parts · \d+ words, about \d+ seconds · uses \d+ words? from the ad$/);
});

test('a weak answer leads with what is there and says what to add', () => {
  const r = Coach.review('I am a hard worker and I like helping people. I am good with customers.', retail);
  assert.ok(r.starScore <= 1);
  assert.equal(check(r, 'structure').ok, false);
  assert.match(check(r, 'structure').detail, /what you did/);
  assert.equal(check(r, 'ownership').ok, false);
  assert.equal(check(r, 'evidence').ok, false);
  assert.equal(check(r, 'length').ok, false);
  assert.match(check(r, 'length').detail, /^About \d+ seconds out loud/);
  assert.match(r.summary, /^No story parts yet|^1 of 4 parts/);
});

test('a "we"-heavy answer is asked for what you did yourself, with the counts', () => {
  const text = 'At my last job we had a big inventory count. We split the store into sections and we counted everything. We worked late and we finished on time. We were happy. I helped too.';
  const r = Coach.review(text, { question: 'Tell me about a time you worked as part of a team.', info: null, analysis: retail.analysis });
  const own = check(r, 'ownership');
  assert.equal(own.ok, false);
  assert.equal(own.detail, 'You said “we” 6 times and “I” once; try saying what you did yourself.');
});

test('ownership counts chained actions and ignores other people', () => {
  const r = Coach.review('I greeted her, asked what she needed, checked the back and found her size.', retail);
  assert.match(check(r, 'ownership').detail, /^You name 4 things you did yourself/);
  const other = Coach.review('My manager asked me to restock. She showed me the stockroom and she counted the boxes.', retail);
  assert.equal(check(other, 'ownership').ok, false);
  const notes = Coach.review('Restocked the shelves before close. Counted the till and checked the doors.', retail);
  assert.equal(check(notes, 'ownership').ok, true);
});

test('a filler-heavy answer is flagged, and "sort of" is not an action', () => {
  const text = 'Um so basically I was like working at a cafe and um the coffee machine kind of broke and honestly I just sort of called my manager and basically we fixed it I guess and it was literally fine.';
  const r = Coach.review(text, null);
  const clarity = check(r, 'clarity');
  assert.equal(clarity.ok, false);
  assert.match(clarity.detail, /“basically” twice/);
  assert.match(check(r, 'ownership').detail, /“called”/);
  assert.doesNotMatch(check(r, 'ownership').detail, /“sort”/);
});

test('very long sentences are pointed out', () => {
  const text = `I helped a customer ${words(45, 'and')} then I checked the stockroom and found her size and she was happy.`;
  const clarity = check(Coach.review(text, retail), 'clarity');
  assert.equal(clarity.ok, false);
  assert.match(clarity.detail, /^One sentence runs to \d+ words/);
});

test('works for retail, trades, healthcare, tech and hospitality answers', () => {
  const cases = { retail, trades, care, tech, cafe };
  for (const [name, ctx] of Object.entries(cases)) {
    const r = Coach.review(STRONG[name], ctx);
    assert.equal(r.star.action, true, name);
    assert.equal(r.star.result, true, name);
    assert.ok(r.starScore >= 3, `${name}: ${JSON.stringify(r.star)}`);
    assert.equal(check(r, 'structure').ok, true, name);
    assert.equal(check(r, 'evidence').ok, true, `${name}: ${check(r, 'evidence').detail}`);
    assert.equal(check(r, 'relevance').ok, true, `${name}: ${JSON.stringify(r.echoed)}`);
    assert.ok(r.echoed.length >= 2, name);
  }
  assert.equal(check(Coach.review(STRONG.trades, trades), 'ownership').ok, true);
  assert.ok(Coach.review(STRONG.trades, trades).echoed.includes('multimeter'));
  assert.ok(Coach.review(STRONG.care, care).echoed.includes('PointClickCare'));
  assert.ok(Coach.review(STRONG.tech, tech).echoed.includes('React'));
  assert.match(check(Coach.review(STRONG.tech, tech), 'evidence').detail, /“4 seconds”/);
});

test('relevance works with and without the ad analysis', () => {
  const withAll = Coach.review(STRONG.retail, retail);
  assert.ok(withAll.echoed.length >= 2);
  const sourceOnly = Coach.review('I greet every customer at the door and help them find sizes.', { question: retail.question, info: { source: retail.info.source }, analysis: null });
  assert.ok(sourceOnly.echoed.includes('customer'));
  const none = Coach.review(STRONG.retail, { question: 'Tell me about a busy day.' });
  assert.deepEqual(none.echoed, []);
  assert.deepEqual(none.missing, []);
  assert.equal(check(none, 'relevance').ok, true);
  assert.doesNotMatch(none.summary, /from the ad/);
  // Old preparations quote the ad inside the question.
  const old = Coach.review('I restocked the shelves every night.', { question: 'Tell me about a real example relevant to “Keep the sales floor tidy, restock shelves and set up new displays”. What did you personally do?' });
  assert.ok(old.echoed.includes('restock'));
  assert.ok(old.missing.length >= 1 && old.missing.length <= 3);
});

test('missing words come from the ad, are relevant and never already used', () => {
  const r = Coach.review('I helped a shopper find a coat and she was happy.', retail);
  assert.ok(r.missing.length <= 3);
  for (const m of r.missing) assert.ok(!r.echoed.includes(m));
  // Coaching words from "a strong answer includes" are not ad words.
  for (const junk of ['turned', 'busy', 'step', 'real']) assert.ok(!r.missing.includes(junk), junk);
  assert.ok(r.missing.includes('greet'));
  const t = Coach.review('I built a small website for a friend.', tech);
  assert.ok(!(t.missing.includes('responsive') && t.missing.includes('responsive interfaces')));
});

test('length is timed at about 140 words a minute', () => {
  assert.equal(Coach.live(words(140)).seconds, 60);
  assert.equal(Coach.live(words(70)).seconds, 30);
  const ok = check(Coach.review(STRONG.retail + ' ' + STRONG.retail.slice(0, 200), retail), 'length');
  assert.equal(ok.ok, true);
  assert.match(ok.detail, /out loud, a comfortable length\.$/);
  const long = check(Coach.review(`I helped. ${words(420)}`, retail), 'length');
  assert.equal(long.ok, false);
  assert.match(long.detail, /^About 3 minutes out loud; try to keep it under 2 and a half minutes/);
});

test('situational answers can say what you would do', () => {
  const r = Coach.review('I would first make sure the customer feels heard, then I would check the stock system and call the other store. If it is not there, I would offer to order it so she leaves happy.', { question: 'What would you do if a customer could not find their size?', info: { kind: 'situational' } });
  assert.equal(check(r, 'structure').ok, true);
  assert.match(check(r, 'ownership').detail, /you would do yourself/);
});

test('motivation and closing questions get fitting checks', () => {
  const m = Coach.review('I love making coffee and I enjoy the rush of a busy morning. At my last job at a bakery I opened at 6 am every Saturday, so early starts suit me.', { question: 'Why do you want to work here?', info: { kind: 'motivation', source: null }, analysis: cafe.analysis });
  assert.equal(check(m, 'structure').ok, true);
  assert.equal(check(m, 'structure').title, 'A clear reason');
  assert.doesNotMatch(m.summary, /parts/);
  const c = Coach.review('What does a great first month look like for a new barista? How do you train people on the Square register?', { question: 'What questions do you have for us?', info: { kind: 'closing' }, analysis: cafe.analysis });
  assert.equal(check(c, 'structure').ok, true);
  assert.match(check(c, 'structure').detail, /2 real questions/);
  assert.ok(c.echoed.includes('Square'));
  // Without questionInfo the kind comes from the question wording.
  const old = Coach.review('I enjoy helping people because I like seeing them leave happy, and at my last job I helped customers every day.', { question: 'What interests you in Store Associate at Maple & Thread?' });
  assert.equal(check(old, 'structure').title, 'A clear reason');
});

test('robust to empty, odd and huge input', () => {
  const odd = [undefined, null, '', '   ', 42, {}, [], Symbol('x'), '😀😀 🎉 👍', '<script>alert(1)</script>', '\u0000\u0001'];
  for (const v of odd) {
    const l = Coach.live(v);
    assert.ok(Number.isFinite(l.words) && Number.isFinite(l.seconds));
    const r = Coach.review(v, { question: 42, info: [], analysis: { skills: 'React', keywords: [1, null, {}, 'customer service'], requirements: 'nope' } });
    assert.deepEqual(r.checks.map((c) => c.id), IDS);
    assert.equal(typeof r.summary, 'string');
  }
  assert.equal(Coach.review('', null).summary, 'No answer yet');
  assert.equal(Coach.review('   ').words, 0);
  const huge = STRONG.care.repeat(200).slice(0, 60000);
  const r = Coach.review(huge, care);
  assert.ok(r.words > 9000);
  assert.equal(check(r, 'length').ok, false);
});

test('non-English answers are timed but not judged on English wording', () => {
  const fr = Coach.review('Dans mon dernier emploi au magasin, un client était fâché parce que sa commande était en retard. J’ai écouté, j’ai vérifié le système et j’ai trouvé une solution. Il est revenu la semaine suivante.', retail);
  assert.match(check(fr, 'structure').detail, /reads English answers/);
  assert.ok(fr.words > 20);
  const zh = Coach.live('我在一家咖啡店工作了两年。有一次顾客很生气，我先听他说话，然后帮他重新做了一杯咖啡。');
  assert.ok(zh.words >= 15 && zh.seconds > 5);
});

test('fast enough for every keystroke', () => {
  const text = words(400, 'I greeted the customer and checked the back so she was happy');
  const sample = text.split(' ').slice(0, 400).join(' ');
  for (let i = 0; i < 20; i++) Coach.live(sample);
  const n = 200;
  const t0 = performance.now();
  for (let i = 0; i < n; i++) Coach.live(sample);
  const live = (performance.now() - t0) / n;
  assert.ok(live < 2, `live took ${live.toFixed(3)} ms`);
  const t1 = performance.now();
  for (let i = 0; i < 20; i++) Coach.review(sample, retail);
  const review = (performance.now() - t1) / 20;
  assert.ok(review < 20, `review took ${review.toFixed(3)} ms`);
});

test('deterministic and never mutates its inputs', () => {
  const deepFreeze = (o) => { if (o && typeof o === 'object') { Object.values(o).forEach(deepFreeze); Object.freeze(o); } return o; };
  const ctx = deepFreeze(structuredClone(tech));
  const a = Coach.review(STRONG.tech, ctx);
  const b = Coach.review(STRONG.tech, ctx);
  assert.deepEqual(a, b);
  assert.deepEqual(Coach.live(STRONG.tech), Coach.live(STRONG.tech));
  assert.deepEqual(ctx, tech);
});

test('plain, kind words only: no hiring scores or jargon', () => {
  const banned = /\b(?:competenc\w*|stakeholders?|probe\w*|leverag\w*|KPIs?|score\w*|hire|hiring|grade\w*|fail\w*|verdict|wrong|bad|poor|weak|theme\w*)\b/i;
  const answers = [...Object.values(STRONG), '', 'I am a hard worker.', 'We did it. We were great. We won. We finished.', 'um um like, basically, kind of fine'];
  const ctxs = [retail, trades, care, tech, cafe, null, { question: 'Why do you want this job?' }, { question: 'Any questions for us?' }];
  for (const text of answers) {
    for (const ctx of ctxs) {
      const r = Coach.review(text, ctx);
      for (const c of r.checks) {
        assert.doesNotMatch(c.title, banned);
        assert.doesNotMatch(c.detail, banned, c.detail);
      }
      assert.doesNotMatch(r.summary, banned);
    }
  }
});

test('summary is one plain line for the session log', () => {
  const r = Coach.review('At my last job a customer was upset. I listened and offered a refund.', retail);
  assert.match(r.summary, /^\d of 4 parts \(no [a-z, ]+ yet\) · \d+ words, about \d+ seconds · (uses \d+ words? from the ad|no words from the ad yet)$/);
  assert.ok(!r.summary.includes('\n'));
});
