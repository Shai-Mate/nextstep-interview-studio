'use strict';
/* Onboarding flow and the first minute: a job link (paste the ad only if that fails),
   sample ads, plan creation, the decode moment, the "Your ad, decoded" reveal and the
   insights page.
   Classic script loaded after app.js: it shares app.js top-level globals
   ($, esc, I, screens, binders, actions, show, notify, persist, records, active, draft,
   analysisOf, reduceMotion, wordCount, iconBtn, needPrep, ...).
   Screens register into `screens`, per-screen event wiring into `binders[view]`,
   click actions into `actions[name]`. The CSP blocks inline style attributes: use classes,
   SVG presentation attributes, or el.style / custom properties from JS. Every ad and user
   string goes through esc() before it reaches innerHTML. */

/* Four made-up job ads from different kinds of work, so anyone can see it work in one tap.
   Every company here is fictional, and each ad says so. */
const FLOW_SAMPLES = [
  {
    id: 'retail',
    area: 'Retail',
    title: 'Store associate',
    role: 'Store associate',
    company: 'Maple & Thread',
    where: 'Maple & Thread, a fictional store',
    icon: 'M5 8.5h14l-1.2 11.5H6.2zM9 8.5V7a3 3 0 016 0v1.5',
    job: `Store Associate (Part-time) – Maple & Thread
Maple & Thread is a fictional neighbourhood clothing and home store with two locations.

What you'll do
• Greet every customer and help them find what they need
• Process sales, returns and exchanges on our POS system and handle cash accurately
• Keep the sales floor tidy, restock shelves and set up new displays
• Receive deliveries and help with monthly inventory counts
• Share customer feedback with the store manager

What we're looking for
• Friendly and patient, even when the store is busy
• Previous retail or customer service experience is an asset but not required
• Comfortable standing for long periods and lifting boxes up to 20 kg
• Available evenings and weekends, including holiday season
• Reliable and on time

Why work with us
Staff discount, flexible scheduling and paid training.`
  },
  {
    id: 'trades',
    area: 'Trades',
    title: 'Electrical apprentice',
    role: 'Electrical apprentice',
    company: 'Brightline Electric',
    where: 'Brightline Electric, a fictional contractor',
    icon: 'M13 3L5.5 13.5h5.5L10 21l8-11h-5.5z',
    job: `Electrical Apprentice (2nd or 3rd year) — Brightline Electric (fictional)

About us: Brightline Electric is a small, family-run contractor doing residential renovations and light commercial work. We are growing and want an apprentice who takes pride in clean, safe work.

Responsibilities:
- Install and repair wiring, outlets, panels and lighting under the supervision of a journeyperson
- Read and follow blueprints, drawings and the electrical code
- Run conduit, pull wire and terminate devices
- Troubleshoot circuits using a multimeter
- Keep job sites clean and follow all safety procedures, including lockout/tagout
- Talk with homeowners respectfully and explain what we are doing

Requirements:
- Registered apprentice, 2nd or 3rd year, working toward your Red Seal
- WHMIS and fall protection training
- Valid driver's licence and reliable transportation
- Own basic hand tools
- Able to work on ladders, in crawl spaces and outdoors in all weather
- Good attitude, eager to learn, and you show up on time

Nice to have:
- Experience with commercial tenant improvements
- First Aid certificate

We offer: competitive wages, paid school time, tool allowance and a supportive crew.`
  },
  {
    id: 'care',
    area: 'Healthcare',
    title: 'Care aide',
    role: 'Health care aide',
    company: 'Cedar Grove Care Home',
    where: 'Cedar Grove, a fictional care home',
    icon: 'M12 20s-7.5-4.6-7.5-10.2A4.2 4.2 0 0112 7.3a4.2 4.2 0 017.5 2.5C19.5 15.4 12 20 12 20zM12 10.5v5M9.5 13h5',
    job: `Health Care Aide / Personal Support Worker – Cedar Grove Care Home

Cedar Grove Care Home (a fictional long-term care home) is home to 120 residents. Our values are dignity, kindness and teamwork.

Position summary
Provide safe, compassionate personal care to residents and support their wellbeing every day.

Key duties
- Assist residents with bathing, dressing, grooming, toileting and meals
- Help residents move safely using mechanical lifts and transfer techniques
- Observe changes in a resident's condition and report them to the nurse in charge
- Record care accurately in the electronic charting system (PointClickCare)
- Follow infection prevention and control practices
- Encourage residents to take part in activities and support families during visits

Qualifications
- Health Care Aide or Personal Support Worker certificate
- Current CPR and First Aid
- Clear criminal record check (vulnerable sector)
- Good spoken and written English
- Able to work days, evenings, nights and weekends on a rotating schedule
- Experience in long-term care or dementia care is preferred

Benefits include extended health and dental, pension plan and paid education days.`
  },
  {
    id: 'tech',
    area: 'Tech',
    title: 'Junior developer',
    role: 'Junior front-end developer',
    company: 'Kitebird',
    where: 'Kitebird, a fictional startup',
    icon: 'M9 7.5L4.5 12 9 16.5M15 7.5l4.5 4.5-4.5 4.5',
    job: `Junior Front-End Developer
Kitebird (a fictional travel-planning startup) · Remote within Canada

About Kitebird
We help families plan trips together. Our team of 18 ships small improvements every week.

What you will work on
- Build accessible, responsive interfaces in React and TypeScript
- Turn Figma designs into clean, reusable components
- Write unit tests with Jest and fix bugs reported by users
- Take part in code reviews, planning and short daily stand-ups
- Improve page speed and Core Web Vitals on our booking pages

You have
- 1+ years building web apps with JavaScript, HTML and CSS (internships, bootcamp and personal projects count)
- Some experience with React and Git
- A basic understanding of web accessibility (WCAG) and REST APIs
- Clear written communication for a remote team
- Curiosity and willingness to ask for help

Bonus points
- Next.js or GraphQL
- Experience with analytics dashboards or A/B tests

Perks: remote-first, home office budget, learning stipend, 4 weeks vacation.`
  }
];
const FLOW_HL = [['must', 'Must-have'], ['skill', 'Skill or tool'], ['nice', 'Nice to have'], ['keyword', 'Worth repeating']];
const FLOW_EMPTY_HINT = 'Paste all of it. The duties and requirements matter most.';
let flowSamplesFrom = 'welcome';
let flowBusy = false;
let flowFallback = null;
let flowToken = 0;
let flowAbort = null;
/* A personal course that did not come back: { message }. The writing screen then shows why, with
   Try again (the same draft) and Use general lessons. Nothing is built or saved until one is chosen. */
let flowWriteFailed = null;
const FLOW_FALLBACK = {
  invalid: 'That does not look like a web link. Check it, or paste the ad text below.',
  login: 'That page asks people to sign in, so we could not read it. This is common on LinkedIn and Indeed. Paste the ad text below. It stays on this phone.',
  empty: 'We could not read a job ad on that page. Paste the ad text below and your plan still builds here.',
  short: 'That page did not include enough of the ad. Paste the full text below.',
  blocked: 'We could not open that link. Paste the ad text below.',
  large: 'That page was too large to read. Paste the ad text below.',
  timeout: 'That page took too long. Paste the ad text below.',
  limited: 'Too many tries just now. Paste the ad text below.',
  unset: 'Reading job links is not turned on for this copy yet. Paste the ad text below and your plan still builds on this phone.',
  unreachable: 'We could not reach the page reader just now. Paste the ad text below. It stays on this phone.',
  forbidden: 'The page reader did not accept this request. Paste the ad text below.'
};
let flowReadTimer = 0;
let flowAboutNote = '';
let flowDecodeTimer = 0;
/* When the decode or reveal screen appeared: a quick double tap on the previous screen's
   bottom button must not skip the moment it leads to. */
