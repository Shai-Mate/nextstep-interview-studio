/* Shared text helpers. Job-ad content is data, never instructions. */

export function norm(value) {
  return String(value ?? '').toLowerCase().replace(/\s+/g, ' ').trim();
}

export function containsNorm(haystack, needle) {
  const n = norm(needle);
  return n.length > 0 && norm(haystack).includes(n);
}

export function jobIdFromUrl(raw) {
  let url;
  try {
    url = new URL(String(raw));
  } catch {
    return null;
  }
  const id = url.searchParams.get('vjk') || url.searchParams.get('jk') || url.searchParams.get('jobId');
  if (id && /^[a-zA-Z0-9]{6,40}$/.test(id)) return id;
  return null;
}

export function isSingleHttpUrl(value) {
  const text = String(value ?? '').trim();
  if (!/^https?:\/\/\S+$/i.test(text)) return false;
  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

export function clip(value, max) {
  return String(value ?? '').slice(0, max);
}

export function wordsFromId(id) {
  return String(id || '').split('-').filter(Boolean).map((part, index) => {
    if (index === 0) return part.charAt(0).toUpperCase() + part.slice(1);
    return part;
  }).join(' ');
}

export function decodeEntities(value) {
  return String(value ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => safeCode(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, num) => safeCode(Number(num)))
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'");
}

function safeCode(code) {
  if (!Number.isFinite(code) || code < 0 || code > 0x10ffff) return '';
  if (code < 32 && code !== 10 && code !== 9) return '';
  return String.fromCodePoint(code);
}

export function htmlToText(html) {
  const blocked = new Set(['script', 'style', 'nav', 'noscript', 'template', 'svg', 'iframe', 'header', 'footer']);
  const breaks = new Set(['p', 'div', 'br', 'li', 'h1', 'h2', 'h3', 'h4', 'section', 'article', 'tr', 'ul', 'ol']);
  const parts = [];
  const stack = [];
  const source = String(html ?? '');
  const re = /<!--[\s\S]*?-->|<\/([a-z0-9]+)\s*>|<([a-z0-9]+)(\s[^>]*)?>|([^<]+)/gi;
  let match;
  while ((match = re.exec(source))) {
    if (match[0].startsWith('<!--')) continue;
    if (match[1]) {
      const tag = match[1].toLowerCase();
      const index = stack.lastIndexOf(tag);
      if (index >= 0) stack.splice(index);
      else if (breaks.has(tag)) parts.push('\n');
      continue;
    }
    if (match[2]) {
      const tag = match[2].toLowerCase();
      if (blocked.has(tag)) stack.push(tag);
      else if (!stack.length && breaks.has(tag)) parts.push('\n');
      if (match[0].endsWith('/>') && blocked.has(tag) && stack.at(-1) === tag) stack.pop();
      continue;
    }
    if (!stack.length && match[4]) parts.push(decodeEntities(match[4]));
  }
  return parts.join('').split(/\n+/).map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}
