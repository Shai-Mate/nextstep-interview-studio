import test from "node:test";
import assert from "node:assert/strict";
import {
  appendCoachingNote,
  normalizeCoachingNotes,
  coachingContextKey,
  COACHING_LIMITS,
} from "../src/lib/coaching.js";
import {
  emptyWorkspace,
  normalizeOpportunity,
  validateWorkspace,
  parseBackup,
} from "../src/lib/storage.js";

const draft = (extra = {}) => ({
  id: "coach-1",
  action: "course",
  title: "Build a clearer evidence story",
  created: "2026-11-11T03:00:00.000Z",
  text: "Start with the customer problem. Explain the action you personally took. Only include an outcome you can support.",
  sources: [{ title: "Company careers", url: "https://example.com/careers" }],
  contextKey: "course:evidence-stories",
  ...extra,
});
const job =
  "Product Designer\nCompany: Example\nResearch user needs, design accessible product flows and collaborate with engineering. Explain decisions with evidence from user research.";

test("explicit saves create independent newest-first notes without replacing earlier coaching", () => {
  const first = appendCoachingNote([], draft());
  Object.freeze(first[0]);
  Object.freeze(first);
  const second = appendCoachingNote(
    first,
    draft({
      id: "coach-2",
      text: "A second perspective using the same lesson.",
      created: "2026-11-11T04:00:00.000Z",
    }),
  );
  assert.deepEqual(
    second.map((n) => n.id),
    ["coach-2", "coach-1"],
  );
  assert.equal(first.length, 1);
  assert.equal(first[0].text, draft().text);
  assert.notEqual(second[1], first[0]);
  assert.deepEqual(
    normalizeCoachingNotes(JSON.parse(JSON.stringify(second))),
    second,
  );
});

test("save generates durable identifiers and dates when the UI omits them", () => {
  const { id, created, ...data } = draft();
  const saved = appendCoachingNote(undefined, data)[0];
  assert.ok(saved.id);
  assert.ok(Number.isFinite(Date.parse(saved.created)));
  assert.deepEqual(normalizeCoachingNotes([saved]), [saved]);
});

test("safe keys keep lessons, questions and actions separate", () => {
  assert.equal(
    coachingContextKey("course", "role-practice"),
    "course:role-practice",
  );
  assert.equal(
    coachingContextKey("interview-feedback", "evidence"),
    "interview-feedback:evidence",
  );
  assert.equal(coachingContextKey("application"), "application");
  assert.equal(coachingContextKey("negotiation"), "negotiation");
  for (const context of [
    "../../notes",
    "<script>",
    "role:one",
    "x".repeat(81),
    {},
  ])
    assert.throws(() => coachingContextKey("course", context), /reference/);
  assert.throws(() => coachingContextKey("__proto__"), /supported/);
  assert.throws(
    () =>
      appendCoachingNote([], draft({ contextKey: "research:role-practice" })),
    /reference/,
  );
});

test("note capacity fails explicitly and leaves all existing content untouched", () => {
  let notes = [];
  for (let i = 0; i < COACHING_LIMITS.entries; i++)
    notes = appendCoachingNote(notes, draft({ id: `note-${i}` }));
  const before = JSON.stringify(notes);
  assert.throws(
    () => appendCoachingNote(notes, draft({ id: "one-too-many" })),
    /12 saved coaching notes/,
  );
  assert.equal(JSON.stringify(notes), before);
  assert.deepEqual(normalizeCoachingNotes(notes), notes);
});

test("aggregate capacity does not silently discard an older note or truncate a new one", () => {
  const notes = appendCoachingNote([], draft({ text: "A".repeat(45000) }));
  const before = JSON.stringify(notes);
  assert.throws(
    () =>
      appendCoachingNote(
        notes,
        draft({ id: "second", text: "B".repeat(40000) }),
      ),
    /nearly full/,
  );
  assert.equal(JSON.stringify(notes), before);
  assert.throws(
    () => appendCoachingNote([], draft({ text: "C".repeat(60001) })),
    /too long/,
  );
  assert.equal(notes[0].text.length, 45000);
});

test("invalid actions, empty responses, duplicate identifiers and bad dates cannot be saved", () => {
  for (const data of [null, {}, draft({ action: "submit-job" })])
    assert.throws(() => appendCoachingNote([], data), /supported/);
  for (const text of [undefined, "", "  ", {}])
    assert.throws(() => appendCoachingNote([], draft({ text })), /no coaching/);
  assert.throws(
    () => appendCoachingNote([], draft({ created: "not-a-date" })),
    /invalid date/,
  );
  assert.throws(
    () => appendCoachingNote([], draft({ title: "x".repeat(201) })),
    /200 characters/,
  );
  const notes = appendCoachingNote([], draft());
  assert.throws(() => appendCoachingNote(notes, draft()), /already been saved/);
});

