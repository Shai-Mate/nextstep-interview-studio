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

test('keeps the words people use: phrasal verbs, clock times, time spans, reactions', () => {
  const r = Coach.review('On a basement reno I locked out the panel, tagged it and tested for voltage. I opened at 6 am and the job passed inspection after a week.', trades);
  assert.equal(r.star.situation, true);
  assert.match(check(r, 'ownership').detail, /“locked out”/);
  assert.match(check(r, 'evidence').detail, /“6 am”/);
  const span = Coach.review('On my unit a resident refused her bath. I asked her daughter what she liked and played her favourite songs. After a week she was calmer.', care);
  assert.match(check(span, 'evidence').detail, /“after a week”/);
  const praise = Coach.review('At my placement a resident kept refusing meals. I sat with her, asked what she liked and told the nurse. Later the nurse asked me to share the idea at handover.', care);
  assert.equal(check(praise, 'evidence').ok, true);
});

test('scene-setting and object pronouns are not mistaken for who did what', () => {
  const work = Coach.review('I work at a grocery store on weekends. I restocked the bread aisle and helped a customer.', retail);
  assert.match(check(work, 'ownership').detail, /^You name 2 things/);
  const it = Coach.review('I reproduced it in Safari, found a click handler and rewrote it as a button.', tech);
  assert.match(check(it, 'ownership').detail, /^You name 3 things/);
  const flow = Coach.review('I am a calm person, I just go with the flow and I get along with everyone.', cafe);
  assert.equal(check(flow, 'ownership').ok, false);
  assert.equal(flow.star.action, false);
});

test('tenure is not counted as proof it worked', () => {
  const r = Coach.review('I worked there for 2 years and I always helped customers find what they needed.', retail);
  assert.doesNotMatch(check(r, 'evidence').detail, /2 years/);
});

test('hypothetical and learning questions get their own plain titles', () => {
  const sit = Coach.review('I would stay calm, apologise and check the order. Then I would remake the drink quickly so the customer leaves happy.', { question: 'What would you do if a customer said their drink was wrong?', info: { kind: 'situational' } });
  assert.equal(check(sit, 'structure').title, 'Your steps');
  assert.equal(check(sit, 'evidence').title, 'Real details');
  const gap = Coach.review('I would sign up for the course in my first week and study on my days off. At school I finished the WHMIS course in two days.', { question: 'How would you get your Food Safe certificate?', info: { kind: 'gap' } });
  assert.equal(check(gap, 'structure').title, 'How you would learn it');
  assert.equal(check(gap, 'structure').ok, true);
  assert.match(check(gap, 'ownership').detail, /“sign up”/);
});

test('skills with symbols match the way people type them', () => {
  const r = Coach.review('I know C++ and Node.js, I ran A/B tests and I follow lockout/tagout on every job.', { analysis: { skills: ['C++', 'Node.js', 'A/B tests', 'lockout/tagout', 'GraphQL'] } });
  for (const s of ['C++', 'Node.js', 'A/B tests', 'lockout/tagout']) assert.ok(r.echoed.includes(s), s);
  assert.ok(!r.echoed.includes('GraphQL'));
  assert.doesNotMatch(check(r, 'evidence').detail, /“B”/);
});

test('short note-style English is still read as English', () => {
  const r = Coach.review('Restocked shelves. Counted inventory. Trained 3 new hires. Reduced shrink 10%. Opened store Saturdays.', retail);
  assert.doesNotMatch(check(r, 'structure').detail, /English/);
  assert.equal(r.star.action, true);
  assert.equal(r.star.result, true);
});

// Realistic typed answers, written against the fixture ads in qa/fixtures (all fictional).
const OFFICE = {
  question: 'Tell me about a time you turned around an account at risk.',
  info: { kind: 'behavioural', source: 'Monitor account health using product usage data and act early on churn risk', include: ['A real example', 'What you did yourself', 'How it turned out'] },
  analysis: { skills: ['Salesforce', 'Excel', 'Google Sheets'], keywords: ['churn risk', 'onboarding', 'renewal', 'product usage data'] }
};
const TYPED = {
  retail: 'Last December I worked weekends at a busy gift shop. A woman came in looking for a present for her dad and she was stressed because the store was packed. I greeted her, asked what he liked and showed her three options in her budget. I also checked the stockroom for a bigger size. She bought a sweater and came back the next week to thank me.',
  office: 'At my last job I owned onboarding for 30 small business clients. Usage data showed four accounts were at risk, so I set up weekly check-ins, rebuilt the training deck and ran a short workshop for each team. I tracked logins in a simple Google Sheets report. Within one quarter all four renewed and average weekly usage rose by 22 percent.'
};

