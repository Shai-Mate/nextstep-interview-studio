// node --test test/engine.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const PrepEngine = require('../engine.js');

const FIX = join(here, 'fixtures');
const files = readdirSync(FIX).filter((f) => f.endsWith('.txt')).sort();
const ad = (name) => readFileSync(join(FIX, name), 'utf8');
const flat = (s) => String(s).toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim();

// What each fictional ad must yield. Lines are copied from the ads.
const EXPECT = {
  'admin-dental-receptionist.txt': {
    skills: ['Dentrix'],
    must: ['1+ year in a front-desk, reception or customer service role', 'A warm, patient manner', 'Available some Saturdays'],
    nice: ['Confident on the phone and with computers; Dentrix or another practice system is a plus'],
    never: ['Bright Smile Dental is a fictional', 'We have served our neighbourhood', 'paid vacation', 'Dental Receptionist (Full-time)', 'You are the first face'],
    top3: ['customers', 'pressure']
  },
  'logistics-warehouse-associate.txt': {
    skills: ['forklift', 'pallet jack', 'handheld scanner'],
    must: ['Able to lift up to 23 kg and be on your feet for a 10-hour shift', 'Available Sunday to Thursday nights, 8 pm to 6 am', 'Steel-toe boots required'],
    nice: ['Forklift certification is an asset'],
    never: ['Northgate Supply Co. is a fictional', 'proud of our safety record', 'Shift premium', 'Warehouse Associate – Night Shift'],
    top: ['physical'], top3: ['reliability', 'safety']
  },
  'healthcare-care-aide.txt': {
    skills: ['CPR', 'First Aid', 'PointClickCare'],
    must: ['Current CPR and First Aid', 'Clear criminal record check (vulnerable sector)', 'Health Care Aide or Personal Support Worker certificate'],
    nice: ['Experience in long-term care or dementia care is preferred'],
    never: ['Cedar Grove Care Home (a fictional long-term care home)', 'Our values are dignity', 'Benefits include', 'Health Care Aide / Personal Support Worker'],
    top: ['care'], top3: ['safety', 'reliability']
  },
  'hospitality-barista-noheadings.txt': {
    skills: ['Square', 'Food Safe'],
    must: ['Food Safe certification is required within your first month.', 'You need to be able to stay calm and friendly during the morning rush and work well with a small team.'],
    nice: ['Experience as a barista is great but we will train the right person.'],
    never: ['We offer tips', 'a fictional cafe'],
    top3: ['customers', 'pressure', 'teamwork']
  },
  'office-customer-success.txt': {
    skills: ['Salesforce', 'HubSpot', 'Excel', 'Google Sheets', 'SQL', 'Looker'],
    must: ['Experience with a CRM such as Salesforce or HubSpot', '3+ years in customer success, account management or a similar client-facing role'],
    nice: ['Familiarity with SQL or a BI tool such as Looker', 'Experience in healthcare, SaaS or scheduling software'],
    never: ['About Juniper Lane Health', 'Juniper Lane Health is a fictional', 'Hybrid work, 3 days in a hub', 'Learning budget and mentoring', 'Extended health benefits'],
    top: ['customers'], top3: ['communication']
  },
  'retail-store-associate.txt': {
    skills: ['POS', 'cash'],
    must: ['Reliable and on time', 'Available evenings and weekends, including holiday season'],
    nice: ['Previous retail or customer service experience is an asset but not required'],
    never: ['Store Associate (Part-time)', 'Maple & Thread is a fictional', 'Staff discount, flexible scheduling and paid training.'],
    top: ['customers'], top3: ['reliability']
  },
  'tech-frontend-developer.txt': {
    skills: ['React', 'TypeScript', 'Git', 'Jest', 'Figma'],
    must: ['Some experience with React and Git', 'Curiosity and willingness to ask for help'],
    nice: ['Next.js or GraphQL', 'Experience with analytics dashboards or A/B tests'],
    never: ['Junior Front-End Developer', 'About Kitebird', 'We help families plan trips together.', 'remote-first, home office budget'],
    top: ['technical'], top3: ['learning']
  },
  'trades-electrical-apprentice.txt': {
    skills: ['WHMIS', 'Red Seal', 'multimeter', 'blueprints', "driver's licence"],
    must: ['WHMIS and fall protection training', "Valid driver's licence and reliable transportation", 'Registered apprentice, 2nd or 3rd year, working toward your Red Seal'],
    nice: ['First Aid certificate', 'Experience with commercial tenant improvements'],
    never: ['Brightline Electric is a small, family-run contractor', 'competitive wages', 'Electrical Apprentice (2nd or 3rd year)'],
    top3: ['technical', 'safety']
  }
};

