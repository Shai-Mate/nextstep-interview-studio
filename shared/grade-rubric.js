import { norm } from './text.js';
import { messages } from './messages.js';

const ACTION = /\b(I|we)\b[\s\S]{0,90}\b(built|designed|led|wrote|checked|tested|coached|scheduled|explained|adapted|fixed|reviewed|walked|counted|trained|scoped|posted|reconciled|paged|retried|taught|facilitated|listened|apologized|reordered|staffed)\b/i;
const OUTCOME = /\b(result|outcome|after that|reduced|increased|caught|learned|confirmed|balanced|reconciled|student|customer|next time|so that|checked that)\b/i;
const TRADEOFF = /\b(trade-?off|risk|instead|otherwise|because|checked|limit|constraint|if it failed|rollback|safeguard)\b/i;

function significantWords(value) {
  return norm(value).split(/[^a-z0-9+]+/).filter(word => word.length > 5 && !['should', 'practice', 'example', 'students', 'through'].includes(word));
}

export function firstQuote(answer) {
  const clean = String(answer || '').replace(/\s+/g, ' ').trim();
  if (!clean) return '';
  const sentence = clean.split(/(?<=[.!?])\s/)[0] || clean;
  return sentence.slice(0, 180);
}

export function scoreCompetency({ answer, competency }) {
  const text = String(answer || '').trim();
  const quote = firstQuote(text);
  const words = significantWords(`${competency.learningObjective || ''} ${competency.label || ''} ${competency.id || ''}`);
  const hay = norm(text);
  const ties = words.some(word => hay.includes(word));
  const signals = {
    hasAction: ACTION.test(text),
    longEnough: text.length >= 80,
    hasOutcome: OUTCOME.test(text),
    hasTradeoff: TRADEOFF.test(text),
    ties
  };
  let score = 1;
  if (signals.hasAction && signals.longEnough) score = 2;
  if (signals.hasAction && signals.longEnough && signals.ties) score = 3;
  if (score === 3 && signals.hasOutcome && signals.hasTradeoff) score = 4;
  const missing = [];
  if (!signals.hasAction) missing.push('a specific action you personally took');
  if (!signals.ties) missing.push('a detail that connects to this competency');
  if (!signals.hasOutcome) missing.push('what changed afterward, or how you checked');
  if (score >= 3 && !signals.hasTradeoff) missing.push('a constraint, risk, or check');
  const reason = missing.length
    ? `Still thin on ${missing.join(', and ')}.`
    : 'The answer shows an action, a link to this competency, a check, and a constraint.';
  const feedback = `You wrote "${quote}". The job ad says: "${competency.evidence}" Score ${score} of 4. ${reason} ${messages.practiceDisclaimer}`;
  return { competencyId: competency.id, score, max: 4, evidenceQuote: quote, feedback, signals };
}

export function gradeAnswer({ answer, competencies }) {
  const items = (competencies || []).map(competency => scoreCompetency({ answer, competency }));
  return {
    schema: 'nextstep.grade.v1',
    competencies: items,
    overallNote: messages.practiceDisclaimer,
    feedbackSource: 'rubric'
  };
}