test('strong typed answers are a good length, with encouragement instead of a warning', () => {
  const cases = [[TYPED.retail, retail], [TYPED.office, OFFICE], [STRONG.trades, trades], [STRONG.tech, tech], [STRONG.cafe, cafe]];
  for (const [text, ctx] of cases) {
    const r = Coach.review(text, ctx);
    assert.ok(r.words >= 50 && r.words <= 90, `${r.words} words`);
    const len = check(r, 'length');
    assert.equal(len.ok, true, len.detail);
    assert.match(len.detail, /^About \d+ seconds as written; said out loud with a little detail it will run (?:about|closer to) a minute, which is a good length\.$/);
  }
  // Too short is still asked for more, in kind words that fit the question.
  const short = check(Coach.review('At my old job at a grocery store I helped a lady find gluten free bread.', retail), 'length');
  assert.equal(short.ok, false);
  assert.match(short.detail, /^About \d+ seconds out loud; add how it turned out, so it runs closer to a minute\.$/);
  const why = check(Coach.review('I love helping people put together outfits, and I shop at your store a lot. I worked at a thrift shop for a year where I sorted donations and helped customers.', { question: 'Why do you want to work at Maple & Thread?', info: { kind: 'motivation' } }), 'length');
  assert.equal(why.ok, true, why.detail);
  assert.match(why.detail, /it will run about 30 seconds, which is a good length\.$/);
  const sit = check(Coach.review('I would stay calm and ask her why.', { question: 'What would you do if a resident refused their bath?', info: { kind: 'situational' } }), 'length');
  assert.equal(sit.ok, false);
  assert.doesNotMatch(sit.detail, /turned out/);
  assert.match(sit.detail, /what you would do next and why/);
  const gap = check(Coach.review('I would ask my journeyperson.', { question: 'How would you learn to work on commercial panels?', info: { kind: 'gap' } }), 'length');
  assert.doesNotMatch(gap.detail, /turned out/);
});

test('a "would" answer to a tell-me-about-a-time question asks for a real time', () => {
  const r = Coach.review('I would greet them, ask what they need and find it for them. I would make sure they are happy.', retail);
  const s = check(r, 'structure');
  assert.equal(s.ok, false);
  assert.equal(s.detail, 'This says what you would do; tell one real time it happened instead: where you were, what you did and how it turned out.');
  assert.equal(r.star.result, false);
  const care2 = Coach.review('I would tell the nurse in charge right away and write it in PointClickCare. Then I would check on her every hour.', care);
  assert.match(check(care2, 'structure').detail, /^This says what you would do/);
  // Without question info, the wording of an old question still says it wants a real example.
  const old = Coach.review('If a customer needs help I would go over and help them find it, and I would check the back if it is not on the floor.', { question: 'Tell me about a time you helped a customer.' });
  assert.match(check(old, 'structure').detail, /^This says what you would do/);
  // The same steps are exactly right for a "what would you do" question.
  const sit = Coach.review('I would greet them, ask what they need and find it for them, so they would leave happy.', { question: 'What would you do if a customer could not find what they need?', info: { kind: 'situational' } });
  assert.equal(check(sit, 'structure').ok, true);
  assert.equal(check(sit, 'structure').detail, 'You say what you would do and how you would know it worked.');
  // A real story with one "next time I would" stays a real story, and "I'd already" means "I had".
  const real = Coach.review(`${STRONG.retail} Next time I would check the stockroom first.`, retail);
  assert.equal(check(real, 'structure').ok, true);
  const had = Coach.review("One Saturday at the cafe, I'd already restocked the cups when the rush hit. I took orders and called them out clearly, and we served everyone in about 20 minutes.", cafe);
  assert.equal(check(had, 'structure').ok, true, check(had, 'structure').detail);
});

