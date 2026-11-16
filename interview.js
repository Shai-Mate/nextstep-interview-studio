'use strict';
/* Mock interview: the interviewer (the orb) asks, you answer, a structure checklist, a session report.
   Classic script loaded after app.js; shares app.js top-level globals (esc, I, active, view, show, save, ...).
   Keeps the globals feedback(text) -> string (app.js import rebuilds mock logs with it) and openMock().
   Everything stays on this device: Coach is a local rules-based checklist, read-aloud uses only on-device
   voices (voice.localService === true), and nothing typed here is sent anywhere.
   New top-level names start with iv / IV_ so they cannot clash with the other classic scripts. */

const IV_PARTS = [
  { id: 'situation', name: 'Situation', tip: 'Where and when. Set the scene with one real example.' },
  { id: 'task', name: 'Task', tip: 'What needed doing, and why it mattered.' },
  { id: 'action', name: 'Action', tip: 'What you did yourself. Say “I”, and take it step by step.' },
  { id: 'result', name: 'Result', tip: 'How it turned out, or what you learned.' }
];
const IV_KIND_TIP = {
  motivation: 'No long story needed here: one real reason, linked to something you have done.',
  situational: 'Talk it through with “I would…”: what you would do first, then next.',
  gap: 'Be honest about what is new to you, then say how you would learn it.',
  closing: 'Your turn to ask. One or two questions of your own is plenty.'
};
const IV_PREFS_KEY = 'nextstep.prefs.v1';
const IV_FEEDBACK_URL = 'https://github.com/Shai-Mate/nextstep-interview-studio/issues/new';
const IV_MIC = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3a2.5 2.5 0 012.5 2.5v4a2.5 2.5 0 01-5 0v-4A2.5 2.5 0 0110 3zM5 9.5a5 5 0 0010 0M10 14.5V17"></path></svg>';
const IV_SPEAKER = '<svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3.5 8v4h3l4 3.5v-11L6.5 8z"></path><path class="iv-wave" d="M13.5 7.5a3.5 3.5 0 010 5M15.5 5.5a6.5 6.5 0 010 9"></path></svg>';
let ivPart = 'action';
let lastFeedback = null;
let ivSpeech = null;
let ivSpeakTimer = 0;
let ivSpeechSeq = 0;
let ivReadAloud = ivPrefs().readAloud === true;
let ivMic = null;
let ivVoiceSetup = null;
let ivVoiceHooked = null;

/* ---------- small helpers ---------- */

