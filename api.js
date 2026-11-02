import { packs } from './fixtures/packs.js?v=3';
import { matchPack } from './shared/fixture-match.js?v=3';
import { applyAnswers } from './shared/plan-path.js?v=3';
import { gradeAnswer } from './shared/grade-rubric.js?v=3';
import { messages } from './shared/messages.js?v=3';
import { isSingleHttpUrl } from './shared/text.js?v=3';

const API_KEY = 'nextstep.apiBase.v1';

export function getApiBase() {
  try {
    return localStorage.getItem(API_KEY) || '';
  } catch {
    return '';
  }
}

export function setApiBase(value) {
  const clean = String(value || '').trim();
  if (!clean) {
    localStorage.removeItem(API_KEY);
    return '';
  }
  let url;
  try {
    url = new URL(clean);
  } catch {
    throw new Error('Enter a full https address, or leave the box empty.');
  }
  const local = url.protocol === 'http:' && (url.hostname === 'localhost' || url.hostname === '127.0.0.1');
  if (url.protocol !== 'https:' && !local) throw new Error('Use an https address. Only this computer may use an http localhost address.');
  if (url.username || url.password) throw new Error('That address should not include a password.');
  const base = `${url.origin}${url.pathname === '/' ? '' : url.pathname.replace(/\/$/, '')}`;
  localStorage.setItem(API_KEY, base);
  return base;
}

export function serviceConnected() {
  return Boolean(getApiBase());
}

async function postJson(path, body) {
  const base = getApiBase();
  let response;
  try {
    response = await fetch(`${base}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  } catch {
    throw new Error('The preparation service could not be reached. Check the address under Storage & privacy. Saved packs on this device still work.');
  }
  let data = null;
  try {
    data = await response.json();
  } catch {
    data = null;
  }
  if (!response.ok) throw new Error(data?.error?.message || 'The preparation service could not do that step. Nothing new was saved.');
  return data;
}

export async function extractJob(input) {
  if (!getApiBase()) {
    const pack = matchPack(packs, input);
    if (!pack) {
      const error = new Error(messages.noPack);
      error.code = 'no-pack';
      throw error;
    }
    return {
      profile: pack.profile,
      text: input.source === 'text' || input.source === 'file' ? input.text : pack.sampleAd,
      mode: 'pack',
      packId: pack.id,
      banner: messages.packBanner
    };
  }
  const data = await postJson('/api/extract', input);
  return {
    profile: data.profile,
    text: data.extractedText || input.text || '',
    mode: 'service',
    packId: null,
    banner: messages.serviceBanner
  };
}

export async function planJob(profile, answers) {
  if (!getApiBase()) {
    const pack = packs.find(item => item.profile.title === profile.title && item.profile.company === profile.company);
    if (!pack) throw new Error(messages.noPack);
    return applyAnswers(pack.catalog, answers, profile);
  }
  const data = await postJson('/api/plan', { profile, answers });
  return data.plan;
}

function mockTurn(scenario, messages) {
  const answer = [...(messages || [])].reverse().find(message => message.role === 'candidate')?.content?.trim() || '';
  if (!answer) return { question: scenario.opening, kind: 'opening', quote: '' };
  const quote = answer.replace(/\s+/g, ' ').trim().slice(0, 120);
  const prior = (messages || []).filter(message => message.role === 'interviewer').length;
  if (answer.length < 40) return { question: scenario.followUps[0], kind: 'missing', quote: '' };
  const follow = scenario.followUps[Math.max(0, Math.min(prior - 1, scenario.followUps.length - 1))] || scenario.followUps[0];
  if (prior <= 1) return { question: `You wrote "${quote}". ${follow}`, kind: 'probe', quote };
  return { question: follow, kind: 'probe', quote };
}

export async function roleplayTurn(profile, scenario, messages) {
  if (!getApiBase()) return mockTurn(scenario, messages);
  return postJson('/api/roleplay/turn', { profile, scenario, messages });
}

export async function gradeJob(profile, competencyId, answer, question) {
  if (!getApiBase()) {
    const competency = profile.competencies.find(item => item.id === competencyId);
    return gradeAnswer({ answer, competencies: [competency] });
  }
  const data = await postJson('/api/grade', { profile, competencyId, answer, question });
  return data.grade;
}

export function looksLikeUrl(value) {
  return isSingleHttpUrl(value);
}

export { packs };