const KINDS_Q = ['motivation', 'behavioural', 'role', 'situational', 'gap', 'closing'];
const SECTION_KINDS = ['about', 'role', 'duties', 'requirements', 'nice', 'offer', 'other'];
const OUTSIDE = /\bfictional\b|\bwe offer\b|\bbenefits\b|\bperks\b|\bdiscount\b|\bwages\b|\babout us\b|\bvacation\b/i;

function allText(p) {
  const out = [p.role, p.company, ...p.requirements, ...p.questions];
  for (const i of p.questionInfo) out.push(i.probe, ...i.include, i.source || '');
  for (const c of p.course) out.push(c.title, c.body, c.exercise);
  for (const q of p.quizItems) out.push(q.q, q.why, ...q.options);
  return out.filter(Boolean);
}
function quotesIn(s) { return [...String(s).matchAll(/“([^”]+)”/g)].map((m) => m[1]); }

test('fixtures are present', () => {
  assert.ok(files.length >= 6, 'expected the six fictional ads in test/fixtures');
  for (const f of Object.keys(EXPECT)) assert.ok(files.includes(f), f);
});

for (const file of files) {
  const job = ad(file);
  const exp = EXPECT[file] || {};
  test(`${file}: analysis contract`, () => {
    const a = PrepEngine.analyze(job, {});
    assert.equal(a.version, 1);
    assert.ok(Number.isInteger(a.words) && a.words > 20);
    assert.ok(Array.isArray(a.sections) && a.sections.length >= 1);
    for (const s of a.sections) {
      assert.ok(SECTION_KINDS.includes(s.kind), s.kind);
      assert.equal(typeof s.title, 'string');
      assert.ok(Array.isArray(s.lines));
    }
    assert.ok(a.requirements.length >= 3 && a.requirements.length <= 12);
    for (const r of a.requirements) {
      assert.ok(['must', 'nice', 'duty'].includes(r.kind));
      assert.ok(typeof r.text === 'string' && r.text.length > 0 && r.text.length <= 300);
      assert.ok(!/^[-*•·]/.test(r.text), 'bullet stripped: ' + r.text);
      assert.ok(Array.isArray(r.themes) && r.themes.every((id) => PrepEngine.themes[id]));
      assert.equal(typeof r.score, 'number');
    }
    const order = { must: 0, duty: 1, nice: 2 };
    for (let i = 1; i < a.requirements.length; i++) assert.ok(order[a.requirements[i - 1].kind] <= order[a.requirements[i].kind], 'must, then duty, then nice');
    assert.ok(a.themes.length >= 1 && a.themes.length <= 6);
    for (let i = 0; i < a.themes.length; i++) {
      const t = a.themes[i];
      assert.ok(PrepEngine.themes[t.id], t.id);
      assert.equal(t.label, PrepEngine.themes[t.id].label);
      assert.ok(t.evidence.length >= 1 && t.evidence.length <= 3);
      assert.match(t.probe, /^They want to hear /);
      if (i) assert.ok(a.themes[i - 1].score >= t.score, 'themes sorted by score');
    }
    assert.ok(a.skills.length <= 12 && a.keywords.length <= 12 && a.signals.length <= 6);
    assert.ok(['Entry', 'Mid', 'Senior', 'Lead', 'Unknown'].includes(a.seniority.level));
    assert.ok(a.seniority.years === null || Number.isInteger(a.seniority.years));
    for (const s of a.signals) assert.ok(s.label && typeof s.detail === 'string');
  });

  test(`${file}: requirements come from what the ad asks for`, () => {
    const a = PrepEngine.analyze(job, {});
    const texts = a.requirements.map((r) => flat(r.text));
    for (const r of a.requirements) assert.ok(!OUTSIDE.test(r.text), 'company blurb or benefit in requirements: ' + r.text);
    for (const n of exp.never || []) assert.ok(!texts.some((t) => t.includes(flat(n))), 'should not be a requirement: ' + n);
    for (const m of exp.must || []) {
      const hit = a.requirements.find((r) => flat(r.text) === flat(m));
      assert.ok(hit, 'missing must-have: ' + m);
      assert.equal(hit.kind, 'must', m);
    }
    for (const n of exp.nice || []) {
      const hit = a.requirements.find((r) => flat(r.text) === flat(n));
      assert.ok(hit, 'missing nice-to-have: ' + n);
      assert.equal(hit.kind, 'nice', n);
    }
  });

  test(`${file}: skills and top areas`, () => {
    const a = PrepEngine.analyze(job, {});
    const low = a.skills.map((s) => s.toLowerCase());
    for (const s of exp.skills || []) assert.ok(low.some((x) => x.includes(s.toLowerCase())), `skill ${s} not in [${a.skills.join(', ')}]`);
    for (const s of a.skills) assert.ok(job.includes(s), 'skill reported in the ad’s own words: ' + s);
    const ids = a.themes.map((t) => t.id);
    for (const id of exp.top || []) assert.equal(ids[0], id, `top area ${ids[0]}, expected ${id}`);
    for (const id of exp.top3 || []) assert.ok(ids.slice(0, 3).includes(id), `${id} not in top 3 [${ids.slice(0, 3)}]`);
  });

  test(`${file}: highlights are sorted, non-overlapping and in range`, () => {
    const a = PrepEngine.analyze(job, {});
    assert.ok(a.highlights.length > 0);
    let at = 0;
    for (const h of a.highlights) {
      assert.ok(['skill', 'keyword', 'must', 'nice'].includes(h.kind));
      assert.ok(Number.isInteger(h.start) && Number.isInteger(h.end) && h.start >= at && h.end > h.start && h.end <= job.length, JSON.stringify(h));
      at = h.end;
    }
    for (const h of a.highlights.filter((x) => x.kind === 'skill' || x.kind === 'keyword')) {
      const t = job.slice(h.start, h.end);
      assert.equal(t, t.trim(), 'skill and keyword marks have no loose spaces: ' + JSON.stringify(t));
    }
    const skillMarks = a.highlights.filter((h) => h.kind === 'skill').map((h) => job.slice(h.start, h.end));
    for (const s of a.skills) assert.ok(skillMarks.some((m) => m.includes(s) || s.includes(m)), 'skill highlighted: ' + s);
  });

  test(`${file}: keywords are whole phrases a candidate could say back`, () => {
    const a = PrepEngine.analyze(job, {});
    assert.ok(a.keywords.length >= 1 && a.keywords.length <= 12);
    const skills = a.skills.map((s) => ' ' + flat(s).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim() + ' ');
    for (const k of a.keywords) {
      const key = ' ' + flat(k) + ' ';
      assert.ok(job.includes(k), 'keyword in the ad’s own words: ' + k);
      assert.ok(k.split(' ').length >= 2, 'a phrase, not a lone word: ' + k);
      assert.ok(!skills.some((s) => s.includes(key) || key.includes(s)), 'keyword repeats a skill: ' + k);
      assert.ok(!/^(?:comfortable|available|able|long|provide|observe|follow|record|help|keep|process|receive|run|pull|troubleshoot|build|write|fix|turn|own|monitor|resolve|manage|clear|good|strong|excellent|basic|valid|current|stay)(?=\s)/i.test(k), 'cut-off start: ' + k);
      assert.ok(!/\b(?:under|over|with|for|to|in|on|at|by|using|including|of|and|or|the|a|reported|accurately|safely)$/i.test(k), 'dangling end: ' + k);
      assert.ok(!/\b(?:evenings?|weekends?|nights?|holidays?|season|mornings|schedule|shifts?)\b/i.test(k), 'schedule words belong to signals: ' + k);
    }
    for (const bad of ['Comfortable standing', 'long periods', 'Available evenings', 'holiday season', 'lighting under', 'Provide safe', 'Observe changes', 'criminal record', 'handle cash accurately']) {
      assert.ok(!a.keywords.includes(bad), 'bad keyword: ' + bad);
    }
  });

  test(`${file}: closing bullets are real questions and the quiz reads naturally`, () => {
    const p = PrepEngine.create({ job });
    const closing = p.questionInfo.filter((x) => x.kind === 'closing');
    assert.equal(closing.length, 1);
    for (const b of closing[0].include) assert.match(b, /^[A-Z].*\?$/, 'closing bullet is a question: ' + b);
    for (const q of p.quizItems) for (const o of q.options) assert.ok(!/\bdoing “/.test(o), 'awkward option: ' + o);
    const ask = p.quizItems.find((q) => /best question to ask/.test(q.q));
    assert.ok(ask && ask.options[ask.correct].endsWith('?'));
  });

  test(`${file}: plan contract and plain, honest copy`, () => {
    const p = PrepEngine.create({ job, role: '', company: '' });
    const a = PrepEngine.analyze(p.job, { role: p.role, company: p.company });
    assert.equal(p.schema, 1);
    assert.ok(p.requirements.length >= 1 && p.requirements.length <= 8);
    p.requirements.forEach((r, i) => assert.equal(r, a.requirements[i].text.slice(0, 300), 'plan requirements match the analysis'));
    assert.ok(p.questions.length >= 8 && p.questions.length <= 10);
    assert.equal(p.questionInfo.length, p.questions.length);
    for (const [i, info] of p.questionInfo.entries()) {
      assert.ok(KINDS_Q.includes(info.kind), info.kind);
      assert.ok(info.theme === null || PrepEngine.themes[info.theme], String(info.theme));
      assert.ok(info.source === null || typeof info.source === 'string');
      assert.ok(typeof info.probe === 'string' && info.probe.length > 10);
      assert.ok(info.include.length >= 2 && info.include.length <= 3);
      assert.ok(p.questions[i].length <= 230, 'question too long: ' + p.questions[i]);
    }
    const kinds = new Set(p.questionInfo.map((x) => x.kind));
    for (const k of ['motivation', 'behavioural', 'situational', 'gap', 'closing']) assert.ok(kinds.has(k), 'missing question kind ' + k);
    assert.ok(p.questionInfo.filter((x) => x.source).length >= 3, 'at least three questions quote the ad');
    assert.ok(p.course.length >= 6 && p.course.length <= 8);
    for (const c of p.course) {
      assert.ok(c.title && c.body && c.exercise && c.minutes > 0 && c.done === false);
      assert.ok(quotesIn(c.body).length <= 1, 'one ad excerpt per lesson at most');
      assert.ok(!/"/.test(c.body), 'no straight quotes in lesson bodies (the UI reads them as ad excerpts)');
    }
    assert.ok(p.quizItems.length >= 5 && p.quizItems.length <= 6);
    const fromAd = p.quizItems.filter((q) => quotesIn(q.q + ' ' + q.why).length || q.options.some((o) => a.skills.includes(o) || p.requirements.some((r) => flat(r).startsWith(flat(o).replace(/…$/, '')))));
    assert.ok(fromAd.length >= 3, 'at least three quiz items built from this ad');
    for (const q of p.quizItems) {
      assert.equal(q.options.length, 3);
      assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct <= 2);
      assert.equal(new Set(q.options).size, 3, 'distinct options');
    }
    assert.ok(new Set(p.quizItems.map((q) => q.correct)).size >= 2, 'correct answer position varies');
    // Every curly-quoted excerpt is really in the ad.
    for (const s of [...p.questions, ...p.course.map((c) => c.body)]) {
      for (const q of quotesIn(s)) assert.ok(flat(job).includes(flat(q.replace(/…$/, ''))), 'excerpt not in ad: ' + q);
    }
    // Plain words only; STAR is always spelled out.
    for (const s of allText(p)) {
      assert.ok(!/\b(?:competenc\w*|leverage|kpis?|theme scoring|probe)\b/i.test(s), 'jargon: ' + s);
      if (/\bstakeholders?\b/i.test(s)) assert.ok(/stakeholder/i.test(job), 'stakeholder only when the ad says it');
      if (/\bSTAR\b/.test(s)) assert.ok(s.includes('Situation, Task, Action, Result'), 'STAR spelled out: ' + s);
    }
  });
}

