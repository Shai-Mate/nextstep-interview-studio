import test from "node:test";
import assert from "node:assert/strict";
import {
  STORAGE_KEY,
  emptyWorkspace,
  loadWorkspace,
  writeWorkspace,
  parseBackup,
  validateWorkspace,
  normalizeOpportunity,
} from "../src/lib/storage.js";

const JOB =
  "Registered Nurse\nExample Clinic\nProvide patient assessments, document clinical care, communicate with patients and families, and follow evidence-based safety procedures. Work with the multidisciplinary team to deliver person-centred care.";
const opportunity = (extra = {}) => ({
  id: "role-1",
  job: JOB,
  role: "Registered Nurse",
  company: "Example Clinic",
  ...extra,
});
function memoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  const calls = [];
  return {
    getItem(key) {
      return entries.get(key) ?? null;
    },
    setItem(key, value) {
      calls.push([key, value]);
      entries.set(key, value);
    },
    removeItem(key) {
      entries.delete(key);
    },
    calls,
  };
}

test("new device creates an independent, empty workspace without writing storage", () => {
  const storage = memoryStorage();
  const result = loadWorkspace(storage);
  assert.equal(result.error, null);
  assert.equal(result.state.schema, 3);
  assert.deepEqual(result.state.opportunities, []);
  assert.equal(storage.calls.length, 0);
  const second = emptyWorkspace();
  result.state.profile.name = "One person";
  assert.equal(second.profile.name, "");
});

test("workspace round trip retains substantive user work and reconciles mock position from saved answers", () => {
  const state = emptyWorkspace();
  state.profile = {
    ...state.profile,
    name: "Avery",
    resume: "Clinical experience from my own work",
    skills: "Patient care",
  };
  state.opportunities = [
    normalizeOpportunity(
      opportunity({
        status: "Interview",
        interviewDate: "2026-12-03T10:30",
        interviewer: {
          name: "Jordan",
          role: "Nurse manager",
          url: "https://example.com/team",
          notes: "Public bio supplied by candidate",
        },
        notes: { "story-1": "I introduced a handover checklist." },
        companyNotes: "The website describes outpatient care.",
        mock: {
          index: 999,
          answers: [
            {
              question: "Describe a safe handover.",
              text: "I used a structured handover and checked the receiving nurse understood the care plan.",
              at: "2026-11-11T00:00:00Z",
            },
          ],
          draft: "A second answer in progress",
        },
      }),
    ),
  ];
  state.activeId = "role-1";
  state.offers = [
    {
      id: "offer-1",
      company: "Example Clinic",
      base: 85000,
      bonus: 5000,
      currency: "CAD",
      payPeriod: "year",
      checklist: { written: true, signed: false },
    },
  ];
  const storage = memoryStorage();
  writeWorkspace(state, storage);
  const restored = loadWorkspace(storage);
  assert.equal(restored.error, null);
  assert.equal(restored.state.profile.name, "Avery");
  assert.equal(restored.state.opportunities[0].mock.index, 1);
  assert.equal(restored.state.opportunities[0].mock.finished, false);
  assert.equal(
    restored.state.opportunities[0].mock.draft,
    "A second answer in progress",
  );
  assert.equal(restored.state.opportunities[0].interviewer.name, "Jordan");
  assert.equal(
    restored.state.opportunities[0].notes["story-1"],
    "I introduced a handover checklist.",
  );
  assert.equal(restored.state.offers[0].checklist.written, true);
  assert.equal(restored.state.activeId, "role-1");
});

test("unreadable or invalid saved data is preserved and is never silently replaced", () => {
  for (const original of [
    "{broken",
    JSON.stringify({ schema: 3, opportunities: "not-an-array", offers: [] }),
    JSON.stringify({ ...emptyWorkspace(), opportunities: [null] }),
  ]) {
    const storage = memoryStorage({ [STORAGE_KEY]: original });
    const result = loadWorkspace(storage);
    assert.match(result.error, /saved workspace/i);
    assert.equal(storage.getItem(STORAGE_KEY), original);
    assert.equal(storage.calls.length, 0);
  }
});

test("storage read and write failures are observable instead of claiming persistence", () => {
  const denied = {
    getItem() {
      throw new Error("Access denied");
    },
    setItem() {
      throw new Error("Quota exceeded");
    },
  };
  assert.match(loadWorkspace(denied).error, /saved workspace/i);
  assert.throws(
    () => writeWorkspace(emptyWorkspace(), denied),
    /Quota exceeded/,
  );
});

test("legacy preparations migrate without altering or erasing their source", () => {
  const original = JSON.stringify([
    opportunity({
      schema: 1,
      notes: { "lesson-0": "Original research", "answer-0": "Original answer" },
      mock: { answers: [], draft: "Unfinished original answer" },
    }),
  ]);
  const storage = memoryStorage({ "nextstep.preparations.v1": original });
  const result = loadWorkspace(storage);
  assert.equal(result.migrated, true);
  assert.equal(result.state.opportunities.length, 1);
  assert.equal(
    result.state.opportunities[0].notes["lesson-0"],
    "Original research",
  );
  assert.equal(
    result.state.opportunities[0].mock.draft,
    "Unfinished original answer",
  );
  assert.equal(storage.getItem("nextstep.preparations.v1"), original);
  assert.equal(storage.calls.length, 0);
});

