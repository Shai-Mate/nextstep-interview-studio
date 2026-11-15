'use strict';
const $ = (s) => document.querySelector(s);
const KEY = 'nextstep.preparations.v1';
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const I = {
  lock: '<svg width="14" height="14" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 9V7a3.5 3.5 0 017 0v2M5 9h10v7H5z"></path></svg>',
  back: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12.5 4.5L7 10l5.5 5.5"></path></svg>',
  close: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5.5 5.5l9 9M14.5 5.5l-9 9"></path></svg>',
  chev: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7.5 4.5L13 10l-5.5 5.5"></path></svg>',
  arrow: '<svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 10h12M11 5l5 5-5 5"></path></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4.5 10.5l3.5 3.5 7.5-8"></path></svg>',
  warn: '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 4.5v7M10 15.5v.01"></path></svg>'
};
const TABS = [
  ['today', 'Today', 'M4 6.5h12v9.5H4zM4 9.5h12M7 4v3M13 4v3'],
  ['learn', 'Learn', 'M10 6.5C8.5 5.2 6.5 5 4 5v10c2.5 0 4.5.2 6 1.5C11.5 15.2 13.5 15 16 15V5c-2.5 0-4.5.2-6 1.5zM10 6.5v10'],
  ['practise', 'Practise', 'M4 5h12v8.5H9.5L6 16.5v-3H4z'],
  ['progress', 'Progress', 'M3.5 16h4v-4h4.5V8H16.5']
];
const groups = {
  experience: ['Early career', 'Experienced', 'Career change', 'Prefer not to say'],
  stage: ['Screening', 'Technical', 'Panel', 'Final', 'Not sure yet'],
  focus: ['Balanced', 'Confidence', 'Role skills', 'Concise answers'],
  time: ['15 minutes', '30 minutes', '60 minutes']
};
const groupLabels = { experience: 'Experience', stage: 'Interview stage', focus: 'Focus', time: 'Time today' };
const defaults = { experience: 'Prefer not to say', stage: 'Not sure yet', focus: 'Balanced', time: '30 minutes' };
const STAR = {
  Situation: 'Where and when. Set the scene with a real example.',
  Task: 'What was needed from you.',
  Action: 'What you personally did. Say I, and keep it specific.',
  Result: 'What changed, or what you learned.'
};
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

let records = [];
let active = null;
let draft = null;
let storageOK = true;
let view = 'welcome';
let lessonIndex = 0;
let renaming = false;
let star = 'Action';
let privacyFrom = 'welcome';
let lastFeedback = null;
try {
  records = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (!Array.isArray(records) || records.some((p) => p.schema !== 1 || !p.id || !Array.isArray(p.course) || !p.mock)) throw Error('Invalid saved format');
} catch {
  storageOK = false;
  records = [];
  notify('Saved data could not be read. It has not been overwritten. Export or recover your browser storage before continuing.');
}