test('barista ad without headings is read sentence by sentence', () => {
  const a = PrepEngine.analyze(ad('hospitality-barista-noheadings.txt'), {});
  const kind = (start) => (a.requirements.find((r) => r.text.startsWith(start)) || {}).kind;
  assert.equal(kind('Food Safe certification'), 'must');
  assert.equal(kind('You will make espresso drinks'), 'duty');
  assert.equal(kind('Experience as a barista'), 'nice');
  assert.equal(kind('We offer'), undefined);
  assert.ok(a.signals.some((s) => /early mornings/i.test(s.label)));
});

test('first lesson, first mock question and role map never quote the company blurb', () => {
  for (const file of files) {
    const p = PrepEngine.create({ job: ad(file), role: 'Practice role', company: 'Practice company' });
    const lesson1 = (p.course[0].body.match(/“([^”]+)”/) || [])[1] || '';
    assert.ok(!OUTSIDE.test(lesson1) && !/^about\b/i.test(lesson1), file + ': ' + lesson1);
    assert.ok(!/\babout (?:us|juniper|kitebird)\b/i.test(p.questions[1]), file + ': ' + p.questions[1]);
    for (const r of p.requirements) assert.ok(!OUTSIDE.test(r), file + ': ' + r);
  }
});

test('a tiny 45-character ad still makes a full plan', () => {
  const job = 'Cashier wanted for weekend shifts. Apply now!';
  assert.equal(job.length, 45);
  const p = PrepEngine.create({ job });
  assert.ok(p.requirements.length >= 1);
  assert.ok(!p.requirements.some((r) => /apply now/i.test(r)));
  assert.ok(p.questions.length >= 8 && p.questions.length <= 10);
  assert.equal(p.questionInfo.length, p.questions.length);
  assert.ok(p.course.length >= 6 && p.course.length <= 8);
  assert.ok(p.quizItems.length >= 5 && p.quizItems.length <= 6);
  const a = PrepEngine.analyze(job, {});
  for (const h of a.highlights) assert.ok(h.end <= job.length);
});