test("backup validation rejects unsupported formats and excessive counts", () => {
  assert.throws(() => parseBackup("{broken"));
  assert.throws(
    () =>
      parseBackup(JSON.stringify({ schema: 7, opportunities: [], offers: [] })),
    /supported Momentum backup/,
  );
  assert.throws(() => parseBackup(" ".repeat(5_000_001)), /5 MB/);
  assert.throws(
    () =>
      validateWorkspace({
        ...emptyWorkspace(),
        opportunities: Array.from({ length: 101 }, () => opportunity()),
      }),
    /supported Momentum backup/,
  );
  assert.throws(
    () =>
      validateWorkspace({
        ...emptyWorkspace(),
        offers: Array.from({ length: 101 }, () => ({})),
      }),
    /supported Momentum backup/,
  );
  assert.throws(
    () =>
      parseBackup(
        JSON.stringify({
          schema: 1,
          preparations: Array.from({ length: 101 }, () => opportunity()),
        }),
      ),
    /100|supported|too many/i,
  );
});

test("oversized legacy storage fails safely instead of bypassing the workspace limit", () => {
  const original = JSON.stringify(
    Array.from({ length: 101 }, () => opportunity()),
  );
  const storage = memoryStorage({ "nextstep.preparations.v1": original });
  assert.match(loadWorkspace(storage).error, /saved workspace/i);
  assert.equal(storage.getItem("nextstep.preparations.v1"), original);
});

test("restoring duplicate opportunity identifiers assigns independent identities", () => {
  const state = validateWorkspace({
    ...emptyWorkspace(),
    activeId: "missing",
    opportunities: [opportunity(), opportunity()],
  });
  assert.notEqual(state.opportunities[0].id, state.opportunities[1].id);
  assert.equal(state.activeId, state.opportunities[0].id);
});

test("untrusted properties do not alter prototypes, create executable markup, or leak into profile", () => {
  const raw = JSON.parse(
    JSON.stringify({
      ...emptyWorkspace(),
      profile: { name: "<img src=x onerror=alert(1)>", unexpected: "secret" },
      opportunities: [opportunity()],
    }),
  );
  raw.opportunities[0].notes = JSON.parse(
    '{"__proto__":{"polluted":true},"constructor":"bad","safe":"<script>alert(1)</script>"}',
  );
  raw.offers = [
    JSON.parse(
      '{"id":"x","__proto__":{"polluted":true},"constructor":"bad","base":100}',
    ),
  ];
  const state = validateWorkspace(raw);
  assert.equal({}.polluted, undefined);
  assert.equal(Object.hasOwn(state.offers[0], "constructor"), false);
  assert.equal(
    Object.hasOwn(state.opportunities[0].notes, "constructor"),
    false,
  );
  assert.equal(state.profile.unexpected, undefined);
  assert.equal(state.profile.name, "<img src=x onerror=alert(1)>"); // React renders this as text.
  assert.equal(state.opportunities[0].notes.safe, "<script>alert(1)</script>");
});

test("lesson completion only accepts actual booleans", () => {
  const base = normalizeOpportunity(opportunity());
  const records = base.course.map((lesson, index) => ({
    ...lesson,
    done: index === 0 ? "false" : index === 1 ? true : false,
  }));
  const restored = normalizeOpportunity({ ...base, course: records });
  assert.equal(restored.course[0].done, false);
  assert.equal(restored.course[1].done, true);
});

test("oversized fields are bounded and invalid quiz selections are ignored", () => {
  const result = normalizeOpportunity(
    opportunity({
      role: "A".repeat(1000),
      notes: { evidence: "x".repeat(70000) },
      quiz: {
        answers: {
          lesson0: 2,
          lesson1: -1,
          lesson2: "1",
          lesson3: 99,
          "bad key": 0,
        },
      },
    }),
  );
  assert.ok(result.role.length <= 120);
  assert.equal(result.notes.evidence.length, 60000);
  assert.deepEqual(result.quiz.answers, { lesson0: 2 });
});

test("edited profile drafts, preferences, and offer negotiation work survive restore", () => {
  const value = emptyWorkspace();
  value.profile = {
    ...value.profile,
    preferences: {
      workStyle: "Remote",
      priority: "Learning and growth",
      nonNegotiables: "No relocation",
    },
    kitDrafts: {
      headline: "My revised headline",
      about: "My own words",
      resumeSummary: "A precise introduction",
      bullets: "A truthful result",
    },
    kitSourceSignature: "9fed1234",
  };
  value.offers = [
    {
      id: "offer",
      company: "Example",
      role: "Nurse",
      base: "85000",
      target: "90000",
      payPeriod: "year",
      currency: "CAD",
      status: "Negotiating",
      deadline: "2026-12-01",
      checks: { written: true, signed: false },
      counterDraft:
        "Thank you for the offer. Could we discuss the base salary?",
      priorities: "Predictable schedule",
    },
  ];
  const restored = parseBackup(JSON.stringify(value));
  assert.deepEqual(restored.profile.preferences, value.profile.preferences);
  assert.deepEqual(restored.profile.kitDrafts, value.profile.kitDrafts);
  assert.equal(restored.profile.kitSourceSignature, "9fed1234");
  assert.deepEqual(restored.offers[0].checks, { written: true, signed: false });
  assert.equal(restored.offers[0].counterDraft, value.offers[0].counterDraft);
  assert.equal(restored.offers[0].status, "Negotiating");
});

test("blocked browser storage getter reports recovery instead of crashing startup", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("Storage access is blocked");
    },
  });
  try {
    assert.match(loadWorkspace().error, /saved workspace/i);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});

test("absent offer counterdraft remains absent so a generated draft can be shown", () => {
  const state = validateWorkspace({
    ...emptyWorkspace(),
    offers: [
      {
        id: "fresh-offer",
        company: "Example",
        base: 80000,
        deadline: "2026-02-31",
      },
    ],
  });
  assert.equal(Object.hasOwn(state.offers[0], "counterDraft"), false);
  assert.equal(state.offers[0].deadline, "");
});
