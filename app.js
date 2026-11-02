import { esc, radios, downloadJson, seniorityLabel } from './ui.js?v=3';
import { extractJob, planJob, roleplayTurn, gradeJob, looksLikeUrl, getApiBase, setApiBase, serviceConnected, packs } from './api.js?v=3';
import { extractUpload } from './files.js?v=3';
import { renderLegacy } from './legacy.js?v=3';
import { onboardingQuestions } from './shared/onboarding.js?v=3';
import { basisLabel } from './shared/plan-path.js?v=3';
import { parseStore } from './shared/records.js?v=3';
import { exportEnvelope, importBackup } from './shared/backup.js?v=3';

const KEY = 'nextstep.preparations.v1';
const $ = selector => document.querySelector(selector);

let records = [];
let active = null;
let tab = 'Overview';
let draft = null;
let storageOK = true;
let chosenFile = null;

const loaded = parseStore(localStorage.getItem(KEY));
if (!loaded.ok) {
  storageOK = false;
  records = [];
} else {
  records = loaded.records;
}

function notify(text) {
  $('#status').textContent = text || '';
}

function persist() {
  if (!storageOK) {
    notify('Storage unavailable. Existing saved data was not overwritten. Export a backup before leaving.');
    return false;
  }
  try {
    localStorage.setItem(KEY, JSON.stringify(records));
    return true;
  } catch {
    notify('Could not save: browser storage is full or unavailable. Export a backup before leaving.');
    return false;
  }
}

function save() {
  if (active) active.updated = new Date().toISOString();
  return persist();
}

