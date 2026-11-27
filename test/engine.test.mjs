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

// Ads written by a second reviewer (test/fixtures/review), checked for specific mistakes rather than the full fixture table.
const REVIEW = join(FIX, 'review');
const reviewFiles = readdirSync(REVIEW).filter((f) => f.endsWith('.txt')).sort();
const rad = (name) => readFileSync(join(REVIEW, name), 'utf8');
const CHECK_WORDS = /criminal record|vulnerable sector|security check|background check|police check|drug test|work permit|driver[’']?s abstract/i;
const generatedText = (p) => [...p.questions, ...p.questionInfo.flatMap((i) => [i.source || '', ...i.include]), ...p.course.flatMap((c) => [c.body, c.exercise]),
  ...p.quizItems.flatMap((q) => [q.q, q.why, ...q.options])];

test('review ads: a full, plain plan for every one', () => {
  assert.ok(reviewFiles.length >= 5);
  for (const f of reviewFiles) {
    const job = rad(f);
    const p = PrepEngine.create({ job });
    assert.ok(p.questions.length >= 8 && p.questions.length <= 10, f);
    assert.equal(p.questionInfo.length, p.questions.length, f);
    assert.ok(p.course.length >= 6 && p.course.length <= 8, f);
    assert.ok(p.quizItems.length >= 5 && p.quizItems.length <= 6, f);
    for (const q of [...p.questions, ...p.course.map((c) => c.body)]) for (const x of quotesIn(q)) assert.ok(flat(job).includes(flat(x.replace(/…$/, ''))), f + ': excerpt not in ad: ' + x);
    for (const b of p.questionInfo.find((x) => x.kind === 'closing').include) assert.match(b, /\?$/, f);
    for (const t of allText(p)) assert.ok(!/\b(?:competenc\w*|leverage|kpis?|probe)\b/i.test(t), f + ': jargon: ' + t);
  }
});

test('the company name is never a skill, keyword or tool in a question; the title line is never a requirement', () => {
  const job = rad('delivery-driver.txt');
  const p = PrepEngine.create({ job });
  assert.equal(p.company, 'Swift Parcel Co.');
  assert.match(p.role, /^Delivery Driver/);
  const a = PrepEngine.analyze(job, { role: p.role, company: p.company });
  assert.ok(!a.skills.some((s) => /swift/i.test(s)), a.skills.join(', '));
  assert.ok(a.skills.some((s) => /Class 5/.test(s)), 'Class 5 licence stays a skill');
  assert.ok(!a.keywords.some((k) => /swift|parcel/i.test(k)), a.keywords.join(', '));
  assert.ok(!a.requirements.some((r) => /Delivery Driver|Swift Parcel/.test(r.text)), 'title line is not a requirement');
  for (const q of p.questions) assert.ok(!/\bSwift\b(?! Parcel Co)/.test(q), q);
  assert.ok(a.signals.some((s) => s.label === 'Driving or travel'));
  const cook = PrepEngine.create({ job: rad('line-cook.txt') });
  assert.equal(cook.company, 'Harbour Table Bistro');
  const ca = PrepEngine.analyze(cook.job, { role: cook.role, company: cook.company });
  assert.ok(!ca.keywords.some((k) => /harbour|bistro/i.test(k)), ca.keywords.join(', '));
  assert.ok(!ca.requirements.some((r) => /since 2009|Harbour Table/.test(r.text)), 'company history is not a requirement');
  const short = 'Delivery Driver – Swift Parcel Co.\nWhat you will do:\n- Represent Swift Parcel Co. with a friendly attitude at every stop\n- Learn the Swift routing app and plan your day\n- Deliver parcels safely and on time\nWhat you need:\n- Class 5 licence\n- Comfortable with Kotlin is a bonus';
  const sa = PrepEngine.analyze(short, { company: 'Swift Parcel Co.' });
  assert.ok(!sa.skills.some((x) => /swift/i.test(x)), 'the short company name is not a skill: ' + sa.skills.join(', '));
  assert.ok(sa.skills.includes('Kotlin'));
  const care = PrepEngine.analyze(ad('healthcare-care-aide.txt'), { company: 'Cedar Grove Care Home' });
  assert.ok(care.keywords.some((k) => /care/i.test(k)), 'ordinary words that also appear in the company name stay: ' + care.keywords.join(', '));
});

test('kitchen ads: rotating stock is not a schedule, line work is hands-on, long duty lines quote the part that fits', () => {
  const job = rad('line-cook.txt');
  const a = PrepEngine.analyze(job, {});
  assert.ok(!a.signals.some((s) => /rotating/i.test(s.label)), a.signals.map((s) => s.label).join(' | '));
  assert.equal(a.themes[0].id, 'physical');
  const p = PrepEngine.create({ job });
  const phys = p.questions[p.questionInfo.findIndex((i) => i.kind === 'behavioural' && i.theme === 'physical')];
  assert.match(phys, /“work the grill|“prep vegetables/, phys);
  const ea = PrepEngine.create({ job: rad('teaching-assistant.txt') });
  const calm = ea.course.find((c) => c.theme === 'pressure');
  assert.ok(calm && /“stay calm and patient when a child is upset”/.test(calm.body), calm && calm.body);
  assert.ok(PrepEngine.analyze(rad('teaching-assistant.txt'), {}).signals.some((s) => s.label === 'Weekdays'));
});

test('checks and clearances stay requirements but never become questions, lessons or quiz items', () => {
  const cases = [['teaching-assistant.txt', /criminal record check/i], ['no-bullets-multiline.txt', /security check/i], ['delivery-driver.txt', /driver's abstract/i]];
  for (const [name, check] of cases) {
    const p = PrepEngine.create({ job: rad(name) });
    assert.ok(p.requirements.some((r) => check.test(r)), name + ': still a requirement');
    for (const t of generatedText(p)) assert.ok(!CHECK_WORDS.test(t), name + ': ' + t);
  }
  const care = PrepEngine.create({ job: ad('healthcare-care-aide.txt') });
  assert.ok(care.requirements.some((r) => /criminal record/i.test(r)));
  for (const t of generatedText(care)) assert.ok(!CHECK_WORDS.test(t), 'care aide: ' + t);
});

test('checks and clearances are never skills, keywords or skill highlights', () => {
  const NOT_SKILL = /criminal record|vulnerable sector|police (?:check|clearance|information)|security (?:check|clearance|screening)|background (?:check|screening)|references?\b|drug (?:test|screen)|work permit|eligib\w* to work|entitled to work|driver[’']?s abstract|driving (?:record|abstract)/i;
  const guard = 'Security Guard – Northside Patrol Ltd.\nWhat you need:\n- Valid security worker licence\n- Clear criminal record check and police information check\n- Pass a background check and drug test\n- Two professional references\n- Legally entitled to work in Canada; work permit holders welcome\n- Clean driver\'s abstract and Class 5 licence\n- First Aid and CPR\nWhat you will do:\n- Patrol the site and write clear incident reports\n- Use Microsoft Excel to log hours and incidents';
  const jobs = [guard, ...files.map((f) => ad(f)), ...reviewFiles.map((f) => rad(f))];
  for (const job of jobs) {
    const a = PrepEngine.analyze(job, {});
    for (const x of a.skills) assert.ok(!NOT_SKILL.test(x), 'skill: ' + x);
    for (const k of a.keywords) assert.ok(!NOT_SKILL.test(k), 'keyword: ' + k);
    for (const h of a.highlights) if (h.kind === 'skill' || h.kind === 'keyword') assert.ok(!NOT_SKILL.test(job.slice(h.start, h.end)), h.kind + ' highlight: ' + job.slice(h.start, h.end));
  }
  const g = PrepEngine.analyze(guard, {});
  assert.ok(g.skills.includes('Class 5 licence') && g.skills.some((x) => /First Aid/i.test(x)) && g.skills.some((x) => /Excel/.test(x)), g.skills.join(', '));
  for (const want of [/criminal record/i, /background check/i, /references/i, /entitled to work/i, /driver's abstract/i]) assert.ok(g.requirements.some((r) => want.test(r.text)), 'still a requirement: ' + want);
  const care = PrepEngine.analyze(ad('healthcare-care-aide.txt'), {});
  assert.ok(care.requirements.some((r) => /criminal record/i.test(r.text)) && !care.skills.some((x) => /criminal/i.test(x)), care.skills.join(', '));
  assert.ok(!PrepEngine.analyze(rad('delivery-driver.txt'), {}).skills.some((x) => /abstract/i.test(x)));
});

test('duty quotes use a template that fits how the excerpt starts', () => {
  const all = files.map((f) => ad(f)).concat(reviewFiles.map((f) => rad(f)));
  for (const job of all) {
    const p = PrepEngine.create({ job });
    for (const q of p.questions) {
      const m = q.match(/involves “(\S+)/);
      if (m) assert.ok(/ing$/.test(m[1]) || /^(?:a|an|the|our|your|their|all|any|some|this|these|those|each|every)$/i.test(m[1]) || /^[A-Z]/.test(m[1]), q);
      const t = q.match(/Part of this job is to “(\S+)/);
      if (t) assert.ok(/^[a-z]/.test(t[1]) && !/ing$/.test(t[1]), q);
    }
  }
  assert.ok(!PrepEngine.create({ job: rad('line-cook.txt') }).questions.some((q) => /involves “plate/.test(q)));
  assert.ok(!PrepEngine.create({ job: rad('no-bullets-multiline.txt') }).questions.some((q) => /involves “vacuum/.test(q)));
  const ea = PrepEngine.create({ job: rad('teaching-assistant.txt') });
  assert.ok(ea.questions.some((q) => /“stay calm and patient when a child is upset”/.test(q)), 'the clause that fits the area is quoted');
});

test('pay, bonus, tips and perks are offer text, even without headings', () => {
  const a = PrepEngine.analyze(rad('no-bullets-multiline.txt'), {});
  assert.ok(!a.requirements.some((r) => /we pay|bonus/i.test(r.text)), JSON.stringify(a.requirements));
  const b = PrepEngine.analyze('Server wanted for our patio. You will take orders and serve food. We pay weekly and offer a bonus for perfect attendance. Tips are shared every night. Must be friendly and available weekends.', {});
  assert.ok(!b.requirements.some((r) => /\b(?:pay|bonus|tips)\b/i.test(r.text)), JSON.stringify(b.requirements));
  assert.ok(b.requirements.some((r) => /friendly/.test(r.text)));
});

test('tiny ads always get 5 or 6 quiz items and a sensible role', () => {
  const tiny = 'Dishwasher needed. Evenings. Apply today.';
  assert.equal(tiny.length, 41);
  for (const job of [tiny, rad('very-short.txt'), 'Cashier wanted for weekend shifts. Apply now!']) {
    const p = PrepEngine.create({ job });
    assert.ok(p.quizItems.length >= 5 && p.quizItems.length <= 6, job + ': ' + p.quizItems.length);
    for (const q of p.quizItems) { assert.equal(new Set(q.options).size, 3); assert.ok(q.correct >= 0 && q.correct <= 2); }
    assert.ok(p.questions.length >= 8 && p.course.length >= 6);
  }
  assert.equal(PrepEngine.create({ job: tiny }).role, 'Dishwasher');
  assert.equal(PrepEngine.create({ job: rad('very-short.txt') }).role, 'Dishwasher');
  const hw = PrepEngine.create({ job: 'Help Wanted – Cashier\nPart-time, weekends. Must be friendly and good with cash.' });
  assert.equal(hw.role, 'Cashier');
  assert.notEqual(hw.company, 'Cashier');
  const hw2 = PrepEngine.create({ job: 'Help wanted. Line cook for busy diner. Must be able to stand all shift.' });
  assert.equal(hw2.role, 'Line cook');
  assert.ok(!hw2.requirements.some((r) => /^help wanted/i.test(r)), hw2.requirements.join(' / '));
  assert.ok(!PrepEngine.analyze(rad('very-short.txt'), {}).signals.some((s) => s.label === 'On-site'), '"Apply in person" is not on-site work');
});

// Ads pasted the way people really copy them (Indeed, LinkedIn, Job Bank, email, emoji, French, CRLF), from adversarial QA.
const ADV = join(FIX, 'adv');
const advFiles = readdirSync(ADV).filter((f) => f.endsWith('.txt')).sort();
const aad = (name) => readFileSync(join(ADV, name), 'utf8');
const PICTO = /\p{Extended_Pictographic}/u;
const FURNITURE = /\b(?:job types?|work location|application deadline|expected start date|expected hours|shift and schedule|supplemental pay|seniority level|employment type|job function|referrals increase|see who you know|profile insights|out of 5 stars|show (?:more|less)|easy apply|advertised until|employment groups|posted on)\b/i;

test('pasted job-site ads: no page furniture, emoji or brackets in the plan', () => {
  assert.ok(advFiles.length >= 12);
  for (const f of advFiles) {
    const job = aad(f);
    const p = PrepEngine.create({ job });
    assert.ok(p.questions.length >= 8 && p.questions.length <= 10 && p.course.length >= 6 && p.course.length <= 8 && p.quizItems.length >= 5 && p.quizItems.length <= 6, f);
    assert.equal(new Set(p.course.map((c) => c.title)).size, p.course.length, f + ': lesson titles repeat');
    for (const r of p.requirements) assert.ok(!FURNITURE.test(r) && !/^(?:pay|salary|hours|location|schedule)\s*:/i.test(r), f + ': furniture requirement: ' + r);
    for (const t of [p.role, p.company, ...p.requirements, ...p.questions]) assert.ok(!PICTO.test(t), f + ': emoji: ' + t);
    for (const q of p.questions) assert.ok(!/\((?:required|preferred)\)/i.test(q), f + ': ' + q);
    const a = PrepEngine.analyze(job, { role: p.role, company: p.company });
    for (const r of a.requirements) assert.ok(!FURNITURE.test(r.text), f + ': ' + r.text);
    for (const k of a.keywords) assert.ok(!FURNITURE.test(k) && !/[<>“”"]/.test(k), f + ': keyword ' + k);
  }
});

test('pasted job-site ads: names come from the line after the title, not the title’s second half', () => {
  const names = {
    'linkedin-registered-nurse.txt': ['Registered Nurse', 'Larchmere Health Centre'],
    'corporate-class1-driver.txt': ['Class 1 Driver', 'Granitefield Freight Lines Ltd.'],
    'messy-crlf-shipper-receiver.txt': ['Shipper / Receiver', 'Kestrel Bay Distribution'],
    'indeed-server-bartender-newlayout.txt': ['Server / Bartender', 'The Gilded Gull Taphouse'],
    'caps-emoji-early-childhood-educator.txt': ['Early Childhood Educator (ECE)', 'Little Acorns Learning Village'],
    'indeed-line-cook.txt': ['Line Cook', 'Saltgrass Kitchen & Bar'],
    'email-bakery-weekend.txt': [null, 'Honeycomb Hearth Bakery']
  };
  for (const [f, [role, company]] of Object.entries(names)) {
    const p = PrepEngine.create({ job: aad(f) });
    if (role) assert.equal(p.role, role, f);
    assert.equal(p.company, company, f);
  }
});

test('pasted job-site ads: Indeed, Job Bank and LinkedIn sections are read for what they are', () => {
  const cook = aad('indeed-line-cook.txt');
  const cp = PrepEngine.create({ job: cook });
  const ca = PrepEngine.analyze(cook, {});
  assert.ok(cp.requirements.includes('1 year of kitchen experience'), cp.requirements.join(' | '));
  assert.ok(ca.requirements.some((r) => r.text === 'kitchen: 1 year' && r.kind === 'must'));
  assert.ok(ca.requirements.some((r) => r.text === 'line cook: 1 year' && r.kind === 'nice'));
  const bar = PrepEngine.analyze(aad('indeed-server-bartender-newlayout.txt'), {});
  assert.ok(bar.requirements.some((r) => /pour draft beer/.test(r.text)), 'the full job description is read');
  assert.ok(!bar.requirements.some((r) => /^(?:serving|bartending)$/i.test(r.text)), 'Profile insights skills are page furniture');
  const jan = PrepEngine.create({ job: aad('jobbank-janitor.txt') });
  assert.ok(jan.requirements.includes('Bondable') || PrepEngine.analyze(aad('jobbank-janitor.txt'), {}).requirements.some((r) => r.text === 'Bondable'));
  assert.ok(!PrepEngine.analyze(aad('jobbank-janitor.txt'), {}).signals.some((x) => x.label === 'Certificates or checks' && /no degree/i.test(x.detail)));
  const rn = PrepEngine.analyze(aad('linkedin-registered-nurse.txt'), {});
  assert.ok(!rn.requirements.some((r) => /equal opportunity/i.test(r.text)), 'the list after Preferred Qualifications ends at the paragraph');
  const email = PrepEngine.analyze(aad('email-bakery-weekend.txt'), {});
  assert.ok(!email.requirements.some((r) => /reply to this email|ask for Marisol/i.test(r.text)));
  const truck = PrepEngine.analyze(aad('corporate-class1-driver.txt'), {});
  assert.ok(truck.skills.some((x) => /Class 1 driver's licence/i.test(x)) && truck.skills.some((x) => /air brake/i.test(x)), truck.skills.join(', '));
  assert.ok(PrepEngine.analyze(aad('jobbank-security-guard.txt'), {}).skills.some((x) => /Security Worker Licence/i.test(x)));
  const ece = PrepEngine.analyze(aad('caps-emoji-early-childhood-educator.txt'), {});
  assert.ok(ece.requirements.some((r) => /criminal record/i.test(r.text)) && ece.requirements.some((r) => /^Plan and lead play-based/.test(r.text)), 'emoji headings and bullets are read');
});

test('a French-only ad gets a Language signal and is not quoted into English', () => {
  const job = aad('french-only-aide-cuisinier.txt');
  const a = PrepEngine.analyze(job, {});
  assert.equal(a.signals[0].label, 'Language');
  assert.deepEqual(a.keywords, []);
  const p = PrepEngine.create({ job });
  for (const t of [...p.questions, ...p.quizItems.flatMap((q) => [q.q, ...q.options])]) assert.ok(!/“/.test(t) && !/Expérience|Préparer|Capacité|Disponible/.test(t), t);
  assert.ok(!/keep pointing back to these/.test(p.course[0].body), 'no areas, so nothing to point back to');
  for (const r of p.requirements) assert.ok(!/salaire|pourboires|postuler|restaurant fictif/i.test(r), r);
});

test('one-line ads without a full stop still get areas and a role', () => {
  const cases = [['Part time dishwasher needed evenings and weekends, no experience needed', 'Dishwasher'], ['Need a cashier for weekends, must be friendly and good with cash', 'Cashier'],
    ['Hiring delivery drivers with own car and clean driving record', 'Delivery driver'], ['Babysitter needed after school for two kids, must have first aid', 'Babysitter']];
  for (const [job, role] of cases) {
    const a = PrepEngine.analyze(job, {});
    assert.ok(a.themes.length >= 1, job);
    const p = PrepEngine.create({ job });
    assert.equal(p.role, role, job);
    assert.equal(new Set(p.course.map((c) => c.title)).size, p.course.length, job);
  }
  assert.equal(PrepEngine.create({ job: rad('no-bullets-multiline.txt') }).role, 'Cleaner', 'a short "X needed for…" first line is still the title');
});

test('every listed area gets a question in a default plan, and no two lessons quote the same line', () => {
  const all = [...files.map((f) => ad(f)), ...reviewFiles.map((f) => rad(f)), ...advFiles.map((f) => aad(f))];
  for (const job of all) {
    const p = PrepEngine.create({ job });
    const a = PrepEngine.analyze(job, { role: p.role, company: p.company });
    assert.ok(a.themes.length <= 4);
    const asked = new Set(p.questionInfo.map((i) => i.theme));
    for (const t of a.themes) assert.ok(asked.has(t.id), job.slice(0, 40) + ': no question for ' + t.id);
    const quoted = p.course.flatMap((c) => quotesIn(c.body));
    assert.equal(new Set(quoted).size, quoted.length, job.slice(0, 40) + ': two lessons quote the same line: ' + quoted.join(' | '));
    assert.equal(p.course[0].title, 'The heart of this job');
  }
});

test('quiz wrong answers are clearly wrong', () => {
  const KIN = new Set(['Helping customers', 'Sales and persuasion', 'Care and compassion']);
  for (const f of ['retail-store-associate.txt', 'hospitality-barista-noheadings.txt', 'healthcare-care-aide.txt', 'admin-dental-receptionist.txt']) {
    const p = PrepEngine.create({ job: ad(f) });
    const about = p.quizItems.find((q) => q.q === 'What is this job mostly about?');
    if (about && KIN.has(about.options[about.correct])) for (const [i, o] of about.options.entries()) if (i !== about.correct) assert.ok(!KIN.has(o), f + ': ' + o);
    const skill = p.quizItems.find((q) => q.q === 'Which skill or certificate does the ad mention?');
    if (skill && /food ?safe|serving it right|smart serve/i.test(skill.options[skill.correct])) for (const [i, o] of skill.options.entries()) if (i !== skill.correct) assert.ok(!/smart serve|food ?safe/i.test(o), f + ': ' + o);
  }
});

test('checks are about the candidate: screening or reference checks as duties are ordinary tasks', () => {
  const job = 'Airport Screening Officer – Northwind Aviation Security Ltd.\nWhat you will do:\n- Perform security screening of passengers and their bags\n- Use X-ray and walk-through scanners and explain each step to travellers\nWhat you need:\n- High school diploma\n- Must pass a background check\n- Able to stand for long shifts';
  const p = PrepEngine.create({ job });
  assert.ok(p.questions.some((q) => /“perform security screening of passengers/.test(q)), 'a screening duty can be asked about');
  assert.ok(!p.questions.some((q) => /background check/i.test(q)), 'the candidate’s own check is never asked about');
  assert.ok(!p.questions.some((q) => /“high school diploma”/i.test(q)), 'a bare credential is not a story hook');
  assert.ok(!p.questions.some((q) => /stand for long shifts”\. How would that schedule work/.test(q)), 'standing for long shifts is stamina, not a schedule');
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
  assert.equal(none.company, '');
});

test('an ad that names no company never shows "Company" as if it were one', () => {
  const p = PrepEngine.create({ job: 'Store associate at a neighbourhood grocery. Stock shelves, help customers find things and run the till on weekends.' });
  assert.equal(p.company, '');
  const text = JSON.stringify([p.course, p.questions, p.questionInfo, p.quizItems, p.requirements]);
  assert.ok(!/\bCompany\b/.test(text), 'no lesson, question or quiz item uses the placeholder');
  assert.ok(!/\bat \.|\bat {2}|\bat ,/.test(text), 'no sentence reads "at ." or "at  "');
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