test('seniority evidence never repeats the title', () => {
  const job = ad('trades-electrical-apprentice.txt');
  for (const role of ['', 'Electrical Apprentice', 'Electrical Apprentice (2nd or 3rd year)']) {
    const s = PrepEngine.analyze(job, { role }).seniority;
    assert.equal(s.level, 'Entry');
    assert.equal(s.evidence, 'Electrical Apprentice (2nd or 3rd year)', role);
  }
  const p = PrepEngine.create({ job });
  const ev = PrepEngine.analyze(job, { role: p.role, company: p.company }).seniority.evidence;
  assert.equal(ev.split('Electrical Apprentice').length, 2, ev);
});

test('questions fit the line they quote', () => {
  const trades = PrepEngine.create({ job: ad('trades-electrical-apprentice.txt') });
  const gap = trades.questions[trades.questionInfo.findIndex((x) => x.kind === 'gap')];
  assert.match(gap, /First Aid certificate/);
  assert.match(gap, /how would you go about getting it\?$/, gap);
  const care = PrepEngine.create({ job: ad('healthcare-care-aide.txt') });
  const rel = care.questionInfo.findIndex((x) => x.kind === 'behavioural' && x.theme === 'reliability');
  assert.ok(rel > 0);
  assert.match(care.questions[rel], /rotating schedule/);
  assert.match(care.questions[rel], /How would that schedule work for you/);
  const retail = PrepEngine.create({ job: ad('retail-store-associate.txt') });
  const r = retail.questionInfo.findIndex((x) => x.kind === 'behavioural' && x.theme === 'reliability');
  assert.match(retail.questions[r], /“reliable and on time”/, 'a line about being dependable beats a schedule line');
  const office = PrepEngine.create({ job: ad('office-customer-success.txt') });
  const crm = office.questionInfo.find((x) => x.kind === 'role' && /Salesforce/.test(x.source || ''));
  if (crm) assert.ok(crm.include.some((b) => /used/.test(b)), 'bullets match a "how have you used these" question');
  for (const p of [trades, care, retail, office]) {
    const sit = p.questions.find((q) => /handed it in/.test(q));
    assert.equal(sit, undefined, 'situations fit any job, not only office work');
  }
});