let flowShownAt = 0;
const flowSettled = () => performance.now() - flowShownAt > 500;

const flowList = (v) => (Array.isArray(v) ? v : []);
const flowStr = (v) => (typeof v === 'string' ? v.trim() : '');
const flowNum = (n) => (Number(n) || 0).toLocaleString();
const flowPlural = (n, one, many) => flowNum(n) + ' ' + (n === 1 ? one : many);
/* Word joiners keep "nice-to-have" on one line. */
const FLOW_NICE = ['nice-\u2060to-\u2060have', 'nice-\u2060to-\u2060haves'];
function flowClip(s, max) {
  const t = flowStr(s).replace(/\s+/g, ' ');
  if (t.length <= max) return t;
  const cut = t.slice(0, max);
  const at = cut.lastIndexOf(' ');
  return (at > max * 0.6 ? cut.slice(0, at) : cut).replace(/[\s,;:.–—-]+$/, '') + '…';
}
function flowWho(p) {
  const role = flowStr(p && p.role);
  const company = flowStr(p && p.company);
  return [role && !/^new opportunity$/i.test(role) ? role : '', company && !/^company$/i.test(company) ? company : ''].filter(Boolean).join(' · ');
}
function flowIcon(d) {
  return `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg>`;
}
/* On-device analysis of loose text (the job-ad box). Null when the engine is missing or fails. */
function flowAnalyzeText(text) {
  if (!globalThis.PrepEngine || typeof PrepEngine.analyze !== 'function') return null;
  try {
    const a = PrepEngine.analyze(String(text || ''), {});
    return a && typeof a === 'object' ? a : null;
  } catch { return null; }
}
/* Everything the decode, reveal and insights screens show, from the analysis when there is one
   and from the saved preparation when there is not (older engine, or analysis unavailable). */