function uid() {
  return crypto.randomUUID?.() || `prep-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function bind(action, fn) {
  document.querySelectorAll(`[data-action="${action}"]`).forEach(el => el.addEventListener('click', () => fn(el)));
}

function exportOne(list) {
  downloadJson('nextstep-backup.json', exportEnvelope(list));
  notify('Backup exported. It includes your job text, notes and answers. Keep it private.');
}

function library() {
  active = null;
  draft = null;
  chosenFile = null;
  notify(storageOK ? '' : 'Storage recovery needed: existing data will not be overwritten.');
  const connected = serviceConnected();
  $('#app').innerHTML = `<section class="hero"><div><p class="eyebrow">YOUR NEXT CHAPTER STARTS HERE</p><h1>Show up ready.<br><em>Sound like yourself.</em></h1><p>Paste a job link or the job ad. You can attach a file. Answer a few choices, then practice the course, a role-play, and a grade.</p><button class="primary" id="new">New preparation</button></div><div class="hero-art" aria-hidden="true"><div class="orbit"></div><span>ONE ROLE.<br>ONE CLEAR<br>PLAN.</span><small>STUDY, PRACTISE, REFINE</small></div></section><div class="section-title"><h2>Your preparations</h2><span>${records.length} saved locally</span></div><div class="grid">${records.map(card).join('') || '<article class="card empty"><h3>A clean slate, just for you.</h3><p>No sample identities or private answers. Add a job, or open a saved practice pack.</p></article>'}</div><p class="muted">${connected ? 'A preparation service is connected. Job text you submit is sent only to that address.' : 'No preparation service connected. Saved practice packs run on this device. v2 preparations still open.'}</p>`;
  $('#new').onclick = () => inputScreen();
  bind('resume', el => openRecord(el.dataset.id));
}

function card(prep) {
  if (prep.schema === 1) {
    const done = prep.course.filter(item => item.done).length;
    return `<article class="card"><p class="eyebrow">v2 rules practice</p><h3>${esc(prep.role)}</h3><p>${esc(prep.company)} · ${esc(prep.intake?.stage)}</p><progress max="${prep.course.length}" value="${done}"></progress><p>${done}/${prep.course.length} lessons · mock ${prep.mock.finished ? 'complete' : `${prep.mock.index}/${prep.questions.length}`}</p><button data-action="resume" data-id="${esc(prep.id)}">Resume preparation</button></article>`;
  }
  const lessons = prep.plan?.lessons || [];
  const done = lessons.filter(item => prep.courseDone?.[item.id]).length;
  return `<article class="card"><p class="eyebrow">v3 role practice</p><h3>${esc(prep.profile.title)}</h3><p>${esc(prep.profile.company)} · ${prep.plan ? `${done}/${lessons.length} lessons` : 'Questions not finished'}</p>${lessons.length ? `<progress max="${lessons.length}" value="${done}"></progress>` : ''}<button data-action="resume" data-id="${esc(prep.id)}">Resume preparation</button></article>`;
}

function openRecord(id) {
  active = records.find(item => item.id === id) || null;
  if (!active) return library();
  tab = 'Overview';
  if (active.schema === 1) {
    renderLegacy(active, { notify, save, exportOne: () => exportOne([active]), tab });
    return;
  }
  if (!active.plan) return questions();
  render();
}

function inputScreen() {
  active = null;
  $('#app').innerHTML = `<div class="narrow"><p class="eyebrow">01 / THE JOB</p><h1>What job are you preparing for?</h1><p>Paste a link or the job ad. You can also attach a PDF, Word, or text file. One of those is enough.</p><form id="job-form"><label>Job link or job ad<textarea id="job-input" rows="8" maxlength="60000" placeholder="https://… or the job description"></textarea></label><div class="actions"><label class="file-button">Attach a file<input id="file" type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"></label><button class="primary" id="analyze" type="submit">Analyze this job</button></div><p id="file-name" class="muted"></p><p class="muted" id="mode-note">${serviceConnected() ? 'A preparation service is connected. The link or text is sent there to read the job.' : 'No preparation service connected. A link or pasted ad opens a saved practice pack only when it matches one.'}</p></form><h2>Saved practice packs</h2><p>These three packs are on this device. They are here so you can practice without a service, and so different jobs stay different.</p><div class="actions vertical">${packs.map(pack => `<button data-action="pack" data-pack="${esc(pack.id)}">${esc(pack.title)}</button>`).join('')}</div></div>`;
  $('#file').onchange = () => {
    chosenFile = $('#file').files[0] || null;
    $('#file-name').textContent = chosenFile ? chosenFile.name : '';
  };
  $('#job-form').onsubmit = event => {
    event.preventDefault();
    analyze();
  };
  bind('pack', el => analyzePack(el.dataset.pack));
}

async function analyze() {
  const raw = $('#job-input').value.trim();
  notify('Reading the job…');
  try {
    let input;
    if (chosenFile) {
      const text = await extractUpload(chosenFile);
      input = { source: 'file', filename: chosenFile.name.slice(0, 80), text };
    } else if (looksLikeUrl(raw)) {
      input = { source: 'url', url: raw };
    } else if (raw.length >= 40) {
      input = { source: 'text', text: raw };
    } else {
      notify('Paste a job link, at least a short job ad, or attach a file.');
      return;
    }
    const result = await extractJob(input);
    startDraft(result);
  } catch (error) {
    notify(error.message || 'That job could not be read.');
  }
}

async function analyzePack(packId) {
  notify('');
  try {
    const result = await extractJob({ source: 'pack', packId });
    startDraft(result);
  } catch (error) {
    notify(error.message || 'That pack could not be opened.');
  }
}

function startDraft(result) {
  draft = {
    profile: result.profile,
    sourceText: result.text || '',
    mode: result.mode,
    packId: result.packId,
    banner: result.banner,
    answers: {}
  };
  notify('');
  questions();
}

