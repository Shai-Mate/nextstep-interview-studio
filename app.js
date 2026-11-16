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
const reduceMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Module seams. Later classic scripts (flow.js, interview.js, ...) share these
   top-level globals and register: screens.<view> = () => html, binders.<view> = () => wiring,
   actions['data-action name'] = (el, event) => {}. Never use inline style attributes:
   the CSP (style-src 'self') blocks them; use classes or el.style from JS. */
const binders = {};
const actions = {};
const analysisCache = new Map();
/* Deterministic ad analysis, recomputed from the saved ad text (works for older preparations too). */
function analysisOf(p) {
  if (!p || !globalThis.PrepEngine || typeof PrepEngine.analyze !== 'function') return null;
  const key = [p.id, String(p.job || '').length, p.role, p.company].join('\u0001');
  if (!analysisCache.has(key)) {
    try { analysisCache.set(key, PrepEngine.analyze(p.job, { role: p.role, company: p.company })); }
    catch { analysisCache.set(key, null); }
  }
  return analysisCache.get(key);
}

/* Core helpers for the richer engine output. Every one falls back cleanly for older
   preparations that have no questionInfo / quizItems / analysis. Prefixed to avoid
   clashing with top-level names in the other classic scripts. */
const CORE_KIND_LABEL = { motivation: 'Why this job', behavioural: 'A time when…', role: 'Doing the job', situational: 'What would you do?', gap: 'Something new to you', closing: 'Your questions' };
const CORE_REQ_KINDS = [
  ['must', 'Must-haves', 'What the ad says you need. Try to bring one true example for each.'],
  ['duty', 'Day to day', 'What you would actually do. Think of a time you did something like it.'],
  ['nice', 'Nice to have', 'Extras, not deal-breakers. “Not yet, and here is how I would learn it” is a fine answer.'],
  ['other', 'Also in the ad', 'Worth a sentence or two if it comes up.']
];
const CORE_DEFAULT_QUIZ = [
  { q: 'Which answer best demonstrates a job requirement?', options: ['A confident claim with no example', 'A true example with your action and a clear outcome', 'Someone else’s experience presented as yours'], correct: 1, why: 'Specific, truthful evidence is more useful than polished claims.' },
  { q: 'The job ad says: “{req}”. What should you prepare?', options: ['A relevant example and a question about success', 'An unrelated memorized speech', 'An invented company policy'], correct: 0, why: 'Connect your own evidence to the exact requirement and clarify what success means.' },
  { q: 'You have not done part of this role before. What is the strongest approach?', options: ['Pretend you have', 'Avoid the topic entirely', 'Be honest, connect transferable skills and explain how you would learn'], correct: 2, why: 'An honest gap plus a credible learning plan protects your integrity and shows judgment.' }
];
let coreQuizJust = -1;
let coreCelebrate = -1;
/* Quiz items for a preparation. Indices stay stable (answers are keyed by index): an
   unusable item in p.quizItems comes back as null and is skipped, never shifted out. */