function flowFacts(p) {
  const a = analysisOf(p);
  const reqs = flowList(a && a.requirements).filter((r) => r && flowStr(r.text));
  const of = (kind) => reqs.filter((r) => r.kind === kind).map((r) => flowStr(r.text));
  const must = of('must');
  const duty = of('duty');
  const nice = of('nice');
  const fallback = flowList(p.requirements).map(flowStr).filter(Boolean);
  const asks = must.length ? must : duty.length ? duty : fallback;
  const seen = new Set();
  const skills = flowList(a && a.skills).map(flowStr).filter((s) => {
    const k = s.toLowerCase();
    if (!s || s.length > 60 || seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 12);
  const themes = flowList(a && a.themes).filter((t) => t && flowStr(t.label));
  const signals = flowList(a && a.signals).map((s) => flowStr(s && s.label)).filter(Boolean).slice(0, 6);
  const sen = a && a.seniority && typeof a.seniority === 'object' ? a.seniority : null;
  if (sen && ['Entry', 'Mid', 'Senior', 'Lead'].includes(sen.level)) {
    signals.unshift(sen.level + ' level' + (Number.isInteger(sen.years) && sen.years > 0 ? ' · ' + sen.years + '+ years' : ''));
  }
  const words = a && Number.isFinite(a.words) && a.words > 0 ? a.words : wordCount(p.job);
  return {
    a, words, must, duty, nice, asks, skills, themes, signals,
    asksLabel: must.length || !duty.length ? ['thing they ask for', 'things they ask for'] : ['thing you would do', 'things you would do'],
    questions: flowList(p.questions).length,
    lessons: flowList(p.course).length
  };
}
function flowSteps(f) {
  const steps = ['Read ' + flowPlural(f.words, 'word', 'words')];
  if (f.must.length) steps.push('Found ' + flowPlural(f.must.length, 'thing they ask for', 'things they ask for') + (f.nice.length ? ' and ' + flowPlural(f.nice.length, FLOW_NICE[0], FLOW_NICE[1]) : ''));
  else if (f.duty.length) steps.push('Found ' + flowPlural(f.duty.length, 'thing you would do', 'things you would do') + ' day to day');
  else if (f.asks.length) steps.push('Picked out ' + flowPlural(f.asks.length, 'line', 'lines') + ' that matter most');
  if (f.skills.length) steps.push('Spotted ' + flowPlural(f.skills.length, 'skill', 'skills') + ': ' + f.skills.slice(0, 3).join(', ') + (f.skills.length > 3 ? '…' : ''));
  const top = f.themes[0] ? flowStr(f.themes[0].label) : '';
  if (top) steps.push('Worked out what this job is really about: ' + top.charAt(0).toLowerCase() + top.slice(1));
  steps.push('Wrote ' + flowPlural(f.questions, 'practice question', 'practice questions') + ' and ' + flowPlural(f.lessons, 'short lesson', 'short lessons'));
  return steps;
}
/* "They want to hear how you ..." reads as "How you ..." under a "What they want to hear" label. */
function flowWant(probe) {
  const t = flowStr(probe).replace(/^they want to hear\s+/i, '');
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : '';
}
/* Three questions that show the plan understood this job: one of each kind first. */
function flowLikelyQuestions(p) {
  const info = Array.isArray(p.questionInfo) ? p.questionInfo : [];
  const qs = flowList(p.questions).map((q, i) => ({ q: flowStr(q), i, kind: info[i] && typeof info[i] === 'object' ? info[i].kind : '' })).filter((x) => x.q);
  if (!qs.some((x) => x.kind)) return qs.slice(0, 3).map((x) => x.q);
  const picked = [];
  ['behavioural', 'role', 'situational', 'gap', 'motivation'].forEach((kind) => {
    const hit = qs.find((x) => x.kind === kind);
    if (hit && picked.length < 3) picked.push(hit);
  });
  qs.forEach((x) => { if (picked.length < 3 && !picked.includes(x) && x.kind !== 'closing') picked.push(x); });
  return picked.sort((x, y) => x.i - y.i).map((x) => x.q);
}
/* The job ad with the analysis highlights. Ranges index the original text; every segment is escaped. */
/* The highlighted ad. Core's renderer (app.js) keeps each must or nice line as one band with the
   skills inside it; the flat marks below are only a fallback if it is missing or fails. */
function flowMarked(text, a) {
  if (typeof coreHighlightAd === 'function') {
    try {
      const r = coreHighlightAd(text, a);
      if (r && typeof r.html === 'string' && r.kinds && typeof r.kinds.has === 'function') return r;
    } catch { /* use the flat marks */ }
  }
  const src = String(text || '');
  const kinds = new Set();
  let out = '';
  let at = 0;
  for (const h of flowList(a && a.highlights)) {
    const s = Number(h && h.start);
    const e = Number(h && h.end);
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < at || e <= s || e > src.length) continue;
    const kind = FLOW_HL.some(([k]) => k === h.kind) ? h.kind : 'keyword';
    kinds.add(kind);
    out += esc(src.slice(at, s)) + `<mark class="hl hl-${kind}">${esc(src.slice(s, e))}</mark>`;
    at = e;
  }
  return { html: out + esc(src.slice(at)), kinds };
}
function flowStrengthBar(pct) {
  const w = Math.max(8, Math.min(100, Math.round(pct)));
  return `<svg class="track" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="4" rx="2" fill="rgba(255,255,255,.12)"></rect><rect class="bar" data-bar width="${w}" height="4" rx="2" fill="#FFC48A"></rect></svg>`;
}
function flowStatsHtml(f) {
  const lead = [
    [f.asks.length, f.asksLabel],
    [f.skills.length, ['skill the ad mentions', 'skills the ad mentions']],
    [f.nice.length, FLOW_NICE],
    [f.words, ['word read', 'words read']]
  ].filter(([n]) => n > 0).slice(0, 2);
  const stats = [...lead, [f.questions, ['practice question', 'practice questions']]];
  return `<div class="glass reveal-stats">${stats.map(([n, [one, many]]) => `<div class="reveal-stat"><b data-count="${n}" aria-hidden="true">${flowNum(n)}</b><span class="flow-sr">${flowNum(n)} </span><span>${n === 1 ? one : many}</span></div>`).join('')}</div>`;
}
/* The decoded view shared by the reveal and insights screens. */
function flowDecodedHtml(p, f) {
  const themes = f.themes.slice(0, 3);
  const max = Math.max(1, ...themes.map((t) => Number(t.score) || 0));
  const themeHtml = themes.length ? `<section class="flow-sec" aria-labelledby="flow-about">
      <div class="flow-head"><h2 class="flow-title" id="flow-about">What this job is really about</h2></div>
      <p class="hint">The parts of the job the ad keeps coming back to.</p>
      ${themes.map((t) => {
        const pct = ((Number(t.score) || 0) / max) * 100;
        const level = pct >= 75 ? 'A big part of the job' : pct >= 45 ? 'Comes up often' : 'Mentioned';
        const ev = flowClip(flowList(t.evidence).find((x) => flowStr(x)) || '', 150);
        const want = flowWant(t.probe);
        return `<article class="glass theme-card">
          <div class="theme-top"><h3>${esc(t.label)}</h3><span class="strength">${level}</span></div>
          ${flowStrengthBar(pct)}
          ${ev ? `<p class="excerpt">“${esc(ev)}”</p>` : ''}
          ${want ? `<div class="want"><p class="kicker">What they want to hear</p><p>${esc(want)}</p></div>` : ''}
        </article>`;
      }).join('')}
    </section>` : '';
  const DUTY_NOTE = 'You don’t need to have done all of this before.';
  /* With must-haves, the duties still get their own short list: for hourly jobs the duties are the job. */
  const duties = f.must.length ? f.duty.slice(0, 5) : [];
  const dutyHtml = duties.length ? `<section class="flow-sec" aria-labelledby="flow-duties">
      <div class="flow-head"><h2 class="flow-title" id="flow-duties">What you would do</h2></div>
      <ul class="flow-list">${duties.map((x) => `<li>${esc(flowClip(x, 180))}</li>`).join('')}</ul>
      <p class="italic flow-reassure">${DUTY_NOTE}</p>
    </section>` : '';
  const asks = f.asks.slice(0, 12);
  const asDuties = !f.must.length && f.duty.length > 0;
  const asksHtml = asks.length ? `<section class="flow-sec" aria-labelledby="flow-asks">
      <div class="flow-head"><h2 class="flow-title" id="flow-asks">${asDuties ? 'What you would do' : 'What they ask for'}</h2><span class="flow-count">${asks.length}</span></div>
      <ul class="flow-list">${asks.map((x) => `<li>${esc(flowClip(x, 180))}</li>`).join('')}</ul>
      <p class="italic flow-reassure">${asDuties ? DUTY_NOTE : 'You don’t need to tick every box. Most people don’t.'}</p>
    </section>` : '';
  const niceHtml = f.nice.length ? `<section class="flow-sec" aria-labelledby="flow-nice">
      <div class="flow-head"><h2 class="flow-title" id="flow-nice">Nice to have</h2><span class="flow-count">${f.nice.length}</span></div>
      <p class="hint">Extras, not deal-breakers. “Not yet, and here is how I would learn it” is a fine answer.</p>
      <ul class="flow-list nice">${f.nice.slice(0, 6).map((x) => `<li>${esc(flowClip(x, 180))}</li>`).join('')}</ul>
    </section>` : '';
  const skillsHtml = f.skills.length ? `<section class="flow-sec" aria-labelledby="flow-skills">
      <div class="flow-head"><h2 class="flow-title" id="flow-skills">Skills the ad mentions</h2><span class="flow-count">${f.skills.length}</span></div>
      <ul class="flow-chips">${f.skills.map((s) => `<li class="flow-chip">${esc(s)}</li>`).join('')}</ul>
    </section>` : '';
  const signalsHtml = f.signals.length ? `<section class="flow-sec" aria-labelledby="flow-signals">
      <div class="flow-head"><h2 class="flow-title" id="flow-signals">Good to know</h2></div>
      <ul class="flow-chips">${f.signals.map((s) => `<li class="flow-chip signal">${esc(s)}</li>`).join('')}</ul>
    </section>` : '';
  const qs = flowLikelyQuestions(p);
  const qsHtml = qs.length ? `<section class="flow-sec" aria-labelledby="flow-qs">
      <div class="flow-head"><h2 class="flow-title" id="flow-qs">They’ll probably ask</h2></div>
      <ol class="flow-asks">${qs.map((q) => `<li>${esc(q)}</li>`).join('')}</ol>
      <p class="hint">You will practise these in your answer bank and the mock interview.</p>
    </section>` : '';
  return themeHtml + dutyHtml + asksHtml + niceHtml + skillsHtml + signalsHtml + qsHtml;
}
function flowNoPrep() {
  view = 'welcome';
  return screens.welcome();
}
function flowFocusTitle() {
  const h = document.querySelector('#app .flow-focus');
  if (h) { try { h.focus({ preventScroll: true }); } catch { /* focus is a nicety */ } }
}

function flowExtractEndpoint() {
  try {
    const value = window.NEXTSTEP_EXTRACT_URL;
    return typeof value === 'string' ? value.trim() : '';
  } catch { return ''; }
}
function flowUrlProblem(raw) {
  if (!raw) return 'invalid';
  let url;
  try { url = new URL(raw); } catch { return 'invalid'; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return 'invalid';
  if (url.username || url.password) return 'invalid';
  return '';
}
function flowCancelExtract() {
  flowToken += 1;
  flowBusy = false;
  if (flowAbort) {
    try { flowAbort.abort(); } catch { /* already finished */ }
    flowAbort = null;
  }
}
async function flowExtract(raw) {
  const endpoint = flowExtractEndpoint();
  if (!endpoint) return { ok: false, reason: 'unset' };
  const ctrl = new AbortController();
  flowAbort = ctrl;
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      mode: 'cors',
      credentials: 'omit',
      cache: 'no-store',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: raw }),
      signal: ctrl.signal
    });
    let data = null;
    try { data = await res.json(); } catch { data = null; }
    if (!res.ok || !data || data.ok === false) return { ok: false, reason: (data && data.reason) || 'unreachable' };
    const text = String(data.text || '').replace(/\u0000/g, '').trim();
    if (text.length < 40) return { ok: false, reason: 'short' };
    return {
      ok: true,
      text: text.slice(0, 60000),
      company: String(data.company || '').replace(/\s+/g, ' ').trim().slice(0, 120),
      role: String(data.role || '').replace(/\s+/g, ' ').trim().slice(0, 120)
    };
  } catch {
    return { ok: false, reason: 'unreachable' };
  } finally {
    clearTimeout(timer);
    if (flowAbort === ctrl) flowAbort = null;
  }
}
function readLink() {
  draft = draft || {};
  if ($('#url')) draft.url = $('#url').value;
  if ($('#job')) draft.job = $('#job').value;
}
async function flowFromLink(event) {
  if (event) event.preventDefault();
  if (flowBusy) return;
  readLink();
  const raw = String(draft.url || '').trim();
  const problem = flowUrlProblem(raw);
  if (problem) {
    flowFallback = { reason: problem };
    show('link');
    return;
  }
  if (!flowExtractEndpoint()) {
    flowFallback = { reason: 'unset' };
    show('link');
    return;
  }
  const token = ++flowToken;
  flowBusy = true;
  flowFallback = null;
  notify('');
  show('link');
  const result = await flowExtract(raw);
  if (token !== flowToken) return;
  flowBusy = false;
  if (!result.ok) {
    flowFallback = { reason: result.reason || 'unreachable' };
    show('link');
    return;
  }
  try {
    draft.job = result.text;
    draft.role = result.role || '';
    draft.company = result.company || '';
    draft.url = raw;
    draft.intake = {};
    draft.sampleId = '';
    draft.aboutYou = null;
    draft.aboutForm = null;
    flowFallback = null;
    flowOfferAbout();
  } catch (err) {
    flowFallback = { reason: 'short' };
    show('link');
    notify(err.message);
  }
}
function flowFromPaste() {
  readLink();
  const job = String(draft.job || '').trim();
  if (job.length < 40) { notify('Paste at least 40 characters from the actual ad.'); return; }
  draft.job = job;
  draft.role = '';
  draft.company = '';
  draft.intake = {};
  draft.sampleId = FLOW_SAMPLES.some((x) => x.job.trim() === job) ? FLOW_SAMPLES.find((x) => x.job.trim() === job).id : '';
  draft.aboutYou = null;
  draft.aboutForm = null;
  try {
    flowFallback = null;
    flowOfferAbout();
  } catch (err) { notify(err.message); }
}
function flowOfferAbout() {
  draft = draft || {};
  draft.autoWrite = false;
  let saved = null;
  try { saved = globalThis.NextStepCourse ? NextStepCourse.normalizeAbout(corePrefs().aboutYou) : null; }
  catch { saved = null; }
  if (saved && flowProviderReady()) draft.autoWrite = true;
  show('about');
}
function readRole() {
  draft = draft || {};
  if ($('#role')) draft.role = $('#role').value;
  if ($('#company')) draft.company = $('#company').value;
}
function readJob() {
  draft = draft || {};
  if ($('#job')) draft.job = $('#job').value;
  if ($('#url')) draft.url = $('#url').value;
}
function readIntake() {
  draft = draft || {};
  if ($('#intake')) draft.intake = Object.fromEntries(new FormData($('#intake')));
}
/* One calm line about the pasted ad, computed on this device. */
function flowReadout(text) {
  const t = String(text || '');
  if (!t.trim()) return '';
  const a = flowAnalyzeText(t);
  const words = a && Number.isFinite(a.words) && a.words > 0 ? a.words : wordCount(t);
  if (t.trim().length < 40) return flowPlural(words, 'word', 'words') + ' so far. Paste the whole ad.';
  const parts = [flowPlural(words, 'word', 'words')];
  const reqs = flowList(a && a.requirements);
  const must = reqs.filter((r) => r && r.kind === 'must').length;
  const duty = reqs.filter((r) => r && r.kind === 'duty').length;
  if (must) parts.push(flowPlural(must, 'thing they ask for', 'things they ask for'));
  else if (duty) parts.push(flowPlural(duty, 'thing you would do', 'things you would do'));
  const skills = flowList(a && a.skills).length;
  if (skills) parts.push(flowPlural(skills, 'skill spotted', 'skills spotted'));
  return parts.join(' · ');
}
/* The visible line follows every pause in typing; screen readers only hear it after a paste
   or when the ad grew or shrank by 20 words or more. */