test('validation keeps the same message and fields keep their types', () => {
  assert.throws(() => PrepEngine.create({ job: 'too short' }), { message: 'Paste at least 40 characters from the actual job ad.' });
  assert.throws(() => PrepEngine.create({}), { message: 'Paste at least 40 characters from the actual job ad.' });
  const p = PrepEngine.create({ job: ad('retail-store-associate.txt'), role: 'Store Associate', company: 'Maple & Thread', url: 'https://example.com/job' });
  assert.equal(p.role, 'Store Associate');
  assert.equal(p.company, 'Maple & Thread');
  assert.equal(p.url, 'https://example.com/job');
  assert.deepEqual(p.intake, { experience: 'Prefer not to say', stage: 'Not sure yet', focus: 'Balanced', time: '30 minutes' });
  assert.deepEqual(p.notes, {});
  assert.deepEqual(p.quiz, { answers: {} });
  assert.deepEqual(p.mock, { index: 0, answers: [], draft: '', finished: false });
  assert.ok(typeof p.id === 'string' && p.id && !Number.isNaN(Date.parse(p.created)) && !Number.isNaN(Date.parse(p.updated)));
  assert.ok(Array.isArray(p.questions) && p.questions.every((q) => typeof q === 'string'));
  assert.ok(Array.isArray(p.requirements) && p.requirements.every((r) => typeof r === 'string'));
  const fresh = PrepEngine.create(p);
  assert.equal(fresh.questions.length, p.questions.length, 're-creating from a saved plan (backup import) is stable');
});

