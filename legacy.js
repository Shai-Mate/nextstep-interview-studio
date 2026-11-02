import { esc } from './ui.js?v=3';
import { v2Feedback } from './shared/v2-feedback.js?v=3';

const tabs = ['Overview', 'Study', 'Answer bank', 'Quiz', 'Mock interview', 'Role map'];
const quizItems = [
  { q: 'Which answer best demonstrates a job requirement?', options: ['A confident claim with no example', 'A true example with your action and a clear outcome', 'Someone else’s experience presented as yours'], correct: 1, why: 'Specific, truthful evidence is more useful than polished claims.' },
  { q: 'The job ad says: “{req}”. What should you prepare?', options: ['A relevant example and a question about success', 'An unrelated memorized speech', 'An invented company policy'], correct: 0, why: 'Connect your own evidence to the exact requirement and clarify what success means.' },
  { q: 'You have not done part of this role before. What is the strongest approach?', options: ['Pretend you have', 'Avoid the topic entirely', 'Be honest, connect transferable skills and explain how you would learn'], correct: 2, why: 'An honest gap plus a credible learning plan protects your integrity and shows judgment.' }
];

let ctx = null;
let tab = 'Overview';

function record() {
  return ctx.record;
}

function bind(action, fn) {
  document.querySelectorAll(`[data-action="${action}"]`).forEach(el => el.addEventListener('click', () => fn(el)));
}

function bindNotes() {
  document.querySelectorAll('[data-note]').forEach(el => {
    el.oninput = () => {
      record().notes[el.dataset.note] = el.value;
      ctx.save();
    };
  });
}

export function renderLegacy(next, hooks) {
  ctx = { ...hooks, record: next };
  tab = hooks.tab || 'Overview';
  paint();
}

function paint() {
  const prep = record();
  const root = document.querySelector('#app');
  root.innerHTML = `<section class="prep-heading"><p class="eyebrow">${esc(prep.company)} / ${esc(prep.intake?.stage)} · v2 rules practice</p><h1>${esc(prep.role)}</h1><p>Your evidence. Your words. One opportunity at a time. This preparation stays on the original rules-based plan.</p><div class="actions"><button id="export">Export backup</button><button id="rename">Rename</button><span class="muted">${esc(prep.intake?.time)} today · local save</span></div></section><nav class="tabs" aria-label="Preparation sections">${tabs.map(name => `<button data-action="tab" data-tab="${name}" ${name === tab ? 'aria-current="page"' : ''}>${name}</button>`).join('')}</nav><section id="content"></section>`;
  bind('tab', el => {
    tab = el.dataset.tab;
    ctx.tab = tab;
    paint();
  });
  document.querySelector('#export').onclick = () => ctx.exportOne();
  document.querySelector('#rename').onclick = () => {
    const name = prompt('Job title for this preparation', prep.role);
    if (name?.trim()) {
      prep.role = name.trim().slice(0, 120);
      ctx.save();
      paint();
    }
  };
  ({ Overview: overview, Study: study, 'Answer bank': answers, Quiz: quiz, 'Mock interview': mock, 'Role map': rolemap })[tab]();
}

function overview() {
  const prep = record();
  const budget = parseInt(prep.intake?.time, 10) || 30;
  const picks = prep.course.slice(0, Math.max(1, Math.floor(budget / 5)));
  document.querySelector('#content').innerHTML = `<div class="grid"><article class="card"><p class="eyebrow">YOUR ROUTE TO READY</p><h2>A focused plan, not a script.</h2>${tabs.slice(1).map((name, index) => `<button class="route" data-action="goto" data-tab="${name}"><span>0${index + 1}</span><strong>${name}</strong><span>→</span></button>`).join('')}</article><article class="card"><p class="eyebrow">TODAY’S ${budget}-MINUTE FOCUS</p><h2>Small steps. Real evidence.</h2><p>${esc(prep.intake?.focus)} · ${esc(prep.intake?.experience)}</p><ol>${picks.map(item => `<li>${esc(item.title)}</li>`).join('')}</ol><progress max="${prep.course.length}" value="${prep.course.filter(item => item.done).length}"></progress><p>${prep.course.filter(item => item.done).length} of ${prep.course.length} lessons complete</p></article></div><article class="card"><h3>What this preparation is based on</h3><p>Only your supplied job ad and quick setup. It does not verify company claims or candidate qualifications. This is the v2 rules practice and it was not rebuilt as a v3 role pack.</p><details><summary>Review original job ad</summary><pre>${esc(prep.job)}</pre></details></article>`;
  bind('goto', el => {
    tab = el.dataset.tab;
    paint();
  });
}

function study() {
  const prep = record();
  document.querySelector('#content').innerHTML = `<p class="eyebrow">LEARN / APPLY / RECALL</p><h2>Build understanding before answers.</h2>${prep.course.map((item, index) => `<details class="card lesson" ${index === 0 ? 'open' : ''}><summary>${item.done ? '✓' : '○'} ${esc(item.title)} <small>~${item.minutes} min</small></summary><p class="preline">${esc(item.body)}</p><div class="exercise"><strong>Try it</strong><p>${esc(item.exercise)}</p></div><label>Your working notes<textarea rows="4" data-note="lesson-${index}">${esc(prep.notes['lesson-' + index] || '')}</textarea></label><button data-action="done" data-index="${index}">${item.done ? 'Mark incomplete' : 'Mark complete'}</button></details>`).join('')}`;
  bindNotes();
  bind('done', el => {
    const item = prep.course[+el.dataset.index];
    item.done = !item.done;
    ctx.save();
    study();
  });
}