let flowSaidWords = 0;
let flowPasted = false;
function flowUpdateReadout() {
  const box = $('#job');
  const out = $('#ad-readout');
  if (!box || !out) return;
  const line = flowReadout(box.value);
  out.textContent = line || FLOW_EMPTY_HINT;
  out.classList.toggle('on', !!line);
  const live = $('#ad-readout-live');
  const words = wordCount(box.value);
  if (live && line && (flowPasted || Math.abs(words - flowSaidWords) >= 20)) {
    live.textContent = line;
    flowSaidWords = words;
  }
  flowPasted = false;
}

Object.assign(screens, {
  link() {
    draft = draft || {};
    const fb = flowFallback;
    const message = fb ? (FLOW_FALLBACK[fb.reason] || FLOW_FALLBACK.empty) : '';
    return `<form class="screen link-screen" id="link-form" data-screen="link">
      <div class="topbar">${iconBtn('back-welcome', 'Back', I.back)}<span class="label">New preparation</span></div>
      <h1 class="flow-focus" tabindex="-1">Paste the job link</h1>
      <p class="italic lg">One link. The plan builds itself.</p>
      <label class="field" for="url">Job link</label>
      <input id="url" name="url" type="url" inputmode="url" autocomplete="url" maxlength="2000" placeholder="https://" value="${esc(draft.url || '')}" ${flowBusy ? 'readonly' : ''}>
      <p class="hint" id="link-status">${flowBusy ? 'Reading the public page. This can take a few seconds.' : 'We read the public page for the company, the role and what they ask for. Your answers stay on this phone.'}</p>
      <button class="primary" type="submit" ${flowBusy ? 'disabled' : ''}>${flowBusy ? 'Reading the page' : 'Continue'}</button>
      ${message ? `<div class="glass pad-sm link-fallback" role="status">
        <p class="fallback-msg">${esc(message)}</p>
        <label class="field" for="job">Job ad text</label>
        <textarea id="job" name="job" maxlength="60000" placeholder="Paste the full job ad here">${esc(draft.job || '')}</textarea>
        <button class="primary" type="button" id="build-paste">Continue with this text</button>
      </div>` : ''}
      <button type="button" class="text-btn" data-action="try-sample">Try a sample ad</button>
    </form>`;
  },
  role() {
    draft = draft || {};
    return `<form class="screen" id="role-form" data-screen="role">
      <div class="topbar">${iconBtn('back-welcome', 'Back', I.back)}<span class="label">Step 1 of 3</span></div>
      <h1>What role are you preparing for?</h1>
      <p class="italic lg">One role. One clear plan.</p>
      <label class="field" for="role">Role title</label>
      <input id="role" name="role" type="text" maxlength="120" value="${esc(draft.role || '')}" autocomplete="organization-title">
      <label class="field" for="company">Company</label>
      <input id="company" name="company" type="text" maxlength="120" value="${esc(draft.company || '')}" autocomplete="organization">
      <div class="spacer"></div>
      <button class="primary" type="submit">Continue</button>
    </form>`;
  },
  jobad() {
    draft = draft || {};
    const has = !!String(draft.job || '').trim();
    return `<form class="screen" id="job-form" data-screen="jobad">
      <div class="topbar">${iconBtn('back-role', 'Back', I.back)}<span class="label">Step 2 of 3</span></div>
      <h1>Paste the job ad</h1>
      <p class="italic lg">Your plan starts with their words.</p>
      <label class="field" for="job">Job-ad text</label>
      <textarea class="tall" id="job" name="job" maxlength="60000" placeholder="Paste the full job ad here" aria-describedby="ad-readout">${esc(draft.job || '')}</textarea>
      <div class="readout-row">
        <p class="readout" id="ad-readout">${esc(FLOW_EMPTY_HINT)}</p>
        <p class="flow-sr" id="ad-readout-live" aria-live="polite"></p>
        <button type="button" class="link" id="use-sample" data-action="sample-from-jobad" ${has ? 'hidden' : ''}>Use a sample ad</button>
      </div>
      <label class="field" for="url">Job-ad URL, optional</label>
      <input id="url" name="url" type="url" maxlength="2000" value="${esc(draft.url || '')}" placeholder="Saved as a reference only" inputmode="url">
      <div class="meta"><span id="fetch-status">Stays on this device.</span><button type="button" class="link" id="how-ad">How to add a job ad</button></div>
      <button class="primary" type="submit">Continue</button>
    </form>`;
  },
  setup() {
    draft = draft || {};
    const chosen = { ...defaults, ...(draft.intake || {}) };
    return `<form class="screen" id="intake" data-screen="setup">
      <div class="topbar">${iconBtn('back-job', 'Back', I.back)}<span class="label">Step 3 of 3</span></div>
      <h1>Four quick choices</h1>
      <p class="italic lg">About a minute. Or skip it.</p>
      <div class="groups">${Object.entries(groups).map(([k, opts]) => `<fieldset><legend>${groupLabels[k]}</legend><div class="choices">${opts.map((v) => `<label class="choice"><input type="radio" name="${k}" value="${esc(v)}" ${v === chosen[k] ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div></fieldset>`).join('')}</div>
      <div class="spacer"></div>
      <button class="primary" type="submit">Create my plan</button>
      <button type="button" class="text-btn" id="skip">Skip for now</button>
    </form>`;
  },
  samples() {
    const fromJob = flowSamplesFrom === 'jobad';
    return `<div class="screen samples" data-screen="samples">
      <div class="topbar">${iconBtn('samples-back', 'Back', I.back)}<span class="label">Sample job ads</span></div>
      <h1 class="flow-focus" tabindex="-1">Try a sample job ad</h1>
      <p class="italic lg">Any kind of job works.</p>
      <p class="sub">${fromJob ? 'Pick one and it goes into the job-ad box for you.' : 'Pick one and watch it read the ad, right here on this device.'} The companies are made up.</p>
      <div class="sample-list">${FLOW_SAMPLES.map((s) => `<button type="button" class="primary sample-card" data-action="use-sample" data-sample="${s.id}"><span class="sample-icon">${flowIcon(s.icon)}</span><span class="copy"><span class="kicker">${esc(s.area)}</span><strong>${esc(s.title)}</strong><span class="where">${esc(s.where)}</span></span>${I.chev}</button>`).join('')}</div>
      <div class="spacer"></div>
      <p class="fine">Practice ads only. Your own ad works the same way.</p>
    </div>`;
  },
  decode() {
    const p = active;
    if (!p) return flowNoPrep();
    const f = flowFacts(p);
    const steps = flowSteps(f);
    const still = reduceMotion();
    const who = flowWho(p);
    return `<div class="screen decode${still ? ' still' : ''}" data-screen="decode">
      ${who ? `<p class="kicker decode-kicker">${esc(who)}</p>` : '<p class="kicker decode-kicker">Your job ad</p>'}
      <div class="decode-stage"><div class="orb-anchor decode-orb" data-orb data-env="1" data-s="1" data-up="166,102" data-down="101,280" data-energy="1"></div></div>
      <h1 class="decode-title flow-focus" tabindex="-1">${still ? 'Your plan is ready' : 'Reading your ad'}</h1>
      <p class="italic decode-line">${esc(p.generatedBy === 'subscription' ? 'These lessons were written for you, from this ad and what you shared.' : (p.generateNote || 'Your plan is built on this phone.'))}</p>
      <ol class="decode-steps">${steps.map((s) => `<li class="decode-step"><span class="tick" aria-hidden="true">${I.check}</span><span>${esc(s)}</span></li>`).join('')}</ol>
      <div class="spacer"></div>
      ${still ? `<button type="button" class="primary" data-action="reveal-next"><span>Continue</span>${I.arrow}</button>` : '<button type="button" class="text-btn decode-skip" data-action="decode-skip">Tap anywhere to skip</button>'}
    </div>`;
  },
  reveal() {
    const p = active;
    if (!p) return flowNoPrep();
    const f = flowFacts(p);
    const who = flowWho(p);
    return `<div class="screen flow-full reveal" data-screen="reveal">
      <div class="scroll">
        <div class="reveal-head">
          <div class="copy">${who ? `<p class="kicker">${esc(who)}</p>` : ''}<h1 class="flow-focus" tabindex="-1">Your ad, decoded.</h1></div>
          <div class="orb-slot md"><div class="orb-anchor md" data-orb data-env=".8" data-s=".75" data-up="80,40" data-down="40,90" data-energy="1"></div></div>
        </div>
        <p class="italic lg reveal-line">Here’s what they really want.</p>
        ${p.sample ? '<p class="flow-note">A practice ad from a made-up company.</p>' : ''}
        ${p.generatedBy === 'subscription' ? '<p class="flow-note">Written for you from this ad and what you shared. Your practice answers still stay on this phone.</p>' : ''}
        ${p.generateNote ? `<p class="flow-note">${esc(p.generateNote)}</p>` : ''}
        ${typeof coreGenericBanner === 'function' ? coreGenericBanner() : ''}
        ${flowStatsHtml(f)}
        ${flowDecodedHtml(p, f)}
        <div class="flow-links">
          <button type="button" class="text-btn" data-action="open-insights" data-to="ad">${f.a && flowList(f.a.highlights).length ? 'See it highlighted in your ad' : 'See your job ad'}</button>
          ${p.sample ? '<button type="button" class="text-btn" data-action="start">Try it with your own job ad</button>' : ''}
        </div>
      </div>
      <div class="flow-foot"><button type="button" class="primary" data-action="go-today"><span>Start today’s session</span>${I.arrow}</button></div>
    </div>`;
  },
  insights() {
    const p = active;
    if (!p) return flowNoPrep();
    const f = flowFacts(p);
    const ad = flowMarked(p.job, f.a);
    const legend = FLOW_HL.filter(([k]) => ad.kinds.has(k));
    return `<div class="screen flow-full insights" data-screen="insights">
      <div class="topbar flow-bar">${iconBtn('close-today', 'Back to Today', I.back)}<span class="label">${esc(flowWho(p) || 'Your job ad')}</span></div>
      <div class="scroll">
        <h1 class="flow-focus" tabindex="-1">Your ad, decoded.</h1>
        <p class="italic lg">Their words, made plain.</p>
        ${f.a ? '' : '<p class="flow-note">A simpler view: the detailed reading is not available on this device right now.</p>'}
        ${flowStatsHtml(f)}
        ${flowDecodedHtml(p, f)}
        <section class="flow-sec" id="flow-ad" aria-labelledby="flow-ad-title">
          <div class="flow-head"><h2 class="flow-title" id="flow-ad-title">${legend.length ? 'Your ad, highlighted' : 'Your job ad'}</h2></div>
          ${legend.length ? `<p class="flow-legend"><span class="flow-sr">Key: </span>${legend.map(([k, l]) => `<span class="key hl-${k}">${l}</span>`).join('')}</p>` : ''}
          <div class="glass flow-ad"><p class="flow-ad-text">${ad.html}</p></div>
          ${p.url ? `<p class="hint">Reference URL: ${esc(p.url)}</p>` : ''}
        </section>
        <button type="button" class="text-btn flow-back" data-action="close-today">Back to Today</button>
      </div>
    </div>`;
  },
  about() {
    draft = draft || {};
    flowPrepareAbout();
    const form = draft.aboutForm;
    const mode = form.mode || 'resume';
    const ready = flowProviderReady();
    const stage = form.stage || 'Not sure yet';
    return `<form class="screen" id="about-form" data-screen="about">
      <div class="topbar">${iconBtn('back-link', 'Back', I.back)}<span class="label">About you</span></div>
      <h1 class="flow-focus" tabindex="-1">About you</h1>
      <p class="italic lg">So the lessons can use your real experience.</p>
      <p class="sub">This stays on this phone until you write a personal course. Practice answers are never sent. If you skip, the lessons stay general.</p>
      ${flowAboutNote ? `<p class="flow-note" role="status">${esc(flowAboutNote)}</p>` : ''}
      <fieldset class="about-modes"><legend>How should we learn about you?</legend><div class="choices">${[
        ['resume', 'Résumé'],
        ['linkedin', 'LinkedIn'],
        ['answers', 'A few questions']
      ].map(([id, label]) => `<label class="choice"><input type="radio" name="aboutMode" value="${id}" ${mode === id ? 'checked' : ''}><span>${label}</span></label>`).join('')}</div></fieldset>
      <div class="about-panel" ${mode === 'resume' ? '' : 'hidden'}>
        <label class="field" for="about-file">Résumé file, PDF or plain text</label>
        <input class="file" id="about-file" type="file" accept="application/pdf,.pdf,text/plain,.txt">
        <label class="field" for="about-text">Or paste the text</label>
        <textarea id="about-text" maxlength="40000" placeholder="Paste your résumé. The file itself is not kept.">${esc(mode === 'resume' ? form.text : '')}</textarea>
        <p class="hint">We keep the words, not the file. If a PDF does not come through, paste the text.</p>
      </div>
      <div class="about-panel" ${mode === 'linkedin' ? '' : 'hidden'}>
        <label class="field" for="about-link">LinkedIn profile link</label>
        <input id="about-link" type="url" inputmode="url" maxlength="2000" placeholder="https://" value="${esc(form.link || '')}">
        <button type="button" class="text-btn" id="read-profile" ${flowBusy ? 'disabled' : ''}>${flowBusy ? 'Reading the page' : 'Read this page'}</button>
        <label class="field" for="about-profile">Or paste the profile</label>
        <textarea id="about-profile" maxlength="40000" placeholder="LinkedIn often asks people to sign in. Pasting the text works either way.">${esc(mode === 'linkedin' ? form.text : '')}</textarea>
      </div>
      <div class="about-panel" ${mode === 'answers' ? '' : 'hidden'}>
        <label class="field" for="about-now">What do you do now, or what did you do most recently?</label>
        <textarea class="compact" id="about-now" maxlength="4000">${esc(form.now || '')}</textarea>
        <label class="field" for="about-proud">One real example you are proud of</label>
        <textarea class="compact" id="about-proud" maxlength="4000" placeholder="What happened, and what did you do?">${esc(form.proud || '')}</textarea>
        <label class="field" for="about-hard">A hard thing you handled</label>
        <textarea class="compact" id="about-hard" maxlength="4000">${esc(form.hard || '')}</textarea>
        <label class="field" for="about-why">Why this kind of work?</label>
        <textarea class="compact" id="about-why" maxlength="4000">${esc(form.why || '')}</textarea>
      </div>
      <fieldset><legend>Interview stage, optional</legend><div class="choices">${groups.stage.map((v) => `<label class="choice"><input type="radio" name="aboutStage" value="${esc(v)}" ${v === stage ? 'checked' : ''}><span>${esc(v)}</span></label>`).join('')}</div></fieldset>
      <label class="field" for="about-date">Interview date, optional</label>
      <input id="about-date" type="date" value="${esc(form.date || '')}">
      <p class="hint">${ready ? 'Write my course sends this background and the ad to the tower you saved in Settings. Practice answers are not sent.' : 'This plan uses the general lessons, built from the job ad. What you write here is not sent anywhere.'}</p>
      <div class="spacer"></div>
      <button class="primary" type="submit" ${flowBusy ? 'disabled' : ''}>${ready ? 'Write my course' : 'Build general lessons'}</button>
      <button type="button" class="text-btn" id="about-skip" ${flowBusy ? 'disabled' : ''}>Skip, use general lessons</button>
    </form>`;
  },
  writing() {
    if (flowWriteFailed) {
      return `<div class="screen" data-screen="writing">
      <div class="topbar">${iconBtn('cancel-writing', 'Back to About you', I.back)}<span class="label">Personal course</span></div>
      <h1 class="flow-focus" tabindex="-1">The course wasn't written</h1>
      <p class="italic lg">Nothing is lost.</p>
      <p class="sub" role="status">${esc(flowWriteFailed.message)}</p>
      <p class="hint">Your ad and what you shared are still here. Try again, or use the general lessons built from this ad.</p>
      <div class="spacer"></div>
      <button type="button" class="primary" data-action="writing-retry">Try again</button>
      <button type="button" class="text-btn" data-action="writing-general">Use general lessons</button>
    </div>`;
    }
    return `<div class="screen" data-screen="writing">
      <div class="topbar"><span class="label">Personal course</span></div>
      <h1 class="flow-focus" tabindex="-1">Writing your lessons</h1>
      <p class="italic lg">This usually takes under a minute.</p>
      <p class="sub">Your ad and what you shared are being used to write the lessons. Practice answers are not sent.</p>
      <div class="spacer"></div>
      <button type="button" class="text-btn" data-action="cancel-writing">Cancel</button>
    </div>`;
  }
});

function flowProviderReady() {
  try { return !!(globalThis.NextStepProvider && NextStepProvider.providerReady(corePrefs())); }
  catch { return false; }
}
function flowPrepareAbout() {
  draft = draft || {};
  if (draft.aboutForm) return;
  let saved = null;
  try { saved = globalThis.NextStepCourse ? NextStepCourse.normalizeAbout(corePrefs().aboutYou) : null; }
  catch { saved = null; }
  draft.aboutForm = {
    mode: saved && saved.source ? saved.source : 'resume',
    text: saved ? saved.text : '',
    link: '',
    now: '',
    proud: '',
    hard: '',
    why: '',
    stage: (draft.intake && draft.intake.stage) || 'Not sure yet',
    date: draft.interviewAt || ''
  };
}
function flowReadAbout() {
  draft = draft || {};
  flowPrepareAbout();
  const form = draft.aboutForm;
  const text = form.mode === 'linkedin' ? $('#about-profile') : form.mode === 'resume' ? $('#about-text') : null;
  if (text) form.text = text.value;
  const mode = document.querySelector('input[name="aboutMode"]:checked');
  if (mode) form.mode = mode.value;
  if ($('#about-link')) form.link = $('#about-link').value;
  ['now', 'proud', 'hard', 'why'].forEach((key) => {
    const el = $('#about-' + key);
    if (el) form[key] = el.value;
  });
  const stage = document.querySelector('input[name="aboutStage"]:checked');
  if (stage) form.stage = stage.value;
  if ($('#about-date')) form.date = $('#about-date').value;
}
function flowAboutText(form) {
  if (form.mode === 'answers') {
    return [
      ['now', 'What I do now'],
      ['proud', 'An example I am proud of'],
      ['hard', 'A hard thing I handled'],
      ['why', 'Why this kind of work']
    ].map(([key, label]) => {
      const value = String(form[key] || '').trim();
      return value ? label + ': ' + value : '';
    }).filter(Boolean).join('\n\n');
  }
  return String(form.text || '').trim();
}
function flowSaveAbout(about) {
  try {
    const prefs = corePrefs();
    prefs.aboutYou = about;
    coreWritePrefs(prefs);
  } catch { /* this visit can still build */ }
}
function flowUseAbout() {
  if (flowBusy) return;
  flowReadAbout();
  const form = draft.aboutForm;
  draft.intake = { ...(draft.intake || {}), stage: form.stage || 'Not sure yet' };
  draft.interviewAt = form.date || '';
  let text = flowAboutText(form);
  if (text.trim().length < 40) text = String(form.text || '').trim();
  if (/^https?:\/\/\S+$/i.test(text)) {
    notify('Paste the profile text. A link on its own is not enough, because the page often asks people to sign in.');
    return;
  }
  const about = NextStepCourse.normalizeAbout({ source: form.mode, text });
  if (!about) { notify('Add a bit more about you, or skip for the general lessons.'); return; }
  draft.aboutYou = about;
  flowSaveAbout(about);
  flowAboutNote = '';
  flowBuild(draft.sampleId || '');
}
function flowSkipAbout() {
  if (flowBusy) return;
  flowReadAbout();
  const form = draft.aboutForm;
  draft.intake = { ...(draft.intake || {}), stage: form.stage || 'Not sure yet' };
  draft.interviewAt = form.date || '';
  draft.aboutYou = null;
  flowAboutNote = '';
  flowBuild(draft.sampleId || '');
}
async function flowTakeFile(file) {
  if (!file || flowBusy) return;
  flowReadAbout();
  if (file.size > 8000000) {
    flowAboutNote = 'That file is over 8 MB. Paste the text instead.';
    show('about');
    return;
  }
  const name = String(file.name || '').toLowerCase();
  const kind = String(file.type || '');
  let text = '';
  try {
    const buf = await file.arrayBuffer();
    if (name.endsWith('.txt') || kind.startsWith('text/')) text = new TextDecoder('utf-8', { fatal: false }).decode(buf);
    else if (name.endsWith('.pdf') || kind === 'application/pdf') text = await NextStepPdf.extractPdfText(buf);
    else {
      flowAboutNote = 'Use a PDF or a plain text file, or paste the text.';
      show('about');
      return;
    }
  } catch {
    text = '';
  }
  if (!text || text.trim().length < 40) {
    flowAboutNote = 'We could not read enough text from that file. Paste the résumé instead. The file itself stays on this phone.';
    show('about');
    return;
  }
  draft.aboutForm.mode = 'resume';
  draft.aboutForm.text = text.trim().slice(0, 40000);
  flowAboutNote = 'Read ' + draft.aboutForm.text.length + ' characters. Check them, then build. The file is not kept.';
  show('about');
}
async function flowReadProfile() {
  if (flowBusy) return;
  flowReadAbout();
  const raw = String(draft.aboutForm.link || '').trim();
  if (flowUrlProblem(raw)) { notify('That does not look like a link.'); return; }
  const token = ++flowToken;
  flowBusy = true;
  flowAboutNote = 'Reading that page.';
  show('about');
  const result = await flowExtract(raw);
  if (token !== flowToken) return;
  flowBusy = false;
  if (!result.ok) {
    flowAboutNote = 'We could not read that page. LinkedIn often asks people to sign in. Paste the profile text below. It stays on this phone.';
    show('about');
    return;
  }
  draft.aboutForm.mode = 'linkedin';
  draft.aboutForm.text = result.text;
  flowAboutNote = 'Check the text, then build. If this is not your profile, paste the right one.';
  show('about');
}

/* Saves a new preparation from `draft` and plays the decode moment.
   A personal course is attempted only when About you has text and My subscription is ready. */
async function flowBuild(sampleId, opts) {
  const general = !!(opts && opts.general);
  const token = ++flowToken;
  flowWriteFailed = null;
  const source = draft || {};
  const input = {
    role: source.role || '',
    company: source.company || '',
    job: source.job || '',
    url: source.url || '',
    intake: { ...(source.intake || {}) },
    interviewAt: source.interviewAt || '',
    aboutYou: source.aboutYou || null
  };
  const mark = sampleId || source.sampleId || '';
  const replaceId = source.replaceId || '';
  let generated = null;
  let attempted = false;
  if (!general && input.aboutYou && flowProviderReady()) {
    attempted = true;
    flowBusy = true;
    const ctrl = new AbortController();
    flowAbort = ctrl;
    show('writing');
    let hints = { themes: [], musts: [] };
    try { hints = NextStepCourse.courseHints(flowAnalyzeText(input.job) || {}); } catch { /* the ad text is still sent */ }
    const res = await NextStepProvider.requestCourse(corePrefs(), {
      company: input.company,
      role: input.role,
      stage: input.intake.stage,
      interviewAt: input.interviewAt,
      job: input.job,
      aboutYou: input.aboutYou,
      hints
    }, { signal: ctrl.signal });
    if (token !== flowToken) return;
    flowBusy = false;
    if (flowAbort === ctrl) flowAbort = null;
    if (res.ok) generated = res.course;
    else if (res.reason === 'cancelled') return;
    else if (res.attempted) {
      // Stay here: show why, and let the person choose. The general lessons are never automatic.
      flowWriteFailed = { message: res.message };
      show('writing');
      return;
    }
  }
  if (token !== flowToken) return;
  let prep;
  try { prep = NextStepCourse.finishCourse(input, generated); }
  catch (err) {
    flowBusy = false;
    notify(err.message);
    show('about');
    return;
  }
  if (attempted && prep.generatedBy !== 'subscription') {
    // The course came back but did not pass the checks: the same choice as any other failure.
    flowWriteFailed = { message: 'The personal course did not pass the checks.' };
    show('writing');
    return;
  }
  if (general && flowProviderReady() && input.aboutYou) {
    prep.generatedBy = 'template';
    prep.generateNote = 'These are the general lessons, built from this ad.';
  }
  /* Rewriting an existing preparation swaps it only when the personal course came back, and keeps the
     person's lessons, notes, quiz, mock and live interviews (NextStepCourse.replaceWith). On any other
     result the old preparation stays exactly as it was and the reason is shown. */
  if (replaceId && records.some((item) => item && item.id === replaceId)) {
    const swap = NextStepCourse.replaceWith(records, replaceId, prep);
    if (!swap.swapped) {
      active = swap.active;
      draft = null;
      flowAboutNote = '';
      flowBusy = false;
      show('today');
      notify('Your preparation is unchanged.');
      return;
    }
    records.splice(0, records.length, ...swap.records);
    active = swap.active;
  } else {
    active = prep;
    records.unshift(active);
  }
  if (mark) active.sample = mark;
  persist();
  draft = null;
  flowAboutNote = '';
  lessonIndex = 0;
  renaming = false;
  flowBusy = false;
  show('decode');
  if (prep.generateNote) notify(prep.generateNote);
}
function createPrep(skip) {
  try {
    readRole();
    readJob();
    if ((draft.job || '').trim().length < 40) { notify('Paste at least 40 characters from the actual ad.'); show('jobad'); return; }
    draft.intake = skip ? {} : Object.fromEntries(new FormData($('#intake')));
    const job = String(draft.job || '').trim();
    const sample = FLOW_SAMPLES.find((x) => x.job.trim() === job);
    flowBuild(sample ? sample.id : '');
  } catch (err) { notify(err.message); }
}
function flowToReveal() {
  clearTimeout(flowDecodeTimer);
  if (view !== 'decode' || !active) return;
  show('reveal');
}
/* Count the hero numbers up from zero. Text only, skipped under reduced motion. */
function flowCountUp() {
  if (reduceMotion()) return;
  const els = [...document.querySelectorAll('#app [data-count]')];
  if (!els.length) return;
  const start = performance.now() + 380;
  const dur = 900;
  els.forEach((el) => { el.textContent = '0'; });
  const tick = (now) => {
    if (!els[0].isConnected) return;
    const k = Math.min(1, Math.max(0, (now - start) / dur));
    const ease = 1 - Math.pow(1 - k, 3);
    els.forEach((el) => { el.textContent = flowNum(Math.round((Number(el.dataset.count) || 0) * ease)); });
    if (k < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}

binders.link = () => {
  const form = $('#link-form');
  if (form) form.addEventListener('submit', (event) => { flowFromLink(event); });
  const paste = $('#build-paste');
  if (paste) paste.addEventListener('click', flowFromPaste);
  flowShownAt = performance.now();
  if (flowFallback && $('#job')) {
    try { $('#job').focus({ preventScroll: true }); } catch { /* focus is a nicety */ }
  } else flowFocusTitle();
};
binders.role = () => {
  const form = $('#role-form');
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); readRole(); show('jobad'); });
};
binders.jobad = () => {
  const job = $('#job-form');
  if (!job) return;
  const box = $('#job');
  const pick = $('#use-sample');
  flowSaidWords = wordCount(box.value);
  flowPasted = false;
  flowUpdateReadout();
  box.addEventListener('paste', () => { flowPasted = true; });
  box.addEventListener('input', (e) => {
    if (e && /^insertFrom(Paste|Drop)/.test(e.inputType || '')) flowPasted = true;
    if (pick) pick.hidden = !!box.value.trim();
    clearTimeout(flowReadTimer);
    flowReadTimer = setTimeout(flowUpdateReadout, 250);
  });
  job.addEventListener('submit', (e) => {
    e.preventDefault();
    readJob();
    if ((draft.job || '').trim().length < 40) { notify('Paste at least 40 characters from the actual ad.'); return; }
    notify('');
    show('setup');
  });
  $('#how-ad').addEventListener('click', () => {
    readJob();
    $('#fetch-status').textContent = 'Open the job ad, copy the responsibilities and requirements, then paste them here. This free edition cannot import websites. The optional URL is only your reference.';
    $('#job').focus();
  });
};
binders.about = () => {
  const form = $('#about-form');
  if (!form) return;
  if (draft && draft.autoWrite) {
    draft.autoWrite = false;
    const typed = flowAboutText(draft.aboutForm);
    const text = typed.trim().length >= 40 ? typed : String(draft.aboutForm.text || '');
    const saved = globalThis.NextStepCourse && NextStepCourse.normalizeAbout({ source: draft.aboutForm.mode, text });
    if (saved && flowProviderReady()) {
      flowUseAbout();
      return;
    }
  }
  form.addEventListener('submit', (e) => { e.preventDefault(); flowUseAbout(); });
  const skip = $('#about-skip');
  if (skip) skip.addEventListener('click', flowSkipAbout);
  const file = $('#about-file');
  if (file) file.addEventListener('change', () => { const picked = file.files && file.files[0]; if (picked) flowTakeFile(picked); });
  const read = $('#read-profile');
  if (read) read.addEventListener('click', () => { flowReadProfile(); });
  form.querySelectorAll('input[name="aboutMode"]').forEach((el) => {
    el.addEventListener('change', () => { flowReadAbout(); show('about'); });
  });
  flowShownAt = performance.now();
  flowFocusTitle();
};
binders.writing = () => { flowShownAt = performance.now(); flowFocusTitle(); };
binders.setup = () => {
  const intake = $('#intake');
  if (!intake) return;
  intake.addEventListener('submit', (e) => { e.preventDefault(); createPrep(false); });
  $('#skip').addEventListener('click', () => createPrep(true));
};
binders.samples = () => { flowShownAt = performance.now(); flowFocusTitle(); };
binders.decode = () => {
  const el = document.querySelector('#app .screen.decode');
  clearTimeout(flowDecodeTimer);
  if (!el) return;
  if (!el.classList.contains('still')) {
    const items = el.querySelectorAll('.decode-step');
    items.forEach((li, i) => li.style.setProperty('--flow-d', (0.4 + i * 0.5).toFixed(2) + 's'));
    flowDecodeTimer = setTimeout(flowToReveal, Math.round((0.4 + Math.max(0, items.length - 1) * 0.5 + 0.95) * 1000));
    el.addEventListener('click', (e) => { if (!e.target.closest('[data-action]') && flowSettled()) flowToReveal(); });
  }
  flowShownAt = performance.now();
  flowFocusTitle();
};
binders.reveal = () => { flowShownAt = performance.now(); flowFocusTitle(); flowCountUp(); };
binders.insights = () => flowFocusTitle();

Object.assign(actions, {
  start: () => { renaming = false; flowCancelExtract(); flowFallback = null; draft = draft || {}; show('link'); },
  'back-welcome': () => { flowCancelExtract(); readLink(); readRole(); show('welcome'); },
  'back-role': () => { readJob(); show('role'); },
  'back-job': () => { readIntake(); show('jobad'); },
  'back-link': () => {
    flowToken += 1;
    flowBusy = false;
    if (flowAbort) {
      try { flowAbort.abort(); } catch { /* already finished */ }
      flowAbort = null;
    }
    flowReadAbout();
    flowAboutNote = '';
    show('link');
  },
  'writing-retry': () => (draft ? flowBuild(draft.sampleId || '') : undefined),
  'writing-general': () => (draft ? flowBuild(draft.sampleId || '', { general: true }) : undefined),
  'cancel-writing': () => {
    flowToken += 1;
    flowBusy = false;
    flowWriteFailed = null;
    if (flowAbort) {
      try { flowAbort.abort(); } catch { /* already finished */ }
      flowAbort = null;
    }
    show('about');
  },
  'try-sample': () => {
    if (view === 'link') { readLink(); flowSamplesFrom = 'link'; }
    else flowSamplesFrom = 'welcome';
    show('samples');
  },
  'sample-from-jobad': () => { readJob(); flowSamplesFrom = 'jobad'; show('samples'); },
  'samples-back': () => show(flowSamplesFrom === 'jobad' ? 'jobad' : flowSamplesFrom === 'link' ? 'link' : 'welcome'),
  'use-sample': (el) => {
    const s = FLOW_SAMPLES.find((x) => x.id === el.dataset.sample);
    if (!s || !flowSettled()) return;
    if (flowSamplesFrom === 'jobad') {
      draft = draft || {};
      draft.job = s.job;
      if (!flowStr(draft.role)) draft.role = s.role;
      if (!flowStr(draft.company)) draft.company = s.company;
      show('jobad');
      notify('Sample ad added. The company in it is made up.');
      return;
    }
    try {
      draft = { role: s.role, company: s.company, job: s.job, url: '', intake: {}, sampleId: s.id, aboutYou: null, aboutForm: null };
      flowOfferAbout();
    } catch (err) { notify(err.message); }
  },
  'decode-skip': () => { if (flowSettled()) flowToReveal(); },
  'reveal-next': () => {
    if (!flowSettled()) return;
    clearTimeout(flowDecodeTimer);
    if (needPrep()) show('reveal');
  },
  'go-today': () => {
    if (view === 'reveal' && !flowSettled()) return;
    clearTimeout(flowDecodeTimer);
    if (needPrep()) show('today');
  },
  'open-insights': (el) => {
    if (!needPrep()) return;
    show('insights');
    if (el && el.dataset && el.dataset.to === 'ad') {
      /* Scroll only the page's own scroller: scrollIntoView can also shift the overflow-hidden
         screen around it and hide the back button. */
      const sc = document.querySelector('#app .scroll');
      const ad = document.getElementById('flow-ad');
      if (sc && ad) {
        const top = ad.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop - 8;
        sc.scrollTo({ top: Math.max(0, Math.round(top)), behavior: reduceMotion() ? 'auto' : 'smooth' });
      }
    }
  }
});