let toastTimer = 0;
function notify(s) {
  const el = $('#status');
  if (!el) return;
  el.textContent = s;
  clearTimeout(toastTimer);
  if (!s) return;
  const sticky = /could not|unavailable|will not|not been overwritten/i.test(s);
  if (!sticky) toastTimer = setTimeout(() => { if (el.textContent === s) el.textContent = ''; }, 4200);
}
function persist() {
  if (!storageOK) { notify('Storage unavailable. Export a backup before leaving.'); return false; }
  try { localStorage.setItem(KEY, JSON.stringify(records)); return true; }
  catch { notify('Could not save: browser storage is full or unavailable. Export a backup before leaving.'); return false; }
}
function save() { active.updated = new Date().toISOString(); return persist(); }
function wordCount(text) { const t = String(text || '').trim(); return t ? t.split(/\s+/).length : 0; }
function feedback(text) {
  const words = text.trim().split(/\s+/).length;
  const length = words < 50 ? 'Try adding context, your specific action and an outcome.' : words > 250 ? 'Try a shorter first pass, then offer detail if asked.' : 'A useful length for a first pass.';
  const contribution = /\bI\b/i.test(text) ? 'Make sure your personal contribution is specific.' : 'Clarify what you personally did.';
  const result = /\d|result|outcome|improv|learn|reduc|increas/i.test(text) ? 'Check that your result is truthful and relevant.' : 'Add an observable result or lesson if you have one.';
  return `Structure checklist: ${words} words. ${length} ${contribution} ${result}`;
}
function checks(text) {
  const words = wordCount(text);
  const lengthOk = words >= 50 && words <= 250;
  const resultOk = /\d|result|outcome|improv|learn|reduc|increas/i.test(text);
  return {
    words,
    length: { ok: lengthOk, title: 'Length', detail: words < 50 ? 'Try adding context, your specific action and an outcome.' : words > 250 ? 'Try a shorter first pass, then offer detail if asked.' : 'A useful length for a first pass.' },
    contribution: { ok: false, title: 'Your contribution', detail: /\bI\b/i.test(text) ? 'Make sure your personal contribution is specific.' : 'Clarify what you personally did.' },
    result: { ok: resultOk, title: 'Result', detail: resultOk ? 'Check that your result is truthful and relevant.' : 'Add an observable result or lesson if you have one.' }
  };
}
function stats(p) {
  const lessonsDone = p.course.filter((c) => c.done).length;
  const answersDone = p.questions.filter((_, i) => (p.notes['answer-' + i] || '').trim()).length;
  const quizDone = Object.keys(p.quiz.answers || {}).length;
  const mockDone = p.mock.answers.length;
  const mapDone = p.requirements.filter((_, i) => (p.notes['map-' + i] || '').trim()).length;
  const lessons = p.course.length;
  const answers = p.questions.length;
  const quiz = 3;
  const mock = p.questions.length;
  const map = p.requirements.length;
  const done = lessonsDone + answersDone + quizDone + mockDone + mapDone;
  const total = Math.max(1, lessons + answers + quiz + mock + map);
  return { lessonsDone, lessons, answersDone, answers, quizDone, quiz, mockDone, mock, mapDone, map, done, total, ratio: done / total };
}
function glow(p) { return (0.15 + 0.85 * stats(p).ratio).toFixed(2); }
function budgetOf(p) { return parseInt(p.intake.time, 10) || 30; }
function todayPicks(p) { return p.course.slice(0, Math.max(1, Math.floor(budgetOf(p) / 5))); }
function currentLessonIndex(p) {
  const picks = todayPicks(p);
  const inPick = picks.findIndex((c) => !c.done);
  if (inPick >= 0) return inPick;
  const any = p.course.findIndex((c) => !c.done);
  return any >= 0 ? any : 0;
}
function quoteFrom(text, fallback) {
  const m = String(text || '').match(/“([^”]+)”/);
  if (m) return m[1];
  const m2 = String(text || '').match(/"([^"]+)"/);
  return (m2 && m2[1]) || fallback || '';
}
function greeting(d) {
  const h = d.getHours();
  if (h < 12) return 'Good morning.';
  if (h < 17) return 'Good afternoon.';
  return 'Good evening.';
}
function longDate(d) {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  return days[d.getDay()] + ', ' + d.getDate() + ' ' + months[d.getMonth()];
}
function iconBtn(action, label, icon) { return `<button type="button" class="icon-btn" data-action="${action}" aria-label="${label}">${icon}</button>`; }
function segs(count, done, current) {
  let html = '<div class="segs" aria-hidden="true">';
  for (let i = 0; i < count; i++) html += `<span class="${i < done ? 'done' : i === current ? 'now' : ''}"></span>`;
  return html + '</div>';
}
function ring(pct) {
  const circ = 163.4;
  const dash = Math.max(0, Math.min(circ, (pct / 100) * circ)).toFixed(1);
  const cap = pct > 0 ? 'round' : 'butt';
  return `<svg class="ring" width="64" height="64" viewBox="0 0 60 60" aria-hidden="true"><circle cx="30" cy="30" r="26" fill="none" stroke="rgba(255,255,255,.1)" stroke-width="4"></circle><circle data-ring data-circ="${circ}" cx="30" cy="30" r="26" fill="none" stroke="#FFB486" stroke-width="4" stroke-linecap="${cap}" stroke-dasharray="${dash} ${circ}" transform="rotate(-90 30 30)"></circle><text x="30" y="35" text-anchor="middle" fill="#FBF1EA" font-size="14" font-weight="600">${pct}%</text></svg>`;
}
function bar(pct) {
  const width = Math.max(0, Math.min(100, pct));
  return `<svg class="track" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true"><rect width="100" height="4" rx="2" fill="rgba(255,255,255,.12)"></rect><rect class="bar" data-bar width="${width}" height="4" rx="2" fill="#FBF1EA"></rect></svg>`;
}
function tabbar(current) {
  return `<nav class="tabbar" aria-label="Sections">${TABS.map(([id, label, d]) => {
    const on = current === id;
    return `<button type="button" data-action="tab-${id}" ${on ? 'aria-current="page"' : ''}><svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${d}"></path></svg><span>${label}</span></button>`;
  }).join('')}</nav>`;
}
function shell(current, inner) {
  return `<div class="screen with-tabs" data-screen="${current}"><div class="scroll">${inner}</div>${tabbar(current)}</div>`;
}
function checkRow(item) {
  const cls = item.ok ? 'ok' : 'warn';
  return `<div class="check ${cls}">${item.ok ? I.check : I.warn}<div><strong>${esc(item.title)}</strong><span>${esc(item.detail)}</span></div></div>`;
}
function mockLine(p) {
  if (p.mock.finished) return 'Session complete';
  if (p.mock.index === 0 && !p.mock.answers.length && !p.mock.draft) return p.questions.length + ' questions ready';
  return 'Resume at question ' + (p.mock.index + 1) + ' of ' + p.questions.length;
}

function show(next) {
  view = next;
  render();
}
function render() {
  const screen = screens[view] || screens.welcome;
  $('#app').innerHTML = screen();
  bindScreen();
  animateBits();
  const sc = document.querySelector('.scroll');
  if (sc) sc.scrollTop = 0;
  window.scrollTo(0, 0);
}
function animateBits() {
  if (reduceMotion()) return;
  document.querySelectorAll('[data-bar]').forEach((b, i) => {
    b.animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: 1000, delay: 400 + i * 80, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  });
  document.querySelectorAll('[data-ring]').forEach((r) => {
    const dash = r.getAttribute('stroke-dasharray');
    r.animate([{ strokeDasharray: '0 ' + r.dataset.circ }, { strokeDasharray: dash }], { duration: 1300, delay: 450, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' });
  });
}
function bindNotes() {
  document.querySelectorAll('[data-note]').forEach((el) => {
    el.addEventListener('input', () => { active.notes[el.dataset.note] = el.value; save(); });
  });
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

const screens = {
  welcome() {
    if (!records.length) {
      return `<div class="screen welcome" data-screen="welcome">
        <div class="brandbar"><span class="logo">NextStep</span><button type="button" class="pill" data-action="privacy">${I.lock}<span>On this device</span></button></div>
        <div class="orb-stage"><div class="orb-anchor hero" data-orb data-env="1" data-s="1" data-up="166,102" data-down="101,280" data-energy="1"></div></div>
        <h1>Show up ready.</h1>
        <p class="italic">Sound like yourself.</p>
        <p class="lede">Turn a job ad into a focused study plan. Find your evidence. Practise the conversation.</p>
        <div class="steps">
          <div class="step"><i>1</i><b>Paste the job ad</b><span>Any role</span></div>
          <div class="step"><i>2</i><b>Four quick choices</b><span>Or skip</span></div>
          <div class="step"><i>3</i><b>Practise daily</b><span>15 to 60 min</span></div>
        </div>
        <div class="install-row"><span>Add to your Home Screen first, so your work stays in one place.</span><button type="button" class="link" data-action="how">How</button></div>
        <button type="button" class="primary" data-action="start">Start your first preparation</button>
        <p class="fine">Free. No account. No trackers or AI calls.</p>
      </div>`;
    }
    const s = stats;
    return `<div class="screen welcome" data-screen="welcome">
      <div class="brandbar"><span class="logo">NextStep</span><button type="button" class="pill" data-action="privacy">${I.lock}<span>On this device</span></button></div>
      <div class="ask"><p class="italic lg">Pick up where you left off.</p><div class="orb-slot md"><div class="orb-anchor md" data-orb data-env=".6" data-s=".75" data-up="80,40" data-down="40,90" data-energy="${glow(records[0])}"></div></div></div>
      <p class="sub">Your preparations stay on this device.</p>
      <div class="prep-list">${records.map((p) => {
        const st = s(p);
        return `<article class="glass prep-card"><p class="kicker">${esc(p.company)}</p><h2>${esc(p.role)}</h2><p class="muted">${esc(p.intake.stage)} · ${esc(p.intake.time)}</p>${bar(Math.round(st.ratio * 100))}<p class="muted">${st.lessonsDone}/${st.lessons} lessons · mock ${p.mock.finished ? 'complete' : p.mock.index + '/' + p.questions.length}</p><button type="button" class="primary" data-action="resume" data-id="${esc(p.id)}">Resume preparation</button></article>`;
      }).join('')}</div>
      <div class="spacer"></div>
      <button type="button" class="primary gap-top" data-action="start">New preparation</button>
      <button type="button" class="text-btn" data-action="how">How to install</button>
      <p class="fine">Free. No account. No trackers or AI calls.</p>
    </div>`;
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
    return `<form class="screen" id="job-form" data-screen="jobad">
      <div class="topbar">${iconBtn('back-role', 'Back', I.back)}<span class="label">Step 2 of 3</span></div>
      <h1>Paste the job ad</h1>
      <p class="italic lg">Your plan starts with their words.</p>
      <label class="field" for="job">Job-ad text</label>
      <textarea class="tall" id="job" name="job" maxlength="60000" placeholder="Paste the full job ad here">${esc(draft.job || '')}</textarea>
      <label class="field" for="url">Job-ad URL, optional</label>
      <input id="url" name="url" type="url" maxlength="2000" value="${esc(draft.url || '')}" placeholder="Saved as a reference only" inputmode="url">
      <div class="meta"><span id="fetch-status">Stays on this device.</span><button type="button" class="link" id="how-ad">How to add a job ad</button></div>
      <button class="primary" type="submit">Build my plan</button>
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
  today() {
    const p = active;
    const st = stats(p);
    const pct = Math.round(st.ratio * 100);
    const now = new Date();
    const idx = currentLessonIndex(p);
    const lesson = p.course[idx];
    const picks = todayPicks(p);
    const left = picks.filter((c) => !c.done).reduce((sum, c) => sum + (c.minutes || 5), 0);
    const allDone = p.course.every((c) => c.done);
    return shell('today', `
      <p class="date">${esc(longDate(now))}</p>
      <h1 class="italic greet">${esc(greeting(now))}</h1>
      <p class="role-name">${esc(p.role)}</p>
      <p class="muted">${esc(p.company)} · ${esc(p.intake.stage)}</p>
      <div class="glass pad">
        <div class="session-top">
          <div class="copy"><div class="min-left">${allDone ? 'All lessons complete' : left + ' min left'}</div><div class="session-kicker">Today's ${budgetOf(p)}-minute session</div></div>
          <div class="orb-slot sm"><div class="orb-anchor sm" data-orb data-env=".4" data-s=".8" data-up="120,50" data-down="40,110" data-energy="${glow(p)}"></div></div>
        </div>
        <h2 class="session-title">${esc(lesson.title)}</h2>
        <p class="upnow">${allDone ? 'Review any lesson' : 'Up now · Lesson ' + (idx + 1) + ' of ' + p.course.length}</p>
        ${segs(p.course.length, p.course.filter((c) => c.done).length, allDone ? -1 : idx)}
        <button type="button" class="primary" data-action="continue"><span>${allDone ? 'Review lessons' : 'Continue'}</span>${I.arrow}</button>
      </div>
      <div class="glass flat" aria-label="${pct} percent prepared">
        <div class="stat-row">${ring(pct)}<div><strong>Preparation so far</strong><p class="muted">${st.done} of ${st.total} steps done. Keep going, one small step at a time.</p></div></div>
        <div class="stat-grid">
          <div><b>${st.lessonsDone}/${st.lessons}</b><span>Lessons</span></div>
          <div><b>${st.answersDone}/${st.answers}</b><span>Answers</span></div>
          <div><b>${st.quizDone}/${st.quiz}</b><span>Quiz</span></div>
          <div><b>${st.mockDone}/${st.mock}</b><span>Mock</span></div>
        </div>
      </div>
      <button type="button" class="glass button" data-action="open-mock"><span class="copy"><strong>Mock interview</strong><span>${esc(mockLine(p))}</span></span>${I.chev}</button>
      ${renaming ? `<form class="rename" id="rename-form"><input id="rename-input" type="text" maxlength="120" value="${esc(p.role)}" aria-label="Job title"><button class="primary" type="submit">Save</button></form>` : `<div class="pager"><button type="button" class="quiet" id="rename">Rename</button><button type="button" class="quiet" id="export-one">Export backup</button><button type="button" class="quiet" data-action="all-preps">All preparations</button></div>`}
      <details class="fold"><summary>Review original job ad</summary><pre>${esc(p.job)}</pre>${p.url ? `<p class="muted">Reference URL: ${esc(p.url)}</p>` : ''}</details>
    `);
  },
  practise() {
    const p = active;
    const st = stats(p);
    return shell('practise', `
      <h1>Practise</h1>
      <p class="italic lg">Say it out loud first.</p>
      <p class="sub">Practise, pause, pick up again. Drafts save as you go.</p>
      <button type="button" class="row" data-action="open-mock"><span class="copy"><strong>Mock interview</strong><em>${esc(mockLine(p))}</em></span>${I.chev.replace('stroke="currentColor"', 'stroke="#FFC48A"')}</button>
      <button type="button" class="row" data-action="open-answers"><span class="copy"><strong>Answer bank</strong><em>${st.answersDone} of ${st.answers} answers drafted</em></span>${I.chev}</button>
      <button type="button" class="row" data-action="open-quiz"><span class="copy"><strong>Quiz</strong><em>${st.quizDone} of ${st.quiz} done</em></span>${I.chev}</button>
      <button type="button" class="row" data-action="open-map"><span class="copy"><strong>Role map</strong><em>${st.mapDone} of ${st.map} ad excerpts mapped</em></span>${I.chev}</button>
    `);
  },
  progress() {
    const p = active;
    const st = stats(p);
    const pct = Math.round(st.ratio * 100);
    const rows = [
      ['Lessons', st.lessonsDone, st.lessons],
      ['Answers', st.answersDone, st.answers],
      ['Quiz', st.quizDone, st.quiz],
      ['Mock interview', st.mockDone, st.mock],
      ['Role map', st.mapDone, st.map]
    ];
    return shell('progress', `
      <h1>Progress</h1>
      <p class="italic lg">Further than you think.</p>
      <div class="progress-hero">
        <div class="copy"><div class="pct">${pct}%</div><p class="muted">${st.done} of ${st.total} steps done</p></div>
        <div class="orb-slot lg"><div class="orb-anchor lg" data-orb data-env=".8" data-s=".7" data-up="130,55" data-down="55,130" data-energy="${glow(p)}"></div></div>
      </div>
      <div class="bars">${rows.map(([name, done, total]) => `<div><div class="bar-row"><span>${name}</span><span>${done} of ${total}</span></div>${bar(total ? (done / total) * 100 : 0)}</div>`).join('')}</div>
      <div class="spacer"></div>
      <button type="button" class="row" data-action="privacy"><span class="lock">${I.lock}</span><span class="copy"><strong>Privacy and your data</strong></span>${I.chev}</button>
    `);
  },
  lesson() {
    const p = active;
    const i = Math.max(0, Math.min(lessonIndex, p.course.length - 1));
    lessonIndex = i;
    const c = p.course[i];
    const quote = quoteFrom(c.body, p.requirements[0] || '');
    return `<div class="screen" data-screen="lesson">
      <div class="topbar">${iconBtn('close-today', 'Close', I.close)}<span class="label">Lesson ${i + 1} of ${p.course.length}</span></div>
      <h1>${esc(c.title)}</h1>
      <p class="italic lg">Small steps. Real evidence.</p>
      ${quote ? `<div class="glass pad-sm quote"><div class="kicker">From your job ad</div><p>${esc(quote)}</p></div>` : ''}
      <p class="prose">${esc(c.body)}</p>
      <div class="stack">
        <div class="point"><i>1</i><div><strong>Read what they actually asked for</strong><span>Separate the ad's words from your assumptions.</span></div></div>
        <div class="point"><i>2</i><div><strong>Try it</strong><span>${esc(c.exercise)}</span></div></div>
        <div class="point"><i>3</i><div><strong>Keep a true note</strong><span>A gap is something to prepare for, not something to invent.</span></div></div>
      </div>
      <label class="field" for="lesson-note">Your working notes</label>
      <textarea id="lesson-note" rows="4" data-note="lesson-${i}">${esc(p.notes['lesson-' + i] || '')}</textarea>
      <div class="pager">
        <button type="button" class="quiet" id="prev" ${i === 0 ? 'disabled' : ''}>Previous</button>
        <button type="button" class="quiet" data-action="all-lessons">All lessons</button>
        <button type="button" class="quiet" id="next" ${i === p.course.length - 1 ? 'disabled' : ''}>Next</button>
      </div>
      <div class="spacer"></div>
      <button type="button" class="primary" data-action="lesson-practise">Practise this answer</button>
      <button type="button" class="text-btn" id="mark">${c.done ? 'Mark incomplete' : 'Mark lesson done'}</button>
    </div>`;
  },
  lessons() {
    const p = active;
    return `<div class="screen" data-screen="lessons">
      <div class="topbar">${iconBtn('back-lesson', 'Back', I.back)}<span class="label">Learn</span></div>
      <h1>All lessons</h1>
      <p class="italic lg">One small step at a time.</p>
      <div class="stack">${p.course.map((c, i) => `<button type="button" class="row" data-action="open-lesson" data-index="${i}"><span class="copy"><strong>${c.done ? 'Done · ' : ''}${esc(c.title)}</strong><em>About ${c.minutes} min</em></span>${I.chev}</button>`).join('')}</div>
    </div>`;
  },
  mock() {
    const p = active;
    const m = p.mock;
    if (m.finished) {
      return `<div class="screen" data-screen="mock">
        <div class="topbar tight">${iconBtn('close-today', 'Close', I.close)}<span class="center">Mock interview</span><span class="count">${m.answers.length} of ${p.questions.length}</span></div>
        <div class="feedback-orb"><div class="orb-slot lg"><div class="orb-anchor lg" data-orb data-env="1" data-s=".75" data-up="120,60" data-down="50,140" data-energy="${glow(p)}"></div></div></div>
        <h1>Session complete.</h1>
        <p class="italic saved-italic">You can pick it up again.</p>
        <p class="muted gap-top">${m.answers.length} answers saved. Review your evidence and refine one answer before the real conversation.</p>
        <div class="spacer"></div>
        <button type="button" class="primary" data-action="open-answers">Refine in Answer bank</button>
        <button type="button" class="text-btn" id="restart">Start another round</button>
        ${logHtml(m)}
      </div>`;
    }
    const q = p.questions[m.index];
    const excerpt = quoteFrom(q, p.requirements[Math.min(m.index, p.requirements.length - 1)] || '');
    const words = wordCount(m.draft);
    return `<div class="screen" data-screen="mock">
      <div class="topbar tight">${iconBtn('close-today', 'Close', I.close)}<span class="center">Mock interview</span><span class="count">${m.index + 1} of ${p.questions.length}</span></div>
      ${segs(p.questions.length, m.index, m.index)}
      <div class="ask"><p class="italic">The interviewer asks</p><div class="orb-slot md"><div class="orb-anchor md" data-orb data-env=".45" data-s=".7" data-up="100,45" data-down="45,100" data-energy="${glow(p)}" data-voice="1"></div></div></div>
      <p class="question" data-say="1">${esc(q)}</p>
      ${excerpt ? `<div class="glass pad-sm quote"><div class="kicker">From your job ad</div><p>${esc(excerpt)}</p></div>` : ''}
      <div class="chips" role="group" aria-label="Answer shape">${Object.keys(STAR).map((name) => `<button type="button" class="chip" data-star="${name}" aria-pressed="${name === star}">${name}</button>`).join('')}</div>
      <p class="hint" id="star-hint">${esc(STAR[star])}</p>
      <label class="field tight" for="mock-answer">Your answer</label>
      <textarea id="mock-answer" rows="5" placeholder="Use a real example. What did you do, what happened, and what did you learn?">${esc(m.draft)}</textarea>
      <div class="meta"><span id="word-count">${words} ${words === 1 ? 'word' : 'words'}</span><span class="saved" id="save-line">${I.check}<span>Draft saved. Resume anytime.</span></span></div>
      <button type="button" class="primary" id="submit-answer">Save answer and continue</button>
      ${logHtml(m)}
    </div>`;
  },
  feedback() {
    const p = active;
    const f = lastFeedback;
    if (!f) { view = 'mock'; return screens.mock(); }
    const left = Math.max(0, f.total - f.index);
    return `<div class="screen" data-screen="feedback">
      <div class="topbar tight">${iconBtn('close-today', 'Close', I.close)}<span class="center">Mock interview</span><span class="count">${f.index} of ${f.total}</span></div>
      ${segs(f.total, f.index, -1)}
      <div class="feedback-orb"><div class="orb-slot lg"><div class="orb-anchor lg" data-orb data-env="1" data-s=".75" data-up="125,60" data-down="50,150" data-energy="${glow(p)}"></div></div></div>
      <h1 class="saved-title">Answer saved.</h1>
      <p class="italic saved-italic">One step closer.</p>
      <p class="muted gap-top">${f.index} of ${f.total} done.${left ? ' ' + left + ' to go.' : ''}</p>
      <div class="glass flat">
        <div class="card-head"><strong>Structure check</strong><span class="muted">${f.words} words</span></div>
        <p class="muted">A writing checklist, not a hiring score.</p>
        ${checkRow(f.length)}${checkRow(f.contribution)}${checkRow(f.result)}
      </div>
      <div class="spacer"></div>
      <button type="button" class="primary gap-top" data-action="feedback-next"><span>${f.finished ? 'See your session' : 'Next question'}</span>${I.arrow}</button>
      <button type="button" class="text-btn" data-action="open-answers">Refine in Answer bank</button>
    </div>`;
  },
  answers() {
    const p = active;
    return `<div class="screen" data-screen="answers">
      <div class="topbar">${iconBtn('back-practise', 'Back', I.back)}<span class="label">Answer bank</span></div>
      <h1>Your answer bank</h1>
      <p class="italic lg">True examples only.</p>
      <p class="sub">Use something you actually did. A gap is something to prepare for, not something to fabricate. Notes save as you type.</p>
      ${p.questions.map((q, i) => `<details class="block" ${i === 0 ? 'open' : ''}><summary>${esc(q)}</summary><p class="muted">Situation, task, your action, result, what you learned.</p><label class="field" for="answer-${i}">Your evidence and answer</label><textarea id="answer-${i}" rows="6" data-note="answer-${i}" placeholder="Describe something you actually did.">${esc(p.notes['answer-' + i] || '')}</textarea></details>`).join('')}
    </div>`;
  },
  quiz() {
    const items = [
      { q: 'Which answer best demonstrates a job requirement?', options: ['A confident claim with no example', 'A true example with your action and a clear outcome', 'Someone else’s experience presented as yours'], correct: 1, why: 'Specific, truthful evidence is more useful than polished claims.' },
      { q: 'The job ad says: “{req}”. What should you prepare?', options: ['A relevant example and a question about success', 'An unrelated memorized speech', 'An invented company policy'], correct: 0, why: 'Connect your own evidence to the exact requirement and clarify what success means.' },
      { q: 'You have not done part of this role before. What is the strongest approach?', options: ['Pretend you have', 'Avoid the topic entirely', 'Be honest, connect transferable skills and explain how you would learn'], correct: 2, why: 'An honest gap plus a credible learning plan protects your integrity and shows judgment.' }
    ];
    const p = active;
    return `<div class="screen" data-screen="quiz">
      <div class="topbar">${iconBtn('back-practise', 'Back', I.back)}<span class="label">Quiz</span></div>
      <h1>Check your approach</h1>
      <p class="italic lg">Technique, not a score.</p>
      <p class="sub">This checks interview technique, not technical certification or hiring readiness.</p>
      ${items.map((q, i) => `<article class="quiz"><h2>${i + 1}. ${esc(q.q.replace('{req}', p.requirements[0] || ''))}</h2><div class="choices">${q.options.map((o, j) => `<button type="button" class="choice" data-action="quiz" data-q="${i}" data-choice="${j}" ${p.quiz.answers[i] !== undefined ? 'disabled' : ''}><span>${esc(o)}</span></button>`).join('')}</div>${p.quiz.answers[i] !== undefined ? `<p class="result ${p.quiz.answers[i] === q.correct ? 'ok' : ''}">${p.quiz.answers[i] === q.correct ? 'Correct. ' : 'Try a different approach next time. '}${esc(q.why)}</p>` : ''}</article>`).join('')}
      <button type="button" class="text-btn" id="retry">Retry quiz</button>
    </div>`;
  },
  rolemap() {
    const p = active;
    return `<div class="screen" data-screen="rolemap">
      <div class="topbar">${iconBtn('back-practise', 'Back', I.back)}<span class="label">Role map</span></div>
      <h1>Map the role to your evidence</h1>
      <p class="italic lg">From the ad, not assumptions.</p>
      <p class="sub">These are excerpts, not verified facts about the employer. Confirm the priorities with your interviewer.</p>
      ${p.requirements.map((r, i) => `<article class="glass pad-sm"><p class="kicker">Ad excerpt ${i + 1}</p><p class="prose">${esc(r)}</p><label class="field" for="map-${i}">Your transferable evidence or gaps</label><textarea id="map-${i}" data-note="map-${i}" rows="3">${esc(p.notes['map-' + i] || '')}</textarea><p class="hint">Ask: What would good performance on this look like in the first 90 days?</p></article>`).join('')}
    </div>`;
  },
  privacy() {
    return `<div class="screen" data-screen="privacy">
      <div class="topbar">${iconBtn('privacy-back', 'Back', I.back)}<span class="label">Privacy</span></div>
      <h1>Private by design</h1>
      <p class="italic lg">Your words stay yours.</p>
      <div class="stack">
        <div class="privacy-block"><strong>Stored on this device</strong><span>Job ads, notes and answers stay in this browser's local storage. People who can open this browser profile can read them.</span></div>
        <div class="privacy-block"><strong>No account. No trackers.</strong><span>Nothing to sign up for, and no analytics. Preparations do not sync between devices.</span></div>
        <div class="privacy-block"><strong>No AI calls</strong><span>Structure feedback runs on this device. It is a writing checklist, not an assessment.</span></div>
        <div class="privacy-block"><strong>Free</strong><span>No trial, no upgrade, no ads. Paste the job ad yourself. This edition does not import websites.</span></div>
      </div>
      <details class="fold"><summary>Also good to know</summary>
        <p class="prose">Clearing site data, private browsing, or changing browsers can lose your work. Export a backup and keep it private. An exported file contains personal answers. The shareable app package contains none.

The hosting provider receives normal requests for the app files, not your typed preparations. Imports append as separate copies and never overwrite existing preparations. Only import a backup you trust.</p>
      </details>
      <div class="spacer"></div>
      <button type="button" class="glass button" id="export-one"><span class="copy"><strong>Export backup</strong><span>${active ? 'This preparation' : 'Every preparation on this device'}</span></span></button>
      <button type="button" class="text-btn" id="all-export">Export all preparations</button>
      <label class="field" for="import">Restore a backup</label>
      <input class="file" id="import" type="file" accept="application/json,.json">
      <button type="button" class="text-btn danger" id="delete-all">Delete all data</button>
      <p class="version">Phone app v5 · storage schema v1 · rules-based preparation</p>
    </div>`;
  }
};

