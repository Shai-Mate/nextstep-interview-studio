/** Local, reviewable AI notes. These helpers never send or execute note content. */
export const COACHING_ACTIONS = Object.freeze([
  "course",
  "interview-feedback",
  "application",
  "research",
  "negotiation",
]);
export const COACHING_LIMITS = Object.freeze({
  entries: 12,
  totalCharacters: 80000,
  textCharacters: 60000,
  titleCharacters: 200,
  sources: 12,
  sourceTitleCharacters: 240,
  sourceUrlCharacters: 2000,
});
const labels = {
  course: "Course coaching",
  "interview-feedback": "Interview feedback",
  application: "Application coaching",
  research: "Research brief",
  negotiation: "Offer coaching",
};
const isObject = (value) =>
  value !== null && typeof value === "object" && !Array.isArray(value);
const safeId = (value) =>
  typeof value === "string" && /^[a-z0-9][a-z0-9_.-]{0,99}$/i.test(value);
const validContext = (value, action) =>
  value === action ||
  (typeof value === "string" &&
    value.startsWith(`${action}:`) &&
    /^[a-z0-9][a-z0-9_-]{0,79}$/i.test(value.slice(action.length + 1)));
const cleanString = (value, max) =>
  typeof value === "string" ? value.replace(/\u0000/g, "").slice(0, max) : "";
const serializedSize = (notes) => JSON.stringify(notes).length;

export function coachingContextKey(action, contextId = "") {
  if (!COACHING_ACTIONS.includes(action))
    throw new Error("Choose a supported coaching action.");
  if (contextId === "" || contextId == null) return action;
  if (
    typeof contextId !== "string" ||
    !/^[a-z0-9][a-z0-9_-]{0,79}$/i.test(contextId)
  )
    throw new Error(
      "This coaching note has an invalid lesson or question reference.",
    );
  return `${action}:${contextId}`;
}

function sourceUrl(value) {
  if (
    typeof value !== "string" ||
    value.length > COACHING_LIMITS.sourceUrlCharacters
  )
    return null;
  try {
    const url = new URL(value);
    if (
      !["https:", "http:"].includes(url.protocol) ||
      url.username ||
      url.password
    )
      return null;
    const host = url.hostname.toLowerCase();
    // Sources are public professional pages, not local services or file links.
    if (
      !host.includes(".") ||
      /(?:^|\.)(?:localhost|local|internal|invalid|test)$/.test(host) ||
      host.includes(":")
    )
      return null;
    if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
      const [a, b] = host.split(".").map(Number);
      if (
        a === 0 ||
        a === 10 ||
        a === 127 ||
        a >= 224 ||
        (a === 169 && b === 254) ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 100 && b >= 64 && b <= 127)
      )
        return null;
    }
    return url.href;
  } catch {
    return null;
  }
}

function normalizeSources(value) {
  if (!Array.isArray(value)) return [];
  const urls = new Set();
  const sources = [];
  for (const item of value.slice(0, 100)) {
    if (!isObject(item)) continue;
    const url = sourceUrl(item.url);
    if (!url || urls.has(url)) continue;
    urls.add(url);
    sources.push({
      title:
        cleanString(item.title, COACHING_LIMITS.sourceTitleCharacters).trim() ||
        new URL(url).hostname,
      url,
    });
    if (sources.length === COACHING_LIMITS.sources) break;
  }
  return sources;
}

function normalizeNote(value) {
  if (
    !isObject(value) ||
    !safeId(value.id) ||
    !COACHING_ACTIONS.includes(value.action) ||
    typeof value.created !== "string" ||
    value.created.length > 40 ||
    !/^\d{4}-\d{2}-\d{2}T/.test(value.created) ||
    !Number.isFinite(Date.parse(value.created))
  )
    return null;
  const text = cleanString(value.text, COACHING_LIMITS.textCharacters);
  if (!text.trim()) return null;
  return {
    id: value.id,
    action: value.action,
    title:
      cleanString(value.title, COACHING_LIMITS.titleCharacters).trim() ||
      labels[value.action],
    created: value.created,
    text,
    sources: normalizeSources(value.sources),
    contextKey: validContext(value.contextKey, value.action)
      ? value.contextKey
      : value.action,
  };
}

/** Restore valid newest-first entries. Invalid/oversized backup material is bounded;
 * notes produced by appendCoachingNote round-trip without losing content. */
export function normalizeCoachingNotes(value) {
  if (!Array.isArray(value)) return [];
  const notes = [];
  const ids = new Set();
  for (const item of value.slice(0, 200)) {
    const note = normalizeNote(item);
    if (!note || ids.has(note.id)) continue;
    if (serializedSize([...notes, note]) > COACHING_LIMITS.totalCharacters)
      continue;
    notes.push(note);
    ids.add(note.id);
    if (notes.length === COACHING_LIMITS.entries) break;
  }
  return notes;
}

/** Save explicitly without replacing history. Limits never silently drop existing
 * valid notes or cut off a new response; callers can offer deletion or export. */
export function appendCoachingNote(existing, data) {
  if (!isObject(data) || !COACHING_ACTIONS.includes(data.action))
    throw new Error(
      "Choose a supported coaching action before saving this note.",
    );
  if (typeof data.text !== "string" || !data.text.trim())
    throw new Error("There are no coaching suggestions to save yet.");
  if (data.text.length > COACHING_LIMITS.textCharacters)
    throw new Error(
      "This coaching response is too long to save as one note. Export it to keep the complete response.",
    );
  if (
    data.title != null &&
    (typeof data.title !== "string" ||
      data.title.length > COACHING_LIMITS.titleCharacters)
  )
    throw new Error("Use a coaching note title of 200 characters or fewer.");
  if (data.contextKey != null && !validContext(data.contextKey, data.action))
    throw new Error(
      "This coaching note has an invalid lesson or question reference.",
    );
  if (data.id != null && !safeId(data.id))
    throw new Error("This coaching note has an invalid identifier.");
  const created = data.created ?? new Date().toISOString();
  const note = normalizeNote({
    ...data,
    id:
      data.id ??
      globalThis.crypto?.randomUUID?.() ??
      `coaching-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
    created,
  });
  if (!note)
    throw new Error("This coaching note has an invalid date or format.");
  const notes = normalizeCoachingNotes(existing);
  if (notes.some((entry) => entry.id === note.id))
    throw new Error("This coaching note has already been saved.");
  if (notes.length >= COACHING_LIMITS.entries)
    throw new Error(
      "You have 12 saved coaching notes here. Export or remove a note before saving another.",
    );
  const result = [note, ...notes];
  if (serializedSize(result) > COACHING_LIMITS.totalCharacters)
    throw new Error(
      "These coaching notes are nearly full. Export this response or remove an older note before saving it.",
    );
  return result;
}