function questions() {
  const profile = draft?.profile || active?.profile;
  if (!profile) return inputScreen();
  const questionsForRole = onboardingQuestions(profile);
  const selected = draft?.answers || active?.onboardingAnswers || {};
  const fallback = { weak: 'unsure', experience: 'prefer-not', stage: 'unsure', time: '30' };
  $('#app').innerHTML = `<div class="narrow"><p class="eyebrow">02 / MAKE IT FIT</p><h1>A few choices for this role.</h1><p class="banner">${esc(draft?.banner || active?.banner || '')}</p><p><strong>${esc(profile.title)}</strong> at ${esc(profile.company)}. ${esc(seniorityLabel(profile.seniority))}.</p><form id="onboarding">${questionsForRole.map(question => `<fieldset><legend>${esc(question.prompt)}</legend>${radios(question.id, question.options, selected[question.id] || fallback[question.id] || question.options[0].value)}</fieldset>`).join('')}<div class="actions"><button type="button" id="back-input">Back</button><button class="primary" id="build" type="submit">Build my practice</button></div></form></div>`;
  $('#back-input').onclick = () => inputScreen();
  $('#onboarding').onsubmit = event => {
    event.preventDefault();
    const data = new FormData(event.target);
    const answers = {};
    for (const question of questionsForRole) {
      const value = data.get(question.id);
      if (!value) {
        notify('Choose an answer for each question.');
        return;
      }
      answers[question.id] = String(value);
    }
    if (!answers.tool) answers.tool = null;
    build(profile, answers);
  };
}

async function build(profile, answers) {
  notify('Building the practice from this role…');
  try {
    const plan = await planJob(profile, answers);
    const now = new Date().toISOString();
    if (!active || active.profile !== profile) {
      active = {
        schema: 2,
        engineVersion: 3,
        id: uid(),
        created: now,
        updated: now,
        mode: draft?.mode || 'pack',
        packId: draft?.packId || null,
        banner: draft?.banner || '',
        profile,
        sourceText: draft?.sourceText || '',
        onboardingAnswers: answers,
        plan,
        notes: {},
        quiz: { answers: {} },
        roleplay: { scenarioId: plan.scenarios[0]?.id || null, messages: [], draft: '' },
        grade: null,
        courseDone: {}
      };
      records.unshift(active);
    } else {
      active.onboardingAnswers = answers;
      active.plan = plan;
      active.quiz = { answers: {} };
      active.roleplay = { scenarioId: plan.scenarios[0]?.id || null, messages: [], draft: '' };
      active.grade = null;
    }
    draft = null;
    tab = 'Overview';
    save();
    notify(active.mode === 'pack' ? 'Practice pack ready on this device.' : 'Practice ready. It was checked against the job text.');
    render();
  } catch (error) {
    notify(error.message || 'The practice could not be built.');
  }
}

const v3Tabs = ['Overview', 'Study', 'Quiz', 'Role-play', 'Grade', 'Role map'];

function render() {
  const prep = active;
  $('#app').innerHTML = `<section class="prep-heading"><p class="eyebrow">${esc(prep.profile.company)} · v3 role practice</p><h1>${esc(prep.profile.title)}</h1><p>${esc(prep.banner)}</p><div class="actions"><button id="export">Export backup</button><button id="retune">Change my choices</button><span class="muted">${esc(prep.plan.answers?.time || '')} min path · local save</span></div></section><nav class="tabs" aria-label="Preparation sections">${v3Tabs.map(name => `<button data-action="tab" data-tab="${name}" ${name === tab ? 'aria-current="page"' : ''}>${name}</button>`).join('')}</nav><section id="content"></section>`;
  bind('tab', el => {
    tab = el.dataset.tab;
    render();
  });
  $('#export').onclick = () => exportOne([prep]);
  $('#retune').onclick = () => {
    draft = { profile: prep.profile, sourceText: prep.sourceText, mode: prep.mode, packId: prep.packId, banner: prep.banner, answers: prep.onboardingAnswers };
    questions();
  };
  ({ Overview: overview, Study: study, Quiz: quiz, 'Role-play': roleplay, Grade: grade, 'Role map': rolemap })[tab]();
}