function logHtml(m) {
  if (!m.answers.length) return '';
  return `<h2 class="log-title">Session log</h2>${m.answers.map((a, i) => `<details class="block"><summary>${i + 1}. ${esc(a.question)}</summary><p class="prose">${esc(a.text)}</p><p class="feedback">${esc(a.feedback)}</p></details>`).join('')}`;
}

function needPrep() { if (!active) { show('welcome'); return false; } return true; }
function openLesson(i) { if (!needPrep()) return; lessonIndex = i; show('lesson'); }
function openMock() { if (!needPrep()) return; show('mock'); }
function createPrep(skip) {
  try {
    readRole();
    readJob();
    if ((draft.job || '').trim().length < 40) { notify('Paste at least 40 characters from the actual ad.'); show('jobad'); return; }
    draft.intake = skip ? {} : Object.fromEntries(new FormData($('#intake')));
    active = PrepEngine.create(draft);
    records.unshift(active);
    persist();
    draft = null;
    lessonIndex = 0;
    renaming = false;
    show('today');
  } catch (err) { notify(err.message); }
}
function exportBackup(all) {
  const payload = { schema: 1, preparations: !all && active ? [active] : records };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'nextstep-backup.json';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  notify('Backup exported. It includes your job ads, notes and answers. Keep it private.');
}
function bindImport() {
  const input = $('#import');
  if (!input) return;
  input.addEventListener('change', async (e) => {
    try {
      const f = e.target.files[0];
      if (!f) return;
      if (f.size > 2000000) throw Error('Backup exceeds 2 MB');
      const b = JSON.parse(await f.text());
      if (b.schema !== 1 || !Array.isArray(b.preparations) || b.preparations.length > 50) throw Error('Unsupported backup');
      const copies = b.preparations.map((p) => {
        const fresh = PrepEngine.create(p);
        if (!p.notes || typeof p.notes !== 'object') throw Error('Invalid notes');
        for (const [k, v] of Object.entries(p.notes)) {
          if (typeof v !== 'string' || v.length > 60000) throw Error('Invalid note');
          fresh.notes[k] = v;
        }
        if (Array.isArray(p.course)) fresh.course.forEach((c, i) => { c.done = p.course[i]?.done === true; });
        if (p.quiz?.answers && typeof p.quiz.answers === 'object') {
          for (const [k, v] of Object.entries(p.quiz.answers)) {
            if (/^[0-2]$/.test(k) && Number.isInteger(v) && v >= 0 && v <= 2) fresh.quiz.answers[k] = v;
          }
        }
        if (p.mock && Number.isInteger(p.mock.index) && p.mock.index >= 0 && p.mock.index <= fresh.questions.length && Array.isArray(p.mock.answers) && p.mock.answers.length === p.mock.index) {
          fresh.mock = {
            index: p.mock.index,
            answers: p.mock.answers.map((a) => {
              if (typeof a.text !== 'string' || a.text.length > 60000) throw Error('Invalid mock');
              return { question: String(a.question).slice(0, 2000), text: a.text, feedback: feedback(a.text) };
            }),
            draft: String(p.mock.draft || '').slice(0, 60000),
            finished: p.mock.index === fresh.questions.length
          };
        }
        return fresh;
      });
      records.push(...copies);
      persist();
      active = null;
      show('welcome');
      notify('Restored ' + copies.length + ' preparation(s) as separate copies.');
    } catch (err) { notify('Could not restore: ' + err.message); }
  });
}

