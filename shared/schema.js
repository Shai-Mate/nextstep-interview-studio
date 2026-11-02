/* Validators for model output. Fail closed. The model does not grade itself. */

const SENIORITY = new Set(['intern', 'junior', 'mid', 'senior', 'staff', 'manager', 'director']);
const ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function isObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

function stringField(value, min, max) {
  return typeof value === 'string' && value.trim().length >= min && value.length <= max;
}

function stringOrNull(value, max) {
  return value === null || (typeof value === 'string' && value.length <= max);
}

function stringList(value, maxItems, maxLen) {
  return Array.isArray(value) && value.length <= maxItems && value.every(item => typeof item === 'string' && item.length <= maxLen);
}

export function validateProfile(data) {
  const errors = [];
  if (!isObject(data)) return ['Profile must be an object.'];
  if (data.schema !== 'nextstep.role-profile.v1') errors.push('schema must be nextstep.role-profile.v1');
  if (!stringField(data.company, 2, 160)) errors.push('company');
  if (!stringField(data.title, 2, 160)) errors.push('title');
  if (!stringOrNull(data.location, 160)) errors.push('location');
  if (!stringOrNull(data.workArrangement, 80)) errors.push('workArrangement');
  if (!stringOrNull(data.compensation, 120)) errors.push('compensation');
  if (!stringOrNull(data.audience, 160)) errors.push('audience');
  if (!stringField(data.roleFamily, 2, 200)) errors.push('roleFamily');
  if (!(data.seniority === null || SENIORITY.has(data.seniority))) errors.push('seniority');
  if (!stringList(data.employmentTypes, 8, 40)) errors.push('employmentTypes');
  if (!stringList(data.projectExamplesFromAd, 12, 200)) errors.push('projectExamplesFromAd');
  if (!stringList(data.namedRequiredTools, 12, 40)) errors.push('namedRequiredTools');
  if (!stringList(data.candidateEvidenceNeeded, 8, 240)) errors.push('candidateEvidenceNeeded');
  if (!stringList(data.generalGuidanceNotClaimedAsEmployerPolicy, 8, 400)) errors.push('generalGuidanceNotClaimedAsEmployerPolicy');
  if (!stringList(data.exclusionChecks, 12, 240)) errors.push('exclusionChecks');
  if (data.exclusionPhrases !== undefined && !stringList(data.exclusionPhrases, 12, 80)) errors.push('exclusionPhrases');
  if (!(data.teachingCredentialRequired === null || typeof data.teachingCredentialRequired === 'boolean')) errors.push('teachingCredentialRequired');
  if (!(data.teachingExperience === null || (isObject(data.teachingExperience) && stringField(data.teachingExperience.classification || '', 2, 80) && stringField(data.teachingExperience.evidence || '', 2, 300)))) {
    errors.push('teachingExperience');
  }
  if (!Array.isArray(data.competencies) || data.competencies.length < 3 || data.competencies.length > 12) errors.push('competencies');
  const ids = new Set();
  for (const item of data.competencies || []) {
    if (!isObject(item)) {
      errors.push('competency');
      continue;
    }
    if (!ID.test(item.id || '') || item.id.length > 40) errors.push(`competency id ${item.id || ''}`);
    if (ids.has(item.id)) errors.push(`duplicate competency ${item.id}`);
    ids.add(item.id);
    if (!['core', 'supporting'].includes(item.priority)) errors.push(`priority ${item.id}`);
    if (!stringField(item.evidence, 20, 500)) errors.push(`evidence ${item.id}`);
    if (!stringField(item.learningObjective, 20, 400)) errors.push(`learningObjective ${item.id}`);
    if (item.label !== undefined && !stringField(item.label, 2, 80)) errors.push(`label ${item.id}`);
  }
  if (!isObject(data.source) || !stringField(data.source.retrieval || '', 2, 240)) errors.push('source');
  else {
    for (const key of ['submittedUrl', 'canonicalUrl', 'provider', 'externalJobId']) {
      if (data.source[key] != null && typeof data.source[key] !== 'string') errors.push(`source.${key}`);
      if (typeof data.source[key] === 'string' && data.source[key].length > 2000) errors.push(`source.${key} length`);
    }
  }
  return errors;
}

