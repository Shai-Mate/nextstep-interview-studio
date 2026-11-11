import { fetchPublicPage } from "./network.js";
import { ServiceError } from "./errors.js";

const entities = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  bull: "•",
  middot: "·",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
  copy: "©",
  reg: "®",
};

export function decodeHtml(text) {
  return String(text || "").replace(
    /&(#x[\da-f]+|#\d+|[a-z]+);/gi,
    (whole, entity) => {
      if (entity[0] !== "#") return entities[entity.toLowerCase()] ?? whole;
      const number =
        entity[1].toLowerCase() === "x"
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(number) &&
        number > 0 &&
        number <= 0x10ffff &&
        !(number >= 0xd800 && number <= 0xdfff)
        ? String.fromCodePoint(number)
        : "";
    },
  );
}

export function plainText(html) {
  // Walk forward rather than using nested-tag regexes, so hostile malformed pages
  // cannot trigger repeated unbounded backtracking on the service event loop.
  const source = String(html || "");
  const lower = source.toLowerCase();
  const excluded = new Set([
    "script",
    "style",
    "noscript",
    "svg",
    "nav",
    "header",
    "footer",
    "form",
    "button",
  ]);
  const blocks = new Set([
    "p",
    "div",
    "section",
    "article",
    "h1",
    "h2",
    "h3",
    "h4",
    "h5",
    "h6",
    "li",
    "ul",
    "ol",
    "table",
    "tr",
  ]);
  const parts = [];
  let cursor = 0;
  while (cursor < source.length) {
    const start = source.indexOf("<", cursor);
    if (start < 0) {
      parts.push(source.slice(cursor));
      break;
    }
    parts.push(source.slice(cursor, start));
    if (source.startsWith("<!--", start)) {
      const end = source.indexOf("-->", start + 4);
      cursor = end < 0 ? source.length : end + 3;
      parts.push(" ");
      continue;
    }
    const tag = lower
      .slice(start + 1, start + 100)
      .match(/^\s*(\/?)\s*([a-z][a-z0-9-]*)\b/);
    if (!tag) {
      parts.push("<");
      cursor = start + 1;
      continue;
    }
    const end = source.indexOf(">", start + 1);
    if (end < 0) break;
    const closing = tag[1] === "/";
    const name = tag[2];
    cursor = end + 1;
    if (!closing && excluded.has(name)) {
      const close = lower.indexOf(`</${name}`, cursor);
      const closeEnd = close < 0 ? -1 : source.indexOf(">", close);
      cursor = closeEnd < 0 ? source.length : closeEnd + 1;
      parts.push(" ");
    } else if (name === "br" || (closing && blocks.has(name))) parts.push("\n");
    else if (name === "li" && !closing) parts.push("• ");
    else parts.push(" ");
  }
  return decodeHtml(parts.join(""))
    .replace(/[\t \f\v]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function elementContent(source, name) {
  const lower = source.toLowerCase();
  const start = lower.indexOf(`<${name}`);
  if (start < 0) return "";
  const openEnd = lower.indexOf(">", start + name.length + 1);
  if (openEnd < 0) return "";
  const close = lower.indexOf(`</${name}`, openEnd + 1);
  return close < 0 ? "" : source.slice(openEnd + 1, close);
}

function findPosting(value, depth = 0, budget = { remaining: 1000 }) {
  if (
    depth > 15 ||
    --budget.remaining < 0 ||
    !value ||
    typeof value !== "object"
  )
    return null;
  if (
    [value["@type"]]
      .flat()
      .some(
        (type) =>
          type === "JobPosting" || type === "https://schema.org/JobPosting",
      )
  )
    return value;
  for (const child of Array.isArray(value) ? value : Object.values(value)) {
    if (child && typeof child === "object") {
      const found = findPosting(child, depth + 1, budget);
      if (found) return found;
    }
  }
  return null;
}

export function extractJob(html, url) {
  let posting = null;
  const lower = html.toLowerCase();
  let cursor = 0;
  while (cursor < html.length) {
    const start = lower.indexOf("<script", cursor);
    if (start < 0) break;
    const openEnd = lower.indexOf(">", start + 7);
    const close = lower.indexOf("</script", openEnd + 1);
    if (openEnd < 0 || close < 0) break;
    cursor = close + 8;
    if (
      !/\btype\s*=\s*["']application\/ld\+json["']/i.test(
        html.slice(start, openEnd),
      )
    )
      continue;
    try {
      posting = findPosting(JSON.parse(html.slice(openEnd + 1, close).trim()));
    } catch {
      /* A malformed embedded block is not a trusted job description. */
    }
    if (posting?.description) break;
  }
  let role = plainText(
    typeof posting?.title === "string"
      ? posting.title
      : elementContent(html, "title"),
  ).slice(0, 120);
  const company = plainText(
    typeof posting?.hiringOrganization?.name === "string"
      ? posting.hiringOrganization.name
      : "",
  ).slice(0, 120);
  let text =
    posting && typeof posting.description === "string"
      ? plainText(posting.description)
      : plainText(elementContent(html, "body") || html);
  if (text.length < 80)
    throw new ServiceError(
      "NO_JOB_TEXT",
      "There is not enough readable job text on that page. It may load after sign-in. Copy and paste the description instead.",
      422,
    );
  const structured = Boolean(
    posting && typeof posting.description === "string",
  );
  if (structured) {
    const extras = [
      "responsibilities",
      "qualifications",
      "skills",
      "experienceRequirements",
      "educationRequirements",
    ]
      .map((key) =>
        typeof posting[key] === "string" ? plainText(posting[key]) : "",
      )
      .filter(Boolean);
    text = [role, company, text, ...extras].filter(Boolean).join("\n\n");
  }
  const warnings = [];
  if (!structured)
    warnings.push(
      "This page did not provide a structured job description. Review the imported text and remove unrelated content.",
    );
  if (text.length > 60000)
    warnings.push(
      "Only the first 60,000 characters were imported. Review the description before continuing.",
    );
  warnings.push(
    "Review the title, company and requirements before creating your plan. Imported website content is not verified by Momentum.",
  );
  return {
    job: {
      text: text.slice(0, 60000),
      role,
      company,
      url,
      source: structured ? "job-posting" : "page",
    },
    warnings,
  };
}

export async function importJob(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input))
    throw new ServiceError("INVALID_INPUT", "Provide a job-ad link.");
  const page = await fetchPublicPage(input.url, options);
  return extractJob(page.body, page.url);
}