function bindScreen() {
  const form = $('#role-form');
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); readRole(); show('jobad'); });
  const job = $('#job-form');
  if (job) {
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
  }
  const intake = $('#intake');
  if (intake) {
    intake.addEventListener('submit', (e) => { e.preventDefault(); createPrep(false); });
    $('#skip').addEventListener('click', () => createPrep(true));
  }
  if (view === 'lesson' || view === 'answers' || view === 'rolemap') bindNotes();
  if (view === 'mock' && active && !active.mock.finished) {
    const box = $('#mock-answer');
    box.addEventListener('input', () => {
      active.mock.draft = box.value;
      const ok = save();
      const n = wordCount(box.value);
      $('#word-count').textContent = n + (n === 1 ? ' word' : ' words');
      $('#save-line').lastElementChild.textContent = ok ? 'Draft saved. Resume anytime.' : 'Not saved yet. Export a backup before leaving.';
    });
    $('#submit-answer').addEventListener('click', () => {
      const text = box.value.trim();
      if (text.length < 20) { notify('Add at least 20 characters so you have an answer to review.'); return; }
      const review = checks(text);
      const m = active.mock;
      m.answers.push({ question: active.questions[m.index], text, feedback: feedback(text), at: new Date().toISOString() });
      m.draft = '';
      m.index += 1;
      m.finished = m.index >= active.questions.length;
      save();
      lastFeedback = { ...review, index: m.answers.length, total: active.questions.length, finished: m.finished };
      show('feedback');
    });
    document.querySelectorAll('[data-star]').forEach((el) => el.addEventListener('click', () => {
      star = el.dataset.star;
      document.querySelectorAll('[data-star]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.star === star)));
      $('#star-hint').textContent = STAR[star];
    }));
  }
  if ($('#restart')) $('#restart').addEventListener('click', () => {
    if (confirm('Start another round? Export first to keep the current mock log.')) {
      active.mock = { index: 0, answers: [], draft: '', finished: false };
      save();
      show('mock');
    }
  });
  if ($('#rename')) $('#rename').addEventListener('click', () => { renaming = true; show('today'); });
  const rename = $('#rename-form');
  if (rename) rename.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#rename-input').value.trim();
    if (name) { active.role = name.slice(0, 120); save(); }
    renaming = false;
    show('today');
  });
  if ($('#export-one')) $('#export-one').addEventListener('click', () => exportBackup(false));
  if ($('#all-export')) $('#all-export').addEventListener('click', () => exportBackup(true));
  if ($('#prev')) $('#prev').addEventListener('click', () => { if (lessonIndex > 0) openLesson(lessonIndex - 1); });
  if ($('#next')) $('#next').addEventListener('click', () => { if (active && lessonIndex < active.course.length - 1) openLesson(lessonIndex + 1); });
  if ($('#mark')) $('#mark').addEventListener('click', () => {
    const c = active.course[lessonIndex];
    const done = !c.done;
    c.done = done;
    save();
    if (done) show('today');
    else show('lesson');
  });
  if ($('#retry')) $('#retry').addEventListener('click', () => { active.quiz.answers = {}; save(); show('quiz'); });
  if ($('#delete-all')) $('#delete-all').addEventListener('click', () => {
    if (!storageOK) { notify('Saved data could not be read, so it will not be deleted. Export or recover browser storage first.'); return; }
    if (!confirm('Delete every preparation on this device? This cannot be undone. Export a backup first if you want to keep them.')) return;
    try {
      localStorage.removeItem(KEY);
      records = [];
      active = null;
      draft = null;
      show('welcome');
      notify('All preparations on this device were deleted.');
    } catch { notify('Could not delete saved preparations.'); }
  });
  bindImport();
}