test('"make sure it is safe" and "would be happy" are hopes, not how it turned out', () => {
  assert.equal(Coach.live('We check everything and we make sure it is safe.').star.result, false);
  assert.equal(Coach.live('I would make sure they are happy and safe.').star.result, false);
  assert.equal(Coach.live('I knew the customer would be happy.').star.result, false);
  assert.equal(Coach.live('I found her size and she left happy.').star.result, true);
  assert.equal(Coach.live('We finished the panel change safely.').star.result, true);
});

test('tool names alone are not proof it worked', () => {
  const r = Coach.review('I fix bugs all the time. I use React and TypeScript and Git. I am a fast learner.', tech);
  const ev = check(r, 'evidence');
  assert.equal(ev.ok, false);
  assert.equal(ev.detail, 'You mention “React” and “TypeScript”; add how you know it worked, like how many, how long, or what someone said.');
  // With a result, the same names are real detail.
  const done = Coach.review('In my bootcamp project I rebuilt the booking form in React and TypeScript, and after that the bug reports went down.', tech);
  assert.equal(check(done, 'evidence').ok, true, check(done, 'evidence').detail);
});

test('situational and learning answers get a summary without story parts', () => {
  const sit = Coach.review('I would stay calm and ask her why she does not want it. I would offer a different time or a sponge bath instead, and respect her choice. Then I would tell the nurse and write it in the chart.', { question: 'What would you do if a resident refused their bath?', info: { kind: 'situational', source: null }, analysis: care.analysis });
  assert.doesNotMatch(sit.summary, /parts/);
  assert.match(sit.summary, /^\d+ words, about \d+ seconds/);
  const gap = Coach.review('I would ask my journeyperson to let me watch the first few, read the code on the evenings and practise at school.', { question: 'How would you learn to work on commercial panels?', info: { kind: 'gap', source: null }, analysis: trades.analysis });
  assert.doesNotMatch(gap.summary, /parts/);
});

test('missing words stay on topic and never repeat what the answer already said', () => {
  // Nothing in the question is tied to one line of the ad: no unrelated tool names.
  const sit = Coach.review('I would stay calm and ask her why she does not want it, then offer a sponge bath instead and tell the nurse.', { question: 'What would you do if a resident refused their bath?', info: { kind: 'situational', source: null }, analysis: care.analysis });
  assert.deepEqual(sit.missing, []);
  assert.doesNotMatch(check(sit, 'relevance').detail, /PointClickCare|mechanical lifts/);
  const why = Coach.review('I love making coffee and I enjoy a busy morning. At my last job at a bakery I opened every Saturday.', { question: 'Why do you want to work at Little Fern Coffee?', info: { kind: 'motivation', source: null }, analysis: cafe.analysis });
  assert.deepEqual(why.missing, []);
  // A word already used inside an echoed phrase is not suggested again.
  const office = Coach.review(TYPED.office.replace('Usage data showed', 'Product usage data showed'), { ...OFFICE, analysis: { ...OFFICE.analysis, keywords: [...OFFICE.analysis.keywords, 'product'] } });
  assert.ok(office.echoed.includes('product usage data'), JSON.stringify(office.echoed));
  assert.ok(!office.missing.includes('product'), JSON.stringify(office.missing));
});

test('answers in other languages are not flagged on English-only checks', () => {
  const es = Coach.review('En mi último trabajo en una tienda, una clienta estaba molesta porque no encontraba su talla. La escuché, revisé el almacén y encontré la última chaqueta. Volvió la semana siguiente con su hermana.', retail);
  for (const id of ['ownership', 'evidence', 'relevance']) {
    assert.equal(check(es, id).ok, true, id);
    assert.match(check(es, id).detail, /^Not checked: this coach reads English answers for now\.$/);
  }
  assert.match(check(es, 'structure').detail, /reads English answers/);
  assert.deepEqual(es.missing, []);
});