function overview() {
  const prep = active;
  const lessons = prep.plan.lessons;
  const done = lessons.filter(item => prep.courseDone?.[item.id]).length;
  $('#content').innerHTML = `<div class="grid"><article class="card"><p class="eyebrow">THIS ROLE</p><h2>${esc(prep.profile.roleFamily)}</h2><p>${esc(seniorityLabel(prep.profile.seniority))}. ${esc(prep.profile.workArrangement || '')} ${esc(prep.profile.location || '')}</p>${prep.plan.assumedTool ? `<p>Examples assume <strong>${esc(prep.plan.assumedTool)}</strong>, because you chose it.</p>` : ''}<p>${esc(prep.profile.generalGuidanceNotClaimedAsEmployerPolicy?.[0] || '')}</p></article><article class="card"><p class="eyebrow">TODAY</p><h2>Your path for this sitting</h2><ol>${lessons.map(item => `<li>${esc(item.title)}</li>`).join('')}</ol><progress max="${lessons.length}" value="${done}"></progress><p>${done} of ${lessons.length} lessons marked done</p></article></div><article class="card"><h3>What was read</h3><p>Facts tied to the ad stay with a competency. General practice notes are labeled. This is not a prediction of the interview.</p><details><summary>Review the text this pack or service used</summary><pre>${esc(prep.sourceText || '')}</pre></details></article>`;
}

function study() {
  const prep = active;
  $('#content').innerHTML = `<p class="eyebrow">THE WORK OF THIS ROLE</p><h2>Lessons for ${esc(prep.profile.title)}</h2>${prep.plan.lessons.map((item, index) => `<details class="card lesson" ${index === 0 ? 'open' : ''}><summary>${prep.courseDone?.[item.id] ? 'Done' : 'Open'} · ${esc(item.title)} <small>~${item.minutes} min</small></summary><p class="badge">${esc(basisLabel(item))}</p><p><strong>Aim:</strong> ${esc(item.objective)}</p><p class="preline">${esc(item.body)}</p>${item.adClaims?.[0] ? `<blockquote>${esc(item.adClaims[0])}</blockquote>` : ''}<div class="exercise"><strong>A concrete example</strong><p>${esc(item.example)}</p><strong>Try it</strong><p>${esc(item.exercise)}</p></div><label>Your notes<textarea rows="4" data-note="lesson-${item.id}">${esc(prep.notes['lesson-' + item.id] || '')}</textarea></label><button data-action="done" data-id="${esc(item.id)}">${prep.courseDone?.[item.id] ? 'Mark not done' : 'Mark done'}</button></details>`).join('')}`;
  document.querySelectorAll('[data-note]').forEach(el => {
    el.oninput = () => {
      prep.notes[el.dataset.note] = el.value;
      save();
    };
  });
  bind('done', el => {
    prep.courseDone[el.dataset.id] = !prep.courseDone[el.dataset.id];
    save();
    study();
  });
}

function quiz() {
  const prep = active;
  $('#content').innerHTML = `<p class="eyebrow">CHECK THE ROLE, NOT A GENERIC SCRIPT</p><h2>Questions for this job</h2><p>Wrong answers are plausible. This is practice, not a certificate and not the employer’s question list.</p>${prep.plan.quiz.map((item, index) => `<article class="card"><h3>${index + 1}. ${esc(item.question)}</h3><div class="choices vertical">${item.options.map((option, choice) => `<button data-action="quiz" data-q="${esc(item.id)}" data-choice="${choice}" ${prep.quiz.answers[item.id] !== undefined ? 'disabled' : ''}>${esc(option)}</button>`).join('')}</div>${prep.quiz.answers[item.id] !== undefined ? `<p>${prep.quiz.answers[item.id] === item.correctIndex ? 'That matches the role.' : 'Not that one.'} ${esc(item.why)}</p>` : ''}</article>`).join('')}<button id="retry">Retry quiz</button>`;
  bind('quiz', el => {
    prep.quiz.answers[el.dataset.q] = +el.dataset.choice;
    save();
    quiz();
  });
  $('#retry').onclick = () => {
    prep.quiz.answers = {};
    save();
    quiz();
  };
}