export function validateCatalog(data) {
  const errors = [];
  if (!isObject(data)) return ['Catalog must be an object.'];
  if (data.schema !== 'nextstep.plan-catalog.v1') errors.push('catalog schema');
  if (!Array.isArray(data.lessons) || data.lessons.length < 3 || data.lessons.length > 12) errors.push('lessons');
  if (!Array.isArray(data.quiz) || data.quiz.length < 3 || data.quiz.length > 8) errors.push('quiz');
  if (!Array.isArray(data.scenarios) || data.scenarios.length < 2 || data.scenarios.length > 8) errors.push('scenarios');
  const lessonIds = new Set();
  for (const lesson of data.lessons || []) {
    if (!isObject(lesson)) {
      errors.push('lesson');
      continue;
    }
    if (!ID.test(lesson.id || '')) errors.push('lesson id');
    if (lessonIds.has(lesson.id)) errors.push(`duplicate lesson ${lesson.id}`);
    lessonIds.add(lesson.id);
    if (!ID.test(lesson.competencyId || '')) errors.push(`lesson competency ${lesson.id}`);
    if (!stringField(lesson.title, 8, 140)) errors.push(`lesson title ${lesson.id}`);
    if (!stringField(lesson.objective, 20, 400)) errors.push(`lesson objective ${lesson.id}`);
    if (!Number.isInteger(lesson.minutes) || lesson.minutes < 3 || lesson.minutes > 25) errors.push(`lesson minutes ${lesson.id}`);
    if (!['core', 'transfer', 'stage'].includes(lesson.kind)) errors.push(`lesson kind ${lesson.id}`);
    if (typeof lesson.generalGuidance !== 'boolean') errors.push(`lesson generalGuidance ${lesson.id}`);
    if (!stringList(lesson.adClaims, 4, 500)) errors.push(`lesson adClaims ${lesson.id}`);
    if (!stringField(lesson.body, 80, 2500)) errors.push(`lesson body ${lesson.id}`);
    if (!stringField(lesson.deepBody, 40, 2500)) errors.push(`lesson deepBody ${lesson.id}`);
    if (!stringField(lesson.example, 40, 1200)) errors.push(`lesson example ${lesson.id}`);
    if (!stringField(lesson.exercise, 20, 600)) errors.push(`lesson exercise ${lesson.id}`);
    if (lesson.kind === 'stage' && lesson.generalGuidance !== true) errors.push(`stage lesson must be general guidance ${lesson.id}`);
    if (lesson.generalGuidance === false && (!lesson.adClaims || lesson.adClaims.length < 1)) errors.push(`ad lesson needs a claim ${lesson.id}`);
    if (lesson.fitsSeniority != null && !SENIORITY.has(lesson.fitsSeniority)) errors.push(`fitsSeniority ${lesson.id}`);
    if (lesson.stage != null && !['screening', 'skills', 'panel', 'final'].includes(lesson.stage)) errors.push(`lesson stage ${lesson.id}`);
  }
  for (const item of data.quiz || []) {
    if (!isObject(item) || !ID.test(item.id || '') || !ID.test(item.competencyId || '')) errors.push('quiz item');
    else {
      if (!stringField(item.question, 20, 400)) errors.push(`quiz question ${item.id}`);
      if (!Array.isArray(item.options) || item.options.length < 3 || item.options.length > 4) errors.push(`quiz options ${item.id}`);
      else if (new Set(item.options).size !== item.options.length || item.options.some(option => !stringField(option, 8, 240))) errors.push(`quiz option text ${item.id}`);
      if (!Number.isInteger(item.correctIndex) || item.correctIndex < 0 || item.correctIndex >= (item.options || []).length) errors.push(`quiz correctIndex ${item.id}`);
      if (!stringField(item.why, 20, 500)) errors.push(`quiz why ${item.id}`);
    }
  }
  for (const scenario of data.scenarios || []) {
    if (!isObject(scenario) || !ID.test(scenario.id || '') || !ID.test(scenario.competencyId || '')) errors.push('scenario');
    else {
      if (!stringField(scenario.opening, 20, 500)) errors.push(`scenario opening ${scenario.id}`);
      if (!Array.isArray(scenario.followUps) || scenario.followUps.length < 2 || scenario.followUps.some(line => !stringField(line, 12, 300))) errors.push(`scenario followUps ${scenario.id}`);
      if (!Array.isArray(scenario.stageFit) || scenario.stageFit.length < 1 || scenario.stageFit.some(stage => !['screening', 'skills', 'panel', 'final', 'any'].includes(stage))) errors.push(`scenario stage ${scenario.id}`);
    }
  }
  return errors;
}

export function validateGrade(data, answer, allowedIds) {
  const errors = [];
  if (!isObject(data)) return ['Grade must be an object.'];
  if (!Array.isArray(data.competencies) || data.competencies.length < 1 || data.competencies.length > 4) errors.push('grade competencies');
  const hay = normLoose(answer);
  for (const item of data.competencies || []) {
    if (!isObject(item) || !allowedIds.includes(item.competencyId)) errors.push('grade competency');
    else {
      if (!Number.isInteger(item.score) || item.score < 1 || item.score > 4) errors.push('grade score');
      if (!stringField(item.feedback, 20, 1200)) errors.push('grade feedback');
      if (typeof item.evidenceQuote !== 'string' || !item.evidenceQuote || !hay.includes(normLoose(item.evidenceQuote))) errors.push('grade quote');
      if (item.evidenceQuote && !normLoose(item.feedback).includes(normLoose(item.evidenceQuote).slice(0, 40))) errors.push('feedback must use the quote');
    }
  }
  return errors;
}

function normLoose(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}