function coreQuizItems(p) {
  const ok = (it) => it && typeof it.q === 'string' && Array.isArray(it.options) && it.options.length >= 2 && it.options.every((o) => typeof o === 'string') && Number.isInteger(it.correct) && it.correct >= 0 && it.correct < it.options.length;
  const own = Array.isArray(p.quizItems) ? p.quizItems.map((it) => (ok(it) ? it : null)) : [];
  if (own.some(Boolean)) return own;
  return CORE_DEFAULT_QUIZ.map((it) => ({ ...it, q: it.q.replace('{req}', p.requirements[0] || 'the main requirement') }));
}
function coreInfo(p, i) {
  const info = Array.isArray(p.questionInfo) ? p.questionInfo[i] : null;
  return info && typeof info === 'object' ? info : null;
}
function coreThemeLabel(id, a) {
  if (!id) return '';
  const t = a && Array.isArray(a.themes) ? a.themes.find((x) => x && x.id === id) : null;
  const cat = globalThis.PrepEngine && PrepEngine.themes ? PrepEngine.themes[id] : null;
  return (t && t.label) || (cat && cat.label) || String(id).replace(/[-_]+/g, ' ').replace(/^./, (c) => c.toUpperCase());
}
/* Kind + themes for each saved p.requirements[i], matched by text against the analysis. */
function coreReqMeta(p, a) {
  const list = a && Array.isArray(a.requirements) ? a.requirements : [];
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  return p.requirements.map((r) => {
    const n = norm(r);
    if (!n) return null;
    const hit = list.find((x) => {
      const m = norm(x && x.text);
      return m && (m === n || (m.length > 24 && n.length > 24 && (m.startsWith(n) || n.startsWith(m))));
    });
    if (!hit) return null;
    const kind = ['must', 'duty', 'nice'].includes(hit.kind) ? hit.kind : 'other';
    return { kind, themes: Array.isArray(hit.themes) ? hit.themes.filter(Boolean) : [] };
  });
}
/* A theme is covered once an answer-bank note or a mock answer exists for one of its questions. */
function coreThemeReadiness(p, a) {
  if (!a || !Array.isArray(a.themes) || !a.themes.length || !Array.isArray(p.questionInfo)) return null;
  const practised = new Set(p.mock.answers.map((x) => x && x.question));
  return a.themes.filter((t) => t && t.id).map((t) => {
    const qs = p.questions.map((_, i) => i).filter((i) => coreInfo(p, i)?.theme === t.id);
    const done = qs.filter((i) => (p.notes['answer-' + i] || '').trim() || practised.has(p.questions[i])).length;
    return { id: t.id, label: t.label || coreThemeLabel(t.id, a), total: qs.length, done };
  });
}
/* Job ad with the analysis highlights (char ranges into p.job), escaped. */
function coreHighlightAd(text, a) {
  const src = String(text || '');
  const hs = a && Array.isArray(a.highlights) ? a.highlights : [];
  const kinds = new Set();
  let out = '';
  let at = 0;
  for (const h of hs) {
    const s = Number(h && h.start), e = Number(h && h.end);
    if (!Number.isInteger(s) || !Number.isInteger(e) || s < at || e <= s || e > src.length) continue;
    const kind = ['skill', 'keyword', 'must', 'nice'].includes(h.kind) ? h.kind : 'keyword';
    kinds.add(kind);
    out += esc(src.slice(at, s)) + `<mark class="hl hl-${kind}">${esc(src.slice(s, e))}</mark>`;
    at = e;
  }
  return { html: out + esc(src.slice(at)), kinds };
}
function coreLive(text) {
  try {
    if (globalThis.Coach && typeof Coach.live === 'function') {
      const r = Coach.live(String(text || ''));
      if (r && typeof r === 'object' && Number.isFinite(r.words)) return r;
    }
  } catch { /* fall back below */ }
  const words = wordCount(text);
  return { words, seconds: Math.round((words / 140) * 60), star: null };
}
function coreStarPips(star) {
  if (!star || typeof star !== 'object') return '';
  const n = ['situation', 'task', 'action', 'result'].filter((k) => star[k]).length;
  return `<span class="star-pips" role="img" title="Situation, Task, Action, Result" aria-label="Situation, Task, Action, Result: ${n} of 4 covered">${[['situation', 'S'], ['task', 'T'], ['action', 'A'], ['result', 'R']].map(([k, l]) => `<i class="${star[k] ? 'on' : ''}" aria-hidden="true">${l}</i>`).join('')}</span>`;
}
function coreLiveHtml(text) {
  const r = coreLive(text);
  const secs = Math.max(0, Math.round(r.seconds || 0));
  const spoken = !r.words ? 'Nothing yet' : r.words + (r.words === 1 ? ' word' : ' words') + ' · about ' + (secs < 60 ? secs + ' s' : Math.floor(secs / 60) + ' min ' + String(secs % 60).padStart(2, '0') + ' s') + ' aloud';
  return `<span>${spoken}</span>${coreStarPips(r.star)}`;
}
/* Interview date: optional, local time, stored as p.interviewAt = 'YYYY-MM-DD' or 'YYYY-MM-DDTHH:MM'. */
let coreWhenEditing = false;
const CORE_CAL = '<svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6.5h12v9.5H4zM4 9.5h12M7 4v3M13 4v3"></path></svg>';
function coreParseWhen(v) {
  const m = typeof v === 'string' ? /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?$/.exec(v) : null;
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3];
  const hasTime = m[4] !== undefined;
  const h = hasTime ? +m[4] : 0, mi = hasTime ? +m[5] : 0;
  if (y < 2000 || y > 2100 || h > 23 || mi > 59) return null;
  const date = new Date(y, mo - 1, d, h, mi);
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return { date, hasTime };
}
function coreWhen(p, now) {
  const w = coreParseWhen(p && p.interviewAt);
  if (!w) return null;
  const n = now || new Date();
  const day0 = new Date(n.getFullYear(), n.getMonth(), n.getDate());
  const dayT = new Date(w.date.getFullYear(), w.date.getMonth(), w.date.getDate());
  const days = Math.round((dayT - day0) / 86400000);
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayT.getDay()];
  let time = '';
  if (w.hasTime) {
    try { time = w.date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); } catch { time = String(w.date.getHours()).padStart(2, '0') + ':' + String(w.date.getMinutes()).padStart(2, '0'); }
  }
  const at = time ? ' at ' + time : '';
  const when = days < 7 ? weekday : longDate(dayT);
  let line;
  if (days < 0) line = 'How did it go?';
  else if (days === 0) line = 'Interview today' + at + '. You’ve got this.';
  else if (days === 1) line = 'Interview tomorrow' + at;
  else line = 'Interview in ' + days + ' days · ' + when + at;
  return { days, when, time, line };
}
function corePace(p, w) {
  if (!w || w.days < 0) return '';
  const left = p.course.filter((c) => !c.done).length;
  if (w.days === 0) return 'Today’s the day. Read your Interview day page before you go.';
  if (w.days === 1) return left ? 'Tomorrow’s the day. Do what feels useful today, then rest.' : 'Tomorrow’s the day. Read your Interview day page tonight, then rest.';
  if (!left) return 'Every lesson done. Practise out loud before ' + w.when + '.';
  const per = Math.ceil(left / w.days);
  return (per === 1 ? 'One lesson a day' : 'About ' + per + ' lessons a day') + ' gets you through before ' + w.when + '.';
}
function coreWhenHtml(p, w) {
  if (coreWhenEditing) {
    const parsed = coreParseWhen(p.interviewAt);
    const dateVal = parsed ? p.interviewAt.slice(0, 10) : '';
    const timeVal = parsed && parsed.hasTime ? p.interviewAt.slice(11, 16) : '';
    return `<form class="glass pad-sm when-form" id="when-form">
      <p class="kicker">When is your interview?</p>
      <div class="when-fields">
        <div><label class="field tight" for="when-date">Date</label><input id="when-date" type="date" value="${esc(dateVal)}" required></div>
        <div><label class="field tight" for="when-time">Time, optional</label><input id="when-time" type="time" value="${esc(timeVal)}"></div>
      </div>
      <p class="hint">Only used on this device, to pace your plan.</p>
      <button class="primary gap-top" type="submit">Save date</button>
      <div class="pager"><button type="button" class="quiet" id="when-cancel">Cancel</button>${parsed ? '<button type="button" class="quiet" id="when-clear">Remove date</button>' : ''}</div>
    </form>`;
  }
  if (!w) return `<button type="button" class="when-chip" data-action="set-when">${CORE_CAL}<span>When is your interview?</span></button>`;
  if (w.days < 0) return `<div class="when-past"><p>How did it go? Start a new preparation when you’re ready.</p><div class="pager"><button type="button" class="quiet" data-action="start">New preparation</button><button type="button" class="quiet" data-action="set-when">Change date</button></div></div>`;
  return `<button type="button" class="when-chip set${w.days <= 1 ? ' soon' : ''}" data-action="set-when" aria-label="${esc(w.line)}. Change the date">${CORE_CAL}<span>${esc(w.line)}</span></button>`;
}
function coreBindWhen() {
  const form = $('#when-form');
  if (!form) return;
  const done = (msg) => { coreWhenEditing = false; show('today', { keep: true }); if (msg) notify(msg); };
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const d = $('#when-date').value;
    const t = $('#when-time').value;
    const v = d ? (t ? d + 'T' + t.slice(0, 5) : d) : '';
    if (!coreParseWhen(v)) { notify('Pick a date, or tap Cancel.'); $('#when-date').focus(); return; }
    active.interviewAt = v;
    save();
    done(coreWhen(active).line);
  });
  $('#when-cancel').addEventListener('click', () => done(''));
  if ($('#when-clear')) $('#when-clear').addEventListener('click', () => { delete active.interviewAt; save(); done('Interview date removed.'); });
}
/* Interview day: one calm page built only from the user's own preparation. */
let coreDayFrom = 'today';
const CORE_DAY_CHECKS = [
  'Know your route, and plan to arrive 10 to 15 minutes early',
  'Bring what they asked for: ID, your CV or résumé, any certificates, a pen',
  'Clothes that suit the workplace: clean, neat and comfortable',
  'Video call? Test the link, camera and sound 15 minutes before',
  'Read your best stories once, out loud if you can',
  'Phone on silent before you walk in'
];
const CORE_DAY_TIPS = [
  ['Breathe out slowly before you go in', 'One long breath out, longer than the breath in, tells your body it is safe.'],
  ['It is fine to pause', 'Take a moment to think, or ask them to repeat the question. Interviewers expect it.'],
  ['A gap is something you are learning', 'Not something to hide. Say what you would do to learn it, and give an example of learning something fast.']
];
function coreBestStories(p) {
  const best = new Map();
  const add = (question, text) => {
    const t = String(text || '').trim();
    if (!t || typeof question !== 'string' || !question) return;
    const r = coreLive(t);
    const parts = r.star && typeof r.star === 'object' ? ['situation', 'task', 'action', 'result'].filter((k) => r.star[k]).length : 0;
    const score = parts * 1000 + Math.min(r.words || 0, 400);
    const prev = best.get(question);
    if (!prev || score > prev.score) best.set(question, { question, text: t, star: r.star, score });
  };
  p.questions.forEach((q, i) => add(q, p.notes['answer-' + i]));
  p.mock.answers.forEach((a) => add(a && a.question, a && a.text));
  return [...best.values()].sort((x, y) => y.score - x.score).slice(0, 3);
}
function coreFirstWords(text, n) {
  const w = String(text || '').trim().split(/\s+/);
  return w.slice(0, n).join(' ') + (w.length > n ? '…' : '');
}
/* Lesson -> story: the answer-bank question that best matches a lesson. Most specific first:
   the question about the same ad excerpt, then the same topic (undrafted first), then the
   first undrafted question. Works for old preparations through the quoted excerpt. */