function currentScenario(prep) {
  return prep.plan.scenarios.find(item => item.id === prep.roleplay.scenarioId) || prep.plan.scenarios[0];
}

function roleplay() {
  const prep = active;
  const scenario = currentScenario(prep);
  if (!scenario) {
    $('#content').innerHTML = '<p>This path has no practice scene.</p>';
    return;
  }
  const messages = prep.roleplay.messages.length ? prep.roleplay.messages : [{ role: 'interviewer', content: scenario.opening }];
  $('#content').innerHTML = `<p class="eyebrow">PRACTICE CONVERSATION</p><h2>Role-play</h2><p>The interviewer stays on this scene. It is practice, not a prediction of their questions.</p><div class="actions">${prep.plan.scenarios.map(item => `<button data-action="scene" data-id="${esc(item.id)}" ${item.id === scenario.id ? 'aria-current="page"' : ''}>${esc(item.competencyId)}</button>`).join('')}</div><div class="chat" id="chat">${messages.map(message => `<p class="bubble ${message.role === 'candidate' ? 'candidate' : 'interviewer'}"><strong>${message.role === 'candidate' ? 'You' : 'Interviewer'}</strong><br>${esc(message.content)}</p>`).join('')}</div><label>Your reply<textarea id="roleplay-answer" rows="6" placeholder="Say what you would actually do.">${esc(prep.roleplay.draft || '')}</textarea></label><div class="actions"><button class="primary" id="send-turn">Send</button><button id="grade-answer" type="button">Grade this answer</button></div>`;
  bind('scene', el => {
    prep.roleplay.scenarioId = el.dataset.id;
    prep.roleplay.messages = [];
    prep.roleplay.draft = '';
    save();
    roleplay();
  });
  $('#roleplay-answer').oninput = event => {
    prep.roleplay.draft = event.target.value;
    save();
  };
  $('#send-turn').onclick = () => sendTurn(scenario);
  $('#grade-answer').onclick = () => gradeLatest(scenario);
}

async function sendTurn(scenario) {
  const prep = active;
  const text = $('#roleplay-answer').value.trim();
  if (text.length < 20) {
    notify('Add at least 20 characters so there is an answer to follow up on.');
    return;
  }
  if (!prep.roleplay.messages.length) prep.roleplay.messages.push({ role: 'interviewer', content: scenario.opening });
  prep.roleplay.messages.push({ role: 'candidate', content: text });
  prep.roleplay.draft = '';
  save();
  notify('Asking a follow-up…');
  try {
    const turn = await roleplayTurn(prep.profile, scenario, prep.roleplay.messages);
    prep.roleplay.messages.push({ role: 'interviewer', content: turn.question });
    save();
    notify('');
    roleplay();
  } catch (error) {
    prep.roleplay.messages.pop();
    save();
    notify(error.message || 'No follow-up was saved.');
    roleplay();
  }
}

async function gradeLatest(scenario) {
  const prep = active;
  const answer = [...prep.roleplay.messages].reverse().find(message => message.role === 'candidate')?.content || $('#roleplay-answer')?.value?.trim();
  if (!answer || answer.length < 20) {
    notify('Send an answer before asking for a grade.');
    return;
  }
  notify('Grading against this competency…');
  try {
    prep.grade = await gradeJob(prep.profile, scenario.competencyId, answer, scenario.opening);
    prep.grade.question = scenario.opening;
    save();
    tab = 'Grade';
    notify('Grade saved on this device. It is practice feedback, not a hiring decision.');
    render();
  } catch (error) {
    notify(error.message || 'No grade was saved.');
  }
}

