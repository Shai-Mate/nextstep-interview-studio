'use strict';
/* Onboarding flow: role, job ad, quick setup and plan creation.
   Classic script loaded after app.js: it shares app.js top-level globals
   ($, esc, I, screens, binders, actions, show, notify, persist, records, active, draft, ...).
   Screens register into `screens`, per-screen event wiring into `binders[view]`,
   click actions into `actions[name]`. */

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

Object.assign(screens, {
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
  }
});

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
binders.role = () => {
  const form = $('#role-form');
  if (form) form.addEventListener('submit', (e) => { e.preventDefault(); readRole(); show('jobad'); });
};
binders.jobad = () => {
  const job = $('#job-form');
  if (!job) return;
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
binders.setup = () => {
  const intake = $('#intake');
  if (!intake) return;
  intake.addEventListener('submit', (e) => { e.preventDefault(); createPrep(false); });
  $('#skip').addEventListener('click', () => createPrep(true));
};
Object.assign(actions, {
  start: () => { renaming = false; show('role'); },
  'back-welcome': () => { readRole(); show('welcome'); },
  'back-role': () => { readJob(); show('role'); },
  'back-job': () => { readIntake(); show('jobad'); }
});