let coreOpenAnswer = -1;
let coreAnswersFrom = 'practise';
function coreStoryFor(p, li) {
  const c = p.course[li] || {};
  const norm = (x) => String(x || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const quote = norm(quoteFrom(c.body, ''));
  const drafted = (i) => !!(p.notes['answer-' + i] || '').trim();
  const all = p.questions.map((_, i) => i);
  /* Closest question number to the lesson number breaks ties, so the match stays stable
     (a drafted story keeps opening for its lesson). */
  const closest = (list) => list.reduce((b, i) => (Math.abs(i - li) < Math.abs(b - li) ? i : b), list[0]);
  if (quote.length > 12) {
    const same = all.filter((i) => norm(coreInfo(p, i)?.source) === quote || norm(p.questions[i]).includes(quote));
    if (same.length) return closest(same);
  }
  if (c.theme) {
    const same = all.filter((i) => coreInfo(p, i)?.theme === c.theme);
    if (same.length) return closest(same.filter((i) => !drafted(i)).length ? same.filter((i) => !drafted(i)) : same);
  }
  const open = all.filter((i) => !drafted(i));
  return open.length ? open[0] : 0;
}
function coreAdWords(a) {
  const out = [];
  const seen = new Set();
  for (const w of [...(a && Array.isArray(a.skills) ? a.skills : []), ...(a && Array.isArray(a.keywords) ? a.keywords : [])]) {
    if (typeof w !== 'string') continue;
    const t = w.trim();
    const k = t.toLowerCase();
    if (!t || t.length > 60 || seen.has(k)) continue;
    seen.add(k);
    out.push(t);
    if (out.length >= 10) break;
  }
  return out;
}
function coreAskThem(p) {
  const out = [];
  (Array.isArray(p.questionInfo) ? p.questionInfo : []).forEach((info) => {
    if (!info || info.kind !== 'closing' || !Array.isArray(info.include)) return;
    info.include.forEach((x) => { if (typeof x === 'string' && x.trim().length < 200 && /\?\s*$/.test(x)) out.push(x.trim()); });
  });
  const role = String(p.role || '').trim();
  const who = role && role !== 'New opportunity' ? 'a new ' + role : 'someone new in this job';
  [`What does a great first month look like for ${who}?`, 'What is the hardest part of this job, and how does the team help with it?', 'What happens after today, and when might I hear back?']
    .forEach((d) => out.push(d));
  return [...new Set(out)].slice(0, 3);
}
function coreBindDay() {
  document.querySelectorAll('input[data-day]').forEach((box) => {
    box.addEventListener('change', () => {
      if (!active) return;
      active.notes['day-' + box.dataset.day] = box.checked ? '1' : '';
      save();
      box.closest('.tick-row')?.classList.toggle('ticked', box.checked);
      const n = document.querySelectorAll('input[data-day]:checked').length;
      const count = $('#day-count');
      if (count) count.textContent = n === CORE_DAY_CHECKS.length ? 'All set' : n + ' of ' + CORE_DAY_CHECKS.length;
    });
  });
}

let records = [];
/* Declared before the storage read below: its catch path calls notify(), which uses this. */
let toastTimer = 0;
let active = null;
let draft = null;
let storageOK = true;
let view = 'welcome';
let lessonIndex = 0;
let renaming = false;
let privacyFrom = 'welcome';
try {
  records = JSON.parse(localStorage.getItem(KEY) || '[]');
  if (!Array.isArray(records) || records.some((p) => p.schema !== 1 || !p.id || !Array.isArray(p.course) || !p.mock)) throw Error('Invalid saved format');
} catch {
  storageOK = false;
  records = [];
  notify('Saved data could not be read. It has not been overwritten. Export or recover your browser storage before continuing.');
}

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
function stats(p) {
  const lessonsDone = p.course.filter((c) => c.done).length;
  const answersDone = p.questions.filter((_, i) => (p.notes['answer-' + i] || '').trim()).length;
  const quizItems = coreQuizItems(p);
  const quiz = quizItems.filter(Boolean).length;
  const quizDone = Object.keys(p.quiz.answers || {}).filter((k) => /^\d+$/.test(k) && quizItems[+k]).length;
  const mockDone = p.mock.answers.length;
  const mapDone = p.requirements.filter((_, i) => (p.notes['map-' + i] || '').trim()).length;
  const lessons = p.course.length;
  const answers = p.questions.length;
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
function coreLessonSegs(p, current, pop) {
  return `<div class="segs" aria-hidden="true">${p.course.map((c, i) => `<span class="${c.done ? 'done' : i === current ? 'now' : ''}${i === pop ? ' pop' : ''}"></span>`).join('')}</div>`;
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

/* Screen changes stay synchronous (callers can query the new DOM right after show()).
   Motion: the outgoing screen is kept as an inert, id-free snapshot that fades out over
   ~220 ms while the new screen's content rises in. It never touches the #aurora / #orb
   canvases, needs no View Transitions support (older iOS Safari included) and is skipped
   under prefers-reduced-motion. show(view, { keep: true }) re-renders in place: scroll kept,
   no entrance motion (used for quiz answers, rename, mark incomplete). */
const CORE_DEPTH = { welcome: 0, today: 1, learn: 1, practise: 1, progress: 1, interviewday: 2, lessons: 3, privacy: 3 };
function show(next, opts) {
  const from = view;
  if (next !== 'answers') coreAnswersFrom = 'practise';
  view = next;
  render({ ...(opts || {}), from });
}
function coreGhost(node, from, to) {
  document.querySelectorAll('.core-ghost').forEach((g) => g.remove());
  if (!node || reduceMotion() || typeof node.animate !== 'function') return null;
  const sc = node.querySelector('.scroll');
  const top = sc ? sc.scrollTop : 0;
  const winY = window.scrollY || 0;
  node.remove();
  [node, ...node.querySelectorAll('[id],[data-orb],[data-action],[data-say],[data-screen],[data-ring],[data-bar]')].forEach((el) => {
    ['id', 'data-orb', 'data-action', 'data-say', 'data-screen', 'data-ring', 'data-bar'].forEach((a) => el.removeAttribute(a));
  });
  const wrap = document.createElement('div');
  wrap.className = 'core-ghost';
  wrap.setAttribute('aria-hidden', 'true');
  wrap.inert = true;
  wrap.appendChild(node);
  const d = (CORE_DEPTH[to] ?? 2) - (CORE_DEPTH[from] ?? 2);
  return { wrap, node, sc, top, winY, dx: d > 0 ? -14 : d < 0 ? 14 : 0 };
}
function coreFadeGhost(g) {
  if (!g) return;
  if (g.node.classList.contains('with-tabs') && document.querySelector('#app .tabbar')) g.wrap.classList.add('keep-tabs');
  document.body.appendChild(g.wrap);
  if (g.sc) g.sc.scrollTop = g.top;
  else if (g.winY) g.node.style.transform = `translate3d(0, ${-g.winY}px, 0)`;
  const anim = g.wrap.animate(
    [{ opacity: 1, transform: 'none' }, { opacity: 0, transform: `translate3d(${g.dx}px, -6px, 0) scale(.985)` }],
    { duration: 220, easing: 'cubic-bezier(.4, 0, .9, .6)', fill: 'forwards' }
  );
  const done = () => g.wrap.remove();
  anim.onfinish = done;
  setTimeout(done, 600);
}
function render(opts = {}) {
  const app = $('#app');
  const screen = screens[view] || screens.welcome;
  const keep = !!opts.keep;
  const oldScroll = document.querySelector('#app .scroll');
  const keepTop = keep ? (oldScroll ? oldScroll.scrollTop : window.scrollY) : 0;
  const html = screen();
  const ghost = keep ? null : coreGhost(app.firstElementChild, opts.from, view);
  app.innerHTML = html;
  if (keep && app.firstElementChild) app.firstElementChild.classList.add('steady');
  document.body.classList.toggle('tabs-on', !!app.querySelector('.tabbar'));
  bindScreen();
  animateBits(keep);
  const sc = document.querySelector('#app .scroll');
  if (keep) {
    if (sc) sc.scrollTop = keepTop;
    else window.scrollTo(0, keepTop);
  } else {
    if (sc) sc.scrollTop = 0;
    window.scrollTo(0, 0);
  }
  coreFadeGhost(ghost);
}
function animateBits(keep) {
  if (keep || reduceMotion()) return;
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
        ${actions['try-sample'] ? '<button type="button" class="text-btn" data-action="try-sample">Try it with a sample job ad</button>' : ''}
        <p class="fine">Free. No account. No trackers or AI calls.</p>
      </div>`;
    }
    return `<div class="screen welcome" data-screen="welcome">
      <div class="brandbar"><span class="logo">NextStep</span><button type="button" class="pill" data-action="privacy">${I.lock}<span>On this device</span></button></div>
      <div class="ask"><p class="italic lg">Pick up where you left off.</p><div class="orb-slot md"><div class="orb-anchor md" data-orb data-env=".6" data-s=".75" data-up="80,40" data-down="40,90" data-energy="${glow(records[0])}"></div></div></div>
      <p class="sub">${records.length === 1 ? 'Your preparation stays on this device.' : records.length + ' preparations, all on this device.'}</p>
      <div class="prep-list">${records.map((p) => {
        const st = stats(p);
        const pct = Math.round(st.ratio * 100);
        const next = p.course.find((c) => !c.done);
        return `<article class="glass prep-card"><div class="prep-top"><div><p class="kicker">${esc(p.company)}</p><h2>${esc(p.role)}</h2></div><span class="prep-pct">${pct}%</span></div><p class="muted">${esc(p.intake.stage)} · ${esc(p.intake.time)} a day</p>${bar(pct)}${(() => { const w = coreWhen(p); return w ? `<p class="when-line${w.days >= 0 && w.days <= 1 ? ' soon' : ''}">${CORE_CAL}<span>${esc(w.days < 0 ? 'Interview date passed. How did it go?' : w.line)}</span></p>` : ''; })()}<p class="next-up">${next ? 'Up next · ' + esc(next.title) : 'Every lesson done · keep practising'}</p><button type="button" class="primary" data-action="resume" data-id="${esc(p.id)}"><span>Resume preparation</span>${I.arrow}</button></article>`;
      }).join('')}</div>
      <div class="spacer"></div>
      <button type="button" class="primary gap-top" data-action="start">New preparation</button>
      <button type="button" class="text-btn" data-action="how">How to install</button>
      <p class="fine">Free. No account. No trackers or AI calls.</p>
    </div>`;
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
    const a = analysisOf(p);
    const pop = coreCelebrate;
    coreCelebrate = -1;
    const w = coreWhen(p, now);
    const dayFirst = !!w && (w.days === 0 || w.days === 1);
    const pace = corePace(p, w);
    const themes = a && Array.isArray(a.themes) ? a.themes.filter((t) => t && t.label).slice(0, 3) : [];
    const musts = a && Array.isArray(a.requirements) ? a.requirements.filter((r) => r && r.kind === 'must').length : 0;
    const skills = a && Array.isArray(a.skills) ? a.skills.length : 0;
    const facts = [musts ? musts + ' must-have' + (musts === 1 ? '' : 's') : '', skills ? skills + (skills === 1 ? ' skill' : ' skills') + ' the ad mentions' : '', a && a.seniority && a.seniority.level && a.seniority.level !== 'Unknown' ? a.seniority.level + ' level' : ''].filter(Boolean).join(' · ');
    const decoded = a && actions['open-insights'] ? `<button type="button" class="glass button decoded" data-action="open-insights"><span class="copy"><span class="kicker">Your ad, decoded</span><strong>What this job is really about</strong>${themes.length ? `<span class="tags">${themes.map((t) => `<b class="tag">${esc(t.label)}</b>`).join('')}</span>` : ''}${facts ? `<span>${esc(facts)}</span>` : ''}</span>${I.chev}</button>` : '';
    const dayHero = dayFirst ? `<button type="button" class="glass button day-hero" data-action="open-day"><span class="copy"><span class="kicker">${w.days === 0 ? 'Interview today' : 'Interview tomorrow'}</span><strong>Your Interview day page</strong><span>Your best stories, questions to ask and a calm checklist</span></span>${I.chev}</button>` : '';
    const ad = coreHighlightAd(p.job, a);
    const legend = [['must', 'Must-have'], ['skill', 'Skill or tool'], ['nice', 'Nice to have'], ['keyword', 'Worth repeating']].filter(([k]) => ad.kinds.has(k));
    return shell('today', `
      <p class="date">${esc(longDate(now))}</p>
      <h1 class="italic greet">${esc(greeting(now))}</h1>
      <p class="role-name">${esc(p.role)}</p>
      <p class="muted">${esc(p.company)} · ${esc(p.intake.stage)}</p>
      ${coreWhenHtml(p, w)}
      ${dayHero}
      <div class="glass pad session${pop >= 0 ? ' celebrate' : ''}">
        <div class="session-head"><div class="min-left">${pop >= 0 ? `<span class="done-badge">${I.check}Lesson ${pop + 1} done</span>` : allDone ? 'All lessons complete' : left + ' min left'}</div><div class="session-kicker">Today's ${budgetOf(p)}-minute session</div></div>
        <h2 class="session-title">${esc(lesson.title)}</h2>
        <p class="upnow">${allDone ? 'Review any lesson' : 'Up now · Lesson ' + (idx + 1) + ' of ' + p.course.length}</p>
        ${coreLessonSegs(p, allDone ? -1 : idx, pop)}
        ${pace ? `<p class="pace">${esc(pace)}</p>` : ''}
        <button type="button" class="primary" data-action="continue"><span>${allDone ? 'Review lessons' : 'Continue'}</span>${I.arrow}</button>
      </div>
      ${decoded}
      <div class="glass flat more-card">
        <p class="kicker quiet-kicker">More ways to prepare</p>
        <button type="button" class="list-row" data-action="open-mock"><span class="copy"><strong>Mock interview</strong><span>${esc(mockLine(p))}</span></span>${I.chev}</button>
        ${dayFirst ? '' : `<button type="button" class="list-row" data-action="open-day"><span class="copy"><strong>Interview day</strong><span>Your best stories, words to use and a calm checklist</span></span>${I.chev}</button>`}
      </div>
      <div class="glass flat quiet-card" aria-label="${pct} percent prepared">
        <div class="stat-row">${ring(pct)}<div><strong>Preparation so far</strong><p class="muted">${st.done} of ${st.total} steps done. ${st.done ? 'Keep going, one small step at a time.' : 'Start with today’s first lesson.'}</p></div></div>
        <div class="stat-grid">
          <div><b>${st.lessonsDone}/${st.lessons}</b><span>Lessons</span></div>
          <div><b>${st.answersDone}/${st.answers}</b><span>Answers</span></div>
          <div><b>${st.quizDone}/${st.quiz}</b><span>Quiz</span></div>
          <div><b>${st.mockDone}/${st.mock}</b><span>Mock</span></div>
        </div>
      </div>
      ${renaming ? `<form class="rename" id="rename-form"><label class="sr" for="rename-input">Job title</label><input id="rename-input" type="text" maxlength="120" value="${esc(p.role)}"><button class="primary" type="submit">Save</button></form>` : `<div class="pager tools"><button type="button" class="quiet" id="rename">Rename</button><button type="button" class="quiet" id="export-one">Export backup</button><button type="button" class="quiet" data-action="all-preps">All preparations</button></div>`}
      <details class="fold"><summary>Review original job ad</summary>${legend.length ? `<p class="hl-legend">${legend.map(([k, l]) => `<mark class="hl hl-${k}">${l}</mark>`).join('')}</p>` : ''}<pre class="ad-text">${ad.html}</pre>${p.url ? `<p class="muted">Reference URL: ${esc(p.url)}</p>` : ''}</details>
    `);
  },
  practise() {
    const p = active;
    const st = stats(p);
    const fromAd = Array.isArray(p.quizItems) && p.quizItems.length;
    return shell('practise', `
      <h1>Practise</h1>
      <p class="italic lg">Say it out loud first.</p>
      <p class="sub">Practise, pause, pick up again. Drafts save as you go.</p>
      <button type="button" class="row" data-action="open-mock"><span class="copy"><strong>Mock interview</strong><em>${esc(mockLine(p))}</em></span>${I.chev.replace('stroke="currentColor"', 'stroke="#FFC48A"')}</button>
      <button type="button" class="row" data-action="open-answers"><span class="copy"><strong>Answer bank</strong><em>${st.answersDone} of ${st.answers} answers drafted${Array.isArray(p.questionInfo) ? ' · with what they want to hear' : ''}</em></span>${I.chev}</button>
      <button type="button" class="row" data-action="open-quiz"><span class="copy"><strong>Quiz</strong><em>${st.quizDone} of ${st.quiz} done${fromAd ? ' · built from your ad' : ''}</em></span>${I.chev}</button>
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
    const ready = coreThemeReadiness(p, analysisOf(p));
    const covered = ready ? ready.filter((t) => t.done > 0).length : 0;
    const readyHtml = ready && ready.length ? `<section class="readiness">
        <div class="section-head"><h2 class="section-title">Ready for each part of the job</h2><span class="muted">${covered} of ${ready.length}</span></div>
        <p class="hint">A part turns green once you write or practise an answer to one of its questions.</p>
        <div class="theme-grid">${ready.map((t) => `<div class="theme-chip${t.done ? ' covered' : ''}"><span class="name">${t.done ? I.check : ''}${esc(t.label)}</span>${t.total ? `<span class="pips" role="img" aria-label="${t.done} of ${t.total} ${t.total === 1 ? 'question' : 'questions'} answered">${Array.from({ length: t.total }, (_, k) => `<i class="${k < t.done ? 'on' : ''}"></i>`).join('')}</span>` : '<span class="pips"><em>No question for this yet</em></span>'}</div>`).join('')}</div>
      </section>` : '';
    return shell('progress', `
      <h1>Progress</h1>
      <p class="italic lg">${pct >= 80 ? 'Ready to walk in.' : pct >= 40 ? 'More than halfway there.' : 'Further than you think.'}</p>
      <div class="progress-hero">
        <div class="copy"><div class="pct">${pct}%</div><p class="muted">${st.done} of ${st.total} steps done</p></div>
        <div class="orb-slot lg"><div class="orb-anchor lg" data-orb data-env=".8" data-s=".7" data-up="130,55" data-down="55,130" data-energy="${glow(p)}"></div></div>
      </div>
      ${readyHtml}
      <div class="bars">${rows.map(([name, done, total]) => `<div><div class="bar-row"><span>${name}</span><span>${done} of ${total}</span></div>${bar(total ? (done / total) * 100 : 0)}</div>`).join('')}</div>
      <div class="spacer"></div>
      <button type="button" class="row" data-action="open-day"><span class="copy"><strong>Interview day</strong><em>One page for the big day</em></span>${I.chev}</button>
      <button type="button" class="row" data-action="privacy"><span class="lock">${I.lock}</span><span class="copy"><strong>Privacy and your data</strong></span>${I.chev}</button>
    `);
  },
  lesson() {
    const p = active;
    const i = Math.max(0, Math.min(lessonIndex, p.course.length - 1));
    lessonIndex = i;
    const c = p.course[i];
    const theme = c.theme ? coreThemeLabel(c.theme, analysisOf(p)) : '';
    const quote = quoteFrom(c.body, '');
    return `<div class="screen" data-screen="lesson">
      <div class="topbar">${iconBtn('close-today', 'Close', I.close)}<span class="label">Lesson ${i + 1} of ${p.course.length}</span></div>
      ${coreLessonSegs(p, i, -1)}
      <p class="kicker lesson-kicker">${theme ? esc(theme) + ' · ' : ''}About ${c.minutes || 5} min${c.done ? ' · Done' : ''}</p>
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
      <textarea id="lesson-note" rows="4" data-note="lesson-${i}" placeholder="What would you say? One true example is enough.">${esc(p.notes['lesson-' + i] || '')}</textarea>
      <div class="pager">
        <button type="button" class="quiet" id="prev" ${i === 0 ? 'disabled' : ''}>Previous</button>
        <button type="button" class="quiet" data-action="all-lessons">All lessons</button>
        <button type="button" class="quiet" id="next" ${i === p.course.length - 1 ? 'disabled' : ''}>Next</button>
      </div>
      <div class="spacer"></div>
      <p class="hint story-hint">Your story for: ${esc(coreFirstWords(p.questions[coreStoryFor(p, i)], 14))}</p>
      <button type="button" class="primary" data-action="lesson-story"><span>Write this story</span>${I.arrow}</button>
      <button type="button" class="text-btn" data-action="lesson-practise">Practise in a mock interview</button>
      <button type="button" class="text-btn mark${c.done ? '' : ' todo'}" id="mark">${c.done ? 'Mark incomplete' : I.check + '<span>Mark lesson done</span>'}</button>
    </div>`;
  },
  lessons() {
    const p = active;
    const a = analysisOf(p);
    const cur = currentLessonIndex(p);
    const doneCount = p.course.filter((c) => c.done).length;
    return `<div class="screen" data-screen="lessons">
      <div class="topbar">${iconBtn('back-lesson', 'Back', I.back)}<span class="label">Learn</span><span class="count">${doneCount} of ${p.course.length}</span></div>
      <h1>All lessons</h1>
      <p class="italic lg">One small step at a time.</p>
      <div class="stack">${p.course.map((c, i) => {
        const theme = c.theme ? coreThemeLabel(c.theme, a) : '';
        const next = !c.done && i === cur;
        return `<button type="button" class="row lesson-row${c.done ? ' is-done' : ''}${next ? ' is-next' : ''}" data-action="open-lesson" data-index="${i}"><span class="tick" aria-hidden="true">${c.done ? I.check : i + 1}</span><span class="copy"><strong>${c.done ? '<span class="sr">Done: </span>' : ''}${esc(c.title)}</strong><em>${next ? 'Up next · ' : ''}${theme ? esc(theme) + ' · ' : ''}About ${c.minutes || 5} min</em></span>${I.chev}</button>`;
      }).join('')}</div>
    </div>`;
  },
  answers() {
    const p = active;
    const a = analysisOf(p);
    const drafted = (i) => !!(p.notes['answer-' + i] || '').trim();
    const total = p.questions.length;
    const doneCount = p.questions.filter((_, i) => drafted(i)).length;
    const firstOpen = coreOpenAnswer >= 0 && coreOpenAnswer < total ? coreOpenAnswer : Math.max(0, p.questions.findIndex((_, i) => !drafted(i)));
    coreOpenAnswer = -1;
    const back = coreAnswersFrom === 'lesson' ? iconBtn('back-lesson', 'Back to the lesson', I.back) : iconBtn('back-practise', 'Back', I.back);
    return `<div class="screen" data-screen="answers">
      <div class="topbar">${back}<span class="label">Answer bank</span><span class="count" id="bank-count">${doneCount} of ${total}</span></div>
      <h1>Your answer bank</h1>
      <p class="italic lg">True examples only.</p>
      <p class="sub">Use something you actually did. A gap is something to prepare for, not something to make up. Notes save as you type.</p>
      <p class="hint star-tip">Tell each story as Situation, Task, Action, Result (STAR). The letters under your answer light up as you cover them.</p>
      ${p.questions.map((q, i) => {
        const info = coreInfo(p, i);
        const kind = info && CORE_KIND_LABEL[info.kind];
        const theme = info && info.theme ? coreThemeLabel(info.theme, a) : '';
        const include = info && Array.isArray(info.include) ? info.include.filter((x) => typeof x === 'string' && x.trim()).slice(0, 4) : [];
        const guide = info ? `${kind || theme ? `<div class="tags">${kind ? `<b class="tag kind">${esc(kind)}</b>` : ''}${theme ? `<b class="tag">${esc(theme)}</b>` : ''}</div>` : ''}
          ${info.probe ? `<div class="guide"><p class="kicker">What they want to hear</p><p>${esc(info.probe)}</p></div>` : ''}
          ${include.length ? `<div class="guide"><p class="kicker">A strong answer includes</p><ul class="includes">${include.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>` : ''}
          ${info.source ? `<p class="source">From the ad: “${esc(info.source)}”</p>` : ''}` : '<p class="muted">Situation, Task, your Action, Result, and what you learned.</p>';
        return `<details class="block qa${drafted(i) ? ' drafted' : ''}" ${i === firstOpen ? 'open' : ''}><summary><span class="qnum" aria-hidden="true">${drafted(i) ? I.check : i + 1}</span><span class="qtext">${drafted(i) ? '<span class="sr">Drafted: </span>' : ''}${esc(q)}</span>${I.chev}</summary>
          ${guide}
          <label class="field" for="answer-${i}">Your evidence and answer</label><textarea id="answer-${i}" rows="6" data-note="answer-${i}" placeholder="Describe something you actually did.">${esc(p.notes['answer-' + i] || '')}</textarea>
          <div class="meta live" data-live="${i}">${coreLiveHtml(p.notes['answer-' + i] || '')}</div></details>`;
      }).join('')}
    </div>`;
  },
  quiz() {
    const p = active;
    const all = coreQuizItems(p);
    const items = all.filter(Boolean);
    const ans = p.quiz.answers || {};
    const answered = all.filter((it, i) => it && ans[i] !== undefined).length;
    const right = all.filter((it, i) => it && ans[i] === it.correct).length;
    let num = 0;
    const just = coreQuizJust;
    coreQuizJust = -1;
    const fromAd = Array.isArray(p.quizItems) && p.quizItems.length;
    const summary = answered === items.length ? `<div class="glass pad-sm quiz-done${just >= 0 ? ' just' : ''}"><p class="kicker">All ${items.length} answered</p><p class="quiz-score"><b>${right}</b> of ${items.length} matched the strongest approach</p><p class="muted">${right === items.length ? 'Lovely. Now try saying one of these answers out loud in the mock interview.' : 'Read the note under each one. Retry whenever you like: this is practice, not a test.'}</p></div>` : '';
    return `<div class="screen" data-screen="quiz">
      <div class="topbar">${iconBtn('back-practise', 'Back', I.back)}<span class="label">Quiz</span><span class="count">${answered} of ${items.length}</span></div>
      <h1>Check your approach</h1>
      <p class="italic lg">Technique, not a score.</p>
      <p class="sub">${fromAd ? 'Built from your job ad. ' : ''}This checks interview technique, not technical certification or hiring readiness.</p>
      <div class="quiz-dots" aria-hidden="true">${all.map((it, i) => (it ? `<span class="${ans[i] === undefined ? '' : ans[i] === it.correct ? 'ok' : 'miss'}"></span>` : '')).join('')}</div>
      ${all.map((q, i) => {
        if (!q) return '';
        num += 1;
        const pick = ans[i];
        const done = pick !== undefined;
        const ok = done && pick === q.correct;
        return `<article class="quiz${done ? (ok ? ' is-ok' : ' is-miss') : ''}${i === just ? ' just' : ''}"><h2><span class="qn">${num}</span>${esc(q.q)}</h2><div class="choices">${q.options.map((o, j) => {
          const cls = done ? (j === q.correct ? ' correct' : j === pick ? ' wrong' : ' dim') : '';
          return `<button type="button" class="choice${cls}" data-action="quiz" data-q="${i}" data-choice="${j}" ${done ? 'disabled' : ''}><span><span class="opt">${esc(o)}${done && j === pick ? '<small>Your pick</small>' : ''}</span>${done && j === q.correct ? I.check : ''}</span></button>`;
        }).join('')}</div>${done ? `<p class="result ${ok ? 'ok' : 'miss'}" id="quiz-result-${i}" tabindex="-1"><strong>${ok ? 'Yes, that is the strongest choice.' : 'Good try. The stronger choice is marked in green.'}</strong> ${esc(q.why)}</p>` : ''}</article>`;
      }).join('')}
      ${summary}
      ${answered ? '<button type="button" class="text-btn" id="retry">Retry quiz</button>' : ''}
    </div>`;
  },
  rolemap() {
    const p = active;
    const a = analysisOf(p);
    const meta = coreReqMeta(p, a);
    const hints = {
      must: 'Ask: What would good performance on this look like in the first 90 days?',
      duty: 'Think of a time you did something similar, even at a smaller scale.',
      nice: 'Not there yet? “Here is how I would learn it” is an honest, strong answer.',
      other: 'Ask: What would good performance on this look like in the first 90 days?'
    };
    const card = (r, i) => {
      const m = meta[i];
      const tags = m ? m.themes.slice(0, 2).map((id) => `<b class="tag">${esc(coreThemeLabel(id, a))}</b>`).join('') : '';
      return `<article class="glass pad-sm map-card${(p.notes['map-' + i] || '').trim() ? ' has-note' : ''}"><div class="map-head"><p class="kicker">Excerpt ${i + 1}</p>${tags ? `<span class="tags">${tags}</span>` : ''}</div><p class="prose">${esc(r)}</p><label class="field" for="map-${i}">Your example, or how you would learn it</label><textarea id="map-${i}" data-note="map-${i}" rows="3">${esc(p.notes['map-' + i] || '')}</textarea><p class="hint">${esc(hints[(m && m.kind) || 'other'])}</p></article>`;
    };
    let body;
    if (meta.some(Boolean)) {
      body = CORE_REQ_KINDS.map(([kind, title, blurb]) => {
        const idx = p.requirements.map((_, i) => i).filter((i) => ((meta[i] && meta[i].kind) || 'other') === kind);
        if (!idx.length) return '';
        return `<section class="map-group"><div class="section-head"><h2 class="section-title">${title}</h2><span class="muted">${idx.length}</span></div><p class="hint">${blurb}</p>${idx.map((i) => card(p.requirements[i], i)).join('')}</section>`;
      }).join('');
    } else body = p.requirements.map(card).join('');
    return `<div class="screen" data-screen="rolemap">
      <div class="topbar">${iconBtn('back-practise', 'Back', I.back)}<span class="label">Role map</span><span class="count">${stats(p).mapDone} of ${p.requirements.length}</span></div>
      <h1>Map the role to your evidence</h1>
      <p class="italic lg">From the ad, not assumptions.</p>
      <p class="sub">These are excerpts, not verified facts about the employer. Confirm the priorities with your interviewer.</p>
      ${body}
    </div>`;
  },
  interviewday() {
    const p = active;
    const a = analysisOf(p);
    const stories = coreBestStories(p);
    const words = coreAdWords(a);
    const ask = coreAskThem(p);
    const ticked = CORE_DAY_CHECKS.filter((_, n) => p.notes['day-' + n] === '1').length;
    const role = String(p.role || '').trim();
    return `<div class="screen day" data-screen="interviewday">
      <div class="topbar">${iconBtn('day-back', 'Back', I.back)}<span class="label">Interview day</span></div>
      <h1>Interview day</h1>
      <p class="italic lg">${stories.length ? 'You’ve done the work.' : 'You know more than you think.'}</p>
      <p class="sub">${esc(role)}${p.company ? ' · ' + esc(p.company) : ''}. Read this the night before, and again in the last ten minutes.</p>
      <section class="glass day-card" aria-labelledby="day-stories">
        <p class="kicker" id="day-stories">Your best stories</p>
        ${stories.length ? `<ol class="stories">${stories.map((st) => `<li><p class="story-q">${esc(st.question)}</p><p class="story-text">${esc(coreFirstWords(st.text, 25))}</p>${coreStarPips(st.star)}</li>`).join('')}</ol>
          <p class="hint">Your own words, from your answer bank and mock interview. Tell each one as Situation, Task, Action, Result.</p>`
        : `<p class="day-empty">You have not written a story yet. One true example is enough to start: a time you helped someone, fixed something or learned fast.</p>
          <button type="button" class="primary day-go" data-action="open-answers"><span>Write my first story</span>${I.arrow}</button>`}
      </section>
      <section class="glass day-card" aria-labelledby="day-words">
        <p class="kicker" id="day-words">Words from the ad to use naturally</p>
        ${words.length ? `<div class="tags day-words">${words.map((w) => `<b class="tag">${esc(w)}</b>`).join('')}</div><p class="hint">Use them when they are true for you. Their words, your examples.</p>`
        : '<p class="day-plain">Read the job ad once more and pick three words they use for the work. Use them when they fit your examples.</p>'}
      </section>
      <section class="glass day-card" aria-labelledby="day-ask">
        <p class="kicker" id="day-ask">Questions to ask them</p>
        <ul class="ask-list">${ask.map((q) => `<li>${esc(q)}</li>`).join('')}</ul>
      </section>
      <section class="glass day-card" aria-labelledby="day-before">
        <div class="card-head"><p class="kicker" id="day-before">Before you go</p><span class="muted" id="day-count">${ticked === CORE_DAY_CHECKS.length ? 'All set' : ticked + ' of ' + CORE_DAY_CHECKS.length}</span></div>
        <div class="ticks">${CORE_DAY_CHECKS.map((t, n) => {
          const on = p.notes['day-' + n] === '1';
          return `<label class="tick-row${on ? ' ticked' : ''}"><input type="checkbox" data-day="${n}" ${on ? 'checked' : ''}><span class="box" aria-hidden="true">${I.check}</span><span class="tick-text">${esc(t)}</span></label>`;
        }).join('')}</div>
      </section>
      <section class="glass day-card" aria-labelledby="day-calm">
        <p class="kicker" id="day-calm">If you feel nervous</p>
        <div class="stack">${CORE_DAY_TIPS.map(([t, d], n) => `<div class="point"><i>${n + 1}</i><div><strong>${esc(t)}</strong><span>${esc(d)}</span></div></div>`).join('')}</div>
      </section>
      <div class="spacer"></div>
      <button type="button" class="primary gap-top" data-action="open-mock"><span>Practise one more answer</span>${I.arrow}</button>
      ${typeof window.print === 'function' ? '<button type="button" class="text-btn" data-action="print-day">Print or save as PDF</button>' : ''}
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
        <div class="privacy-block"><strong>No AI calls</strong><span>Reading the ad, building your plan and the structure feedback all run on this device with plain rules. It is a writing checklist, not an assessment.</span></div>
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
      <div class="about">
        <a class="feedback-link" href="https://github.com/Shai-Mate/nextstep-interview-studio/issues/new" target="_blank" rel="noopener noreferrer">Send feedback</a>
        <p class="hint">GitHub issues are public, so don't paste private answers.</p>
        <p class="credit">Made by Prism</p>
      </div>
      <p class="version">Phone app v8 · storage schema v1 · rules-based preparation</p>
    </div>`;
  }
};


function needPrep() { if (!active) { show('welcome'); return false; } return true; }
function openLesson(i) { if (!needPrep()) return; lessonIndex = i; show('lesson'); }
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
/* Backup restore. A preparation is rebuilt with PrepEngine.create(p) for safe defaults, but when the
   backup carries its own plan (questions, questionInfo, requirements, course, quizItems) that plan is
   kept after shape and length checks, so saved notes, quiz answers and the mock log stay attached
   to the questions they were written for. Anything that no longer matches is dropped, never moved. */
const coreOkStr = (v, max) => typeof v === 'string' && v.length <= max;
function coreStrList(v, max, len) {
  return Array.isArray(v) && v.length >= 1 && v.length <= max && v.every((x) => coreOkStr(x, len) && x.trim()) ? v.slice() : null;
}
function coreCleanInfo(v, n) {
  if (!Array.isArray(v) || v.length !== n) return null;
  const kinds = Object.keys(CORE_KIND_LABEL);
  const out = v.map((x) => {
    if (!x || typeof x !== 'object') return null;
    return {
      kind: kinds.includes(x.kind) ? x.kind : 'role',
      theme: coreOkStr(x.theme, 60) && x.theme ? x.theme : null,
      source: coreOkStr(x.source, 600) && x.source ? x.source : null,
      probe: coreOkStr(x.probe, 600) ? x.probe : '',
      include: Array.isArray(x.include) ? x.include.filter((s) => coreOkStr(s, 400) && s.trim()).slice(0, 4) : []
    };
  });
  return out.every(Boolean) ? out : null;
}
function coreCleanCourse(v) {
  if (!Array.isArray(v) || !v.length || v.length > 20) return null;
  const out = v.map((c) => (c && coreOkStr(c.title, 300) && c.title.trim() && coreOkStr(c.body, 6000) && coreOkStr(c.exercise, 3000) ? {
    title: c.title,
    minutes: Number.isInteger(c.minutes) && c.minutes > 0 && c.minutes <= 120 ? c.minutes : 5,
    body: c.body,
    exercise: c.exercise,
    done: c.done === true,
    ...(coreOkStr(c.theme, 60) && c.theme ? { theme: c.theme } : {})
  } : null));
  return out.every(Boolean) ? out : null;
}
function coreCleanQuiz(v) {
  if (!Array.isArray(v) || !v.length || v.length > 12) return null;
  const out = v.map((it) => (it && coreOkStr(it.q, 600) && it.q.trim() && Array.isArray(it.options) && it.options.length === 3 && it.options.every((o) => coreOkStr(o, 300)) && Number.isInteger(it.correct) && it.correct >= 0 && it.correct <= 2 && (it.why === undefined || coreOkStr(it.why, 800))
    ? { q: it.q, options: it.options.slice(), correct: it.correct, why: it.why || '' } : null));
  return out.every(Boolean) ? out : null;
}
function coreRestore(p) {
  if (!p || typeof p !== 'object') throw Error('Invalid preparation');
  const fresh = PrepEngine.create(p);
  if (!p.notes || typeof p.notes !== 'object') throw Error('Invalid notes');
  for (const [k, v] of Object.entries(p.notes)) {
    if (typeof v !== 'string' || v.length > 60000) throw Error('Invalid note');
    fresh.notes[k] = v;
  }
  /* When the backup's own list is unusable the engine's list is used instead, and the notes
     keyed by index into that list are dropped so they never attach to a different item. */
  const dropNotes = (prefix) => Object.keys(fresh.notes).forEach((k) => { if (k.startsWith(prefix)) delete fresh.notes[k]; });
  const questions = coreStrList(p.questions, 20, 2000);
  if (questions) {
    fresh.questions = questions;
    const info = coreCleanInfo(p.questionInfo, questions.length);
    if (info) fresh.questionInfo = info;
    else delete fresh.questionInfo;
  } else dropNotes('answer-');
  const requirements = coreStrList(p.requirements, 12, 2000);
  if (requirements) fresh.requirements = requirements;
  else dropNotes('map-');
  const course = coreCleanCourse(p.course);
  if (course) fresh.course = course;
  else dropNotes('lesson-');
  if (coreParseWhen(p.interviewAt)) fresh.interviewAt = p.interviewAt;
  /* Quiz: keep the backup's own items; a backup from before ad-specific quizzes answered the three
     default items, so it restores onto those. Answers are dropped if the items are unusable. */
  let quizOK = true;
  if (p.quizItems === undefined) delete fresh.quizItems;
  else {
    const quiz = coreCleanQuiz(p.quizItems);
    if (quiz) fresh.quizItems = quiz;
    else quizOK = false;
  }
  if (quizOK && p.quiz?.answers && typeof p.quiz.answers === 'object') {
    const items = coreQuizItems(fresh);
    for (const [k, v] of Object.entries(p.quiz.answers)) {
      if (/^\d{1,2}$/.test(k) && items[+k] && Number.isInteger(v) && v >= 0 && v < items[+k].options.length) fresh.quiz.answers[k] = v;
    }
  }
  /* Mock log: kept only when every saved answer still belongs to the same question. */
  const m = p.mock;
  if (m && Number.isInteger(m.index) && m.index >= 0 && m.index <= fresh.questions.length && Array.isArray(m.answers) && m.answers.length === m.index
    && m.answers.every((a, k) => a && typeof a.text === 'string' && a.text.length <= 60000 && a.question === fresh.questions[k])) {
    fresh.mock = {
      index: m.index,
      answers: m.answers.map((a) => ({ question: a.question, text: a.text, feedback: feedback(a.text), ...(coreOkStr(a.at, 40) ? { at: a.at } : {}) })),
      draft: String(m.draft || '').slice(0, 60000),
      finished: m.index === fresh.questions.length
    };
  }
  return fresh;
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
      const copies = b.preparations.map((p) => coreRestore(p));
      records.push(...copies);
      persist();
      active = null;
      show('welcome');
      notify('Restored ' + copies.length + ' preparation(s) as separate copies.');
    } catch (err) { notify('Could not restore: ' + err.message); }
  });
}

