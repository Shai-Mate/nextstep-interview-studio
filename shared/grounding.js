import { norm, containsNorm } from './text.js';
import { validateProfile, validateCatalog } from './schema.js';

export function adCorpus(profile) {
  const parts = [profile.company, profile.title];
  for (const item of profile.competencies || []) parts.push(item.evidence);
  for (const item of profile.projectExamplesFromAd || []) parts.push(item);
  for (const item of profile.namedRequiredTools || []) parts.push(item);
  for (const item of profile.sourceQuotes || []) parts.push(item);
  return norm(parts.filter(Boolean).join('\n'));
}

function toolInText(source, tool) {
  const text = String(source);
  if (/^[A-Za-z0-9+#.]{1,12}$/.test(tool)) {
    const pattern = new RegExp(`(?:^|[^A-Za-z0-9])${tool.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?:[^A-Za-z0-9]|$)`);
    return pattern.test(text);
  }
  return containsNorm(text, tool);
}

export function checkProfileAgainstSource(profile, sourceText, structured = null) {
  const errors = validateProfile(profile);
  if (errors.length) return errors;
  const hay = norm(sourceText);
  if (!hay.includes(norm(profile.company))) errors.push('company is not in the job text');
  if (!hay.includes(norm(profile.title))) errors.push('title is not in the job text');
  for (const item of profile.competencies) {
    if (!hay.includes(norm(item.evidence))) errors.push(`evidence is not a quote from the job text (${item.id})`);
  }
  for (const tool of profile.namedRequiredTools || []) {
    if (!toolInText(sourceText, tool)) errors.push(`tool is not in the job text (${tool})`);
  }
  for (const example of profile.projectExamplesFromAd || []) {
    if (!containsNorm(sourceText, example)) errors.push('project example is not in the job text');
  }
  if (profile.seniority && !hay.includes(profile.seniority)) errors.push('seniority is not stated in the job text');
  if (structured?.title && norm(structured.title) !== norm(profile.title)) errors.push('title does not match the selected job');
  if (structured?.company && norm(structured.company) !== norm(profile.company)) errors.push('company does not match the selected job');
  const phrases = profile.exclusionPhrases || [];
  const blob = JSON.stringify({
    title: profile.title,
    company: profile.company,
    roleFamily: profile.roleFamily,
    competencies: profile.competencies
  });
  for (const phrase of phrases) {
    if (phrase && blob.toLowerCase().includes(String(phrase).toLowerCase()) && !hay.includes(norm(phrase))) {
      errors.push(`unrelated phrase in profile (${phrase})`);
    }
  }
  return errors;
}

export function checkPlanCatalog(catalog, profile) {
  const errors = [...validateProfile(profile), ...validateCatalog(catalog)];
  if (errors.length) return errors;
  const ids = new Set(profile.competencies.map(item => item.id));
  const corpus = adCorpus(profile);
  const phrases = profile.exclusionPhrases || [];
  const blob = [];
  const covered = new Set();
  for (const lesson of catalog.lessons) {
    if (!ids.has(lesson.competencyId)) errors.push(`lesson uses an unknown competency (${lesson.id})`);
    if (!lesson.generalGuidance) covered.add(lesson.competencyId);
    for (const claim of lesson.adClaims) {
      if (!corpus.includes(norm(claim))) errors.push(`lesson claim is not in the role profile (${lesson.id})`);
    }
    if (lesson.fitsSeniority && lesson.fitsSeniority !== profile.seniority) errors.push(`lesson seniority does not fit the profile (${lesson.id})`);
    blob.push(lesson.title, lesson.body, lesson.deepBody, lesson.example, lesson.exercise, lesson.objective);
  }
  for (const item of catalog.quiz) {
    if (!ids.has(item.competencyId)) errors.push(`quiz uses an unknown competency (${item.id})`);
    blob.push(item.question, item.why, ...(item.options || []));
  }
  for (const scenario of catalog.scenarios) {
    if (!ids.has(scenario.competencyId)) errors.push(`scenario uses an unknown competency (${scenario.id})`);
    blob.push(scenario.opening, ...(scenario.followUps || []));
  }
  const joined = blob.join('\n');
  for (const phrase of phrases) {
    if (phrase && joined.toLowerCase().includes(String(phrase).toLowerCase())) errors.push(`exclusion phrase present (${phrase})`);
  }
  const core = profile.competencies.filter(item => item.priority === 'core').map(item => item.id);
  const hit = core.filter(id => covered.has(id)).length;
  if (hit < Math.min(3, core.length)) errors.push('catalog does not cover enough core competencies');
  return errors;
}
