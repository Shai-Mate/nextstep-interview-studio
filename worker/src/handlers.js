import { messageFor } from '../../shared/messages.js';
import { checkPlanCatalog, checkProfileAgainstSource } from '../../shared/grounding.js';
import { validateProfile } from '../../shared/schema.js';
import { applyAnswers } from '../../shared/plan-path.js';
import { gradeAnswer } from '../../shared/grade-rubric.js';
import { jobIdFromUrl, norm } from '../../shared/text.js';
import { generateValidated } from './generate.js';
import { EXTRACT_SYSTEM, GRADE_SYSTEM, PLAN_SYSTEM, ROLEPLAY_SYSTEM, extractUser, gradeUser, planUser, roleplayUser } from './prompts.js';
import { allowRequest, LIMITS } from './rate-limit.js';
import { JobFetchError } from './ssrf.js';
import { fetchVacancy } from './fetch-job.js';

const ROUTES = new Set(['/api/extract', '/api/plan', '/api/roleplay/turn', '/api/grade']);
const EXPERIENCE = new Set(['early', 'experienced', 'career-change', 'prefer-not']);
const STAGES = new Set(['screening', 'skills', 'panel', 'final', 'unsure']);
const TIMES = new Set(['15', '30', '60']);

function coded(status, code) {
  const error = new Error(code);
  error.status = status;
  error.code = code;
  return error;
}

function clientIp(request) {
  const value = request.headers.get('cf-connecting-ip') || 'unknown';
  return /^[A-Za-z0-9:.]{1,64}$/.test(value) ? value : 'unknown';
}

function allowOrigin(request, env) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  const configured = String(env.ALLOWED_ORIGINS || 'https://shai-mate.github.io').split(',').map(item => item.trim()).filter(Boolean);
  if (configured.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;
  return '';
}

function respond(request, env, status, body) {
  const headers = new Headers({
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    vary: 'Origin'
  });
  const origin = allowOrigin(request, env);
  if (origin) headers.set('access-control-allow-origin', origin);
  return new Response(JSON.stringify(body), { status, headers });
}

function log(route, status, code) {
  console.log(JSON.stringify({ event: 'api', route, status, code }));
}

async function readJson(request) {
  const type = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw coded(400, 'bad-json');
  const lengthHeader = request.headers.get('content-length');
  if (!lengthHeader || !/^\d+$/.test(lengthHeader)) throw coded(400, 'bad-json');
  const length = Number(lengthHeader);
  if (length <= 0 || length > 80000) throw coded(413, 'too-large-request');
  const buffer = await request.arrayBuffer();
  if (buffer.byteLength !== length) throw coded(400, 'bad-json');
  try {
    const data = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(buffer));
    if (!data || typeof data !== 'object' || Array.isArray(data)) throw new Error('shape');
    return data;
  } catch {
    throw coded(400, 'bad-json');
  }
}

function guard(request, bucket) {
  const rule = LIMITS[bucket];
  if (!allowRequest(clientIp(request), bucket, rule.limit, rule.windowMs)) throw coded(429, 'rate-limited');
}

function publicProfile(profile) {
  return {
    schema: profile.schema,
    company: profile.company,
    title: profile.title,
    location: profile.location ?? null,
    workArrangement: profile.workArrangement ?? null,
    compensation: profile.compensation ?? null,
    employmentTypes: profile.employmentTypes,
    audience: profile.audience ?? null,
    roleFamily: profile.roleFamily,
    seniority: profile.seniority,
    competencies: profile.competencies.map(item => ({
      id: item.id,
      priority: item.priority,
      evidence: item.evidence,
      learningObjective: item.learningObjective,
      ...(item.label ? { label: item.label } : {})
    })),
    projectExamplesFromAd: profile.projectExamplesFromAd,
    namedRequiredTools: profile.namedRequiredTools,
    teachingCredentialRequired: profile.teachingCredentialRequired,
    teachingExperience: profile.teachingExperience,
    candidateEvidenceNeeded: profile.candidateEvidenceNeeded,
    generalGuidanceNotClaimedAsEmployerPolicy: profile.generalGuidanceNotClaimedAsEmployerPolicy,
    exclusionChecks: profile.exclusionChecks,
    ...(Array.isArray(profile.exclusionPhrases) ? { exclusionPhrases: profile.exclusionPhrases } : {}),
    source: {
      submittedUrl: profile.source?.submittedUrl ?? null,
      canonicalUrl: profile.source?.canonicalUrl ?? null,
      provider: profile.source?.provider ?? null,
      externalJobId: profile.source?.externalJobId ?? null,
      retrieval: profile.source?.retrieval
    }
  };
}