test('what you always or usually do is not one real time', () => {
  // Trades fixture: a generic "we always" answer is not a story with all four parts.
  const r = Coach.review("We always do lockout tagout on our sites. We check everything and we make sure it's safe. Our foreman is really strict about it so we never had any problems.", trades);
  assert.equal(r.star.result, false);
  assert.notEqual(r.starScore, 4);
  assert.equal(check(r, 'structure').ok, false);
  assert.equal(Coach.live('We always do lockout tagout on our sites.').star.situation, false);
  assert.equal(Coach.live('At my last job, I always greeted customers.').star.situation, true);
  assert.equal(Coach.live('One morning a regular who usually orders a latte came in upset.').star.situation, true);
  const usual = Coach.review('I am a people person and I always help customers. I usually check the back if something is not on the floor.', retail);
  assert.equal(check(usual, 'structure').detail, 'This says what you usually do; tell one real time it happened instead: where you were, what you did and how it turned out.');
  assert.match(check(usual, 'ownership').detail, /you usually do yourself/);
  // A real story that mentions a habit is still a real story.
  assert.equal(check(Coach.review(`I usually work the morning shift. ${STRONG.cafe}`, cafe), 'structure').ok, true);
});

test('"me and my coworker" is a shared subject, and plain outcomes count as results', () => {
  const r = Coach.review('Me and my coworker restocked the whole aisle before close.', retail);
  assert.equal(r.star.action, true);
  assert.equal(check(r, 'ownership').detail, 'You describe what the team did; add what you did yourself, starting with “I …”.');
  assert.equal(Coach.live('My coworker and me restocked the whole aisle.').star.action, true);
  assert.equal(Coach.live('She thanked my manager and me.').star.action, false);
  assert.equal(Coach.live('She calmed down and bought the jacket.').star.result, true);
  assert.equal(Coach.live('Everything worked after that.').star.result, true);
  assert.equal(Coach.live('I calmed her down.').star.result, false);
});

test('a bare number of years is time in the job, not proof', () => {
  const r = Coach.review('In my country I work in cafe 2 years. Many customers in morning. I make coffee fast and smile. Boss say I am good worker.', cafe);
  assert.doesNotMatch(check(r, 'evidence').detail, /2 years/);
  assert.equal(check(r, 'evidence').ok, false);
  // A span that says how fast it worked is still proof.
  const fast = Coach.review('At my last job I owned onboarding for new clients. I set up weekly check-ins and within 2 months all four accounts renewed.', OFFICE);
  assert.match(check(fast, 'evidence').detail, /2 months/);
  const early = Coach.review('On a renovation job last spring I planned the wiring with my journeyperson and we finished 2 weeks early.', trades);
  assert.match(check(early, 'evidence').detail, /2 weeks/);
});

test('quoted words read as whole phrases, not fragments', () => {
  const why = Coach.review('I love helping people put together outfits, and I shop at your Queen Street store a lot. I worked at a thrift shop where I sorted donations.', { question: 'What interests you in Store Associate at Maple & Thread?', info: { kind: 'motivation', source: null } });
  assert.match(check(why, 'evidence').detail, /“Queen Street”/);
  const star = Coach.review('At my last job at a coffee shop, a bus of tourists walked in at 7:30. I took orders while my coworker pulled shots. We served everyone and they left us a 5-star review.', cafe);
  assert.match(check(star, 'evidence').detail, /“5-star review”/);
  const nurse = Coach.review('During my practicum I noticed a resident was confused, so I called the nurse in charge right away and charted it in PointClickCare.', care);
  assert.ok(!nurse.echoed.includes('charge'), JSON.stringify(nurse.echoed));
  const vague = Coach.review('I felt really nervous but I knew I had to do something so I told my supervisor and she helped the resident.', care);
  assert.doesNotMatch(check(vague, 'ownership').detail, /“do”/);
});

// Engine-shaped questionInfo for questions no single line of the ad is tied to (source: null), as on the real path.
const OPEN_SIT = (question) => ({ question, info: { kind: 'situational', theme: null, source: null, probe: '', include: ['What you would do first, and why', 'Who you would tell or ask for help'] }, analysis: retail.analysis });