test('empty role and company are filled from the ad when it says them', () => {
  const t = PrepEngine.create({ job: ad('trades-electrical-apprentice.txt') });
  assert.equal(t.company, 'Brightline Electric');
  assert.match(t.role, /^Electrical Apprentice/);
  const b = PrepEngine.create({ job: ad('hospitality-barista-noheadings.txt') });
  assert.equal(b.role, 'Barista');
  assert.equal(b.company, 'Little Fern Coffee');
  const w = PrepEngine.create({ job: ad('logistics-warehouse-associate.txt') });
  assert.equal(w.role, 'Warehouse Associate');
  assert.equal(w.company, 'Northgate Supply Co.', 'a shift after the dash is not a company');
  const dn = PrepEngine.create({ job: ad('admin-dental-receptionist.txt') });
  assert.equal(dn.company, 'Bright Smile Dental');
  assert.ok(!dn.questionInfo.some((x) => x.theme === 'customers' && /\bcustomer orders\b/.test(x.source || '')));
  const o = PrepEngine.create({ job: ad('office-customer-success.txt') });
  assert.equal(o.role, 'Customer Success Manager');
  assert.equal(o.company, 'Juniper Lane Health');
  const none = PrepEngine.create({ job: 'Help wanted for afternoon dog walks in the west end, three days a week.' });
  assert.equal(none.role, 'New opportunity');
  assert.equal(none.company, 'Company');
});