function stampSource(profile, { finalUrl, structured, mode }) {
  profile.schema = 'nextstep.role-profile.v1';
  profile.source = {
    submittedUrl: finalUrl,
    canonicalUrl: structured?.url || finalUrl,
    provider: structured ? 'jobposting-jsonld' : (finalUrl ? 'page-text' : mode),
    externalJobId: jobIdFromUrl(finalUrl || '') || structured?.jobId || null,
    retrieval: finalUrl ? 'selected-vacancy' : 'submitted-text'
  };
  return profile;
}

function requireProfile(body) {
  const errors = validateProfile(body.profile);
  if (errors.length) throw coded(400, 'bad-json');
  return publicProfile(body.profile);
}

function answersOk(answers, profile) {
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) return false;
  if (!EXPERIENCE.has(answers.experience) || !STAGES.has(answers.stage) || !TIMES.has(String(answers.time))) return false;
  const ids = new Set(profile.competencies.map(item => item.id));
  if (answers.focus !== 'balanced' && !ids.has(answers.focus)) return false;
  if (answers.weak !== 'unsure' && !ids.has(answers.weak)) return false;
  if (answers.tool != null && !(profile.namedRequiredTools || []).includes(answers.tool)) return false;
  return true;
}

async function extract(request, deps) {
  guard(request, 'extract');
  const body = await readJson(request);
  let sourceText = '';
  let finalUrl = null;
  let structured = null;
  let mode = 'pasted-text';
  if (body.source === 'url') {
    if (typeof body.url !== 'string') throw coded(400, 'bad-json');
    try {
      const fetched = await fetchVacancy(body.url, deps);
      sourceText = fetched.text;
      finalUrl = fetched.finalUrl;
      structured = fetched.structured;
      mode = 'url';
    } catch (error) {
      if (error instanceof JobFetchError || error.code) throw coded(error.code === 'bad-url' || error.code === 'blocked-address' ? 400 : (['login-required', 'listing-only', 'selection-not-found', 'ambiguous', 'unreadable'].includes(error.code) ? 422 : 502), error.code || 'bad-status');
      throw coded(502, 'bad-status');
    }
  } else if (body.source === 'text' || body.source === 'file') {
    if (typeof body.text !== 'string') throw coded(400, 'bad-json');
    sourceText = body.text.trim().slice(0, 60000);
    if (sourceText.length < 80) throw coded(400, 'short-text');
    mode = body.source === 'file' ? 'file-text' : 'pasted-text';
  } else {
    throw coded(400, 'bad-json');
  }
  const profile = await generateValidated({
    adapter: deps.adapter,
    system: EXTRACT_SYSTEM,
    user: extractUser(sourceText),
    validate: value => {
      if (!value || typeof value !== 'object' || Array.isArray(value)) return ['Profile must be an object.'];
      stampSource(value, { finalUrl, structured, mode });
      return checkProfileAgainstSource(value, sourceText, structured);
    }
  });
  return { profile: publicProfile(profile), extractedText: sourceText.slice(0, 60000) };
}

async function plan(request, deps) {
  guard(request, 'plan');
  const body = await readJson(request);
  const profile = requireProfile(body);
  if (!answersOk(body.answers, profile)) throw coded(400, 'bad-json');
  const catalog = await generateValidated({
    adapter: deps.adapter,
    system: PLAN_SYSTEM,
    user: planUser(profile, body.answers),
    validate: value => checkPlanCatalog(value, profile)
  });
  return { plan: applyAnswers(catalog, body.answers, profile) };
}

function lastCandidate(messages) {
  if (!Array.isArray(messages) || messages.length > 12) return null;
  for (const message of messages) {
    if (!message || (message.role !== 'interviewer' && message.role !== 'candidate') || typeof message.content !== 'string' || message.content.length > 6000) return null;
  }
  const candidate = [...messages].reverse().find(message => message.role === 'candidate');
  return candidate ? candidate.content.trim() : '';
}

