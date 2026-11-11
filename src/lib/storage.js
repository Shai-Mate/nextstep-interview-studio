import { createPreparation } from "../../engine.js";
import { normalizeCoachingNotes } from "./coaching.js";

export const STORAGE_KEY = "prism.workspace.v1";
export const emptyProfile = {
  name: "",
  targetRole: "",
  location: "",
  experience: "",
  resume: "",
  skills: "",
  achievements: "",
  preferences: "",
};
export const MAX_RECORDS = 100;
const MAX_BACKUP_BYTES = 5_000_000;
const blockedKeys = new Set(["__proto__", "constructor", "prototype"]);
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const string = (value, max = 60000) =>
  typeof value === "string" ? value.slice(0, max) : "";
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `prism-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const safeKey = (key) =>
  !blockedKeys.has(key) && /^[a-z0-9_-]{1,100}$/i.test(key);

export function emptyWorkspace() {
  return {
    schema: 3,
    profile: { ...emptyProfile },
    opportunities: [],
    offers: [],
    settings: { onboarded: false },
    activeId: null,
  };
}

function normalizeAnswers(answers, questions) {
  if (!Array.isArray(answers)) return [];
  return answers
    .slice(0, questions.length)
    .filter((answer) => isObject(answer) && typeof answer.text === "string")
    .map((answer, index) => ({
      question:
        string(answer.question, 3000) || questions[index]?.question || "",
      text: string(answer.text),
      at: string(answer.at, 40),
    }));
}

export function normalizeOpportunity(record) {
  if (
    !isObject(record) ||
    typeof record.job !== "string" ||
    record.job.trim().length < 40
  )
    throw new Error("An opportunity is missing its job description.");
  const legacy = record.schema === 1;
  const fresh = createPreparation({
    job: record.job.slice(0, 60000),
    role: string(record.role, 120),
    company: string(record.company, 120),
    url: string(record.url, 2000),
    intake: isObject(record.intake)
      ? Object.fromEntries(
          ["experience", "stage", "focus", "time"]
            .map((key) => [key, string(record.intake[key], 120)])
            .filter(([, value]) => value),
        )
      : {},
  });
  fresh.id = string(record.id, 100) || fresh.id;
  fresh.status = [
    "Saved",
    "Applying",
    "Interview",
    "Offer",
    "Accepted",
    "Archived",
  ].includes(record.status)
    ? record.status
    : "Saved";
  fresh.sample = record.sample === true;
  fresh.created = string(record.created, 40) || fresh.created;
  fresh.updated = string(record.updated, 40) || fresh.updated;
  fresh.interviewDate = string(record.interviewDate, 40);
  fresh.interviewer = {
    name: string(record.interviewer?.name, 120),
    role: string(record.interviewer?.role, 120),
    url: string(record.interviewer?.url, 2000),
    notes: string(record.interviewer?.notes, 20000),
  };
  fresh.companyNotes = string(record.companyNotes, 20000);
  fresh.applicationNotes = string(record.applicationNotes, 20000);
  fresh.coaching = normalizeCoachingNotes(record.coaching);
  fresh.notes = {};
  if (isObject(record.notes)) {
    Object.entries(record.notes)
      .slice(0, 150)
      .forEach(([key, value]) => {
        if (typeof value === "string" && !blockedKeys.has(key))
          fresh.notes[key.slice(0, 100)] = value.slice(0, 60000);
      });
    // Preserve original keys for recovery while making legacy evidence visible in the new lesson UI.
    if (legacy) {
      fresh.course.forEach((lesson, index) => {
        const note = fresh.notes[`lesson-${index}`];
        if (
          typeof note === "string" &&
          !Object.prototype.hasOwnProperty.call(fresh.notes, lesson.id)
        )
          fresh.notes[lesson.id] = note;
      });
      fresh.questions.forEach((question, index) => {
        const note = fresh.notes[`answer-${index}`];
        const key = `answer-${question.id}`;
        if (
          typeof note === "string" &&
          !Object.prototype.hasOwnProperty.call(fresh.notes, key)
        )
          fresh.notes[key] = note;
      });
    }
  }
  const savedCourse = Array.isArray(record.course) ? record.course : [];
  fresh.course.forEach((lesson, index) => {
    const saved =
      savedCourse.find((item) => isObject(item) && item.id === lesson.id) ||
      (legacy ? savedCourse[index] : undefined);
    lesson.done = saved?.done === true;
  });
  fresh.quiz = { answers: {} };
  // Old quiz questions differ from the new lesson checks; never transfer correctness by index.
  if (!legacy && isObject(record.quiz?.answers))
    Object.entries(record.quiz.answers)
      .slice(0, 100)
      .forEach(([key, value]) => {
        if (
          safeKey(key) &&
          Number.isInteger(value) &&
          value >= 0 &&
          value <= 10
        )
          fresh.quiz.answers[key] = value;
      });
  const answers = normalizeAnswers(record.mock?.answers, fresh.questions);
  fresh.mock = {
    index: answers.length,
    answers,
    draft: string(record.mock?.draft),
    finished: answers.length >= fresh.questions.length,
  };
  fresh.mockHistory = Array.isArray(record.mockHistory)
    ? record.mockHistory
        .slice(0, 10)
        .filter(isObject)
        .map((history) => ({
          at: string(history.at, 40),
          answers: normalizeAnswers(history.answers, fresh.questions),
        }))
    : [];
  return fresh;
}

function normalizeOffer(record) {
  if (!isObject(record)) throw new Error("An offer in this backup is invalid.");
  const offer = { id: string(record.id, 100) || uid() };
  offer.coaching = normalizeCoachingNotes(record.coaching);
  for (const key of ["company", "role", "benefits", "notes", "priorities"])
    offer[key] = string(
      record[key],
      key === "company" || key === "role" ? 160 : 20000,
    );
  if (typeof record.counterDraft === "string")
    offer.counterDraft = record.counterDraft.slice(0, 20000);
  for (const key of ["opportunityId", "created", "updated"])
    offer[key] = string(record[key], key === "opportunityId" ? 100 : 40);
  for (const key of ["base", "bonus", "equity", "target"]) {
    const value = record[key];
    if (
      typeof value === "number" &&
      Number.isFinite(value) &&
      value >= 0 &&
      value <= 1e9
    )
      offer[key] = value;
    else if (
      typeof value === "string" &&
      /^(?:\d+(?:\.\d*)?|\.\d+)?$/.test(value) &&
      value.length < 20 &&
      Number(value) <= 1e9
    )
      offer[key] = value;
    else offer[key] = "";
  }
  offer.currency =
    typeof record.currency === "string" && /^[A-Z]{3}$/.test(record.currency)
      ? record.currency
      : "USD";
  offer.payPeriod = record.payPeriod === "month" ? "month" : "year";
  offer.status = ["Reviewing", "Negotiating", "Accepted", "Signed"].includes(
    record.status,
  )
    ? record.status
    : "Reviewing";
  const date =
    typeof record.deadline === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(record.deadline)
      ? new Date(`${record.deadline}T00:00:00Z`)
      : null;
  offer.deadline =
    date &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === record.deadline
      ? record.deadline
      : "";
  for (const key of ["checks", "checklist"]) {
    offer[key] = {};
    if (isObject(record[key]))
      Object.entries(record[key])
        .slice(0, 50)
        .forEach(([name, value]) => {
          if (safeKey(name) && typeof value === "boolean")
            offer[key][name] = value;
        });
  }
  return offer;
}

function uniqueIds(records) {
  const ids = new Set();
  records.forEach((record) => {
    if (ids.has(record.id)) record.id = uid();
    ids.add(record.id);
  });
}

export function validateWorkspace(value) {
  if (
    !isObject(value) ||
    value.schema !== 3 ||
    !Array.isArray(value.opportunities) ||
    value.opportunities.length > MAX_RECORDS ||
    !Array.isArray(value.offers) ||
    value.offers.length > MAX_RECORDS
  )
    throw new Error(
      "This is not a supported Momentum backup. Use a backup with no more than 100 opportunities and 100 offers.",
    );
  const state = emptyWorkspace();
  if (isObject(value.profile)) {
    for (const key of Object.keys(emptyProfile))
      state.profile[key] = string(
        value.profile[key],
        key === "resume" ? 60000 : 20000,
      );
    if (isObject(value.profile.preferences))
      state.profile.preferences = {
        workStyle: string(value.profile.preferences.workStyle, 120),
        priority: string(value.profile.preferences.priority, 160),
        nonNegotiables: string(value.profile.preferences.nonNegotiables, 3000),
      };
    if (isObject(value.profile.kitDrafts)) {
      state.profile.kitDrafts = {};
      for (const key of ["headline", "about", "resumeSummary", "bullets"])
        if (typeof value.profile.kitDrafts[key] === "string")
          state.profile.kitDrafts[key] = value.profile.kitDrafts[key].slice(
            0,
            20000,
          );
    }
    if (typeof value.profile.kitSourceSignature === "string")
      state.profile.kitSourceSignature = value.profile.kitSourceSignature.slice(
        0,
        64,
      );
  }
  state.opportunities = value.opportunities.map(normalizeOpportunity);
  uniqueIds(state.opportunities);
  state.offers = value.offers.map(normalizeOffer);
  uniqueIds(state.offers);
  state.settings = { onboarded: value.settings?.onboarded === true };
  state.activeId = state.opportunities.some(
    (record) => record.id === value.activeId,
  )
    ? value.activeId
    : state.opportunities[0]?.id || null;
  return state;
}

function migrateLegacy(records) {
  if (!Array.isArray(records) || records.length > MAX_RECORDS)
    throw new Error("Use a backup with no more than 100 opportunities.");
  const state = emptyWorkspace();
  state.opportunities = records.map((record) =>
    normalizeOpportunity({ ...record, schema: 1 }),
  );
  uniqueIds(state.opportunities);
  state.settings.onboarded = true;
  state.activeId = state.opportunities[0]?.id || null;
  return state;
}

export function loadWorkspace(storage) {
  try {
    storage = storage ?? globalThis.localStorage;
    const saved = storage.getItem(STORAGE_KEY);
    if (saved)
      return { state: validateWorkspace(JSON.parse(saved)), error: null };
    const legacy = storage.getItem("nextstep.preparations.v1");
    if (legacy)
      return {
        state: migrateLegacy(JSON.parse(legacy)),
        error: null,
        migrated: true,
      };
    return { state: emptyWorkspace(), error: null };
  } catch {
    return {
      state: emptyWorkspace(),
      error:
        "We couldn’t read this device’s saved workspace. The original data is still untouched. Export a recovery copy in Settings before resetting storage.",
    };
  }
}

export function writeWorkspace(state, storage = globalThis.localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function parseBackup(text) {
  if (
    typeof text !== "string" ||
    new TextEncoder().encode(text).byteLength > MAX_BACKUP_BYTES
  )
    throw new Error("Backups must be smaller than 5 MB.");
  const parsed = JSON.parse(text);
  if (
    isObject(parsed) &&
    parsed.schema === 1 &&
    Array.isArray(parsed.preparations)
  )
    return migrateLegacy(parsed.preparations);
  return validateWorkspace(parsed);
}