test('intake shapes the plan', () => {
  const job = ad('retail-store-associate.txt');
  const q = (intake) => PrepEngine.create({ job, role: 'Store Associate', company: 'Maple & Thread', intake });
  assert.equal(q({ time: '15 minutes' }).questions.length, 8);
  assert.equal(q({ time: '60 minutes' }).questions.length, 10);
  assert.match(q({ experience: 'Career change' }).questions[0], /past jobs/);
  const early = q({ experience: 'Early career' });
  assert.match(early.questions[0], /school/);
  assert.ok(early.course.some((c) => /school, volunteering, sports, family/.test(c.body)));
  assert.ok(q({ experience: 'Career change' }).course.some((c) => /different field/.test(c.body)));
  const screening = q({ stage: 'Screening' });
  assert.ok(screening.questions.some((x) => /availability/.test(x)));
  assert.ok(screening.course.some((c) => /short first call/i.test(c.title)));
  const technical = PrepEngine.create({ job: ad('tech-frontend-developer.txt'), role: 'Developer', company: 'Kitebird', intake: { stage: 'Technical' } });
  assert.ok(technical.questionInfo.filter((x) => x.kind === 'role').length >= 2);
  assert.ok(q({ focus: 'Concise answers' }).course.some((c) => /four sentences/.test(c.exercise)));
});

test('same input gives the same output (except id and dates)', () => {
  for (const file of files) {
    const input = { job: ad(file), role: 'R', company: 'C', intake: { experience: 'Experienced', stage: 'Panel', focus: 'Balanced', time: '30 minutes' } };
    const strip = (p) => ({ ...p, id: 0, created: 0, updated: 0 });
    assert.deepEqual(strip(PrepEngine.create(input)), strip(PrepEngine.create(input)));
    assert.deepEqual(PrepEngine.analyze(input.job, input), PrepEngine.analyze(input.job, input));
  }
});

test('ad text is data: markup and odd input never break the engine', () => {
  const job = '<script>alert(1)</script> We need a ${constructor} cook. You will prep food. Must have Food Safe. ' + '\u0000‮'.repeat(3);
  const a = PrepEngine.analyze(job, {});
  assert.ok(Array.isArray(a.requirements));
  assert.doesNotThrow(() => PrepEngine.create({ job }));
  for (const v of [null, undefined, 42, '', '   ']) assert.doesNotThrow(() => PrepEngine.analyze(v, null));
  const oneLine = 'word '.repeat(12000);
  assert.doesNotThrow(() => PrepEngine.analyze(oneLine, {}));
});

test('the theme catalog covers every kind of work in plain words', () => {
  const ids = Object.keys(PrepEngine.themes);
  assert.ok(ids.length >= 16);
  for (const id of ['customers', 'teamwork', 'communication', 'reliability', 'safety', 'physical', 'care', 'detail', 'numbers', 'organisation', 'problem', 'learning', 'pressure', 'leadership', 'technical', 'sales']) {
    assert.ok(PrepEngine.themes[id], id);
    assert.ok(PrepEngine.themes[id].label && /^They want to hear /.test(PrepEngine.themes[id].probe));
  }
});

test('a 60k-character ad is analysed in under 50 ms', () => {
  let big = '';
  while (big.length < 60000) for (const f of files) big += ad(f) + '\n\n';
  big = big.slice(0, 60000);
  // Steady-state speed: warm the JIT first, then take the best run (the shared test machine is often busy).
  for (let i = 0; i < 10; i++) PrepEngine.analyze(big, {});
  let best = Infinity;
  for (let i = 0; i < 20 && best >= 50; i++) {
    const t0 = performance.now();
    PrepEngine.analyze(big, { role: 'Store Associate', company: 'Maple & Thread' });
    best = Math.min(best, performance.now() - t0);
  }
  assert.ok(best < 50, `analyze took ${best.toFixed(1)} ms`);
  let bestCreate = Infinity;
  for (let i = 0; i < 10 && bestCreate >= 100; i++) {
    const t0 = performance.now();
    PrepEngine.create({ job: big, role: 'Store Associate', company: 'Maple & Thread' });
    bestCreate = Math.min(bestCreate, performance.now() - t0);
  }
  assert.ok(bestCreate < 100, `create took ${bestCreate.toFixed(1)} ms`);
  const a = PrepEngine.analyze(big, {});
  let at = 0;
  for (const h of a.highlights) { assert.ok(h.start >= at && h.end > h.start && h.end <= big.length); at = h.end; }
});