async function roleplay(request, deps) {
  guard(request, 'roleplay');
  const body = await readJson(request);
  const profile = requireProfile(body);
  const scenario = body.scenario;
  if (!scenario || typeof scenario.opening !== 'string' || scenario.opening.length < 12 || scenario.opening.length > 500) throw coded(400, 'bad-json');
  if (!profile.competencies.some(item => item.id === scenario.competencyId)) throw coded(400, 'bad-json');
  const answer = lastCandidate(body.messages);
  if (answer == null) throw coded(400, 'bad-json');
  if (!answer) return { question: scenario.opening, kind: 'opening' };
  const follow = await generateValidated({
    adapter: deps.adapter,
    system: ROLEPLAY_SYSTEM,
    user: roleplayUser({ scenario, answer }),
    validate: value => {
      if (!value || (value.kind !== 'probe' && value.kind !== 'missing')) return ['kind'];
      if (typeof value.question !== 'string' || value.question.trim().length < 12 || value.question.length > 400) return ['question'];
      if (value.kind === 'missing') return value.quote ? ['missing follow-up cannot quote'] : [];
      if (typeof value.quote !== 'string' || value.quote.trim().length < 8 || !norm(answer).includes(norm(value.quote))) return ['quote is not in the answer'];
      return [];
    }
  });
  return { question: follow.question.trim(), kind: follow.kind, quote: follow.kind === 'probe' ? follow.quote : '' };
}

function inventedNumbers(feedback, answer, evidence) {
  const numbers = String(feedback).match(/\d{3,}/g) || [];
  const hay = `${answer}\n${evidence}`;
  return numbers.some(number => !hay.includes(number));
}

async function grade(request, deps) {
  guard(request, 'grade');
  const body = await readJson(request);
  const profile = requireProfile(body);
  const competency = profile.competencies.find(item => item.id === body.competencyId);
  if (!competency) throw coded(400, 'bad-json');
  if (typeof body.answer !== 'string' || body.answer.trim().length < 20 || body.answer.length > 6000) throw coded(400, 'bad-json');
  const answer = body.answer.trim();
  const rubric = gradeAnswer({ answer, competencies: [competency] });
  const item = rubric.competencies[0];
  let feedback = item.feedback;
  let feedbackSource = 'rubric';
  try {
    const phrased = await generateValidated({
      adapter: deps.adapter,
      system: GRADE_SYSTEM,
      user: gradeUser({ competency, score: item.score, quote: item.evidenceQuote, answer }),
      validate: value => {
        if (!value || typeof value.feedback !== 'string' || value.feedback.length < 20 || value.feedback.length > 1200) return ['feedback'];
        if (!norm(value.feedback).includes(norm(item.evidenceQuote).slice(0, 40))) return ['quote missing from feedback'];
        if (inventedNumbers(value.feedback, answer, competency.evidence)) return ['feedback adds a number the answer did not use'];
        return [];
      }
    });
    feedback = `${phrased.feedback.trim()} ${rubric.overallNote}`;
    feedbackSource = 'model-phrasing';
  } catch (error) {
    if (error.code !== 'check-failed' && error.code !== 'model-unavailable') throw error;
  }
  return {
    grade: {
      ...rubric,
      feedbackSource,
      competencies: [{ ...item, score: item.score, feedback }]
    }
  };
}

export async function handle(request, deps) {
  const url = new URL(request.url);
  const route = url.pathname;
  const env = deps.env || {};
  if (allowOrigin(request, env) === '') {
    log(route, 403, 'origin');
    return respond(request, env, 403, { error: { code: 'origin', message: messageFor('origin') } });
  }
  if (request.method === 'OPTIONS') {
    const headers = new Headers({
      'access-control-allow-methods': 'POST, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '600',
      vary: 'Origin'
    });
    const origin = allowOrigin(request, env);
    if (origin) headers.set('access-control-allow-origin', origin);
    return new Response(null, { status: 204, headers });
  }
  if (!ROUTES.has(route)) {
    log(route, 404, 'not-found');
    return respond(request, env, 404, { error: { code: 'not-found', message: messageFor('not-found') } });
  }
  if (request.method !== 'POST') {
    log(route, 405, 'method');
    return respond(request, env, 405, { error: { code: 'method', message: messageFor('method') } });
  }
  try {
    const result = route === '/api/extract'
      ? await extract(request, deps)
      : route === '/api/plan'
        ? await plan(request, deps)
        : route === '/api/roleplay/turn'
          ? await roleplay(request, deps)
          : await grade(request, deps);
    log(route, 200, 'ok');
    return respond(request, env, 200, result);
  } catch (error) {
    const status = error.status || 500;
    const code = error.code || 'check-failed';
    log(route, status, code);
    return respond(request, env, status, { error: { code, message: messageFor(code) } });
  }
}