test("source links retain public attribution while excluding executable, credentialed and local URLs", () => {
  const urls = [
    "javascript:alert(1)",
    "data:text/html,bad",
    "file:///etc/passwd",
    "https://name:secret@example.com/",
    "http://localhost/admin",
    "http://127.0.0.1/",
    "http://0x7f000001/",
    "http://10.0.0.1/",
    "http://192.168.1.1/",
    "http://172.16.0.1/",
    "http://169.254.169.254/",
    "http://[::1]/",
  ];
  const saved = appendCoachingNote(
    [],
    draft({
      sources: [
        ...urls.map((url) => ({ title: "Untrusted", url })),
        { title: "Official page", url: "https://example.com/team" },
        { title: "Duplicate", url: "https://example.com/team" },
        { url: "http://public.example.org/about" },
      ],
    }),
  )[0];
  assert.deepEqual(saved.sources, [
    { title: "Official page", url: "https://example.com/team" },
    { title: "public.example.org", url: "http://public.example.org/about" },
  ]);
});

test("malformed backups are bounded and cannot add arbitrary fields or unsafe context keys", () => {
  const malicious = JSON.parse(
    '{"id":"note-safe","action":"research","title":"Review this claim","created":"2026-11-11T03:00:00Z","text":"<script>not executable</script>","contextKey":"__proto__","__proto__":{"polluted":true},"sources":[]}',
  );
  const notes = normalizeCoachingNotes([
    null,
    {},
    draft({ action: "fake" }),
    malicious,
    malicious,
  ]);
  assert.equal(notes.length, 1);
  assert.equal(notes[0].contextKey, "research");
  assert.equal(notes[0].text, "<script>not executable</script>");
  assert.equal(Object.hasOwn(notes[0], "__proto__"), false);
  assert.equal({}.polluted, undefined);
  assert.deepEqual(normalizeCoachingNotes("not an array"), []);
  assert.ok(
    normalizeCoachingNotes(
      Array.from({ length: 100 }, (_, i) => draft({ id: `n-${i}` })),
    ).length <= 12,
  );
  const oversized = normalizeCoachingNotes([
    draft({ text: "A".repeat(60000) }),
    draft({ id: "too-large", text: "B".repeat(60000) }),
    draft({ id: "small-last", text: "A small valid note." }),
  ]);
  assert.deepEqual(
    oversized.map((n) => n.id),
    ["coach-1", "small-last"],
  );
  assert.ok(JSON.stringify(oversized).length <= 80000);
});

test("opportunity and offer coaching survive workspace validation, export and restore intact", () => {
  const course = appendCoachingNote([], draft());
  const offerNotes = appendCoachingNote(
    [],
    draft({
      id: "offer-coach",
      action: "negotiation",
      contextKey: "negotiation",
      title: "Review the package",
      text: "Confirm bonus terms and the response deadline.",
    }),
  );
  const workspace = {
    ...emptyWorkspace(),
    opportunities: [
      normalizeOpportunity({
        id: "opportunity-1",
        role: "Product Designer",
        company: "Example",
        job,
        coaching: course,
      }),
    ],
    offers: [
      {
        id: "offer-1",
        company: "Example",
        role: "Product Designer",
        base: 90000,
        coaching: offerNotes,
      },
    ],
    activeId: "opportunity-1",
  };
  const normalized = validateWorkspace(workspace);
  const restored = parseBackup(JSON.stringify(normalized));
  assert.deepEqual(normalized.opportunities[0].coaching, course);
  assert.deepEqual(normalized.offers[0].coaching, offerNotes);
  assert.deepEqual(restored.opportunities[0].coaching, course);
  assert.deepEqual(restored.offers[0].coaching, offerNotes);
  assert.equal(
    normalized.opportunities[0].notes["evidence-stories"],
    undefined,
  );
});

test("older workspaces without coaching remain readable with empty note collections", () => {
  const restored = validateWorkspace({
    ...emptyWorkspace(),
    opportunities: [{ id: "old-opportunity", job }],
    offers: [{ id: "old-offer", base: 50000 }],
  });
  assert.deepEqual(restored.opportunities[0].coaching, []);
  assert.deepEqual(restored.offers[0].coaching, []);
});
