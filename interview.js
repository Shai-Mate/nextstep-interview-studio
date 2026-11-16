'use strict';
/* Mock interview: question, answer, structure feedback, session log.
   Classic script loaded after app.js; shares app.js top-level globals.
   Keep a global feedback(text) -> string: app.js import uses it to rebuild mock logs. */

const STAR = {
  Situation: 'Where and when. Set the scene with a real example.',
  Task: 'What was needed from you.',
  Action: 'What you personally did. Say I, and keep it specific.',
  Result: 'What changed, or what you learned.'
};
let star = 'Action';
let lastFeedback = null;
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
function logHtml(m) {
  if (!m.answers.length) return '';
  return `<h2 class="log-title">Session log</h2>${m.answers.map((a, i) => `<details class="block"><summary>${i + 1}. ${esc(a.question)}</summary><p class="prose">${esc(a.text)}</p><p class="feedback">${esc(a.feedback)}</p></details>`).join('')}`;
}

function openMock() { if (!needPrep()) return; show('mock'); }
Object.assign(screens, {
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
      <p class="italic ask-line">The interviewer asks</p>
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
  }
});
binders.mock = () => {
  if (active && !active.mock.finished) {
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
};
Object.assign(actions, { 'open-mock': openMock, 'lesson-practise': openMock, 'feedback-next': openMock });