function coreBindAnswers() {
  document.querySelectorAll('textarea[data-note^="answer-"]').forEach((el) => {
    const i = el.dataset.note.slice(7);
    const live = document.querySelector(`[data-live="${i}"]`);
    const block = el.closest('details');
    let raf = 0;
    el.addEventListener('input', () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        if (live) live.innerHTML = coreLiveHtml(el.value);
        const has = !!el.value.trim();
        if (block && block.classList.contains('drafted') !== has) {
          block.classList.toggle('drafted', has);
          const num = block.querySelector('.qnum');
          if (num) num.innerHTML = has ? I.check : String(+i + 1);
          const qt = block.querySelector('.qtext');
          const sr = qt && qt.querySelector('.sr');
          if (qt && has && !sr) qt.insertAdjacentHTML('afterbegin', '<span class="sr">Drafted: </span>');
          else if (sr && !has) sr.remove();
          const count = $('#bank-count');
          if (count && active) count.textContent = active.questions.filter((_, k) => (active.notes['answer-' + k] || '').trim()).length + ' of ' + active.questions.length;
        }
      });
    });
  });
}
function bindScreen() {
  if (view === 'lesson' || view === 'answers' || view === 'rolemap') bindNotes();
  if (view === 'answers') coreBindAnswers();
  if (view === 'interviewday') coreBindDay();
  if (view === 'today') coreBindWhen();
  if ($('#rename')) $('#rename').addEventListener('click', () => { renaming = true; show('today', { keep: true }); $('#rename-input')?.focus(); });
  const rename = $('#rename-form');
  if (rename) rename.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('#rename-input').value.trim();
    if (name) { active.role = name.slice(0, 120); save(); }
    renaming = false;
    show('today', { keep: true });
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
    if (done) {
      coreCelebrate = lessonIndex;
      show('today');
      try { window.NextStepOrb?.celebrate?.(); } catch { /* optional orb hook */ }
      const left = active.course.filter((x) => !x.done).length;
      notify(left ? 'Lesson done. ' + left + ' to go.' : 'Every lesson done. Now practise out loud.');
    } else {
      show('lesson', { keep: true });
      $('#mark')?.focus({ preventScroll: true });
    }
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
  if (binders[view]) binders[view]();
}

