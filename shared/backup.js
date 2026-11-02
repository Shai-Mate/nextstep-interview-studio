import { v2Feedback } from './v2-feedback.js';
import { validateProfile } from './schema.js';
import { isV1Record, isV2Record } from './records.js';

function uid() {
  return globalThis.crypto?.randomUUID?.() || `prep-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function exportEnvelope(records) {
  const list = Array.isArray(records) ? records : [];
  const schema = list.length && list.every(record => record.schema === 1) ? 1 : 2;
  return { schema, preparations: list };
}

function importOneV1(record, createV2) {
  const fresh = createV2(record);
  if (!record.notes || typeof record.notes !== 'object' || Array.isArray(record.notes)) throw new Error('Invalid notes');
  for (const [key, value] of Object.entries(record.notes)) {
    if (typeof value !== 'string' || value.length > 60000) throw new Error('Invalid note');
    fresh.notes[key] = value;
  }
  if (Array.isArray(record.course)) fresh.course.forEach((lesson, index) => { lesson.done = record.course[index]?.done === true; });
  if (record.quiz?.answers && typeof record.quiz.answers === 'object') {
    for (const [key, value] of Object.entries(record.quiz.answers)) {
      if (/^[0-2]$/.test(key) && Number.isInteger(value) && value >= 0 && value <= 2) fresh.quiz.answers[key] = value;
    }
  }
  if (record.mock && Number.isInteger(record.mock.index) && record.mock.index >= 0 && record.mock.index <= fresh.questions.length && Array.isArray(record.mock.answers) && record.mock.answers.length === record.mock.index) {
    fresh.mock = {
      index: record.mock.index,
      answers: record.mock.answers.map(answer => {
        if (typeof answer.text !== 'string' || answer.text.length > 60000) throw new Error('Invalid mock');
        return { question: String(answer.question).slice(0, 2000), text: answer.text, feedback: v2Feedback(answer.text) };
      }),
      draft: String(record.mock.draft || '').slice(0, 60000),
      finished: record.mock.index === fresh.questions.length
    };
  }
  fresh.schema = 1;
  return fresh;
}

function importOneV3(record) {
  if (!isV2Record(record)) throw new Error('Unsupported preparation');
  if (validateProfile(record.profile).length) throw new Error('Invalid role profile');
  if (!record.plan || !Array.isArray(record.plan.lessons) || !Array.isArray(record.plan.quiz) || !Array.isArray(record.plan.scenarios)) throw new Error('Invalid plan');
  const notes = {};
  if (record.notes) {
    if (typeof record.notes !== 'object' || Array.isArray(record.notes)) throw new Error('Invalid notes');
    for (const [key, value] of Object.entries(record.notes)) {
      if (typeof value !== 'string' || value.length > 60000) throw new Error('Invalid note');
      notes[key] = value;
    }
  }
  const copy = structuredClone(record);
  copy.id = uid();
  copy.schema = 2;
  copy.engineVersion = 3;
  copy.notes = notes;
  copy.updated = new Date().toISOString();
  return copy;
}

export function importBackup(data, createV2) {
  if (!data || typeof data !== 'object' || !Array.isArray(data.preparations) || data.preparations.length < 1 || data.preparations.length > 50) {
    throw new Error('Unsupported backup');
  }
  if (data.schema === 1) return data.preparations.map(record => importOneV1(record, createV2));
  if (data.schema === 2) {
    return data.preparations.map(record => {
      if (record?.schema === 1) return importOneV1(record, createV2);
      if (record?.schema === 2) return importOneV3(record);
      throw new Error('Unsupported preparation');
    });
  }
  throw new Error('Unsupported backup');
}

export function assertV1RoundTripShape(record) {
  return isV1Record(record);
}