test('open "why this job" and "what would you do" questions are not marked down on ad words', () => {
  const sit = Coach.review('First I would count the drawer again slowly. If it is still short I would check the receipts and refunds from my shift, then tell my supervisor right away and write down what I found.', OPEN_SIT('Imagine your cash drawer is short at the end of your shift. What would you do?'));
  const rel = check(sit, 'relevance');
  assert.equal(rel.ok, true);
  assert.equal(rel.detail, 'Nothing in the ad is tied to this question, so your own words are fine here.');
  assert.deepEqual(sit.missing, []);
  // Coaching words the ad also uses ("learn") do not tie the question to the ad, and any ad word used is a bonus.
  const why = Coach.review('I have always liked figuring out how things work, and I finished my first year of the electrical program last spring. I want to learn on residential and commercial jobs.', {
    question: 'What made you want to apply for the Electrical Apprentice job at Brightline Electric?',
    info: { kind: 'motivation', source: null, include: ['Something specific in the ad that appeals to you', 'What you hope to learn or give'] },
    analysis: { skills: ['blueprints', 'electrical code', 'conduit'], keywords: ['Registered apprentice', 'safety procedures'], requirements: [{ text: 'Good attitude, eager to learn, and you show up on time' }] }
  });
  assert.equal(check(why, 'relevance').ok, true, check(why, 'relevance').detail);
  // A question tied to a line of the ad still asks for its words.
  assert.equal(check(Coach.review('I helped a shopper find a coat and she was happy.', retail), 'relevance').ok, false);
});

test('situational answers with clear steps or a reason are ok, one bare step is not', () => {
  const care2 = Coach.review("I would stay calm and ask her why she doesn't want it, maybe she is cold or embarrassed. I would offer a different time or a sponge bath instead, and respect her choice. Then I would tell the nurse and write it in the chart.", OPEN_SIT('Imagine a resident refuses care they need and is getting upset. What would you do?'));
  assert.equal(check(care2, 'structure').ok, true);
  assert.equal(check(care2, 'structure').detail, 'You give clear steps; you could finish with how you would know it worked.');
  const sick = Coach.review('I would call my manager as early as I can, so they have time to find someone.', OPEN_SIT('Imagine you wake up sick on a day you are scheduled to work. What would you do?'));
  assert.equal(check(sick, 'structure').ok, true);
  assert.match(check(sick, 'structure').detail, /^You say what you would do and why/);
  const one = Coach.review('I would tell my manager.', OPEN_SIT('Imagine your cash drawer is short. What would you do?'));
  assert.equal(check(one, 'structure').ok, false);
  // A sentence that starts with "So" is not a reason.
  assert.equal(check(Coach.review('So I would tell my manager.', OPEN_SIT('Imagine your cash drawer is short. What would you do?')), 'structure').ok, false);
});

test('the structure row is not a warning for answers in other languages', () => {
  const fr = Coach.review("Dans mon dernier emploi, j'ai aidé un client à trouver un cadeau. Je lui ai montré trois options et il a acheté un pull.", retail);
  assert.equal(check(fr, 'structure').ok, true);
  assert.match(check(fr, 'structure').detail, /reads English answers/);
});

test('time in a job is a real detail for "why this job", but not proof it worked', () => {
  const why = Coach.review('I worked 2 years at a grocery store and I loved helping customers find what they needed.', { question: 'Why do you want to work at Maple & Thread?', info: { kind: 'motivation', source: null }, analysis: retail.analysis });
  assert.equal(check(why, 'evidence').ok, true);
  assert.match(check(why, 'evidence').detail, /“2 years”/);
  const story = Coach.review('I worked 2 years at a grocery store and I helped customers find what they needed.', retail);
  assert.doesNotMatch(check(story, 'evidence').detail, /2 years/);
  // "I care a lot about" and "I would like to" are reasons too.
  const dev = Coach.review('I built two React apps in my bootcamp and I care a lot about accessibility. Kitebird makes travel planning easier, and I would like to work on booking pages that real people use every day.', { question: 'What made you want to apply for the Junior Front-End Developer job at Kitebird?', info: { kind: 'motivation', source: null }, analysis: tech.analysis });
  assert.equal(check(dev, 'structure').ok, true);
});