function answers() {
  const prep = record();
  document.querySelector('#content').innerHTML = `<p class="eyebrow">MAKE IT YOURS</p><h2>Your answer bank.</h2><p>Use true examples. A gap is something to prepare for, not something to fabricate. Notes save as you type.</p>${prep.questions.map((question, index) => `<details class="card" ${index === 0 ? 'open' : ''}><summary>${esc(question)}</summary><p class="muted">Situation, task, your action, result, what you learned</p><label>Your evidence and answer<textarea rows="6" data-note="answer-${index}" placeholder="Describe something you actually did…">${esc(prep.notes['answer-' + index] || '')}</textarea></label></details>`).join('')}`;
  bindNotes();
}

function quiz() {
  const prep = record();
  document.querySelector('#content').innerHTML = `<p class="eyebrow">RECALL / REFINE</p><h2>Check your approach.</h2><p>This checks interview technique, not technical certification or hiring readiness. v2 keeps the same three questions for every job.</p>${quizItems.map((item, index) => `<article class="card"><h3>${index + 1}. ${esc(item.q.replace('{req}', prep.requirements?.[0] || ''))}</h3><div class="choices vertical">${item.options.map((option, choice) => `<button data-action="quiz" data-q="${index}" data-choice="${choice}" ${prep.quiz.answers[index] !== undefined ? 'disabled' : ''}>${esc(option)}</button>`).join('')}</div>${prep.quiz.answers[index] !== undefined ? `<p>${prep.quiz.answers[index] === item.correct ? 'Correct.' : 'Try a different approach next time.'} ${esc(item.why)}</p>` : ''}</article>`).join('')}<button id="retry">Retry quiz</button>`;
  bind('quiz', el => {
    prep.quiz.answers[el.dataset.q] = +el.dataset.choice;
    ctx.save();
    quiz();
  });
  document.querySelector('#retry').onclick = () => {
    prep.quiz.answers = {};
    ctx.save();
    quiz();
  };
}

function mock() {
  const prep = record();
  const session = prep.mock;
  document.querySelector('#content').innerHTML = `<p class="eyebrow">PRACTISE / PAUSE / PICK UP AGAIN</p><h2>Mock interview.</h2><p>Text practice with a local structure checklist, not a role grade. This v2 round does not score competencies.</p>${session.finished ? `<article class="card"><h3>Session complete.</h3><p>${session.answers.length} answers saved. Review your evidence and refine one answer before the real conversation.</p><button id="restart">Start another round</button></article>` : `<article class="card"><p class="eyebrow">QUESTION ${session.index + 1} OF ${prep.questions.length}</p><h3>${esc(prep.questions[session.index])}</h3><label>Your answer<textarea id="mock-answer" rows="8" placeholder="Use a real example. What did you do, what happened, and what did you learn?">${esc(session.draft)}</textarea></label><p class="muted">Draft auto-saves. You can leave and resume this exact question.</p><button class="primary" id="submit-answer">Save answer and continue</button></article>`}<h3>Session log</h3>${session.answers.map((answer, index) => `<details class="card"><summary>${index + 1}. ${esc(answer.question)}</summary><p class="preline">${esc(answer.text)}</p><p class="feedback">${esc(answer.feedback)}</p></details>`).join('') || '<p class="muted">Your saved answers will appear here.</p>'}`;
  if (!session.finished) {
    document.querySelector('#mock-answer').oninput = event => {
      session.draft = event.target.value;
      ctx.save();
    };
    document.querySelector('#submit-answer').onclick = () => {
      const text = document.querySelector('#mock-answer').value.trim();
      if (text.length < 20) {
        ctx.notify('Add at least 20 characters so you have an answer to review.');
        return;
      }
      session.answers.push({ question: prep.questions[session.index], text, feedback: v2Feedback(text), at: new Date().toISOString() });
      session.draft = '';
      session.index += 1;
      session.finished = session.index >= prep.questions.length;
      ctx.save();
      ctx.notify('Answer saved. Structure feedback is a writing checklist, not a hiring score.');
      mock();
    };
  } else {
    document.querySelector('#restart').onclick = () => {
      if (confirm('Start another round? Export first to keep the current mock log.')) {
        prep.mock = { index: 0, answers: [], draft: '', finished: false };
        ctx.save();
        mock();
      }
    };
  }
}

function rolemap() {
  const prep = record();
  document.querySelector('#content').innerHTML = `<p class="eyebrow">FROM THE AD / NOT ASSUMPTIONS</p><h2>Map the role to your evidence.</h2><p>These are excerpts, not verified facts about the employer. Confirm the priorities with your interviewer.</p>${(prep.requirements || []).map((requirement, index) => `<article class="card"><p class="eyebrow">AD EXCERPT ${index + 1}</p><blockquote>${esc(requirement)}</blockquote><label>Your transferable evidence or gaps<textarea data-note="map-${index}" rows="3">${esc(prep.notes['map-' + index] || '')}</textarea></label><p class="muted">Ask: What would good performance on this look like in the first 90 days?</p></article>`).join('')}`;
  bindNotes();
}