function ivPrefs() {
  try {
    const v = JSON.parse(localStorage.getItem(IV_PREFS_KEY) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch { return {}; }
}
function ivSetPref(key, value) {
  try {
    const v = ivPrefs();
    v[key] = value;
    localStorage.setItem(IV_PREFS_KEY, JSON.stringify(v));
  } catch { /* the choice still holds for this visit */ }
}
function ivCoach() {
  const C = globalThis.Coach;
  return C && typeof C.live === 'function' && typeof C.review === 'function' ? C : null;
}
function ivSecs(words) { return Math.round((words / 140) * 60); }
function ivSpoken(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 90) return 'about ' + Math.max(5, Math.round(s / 5) * 5) + ' seconds';
  const halves = Math.round(s / 30);
  const whole = Math.floor(halves / 2);
  if (halves % 2) return 'about ' + (whole === 1 ? 'a minute and a half' : whole + ' and a half minutes');
  return 'about ' + whole + (whole === 1 ? ' minute' : ' minutes');
}
function ivShortTime(sec) {
  const s = Math.max(0, Math.round(Number(sec) || 0));
  if (s < 90) return Math.max(5, Math.round(s / 5) * 5) + ' sec';
  return String(Math.round(s / 30) / 2).replace(/\.0$/, '') + ' min';
}
function ivWords(n) { return n + (n === 1 ? ' word' : ' words'); }
function ivInfo(p, i) {
  const x = p && Array.isArray(p.questionInfo) ? p.questionInfo[i] : null;
  return x && typeof x === 'object' ? x : null;
}
function ivStory(info) { return !(info && (info.kind === 'motivation' || info.kind === 'closing')); }
function ivLive(text) {
  const C = ivCoach();
  if (C) {
    try {
      const r = C.live(String(text || ''));
      if (r && typeof r === 'object' && Number.isFinite(r.words)) return r;
    } catch { /* fall back below */ }
  }
  const words = wordCount(text);
  return { words, seconds: ivSecs(words), star: null };
}
/* Full review of answer k (question k), with the ad context when the question still matches. */
function ivReview(p, k, text, question) {
  const C = ivCoach();
  if (!C) return null;
  const q = question || (p && p.questions[k]) || '';
  const same = p && p.questions[k] === q;
  try {
    const r = C.review(String(text || ''), { question: q, info: same ? p.questionInfo?.[k] || null : null, analysis: p ? analysisOf(p) : null });
    return r && Array.isArray(r.checks) ? r : null;
  } catch { return null; }
}
/* Checks used only if coach.js is missing. "Your part in it" is no longer always a warning. */
function ivBasicChecks(text) {
  const words = wordCount(text);
  const own = /\b(I|I'm|I've|I'd|my)\b/.test(text);
  const result = /\d|result|outcome|improv|learn|reduc|increas|thank/i.test(text);
  return [
    { id: 'ownership', ok: own, title: 'Your part in it', detail: own ? 'You say what you did yourself.' : 'Say what you did yourself, starting with “I”.' },
    { id: 'evidence', ok: result, title: 'How it turned out', detail: result ? 'You say how it turned out. Keep it true.' : 'Add how it turned out, or what you learned.' },
    { id: 'length', ok: words >= 50 && words <= 250, title: 'Time to say it', detail: words < 50 ? 'A little short: add where you were, what you did and how it ended.' : words > 250 ? 'Quite long: try a shorter first pass, and offer detail if asked.' : 'A comfortable length for a first pass.' }
  ];
}
function feedback(text, ctx) {
  const C = ivCoach();
  if (C) {
    try {
      const r = C.review(String(text || ''), ctx && typeof ctx === 'object' ? ctx : {});
      if (r && r.summary) return 'Structure checklist: ' + r.summary + '.';
    } catch { /* fall back below */ }
  }
  const words = wordCount(text);
  const length = words < 50 ? 'Try adding context, your specific action and an outcome.' : words > 250 ? 'Try a shorter first pass, then offer detail if asked.' : 'A useful length for a first pass.';
  const contribution = /\bI\b/.test(String(text || '')) ? 'Make sure your personal contribution is specific.' : 'Clarify what you personally did.';
  const result = /\d|result|outcome|improv|learn|reduc|increas/i.test(String(text || '')) ? 'Check that your result is truthful and relevant.' : 'Add an observable result or lesson if you have one.';
  return `Structure checklist: ${words} words. ${length} ${contribution} ${result}`;
}
/* Small snapshot kept on each mock answer. Optional: a restored backup drops it and it is recomputed. */
function ivSnapOf(r, text) {
  if (r) {
    return {
      starScore: r.starScore,
      words: r.words,
      seconds: r.seconds,
      ok: r.checks.filter((c) => c.ok).map((c) => c.id),
      echoed: (Array.isArray(r.echoed) ? r.echoed : []).filter((w) => typeof w === 'string').slice(0, 8).map((w) => w.slice(0, 60))
    };
  }
  const words = wordCount(text);
  return { starScore: null, words, seconds: ivSecs(words), ok: ivBasicChecks(text).filter((c) => c.ok).map((c) => c.id), echoed: [] };
}
function ivSnapValid(s) {
  return s && typeof s === 'object' && Number.isFinite(s.words) && Number.isFinite(s.seconds) && Array.isArray(s.ok) && Array.isArray(s.echoed)
    && (s.starScore === null || (Number.isInteger(s.starScore) && s.starScore >= 0 && s.starScore <= 4));
}
function ivSnap(p, k, a) {
  if (ivSnapValid(a.review) && (a.review.starScore !== null || !ivCoach())) return a.review;
  return ivSnapOf(ivReview(p, k, a.text, a.question), a.text);
}

/* ---------- pieces of markup ---------- */

function ivQuestionHtml(q) {
  let inQuote = false;
  return String(q || '').trim().split(/\s+/).filter(Boolean).map((w) => {
    const opens = /^[“"]/.test(w);
    if (opens) inQuote = true;
    const quoted = inQuote;
    if (inQuote && /[”"][.,;:!?)]*$/.test(w) && !(opens && w.length < 2)) inQuote = false;
    return `<span class="iv-w${quoted ? ' iv-ad' : ''}">${esc(w)}</span>`;
  }).join(' ');
}
function ivMeter(star) {
  return `<div class="iv-meter" id="iv-meter" role="group" aria-label="Answer shape: Situation, Task, Action, Result. Tap a part for a tip.">${IV_PARTS.map((x) => {
    const on = !!(star && star[x.id]);
    return `<button type="button" class="iv-part${on ? ' on' : ''}" data-star="${x.id}" aria-pressed="${x.id === ivPart}"><i class="iv-pip" aria-hidden="true"></i><span>${x.name}</span><span class="iv-vh">${on ? ', in your answer' : ''}</span></button>`;
  }).join('')}</div>`;
}
function ivShape(star) {
  const n = IV_PARTS.filter((x) => star && star[x.id]).length;
  return `<ul class="iv-shape" aria-label="Situation, Task, Action, Result: ${n} of 4 in this answer">${IV_PARTS.map((x) => {
    const on = !!(star && star[x.id]);
    return `<li class="${on ? 'on' : ''}"><i class="iv-pip" aria-hidden="true"></i><span>${x.name}</span><span class="iv-vh">${on ? ': in your answer' : ': not yet'}</span></li>`;
  }).join('')}</ul>`;
}
function ivBars(n) {
  return `<span class="iv-bars" role="img" aria-label="${n} of 4 parts">${[0, 1, 2, 3].map((k) => `<i class="${k < n ? 'on' : ''}"></i>`).join('')}</span>`;
}
function ivChips(words, cls) {
  return `<ul class="iv-words${cls ? ' ' + cls : ''}">${words.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>`;
}
function ivExcerpt(p, i, q) {
  if (/[“"][^”"]{6,}[”"]/.test(q)) return '';
  const info = ivInfo(p, i);
  if (info) return typeof info.source === 'string' ? info.source : '';
  return quoteFrom(q, p.requirements[Math.min(i, p.requirements.length - 1)] || '');
}
function ivWant(info) {
  if (!info) return '';
  const probe = typeof info.probe === 'string' ? info.probe.trim() : '';
  const include = Array.isArray(info.include) ? info.include.filter((x) => typeof x === 'string' && x.trim()).slice(0, 4) : [];
  if (!probe && !include.length) return '';
  return `<details class="fold iv-want"><summary>What they want to hear</summary>${probe ? `<p class="iv-probe">${esc(probe)}</p>` : ''}${include.length ? `<p class="iv-inc-title">A strong answer includes</p><ul class="iv-inc">${include.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}</details>`;
}
function logHtml(m) {
  if (!m.answers.length) return '';
  return `<h2 class="log-title">Your answers so far</h2>${m.answers.map((a, i) => `<details class="block"><summary>${i + 1}. ${esc(a.question)}</summary><p class="prose">${esc(a.text)}</p><p class="feedback">${esc(a.feedback)}</p></details>`).join('')}`;
}
function ivFeedbackLink() {
  return `<div class="iv-send"><a class="iv-link" href="${IV_FEEDBACK_URL}" target="_blank" rel="noopener noreferrer">Send feedback</a><p class="fine">GitHub issues are public, so don't paste private answers.</p></div>`;
}

/* ---------- the session report ---------- */

function ivReport(p) {
  const m = p.mock;
  const a = analysisOf(p);
  const rows = m.answers.map((ans, k) => {
    const s = ivSnap(p, k, ans);
    const info = p.questions[k] === ans.question ? ivInfo(p, k) : null;
    const story = ivStory(info);
    const parts = Number.isInteger(s.starScore) ? s.starScore : null;
    return { k, ans, s, story, parts, score: s.ok.length + (story && parts !== null ? parts : 2) };
  });
  const n = rows.length;
  const words = rows.reduce((t, r) => t + r.s.words, 0);
  const avg = n ? rows.reduce((t, r) => t + r.s.seconds, 0) / n : 0;
  let best = null;
  let next = null;
  rows.forEach((r) => {
    if (!best || r.score > best.score) best = r;
    if (!next || r.score < next.score) next = r;
  });
  if (best && next && (best === next || best.score === next.score)) next = null;
  let nextTip = '';
  if (next) {
    const full = ivReview(p, next.k, next.ans.text, next.ans.question);
    const miss = full ? full.checks.find((c) => !c.ok) : ivBasicChecks(next.ans.text).find((c) => !c.ok);
    nextTip = miss ? miss.detail : '';
  }
  const bestFull = best ? ivReview(p, best.k, best.ans.text, best.ans.question) : null;
  let bestLine = '';
  if (best) {
    const st = bestFull && bestFull.star;
    const have = st ? IV_PARTS.filter((x) => st[x.id]).map((x) => x.name) : [];
    const good = bestFull ? bestFull.checks.filter((c) => c.ok).map((c) => c.title) : [];
    if (best.story && have.length === 4) bestLine = 'It had all four parts: Situation, Task, Action, Result.';
    else if (best.story && have.length) bestLine = `It had ${have.length} of the four parts: ${have.join(', ')}.`;
    else if (good.length) bestLine = 'What went well: ' + good.join(', ') + '.';
    else bestLine = bestFull ? bestFull.summary + '.' : best.s.ok.length + ' of the checks went well.';
  }
  const used = [];
  rows.forEach((r) => (r.s.echoed || []).forEach((w) => { if (!used.some((u) => u.toLowerCase() === String(w).toLowerCase())) used.push(String(w)); }));
  const said = m.answers.map((x) => String(x.text || '').toLowerCase()).join(' \n ');
  const pool = [];
  if (a) [...(Array.isArray(a.skills) ? a.skills : []), ...(Array.isArray(a.keywords) ? a.keywords : [])].forEach((w) => {
    if (typeof w !== 'string' || !w.trim() || w.length > 40) return;
    const lw = w.toLowerCase();
    if (pool.some((x) => x.toLowerCase() === lw) || said.includes(lw)) return;
    if (used.some((u) => { const lu = u.toLowerCase(); return lu.includes(lw) || lw.includes(lu); })) return;
    pool.push(w);
  });
  const notYet = pool.slice(0, 4);
  const qShort = (r) => `<p class="iv-pick-q"><span class="iv-qn">${r.k + 1}</span><span class="iv-pt">${esc(r.ans.question)}</span></p>`;
  return `<div class="screen" data-screen="mock">
    <div class="topbar tight">${iconBtn('close-today', 'Close', I.close)}<span class="center">Mock interview</span><span class="count">${n} of ${p.questions.length}</span></div>
    <div class="feedback-orb iv-report-orb"><div class="orb-slot lg"><div class="orb-anchor lg" data-orb data-env="1" data-s=".75" data-up="120,60" data-down="50,140" data-energy="${glow(p)}"></div></div></div>
    <h1 class="saved-title iv-focus" tabindex="-1">Round complete.</h1>
    <p class="italic saved-italic">You did it.</p>
    <p class="muted gap-top">Every answer you practise now is one you will not have to invent on the day. Here is how this round went.</p>
    <div class="glass flat iv-stats">
      <div><b>${n}</b><span>${n === 1 ? 'answer' : 'answers'}</span></div>
      <div><b>${words}</b><span>words in all</span></div>
      <div><b>${n ? ivShortTime(avg) : '0 sec'}</b><span>to say each, on average</span></div>
    </div>
    <div class="glass flat">
      <div class="card-head"><strong>Answer shape</strong></div>
      <p class="muted">How many of Situation, Task, Action, Result each answer had.</p>
      <ol class="iv-rows">${rows.map((r) => `<li><span class="iv-qn">${r.k + 1}</span><span class="iv-qt">${esc(r.ans.question)}</span>${r.parts === null ? '<span class="iv-na">Not checked</span>' : r.story ? ivBars(r.parts) : '<span class="iv-na">No story needed</span>'}</li>`).join('')}</ol>
    </div>
    ${best ? `<div class="glass flat iv-picks">
      <div class="iv-pick"><p class="kicker">Your strongest answer</p>${qShort(best)}<p class="muted">${esc(bestLine)}</p></div>
      ${next ? `<div class="iv-pick"><p class="kicker">Worth another pass</p>${qShort(next)}${nextTip ? `<p class="muted">Next time: ${esc(nextTip)}</p>` : ''}</div>` : ''}
    </div>` : ''}
    ${used.length || notYet.length ? `<div class="glass flat">
      <div class="card-head"><strong>Words from the ad</strong><span class="muted">${used.length} used</span></div>
      <p class="muted">${used.length ? 'Using the ad’s own words shows you read it closely.' : 'None yet. Echoing the ad’s own words shows you read it closely.'}</p>
      ${used.length ? ivChips(used.slice(0, 10), '') : ''}
      ${notYet.length ? `<p class="iv-sub">Not in your answers yet, only if true for you</p>${ivChips(notYet, 'iv-dashed')}` : ''}
    </div>` : ''}
    <div class="spacer"></div>
    <button type="button" class="primary gap-top" data-action="open-answers">Refine in Answer bank</button>
    <button type="button" class="text-btn" id="restart">Start another round</button>
    ${logHtml(m).replace('Your answers so far', 'Your answers')}
    ${ivFeedbackLink()}
  </div>`;
}

/* ---------- screens ---------- */

function openMock() { if (!needPrep()) return; show('mock'); }
Object.assign(screens, {
  mock() {
    const p = active;
    const m = p.mock;
    if (m.finished || !p.questions[m.index]) return ivReport(p);
    const i = m.index;
    const q = p.questions[i];
    const info = ivInfo(p, i);
    const excerpt = ivExcerpt(p, i, q);
    const live = ivLive(m.draft);
    const part = IV_PARTS.find((x) => x.id === ivPart) || IV_PARTS[2];
    const tip = info && IV_KIND_TIP[info.kind];
    const story = ivStory(info);
    const placeholder = info && info.kind === 'closing' ? 'Write one or two questions you would like to ask them.'
      : info && info.kind === 'motivation' ? 'One real reason you want this job, and something you have done that shows it.'
        : 'Use a real example. What happened, what did you do, and how did it turn out?';
    return `<div class="screen iv-screen" data-screen="mock">
      <div class="topbar tight">${iconBtn('close-today', 'Close', I.close)}<span class="center">Mock interview</span><span class="count">${i + 1} of ${p.questions.length}</span></div>
      ${segs(p.questions.length, i, i)}
      <div class="iv-stage"><div class="orb-slot iv-slot"><div class="orb-anchor iv-anchor" data-orb data-voice="1" data-env="1" data-s=".8" data-up="110,55" data-down="50,120" data-energy="${glow(p)}"></div></div></div>
      <div class="iv-askrow"><p class="italic iv-asks">The interviewer asks</p><button type="button" class="iv-speak" id="iv-speak" aria-pressed="${ivReadAloud}" hidden>${IV_SPEAKER}<span>Read aloud</span></button></div>
      <p class="iv-note" id="iv-speak-note" hidden>Read aloud needs an English voice that works offline on this device.</p>
      <h1 class="question iv-q iv-focus${reduceMotion() ? '' : ' iv-reveal'}" data-say="1" tabindex="-1">${ivQuestionHtml(q)}</h1>
      ${excerpt ? `<div class="glass pad-sm quote"><div class="kicker">From your job ad</div><p>${esc(excerpt)}</p></div>` : ''}
      <p class="iv-calm">This is practice, and nobody is grading you. Take your time.</p>
      ${ivWant(info)}
      ${tip ? `<p class="hint iv-tip">${esc(tip)}</p>` : ''}
      <div class="iv-answer">
        ${story ? `<div class="iv-shape-head"><span class="kicker">Answer shape</span><span class="iv-shape-sub">${ivCoach() ? 'lights up as you write' : 'tap a part for a tip'}</span></div>
        ${ivMeter(live.star)}
        <p class="hint" id="star-hint"><strong>${part.name}:</strong> ${esc(part.tip)}</p>` : ''}
        <label class="field tight" for="mock-answer">Your answer</label>
        <textarea id="mock-answer" rows="5" placeholder="${esc(placeholder)}">${esc(m.draft)}</textarea>
        <div class="meta"><span id="word-count">${ivWords(live.words)}${live.words ? ' · ' + ivSpoken(live.seconds) + ' to say' : ''}</span><span class="saved" id="save-line">${I.check}<span>Draft saved. Resume anytime.</span></span></div>
      </div>
      <div class="iv-mic" id="iv-mic" hidden>
        <div class="iv-mic-row"><button type="button" class="iv-mic-btn" id="iv-mic-btn">${IV_MIC}<span>Practise out loud</span></button><button type="button" class="quiet iv-mic-del" id="iv-mic-del" hidden>Delete recording</button></div>
        <audio class="iv-mic-play" id="iv-mic-play" controls preload="metadata" hidden></audio>
        <p class="iv-mic-note">Optional. Say your answer out loud, then listen back. The recording stays in this device’s memory only: never saved, never sent, and gone when you leave this question or switch apps.</p>
      </div>
      <button type="button" class="primary" id="submit-answer">Save answer and continue</button>
      ${logHtml(m)}
    </div>`;
  },
  feedback() {
    const p = active;
    const f = lastFeedback;
    const ans = f && p && p.mock.answers[f.at];
    if (!ans) { view = 'mock'; return screens.mock(); }
    const r = f.review || ivReview(p, f.at, ans.text, ans.question);
    const info = p.questions[f.at] === ans.question ? ivInfo(p, f.at) : null;
    const checks = r ? r.checks : ivBasicChecks(ans.text);
    const good = checks.filter((c) => c.ok);
    const todo = checks.filter((c) => !c.ok);
    const words = r ? r.words : wordCount(ans.text);
    const secs = r ? r.seconds : ivSecs(words);
    const left = Math.max(0, f.total - f.count);
    const echoed = r && Array.isArray(r.echoed) ? r.echoed.filter((w) => typeof w === 'string').slice(0, 8) : [];
    const missing = r && Array.isArray(r.missing) ? r.missing.filter((w) => typeof w === 'string').slice(0, 3) : [];
    return `<div class="screen" data-screen="feedback">
      <div class="topbar tight">${iconBtn('close-today', 'Close', I.close)}<span class="center">Mock interview</span><span class="count">${f.count} of ${f.total}</span></div>
      ${segs(f.total, f.count, -1)}
      <div class="feedback-orb iv-fb-orb"><div class="orb-slot lg"><div class="orb-anchor lg" data-orb data-env="1" data-s=".75" data-up="125,60" data-down="50,150" data-energy="${glow(p)}"></div></div></div>
      <h1 class="saved-title iv-focus" tabindex="-1">${f.finished ? 'Last answer saved.' : 'Answer saved.'}</h1>
      <p class="italic saved-italic">${f.finished ? 'That’s the round.' : 'One step closer.'}</p>
      <p class="muted gap-top">${f.count} of ${f.total} done.${left ? ' ' + left + ' to go.' : ' Your session report is ready.'}</p>
      <div class="glass flat iv-check">
        <div class="card-head"><strong>Structure check</strong><span class="muted">${ivWords(words)} · ${ivSpoken(secs)}</span></div>
        <p class="muted">A structure checklist, not a hiring score.</p>
        ${r && ivStory(info) ? ivShape(r.star) : ''}
        ${good.length ? `<p class="iv-group">What went well</p>${good.map(checkRow).join('')}` : '<p class="iv-group">What went well</p><p class="muted iv-gentle">You wrote a real answer, and that is the hardest part.</p>'}
        ${todo.length ? `<p class="iv-group">Try next time</p>${todo.slice(0, 2).map(checkRow).join('')}` : ''}
        ${todo.length > 2 ? `<details class="fold iv-want iv-more"><summary>${todo.length - 2} more to try</summary>${todo.slice(2).map(checkRow).join('')}</details>` : ''}
      </div>
      ${echoed.length || missing.length ? `<div class="glass flat">
        <div class="card-head"><strong>Words from the ad</strong></div>
        ${echoed.length ? `<p class="iv-sub">You used</p>${ivChips(echoed, '')}` : ''}
        ${missing.length ? `<p class="iv-sub">Worth adding, if true for you</p>${ivChips(missing, 'iv-dashed')}` : ''}
      </div>` : ''}
      <div class="spacer"></div>
      <button type="button" class="primary gap-top" data-action="feedback-next"><span>${f.finished ? 'See your session report' : 'Next question'}</span>${I.arrow}</button>
      <button type="button" class="text-btn" data-action="open-answers">Refine in Answer bank</button>
    </div>`;
  }
});

/* ---------- read aloud (on-device voices only) ---------- */

function ivSynth() {
  return 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function' ? window.speechSynthesis : null;
}
/* Novelty voices some phones ship as ordinary local English voices: never the interviewer. */
const IV_ODD_VOICE = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox)\b/i;
function ivVoices() {
  const s = ivSynth();
  let list = [];
  try { list = s ? s.getVoices() || [] : []; } catch { list = []; }
  const local = list.filter((v) => v && v.localService === true && /^en([-_]|$)/i.test(v.lang || '') && !IV_ODD_VOICE.test(v.name || ''));
  const want = String(navigator.language || 'en-GB').toLowerCase().replace('_', '-');
  const voice = local.find((v) => v.default) || local.find((v) => String(v.lang).toLowerCase().replace('_', '-') === want) || local[0] || null;
  return { loaded: list.length > 0, voice };
}
function ivStopSpeech() {
  clearTimeout(ivSpeakTimer);
  ivSpeakTimer = 0;
  if (!ivSpeech) return;
  ivSpeech = null;
  try { ivSynth()?.cancel(); } catch { /* nothing to stop */ }
}
function ivSpeak(text) {
  const s = ivSynth();
  const { voice } = ivVoices();
  if (!s || !voice || voice.localService !== true) return;
  const busy = !!ivSpeech || s.speaking || s.pending;
  ivStopSpeech();
  const u = new SpeechSynthesisUtterance(String(text || '').slice(0, 1200));
  u.voice = voice;
  u.lang = voice.lang;
  u.rate = 0.95;
  const app = document.getElementById('app');
  const me = { u, el: app && app.firstElementChild, seq: ++ivSpeechSeq, last: 0 };
  ivSpeech = me;
  const orb = window.NextStepOrb;
  const level = (v) => { try { if (orb && typeof orb.level === 'function') orb.level(v); } catch { /* optional */ } };
  u.onboundary = () => { if (ivSpeech === me) { me.last = performance.now(); level(0.95); } };
  u.onstart = () => {
    if (ivSpeech !== me || reduceMotion()) return;
    const t0 = performance.now();
    const tick = (now) => {
      if (ivSpeech !== me) return;
      if (now - t0 > 1000 && !s.speaking && !s.pending) { ivSpeech = null; return; }
      if (now - me.last > 450) level(0.3 + 0.3 * Math.abs(Math.sin(now / 90)));
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  u.onend = u.onerror = () => { if (ivSpeech === me) ivSpeech = null; };
  const go = () => { if (ivSpeech !== me) return; try { s.speak(u); } catch { ivSpeech = null; } };
  /* Chrome can drop an utterance queued in the same tick as cancel(). */
  if (busy) setTimeout(go, 90);
  else go();
}
function ivBindSpeech(question) {
  const btn = document.querySelector('#app #iv-speak');
  const note = document.querySelector('#app #iv-speak-note');
  const s = ivSynth();
  if (!btn || !s) return;
  const seq = ivSpeechSeq;
  const setup = () => {
    if (!btn.isConnected) { if (ivVoiceSetup === setup) ivVoiceSetup = null; return; }
    const { loaded, voice } = ivVoices();
    if (voice) {
      btn.hidden = false;
      btn.disabled = false;
      if (note) note.hidden = true;
      btn.setAttribute('aria-pressed', String(ivReadAloud));
      if (ivReadAloud && !ivSpeech && !ivSpeakTimer && seq === ivSpeechSeq) {
        ivSpeakTimer = setTimeout(() => { ivSpeakTimer = 0; if (btn.isConnected && ivReadAloud) ivSpeak(question); }, 650);
      }
    } else if (loaded) {
      btn.hidden = false;
      btn.disabled = true;
      btn.setAttribute('aria-pressed', 'false');
      if (note) note.hidden = false;
    }
  };
  ivHookVoices(s);
  ivVoiceSetup = setup;
  setup();
  btn.addEventListener('click', () => {
    if (btn.disabled) return;
    ivReadAloud = !ivReadAloud;
    ivSetPref('readAloud', ivReadAloud);
    btn.setAttribute('aria-pressed', String(ivReadAloud));
    if (ivReadAloud) {
      if (ivMic && ivMic.live) { ivMicStop(true); ivMicPaint(); }
      ivSpeak(question);
    } else ivStopSpeech();
  });
}
/* One listener for the whole app (voices can arrive late): it re-runs the current screen's setup. */
function ivHookVoices(s) {
  if (!s || ivVoiceHooked === s) return;
  ivVoiceHooked = s;
  const run = () => { if (ivVoiceSetup) ivVoiceSetup(); };
  try {
    if (typeof s.addEventListener === 'function') s.addEventListener('voiceschanged', run);
    else s.onvoiceschanged = run;
  } catch { /* older engines */ }
}
ivHookVoices(ivSynth());
(function ivWatchLeave() {
  const app = document.getElementById('app');
  if (app && window.MutationObserver) {
    new MutationObserver(() => {
      if (ivSpeech && app.firstElementChild !== ivSpeech.el) ivStopSpeech();
      else if (ivSpeakTimer && view !== 'mock') ivStopSpeech();
      if (ivMic && app.firstElementChild !== ivMic.el) ivMicStop(false);
    }).observe(app, { childList: true });
  }
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) return;
    ivStopSpeech();
    if (ivMic) { ivMicStop(false); ivMicPaint(); }
  });
  window.addEventListener('pagehide', () => { ivStopSpeech(); ivMicStop(false); ivMicPaint(); });
})();

/* ---------- practise out loud (microphone, in memory only) ---------- */

function ivMicOK() {
  return !!(window.isSecureContext !== false && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && typeof window.MediaRecorder === 'function');
}
/* Stops the microphone. keep=false also forgets the recording (leaving the question). */
function ivMicStop(keep) {
  const me = ivMic;
  if (!me) return;
  me.keep = !!keep;
  clearTimeout(me.limit);
  try { if (me.rec && me.rec.state !== 'inactive') me.rec.stop(); } catch { /* already stopped */ }
  try { me.stream.getTracks().forEach((t) => t.stop()); } catch { /* already stopped */ }
  try { if (me.ctx) me.ctx.close(); } catch { /* already closed */ }
  me.ctx = null;
  me.an = null;
  me.live = false;
  if (!keep) {
    if (me.url) { try { URL.revokeObjectURL(me.url); } catch { /* gone */ } }
    me.url = null;
    me.chunks = [];
    ivMic = null;
  }
}
function ivMicPaint() {
  const root = document.getElementById('app');
  const btn = root && root.querySelector('#iv-mic-btn');
  if (!btn) return;
  const me = ivMic;
  const label = btn.lastElementChild;
  const play = root.querySelector('#iv-mic-play');
  const del = root.querySelector('#iv-mic-del');
  let text;
  if (me && me.live) {
    const sec = Math.floor((performance.now() - me.t0) / 1000);
    text = 'Stop recording · ' + Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0');
  } else text = me && me.url ? 'Record again' : 'Practise out loud';
  if (label.textContent !== text) label.textContent = text;
  btn.classList.toggle('rec', !!(me && me.live));
  if (play) {
    const url = me && !me.live ? me.url : null;
    play.hidden = !url;
    if (url && play.src !== url) play.src = url;
    if (!url && play.getAttribute('src')) { play.removeAttribute('src'); try { play.load(); } catch { /* nothing loaded */ } }
  }
  if (del) {
    const hide = !(me && me.url && !me.live);
    if (del.hidden !== hide) del.hidden = hide;
  }
}
async function ivMicStart() {
  const app = document.getElementById('app');
  const screen = app && app.firstElementChild;
  if (!ivMicOK() || !screen) return;
  ivStopSpeech();
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (err) {
    notify(err && err.name === 'NotAllowedError' ? 'No microphone access, and that is fine: typing your answer works just as well.' : 'The microphone is not available right now. Typing your answer works just as well.');
    return;
  }
  if (app.firstElementChild !== screen) { stream.getTracks().forEach((t) => t.stop()); return; }
  ivMicStop(false);
  let rec;
  try { rec = new MediaRecorder(stream); } catch {
    stream.getTracks().forEach((t) => t.stop());
    notify('Recording is not supported in this browser. Typing your answer works just as well.');
    return;
  }
  const me = { stream, rec, chunks: [], ctx: null, an: null, data: null, el: screen, t0: performance.now(), url: null, live: true, keep: true, limit: 0 };
  ivMic = me;
  rec.ondataavailable = (e) => { if (e.data && e.data.size) me.chunks.push(e.data); };
  rec.onstop = () => {
    if (ivMic !== me || !me.keep || !me.chunks.length) return;
    try { me.url = URL.createObjectURL(new Blob(me.chunks, { type: rec.mimeType || 'audio/webm' })); } catch { me.url = null; }
    me.chunks = [];
    ivMicPaint();
  };
  try {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC && !reduceMotion()) {
      me.ctx = new AC();
      me.an = me.ctx.createAnalyser();
      me.an.fftSize = 512;
      me.ctx.createMediaStreamSource(stream).connect(me.an);
      me.data = new Uint8Array(me.an.fftSize);
      if (me.ctx.state === 'suspended' && typeof me.ctx.resume === 'function') me.ctx.resume().catch(() => {});
    }
  } catch { me.ctx = null; me.an = null; }
  try { rec.start(250); } catch { ivMicStop(false); notify('Recording could not start. Typing your answer works just as well.'); ivMicPaint(); return; }
  me.limit = setTimeout(() => { if (ivMic === me && me.live) { ivMicStop(true); ivMicPaint(); } }, 180000);
  let lastPaint = 0;
  const tick = (now) => {
    if (ivMic !== me || !me.live) return;
    if (me.an) {
      me.an.getByteTimeDomainData(me.data);
      let sum = 0;
      for (let k = 0; k < me.data.length; k++) { const v = (me.data[k] - 128) / 128; sum += v * v; }
      const rms = Math.sqrt(sum / me.data.length);
      try { window.NextStepOrb?.level?.(Math.min(1, Math.max(0, (rms - 0.015) * 6))); } catch { /* optional */ }
    }
    if (now - lastPaint > 250) { lastPaint = now; ivMicPaint(); }
    requestAnimationFrame(tick);
  };
  ivMicPaint();
  requestAnimationFrame(tick);
}
function ivBindMic() {
  const root = document.getElementById('app');
  const box = root && root.querySelector('#iv-mic');
  if (!box || !ivMicOK()) return;
  box.hidden = false;
  root.querySelector('#iv-mic-btn').addEventListener('click', () => {
    if (ivMic && ivMic.live) { ivMicStop(true); ivMicPaint(); }
    else ivMicStart();
  });
  root.querySelector('#iv-mic-del').addEventListener('click', () => { ivMicStop(false); ivMicPaint(); root.querySelector('#iv-mic-btn')?.focus(); });
}

/* ---------- wiring ---------- */

function ivPaintMeter(text) {
  const live = ivLive(text);
  const wc = document.querySelector('#app #word-count');
  const count = ivWords(live.words) + (live.words ? ' · ' + ivSpoken(live.seconds) + ' to say' : '');
  if (wc && wc.textContent !== count) wc.textContent = count;
  if (!live.star) return;
  document.querySelectorAll('#app .iv-part').forEach((b) => {
    const on = !!live.star[b.dataset.star];
    if (b.classList.contains('on') === on) return;
    b.classList.toggle('on', on);
    const vh = b.querySelector('.iv-vh');
    if (vh) vh.textContent = on ? ', in your answer' : '';
  });
}
function ivRevealQuestion() {
  const q = document.querySelector('#app .iv-q.iv-reveal');
  if (!q) return;
  let t = 0.3;
  q.querySelectorAll('.iv-w').forEach((w) => {
    w.style.animationDelay = t.toFixed(3) + 's';
    const s = w.textContent;
    t += 0.06 + (/[.?!][”"’)]*$/.test(s) ? 0.24 : /[,;:][”"’)]*$/.test(s) ? 0.1 : 0);
  });
}
function ivFocusTitle() {
  const h = document.querySelector('#app .iv-focus');
  if (h) { try { h.focus({ preventScroll: true }); } catch { /* focus is a nicety */ } }
}
binders.feedback = ivFocusTitle;
binders.mock = () => {
  const p = active;
  if (!p) return;
  const root = document.getElementById('app');
  ivFocusTitle();
  const box = root.querySelector('#mock-answer');
  if (!p.mock.finished && box) {
    const question = p.questions[p.mock.index];
    const at = p.mock.index;
    ivRevealQuestion();
    ivBindSpeech(question);
    ivBindMic();
    let pending = 0;
    box.addEventListener('input', () => {
      active.mock.draft = box.value;
      const ok = save();
      const line = root.querySelector('#save-line');
      const said = ok ? 'Draft saved. Resume anytime.' : 'Not saved yet. Export a backup before leaving.';
      if (line && line.lastElementChild.textContent !== said) line.lastElementChild.textContent = said;
      if (!pending) pending = requestAnimationFrame(() => { pending = 0; ivPaintMeter(box.value); });
    });
    root.querySelector('#submit-answer').addEventListener('click', () => {
      /* A handler from a screen that is already gone (double tap) must not save twice. */
      if (!box.isConnected || active !== p || p.mock.finished || p.mock.index !== at) return;
      const text = box.value.trim();
      if (text.length < 20) { notify('Add a few more words first, so there is an answer to look at.'); box.focus(); return; }
      const m = active.mock;
      const k = m.index;
      const r = ivReview(active, k, text, question);
      ivStopSpeech();
      ivMicStop(false);
      m.answers.push({ question, text, feedback: r ? 'Structure checklist: ' + r.summary + '.' : feedback(text), at: new Date().toISOString(), review: ivSnapOf(r, text) });
      m.draft = '';
      m.index = m.answers.length;
      m.finished = m.index >= active.questions.length;
      save();
      lastFeedback = { at: k, count: m.answers.length, total: active.questions.length, finished: m.finished, review: r };
      show('feedback');
      if (m.finished) { try { window.NextStepOrb?.celebrate?.(); } catch { /* optional orb hook */ } }
    });
    root.querySelectorAll('[data-star]').forEach((el) => el.addEventListener('click', () => {
      ivPart = el.dataset.star;
      const part = IV_PARTS.find((x) => x.id === ivPart) || IV_PARTS[2];
      root.querySelectorAll('[data-star]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.star === ivPart)));
      const hint = root.querySelector('#star-hint');
      if (hint) hint.innerHTML = `<strong>${part.name}:</strong> ${esc(part.tip)}`;
    }));
  }
  const restart = root.querySelector('#restart');
  if (restart) restart.addEventListener('click', () => {
    if (confirm("Start a new round? This round's answers will be cleared, including stories your Interview day page uses. Answer bank notes stay. Export a backup first to keep them.")) {
      active.mock = { index: 0, answers: [], draft: '', finished: false };
      lastFeedback = null;
      save();
      show('mock');
    }
  });
};
Object.assign(actions, { 'open-mock': openMock, 'lesson-practise': openMock, 'feedback-next': openMock });