document.body.addEventListener('click', (e) => {
  const close = e.target.closest('[data-close-install]');
  if (close) { $('#install').hidden = true; return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (action === 'how') { $('#install').hidden = false; return; }
  if (action === 'privacy') { privacyFrom = view; show('privacy'); return; }
  if (action === 'privacy-back') { show(privacyFrom || 'welcome'); return; }
  if (action === 'start') { renaming = false; show('role'); return; }
  if (action === 'back-welcome') { readRole(); show('welcome'); return; }
  if (action === 'back-role') { readJob(); show('role'); return; }
  if (action === 'back-job') { readIntake(); show('jobad'); return; }
  if (action === 'all-preps') { active = null; renaming = false; show('welcome'); return; }
  if (action === 'resume') {
    active = records.find((p) => p.id === el.dataset.id);
    renaming = false;
    if (active) show('today');
    return;
  }
  if (action === 'tab-today' || action === 'close-today') { if (needPrep()) show('today'); return; }
  if (action === 'tab-practise' || action === 'back-practise') { if (needPrep()) show('practise'); return; }
  if (action === 'tab-progress') { if (needPrep()) show('progress'); return; }
  if (action === 'tab-learn' || action === 'continue') { if (needPrep()) openLesson(currentLessonIndex(active)); return; }
  if (action === 'all-lessons') { if (needPrep()) show('lessons'); return; }
  if (action === 'back-lesson') { if (needPrep()) show('lesson'); return; }
  if (action === 'open-lesson') { openLesson(+el.dataset.index || 0); return; }
  if (action === 'open-mock' || action === 'lesson-practise' || action === 'feedback-next') { openMock(); return; }
  if (action === 'open-answers') { if (needPrep()) show('answers'); return; }
  if (action === 'open-quiz') { if (needPrep()) show('quiz'); return; }
  if (action === 'open-map') { if (needPrep()) show('rolemap'); return; }
  if (action === 'quiz') {
    if (active.quiz.answers[el.dataset.q] !== undefined) return;
    active.quiz.answers[el.dataset.q] = +el.dataset.choice;
    save();
    show('quiz');
  }
});

show('welcome');