function grade() {
  const prep = active;
  const report = prep.grade;
  if (!report) {
    $('#content').innerHTML = '<article class="card"><h2>No grade yet</h2><p>Answer a role-play scene, then ask for a grade. The score uses your words and the competency from the ad.</p></article>';
    return;
  }
  $('#content').innerHTML = `<p class="eyebrow">PRACTICE GRADE</p><h2>How this answer sits against the role</h2><p>${esc(report.overallNote || 'Practice feedback, not a hiring decision.')}</p>${(report.competencies || []).map(item => `<article class="card"><p class="eyebrow">${esc(item.competencyId)}</p><p class="score">${esc(item.score)}<span> / ${esc(item.max || 4)}</span></p><blockquote>${esc(item.evidenceQuote || '')}</blockquote><p class="feedback">${esc(item.feedback)}</p></article>`).join('')}`;
}

function rolemap() {
  const prep = active;
  const rows = prep.plan.roleMap?.length ? prep.plan.roleMap : prep.profile.competencies.map(item => ({ competencyId: item.id, evidence: item.evidence, objective: item.learningObjective, priority: item.priority }));
  $('#content').innerHTML = `<p class="eyebrow">FROM THE AD</p><h2>Competencies and your evidence</h2><p>Each row is a competency from the role profile. The quote is from the ad, not a guess about the employer.</p>${rows.map(item => `<article class="card"><p class="eyebrow">${esc(item.priority || 'core')} · ${esc(item.competencyId)}</p><blockquote>${esc(item.evidence)}</blockquote><p>${esc(item.objective || '')}</p><label>Your evidence or gap<textarea data-note="map-${item.competencyId}" rows="3">${esc(prep.notes['map-' + item.competencyId] || '')}</textarea></label></article>`).join('')}`;
  document.querySelectorAll('[data-note]').forEach(el => {
    el.oninput = () => {
      prep.notes[el.dataset.note] = el.value;
      save();
    };
  });
}

function privacy() {
  active = null;
  $('#app').innerHTML = `<div class="narrow"><p class="eyebrow">YOUR DATA</p><h1>What stays here</h1><p>Preparations, notes, and answers stay in this browser. If you save a preparation service address, the job text and the answers you submit are sent only to that address. Nothing is sent when the address is empty.</p><p>Storage is not encrypted. Anyone who can open this browser profile can read it. Exports contain your answers. Keep them private.</p><p>v2 preparations stay v2. They are not rewritten into v3. Imports are added as separate copies.</p><label>Preparation service address<input id="api-base" type="url" placeholder="https://your-name.workers.dev" value="${esc(getApiBase())}"></label><button id="save-api" type="button">Save service address</button><p class="muted">Leave this empty to use saved practice packs only. Sign in to Cloudflare and run wrangler deploy yourself before you paste an address. This app does not deploy anything.</p><button id="all-export">Export all preparations</button><h2>Restore a backup</h2><label>Backup JSON file<input id="import" type="file" accept="application/json,.json"></label><p class="muted">App v3 · v2 storage still loads · role practice is schema 2</p></div>`;
  $('#save-api').onclick = () => {
    try {
      const saved = setApiBase($('#api-base').value);
      notify(saved ? 'Preparation service saved on this device.' : 'Preparation service cleared. Saved packs stay on this device.');
      privacy();
    } catch (error) {
      notify(error.message);
    }
  };
  $('#all-export').onclick = () => exportOne(records);
  $('#import').onchange = async event => {
    try {
      const file = event.target.files[0];
      if (!file) return;
      if (file.size > 2_000_000) throw new Error('Backup exceeds 2 MB');
      const data = JSON.parse(await file.text());
      const copies = importBackup(data, input => globalThis.PrepEngine.create(input));
      records.push(...copies);
      if (!persist()) return;
      library();
      notify(`Restored ${copies.length} preparation(s) as separate copies.`);
    } catch (error) {
      notify(`Could not restore: ${error.message}`);
    }
  };
}

if (!storageOK) notify('Saved data could not be read. It has not been overwritten. Export or recover your browser storage before continuing.');
$('#library').onclick = library;
$('#home').onclick = event => {
  event.preventDefault();
  library();
};
$('#privacy').onclick = privacy;
library();