document.body.addEventListener('click', (e) => {
  const close = e.target.closest('[data-close-install]');
  if (close) { $('#install').hidden = true; return; }
  const el = e.target.closest('[data-action]');
  if (!el) return;
  const action = el.dataset.action;
  if (actions[action]) { actions[action](el, e); return; }
  if (action === 'how') { $('#install').hidden = false; return; }
  if (action === 'privacy') { privacyFrom = view; show('privacy'); return; }
  if (action === 'privacy-back') { show(privacyFrom || 'welcome'); return; }
  if (action === 'all-preps') { active = null; renaming = false; show('welcome'); return; }
  if (action === 'resume') {
    active = records.find((p) => p.id === el.dataset.id);
    renaming = false;
    coreWhenEditing = false;
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
  if (action === 'open-answers') { if (needPrep()) { coreAnswersFrom = 'practise'; show('answers'); } return; }
  if (action === 'lesson-story') {
    if (!needPrep()) return;
    const qi = coreStoryFor(active, lessonIndex);
    coreAnswersFrom = 'lesson';
    coreOpenAnswer = qi;
    show('answers');
    const box = document.getElementById('answer-' + qi);
    if (box) {
      const block = box.closest('details');
      if (block) block.open = true;
      box.scrollIntoView({ block: 'center', behavior: reduceMotion() ? 'auto' : 'smooth' });
      box.focus({ preventScroll: true });
    }
    return;
  }
  if (action === 'open-quiz') { if (needPrep()) show('quiz'); return; }
  if (action === 'open-map') { if (needPrep()) show('rolemap'); return; }
  if (action === 'open-day') { if (needPrep()) { coreDayFrom = view === 'progress' ? 'progress' : 'today'; show('interviewday'); } return; }
  if (action === 'day-back') { if (needPrep()) show(coreDayFrom || 'today'); return; }
  if (action === 'print-day') { window.print(); return; }
  if (action === 'set-when') { if (needPrep()) { coreWhenEditing = true; show('today', { keep: true }); $('#when-date')?.focus(); } return; }
  if (action === 'quiz') {
    if (!active || active.quiz.answers[el.dataset.q] !== undefined || !coreQuizItems(active)[+el.dataset.q]) return;
    active.quiz.answers[el.dataset.q] = +el.dataset.choice;
    save();
    coreQuizJust = +el.dataset.q;
    show('quiz', { keep: true });
    document.getElementById('quiz-result-' + el.dataset.q)?.focus({ preventScroll: true });
  }
});

/* First render after every deferred module (flow.js, interview.js, ...) has registered. */
document.addEventListener('DOMContentLoaded', () => show('welcome'));
