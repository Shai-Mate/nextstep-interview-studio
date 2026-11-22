/* Turn a public job page into plain ad text, plus a company and role when the page says them plainly.
   Pure: no network, no storage. The Worker (index.js) fetches the page and calls extractJob.
   Job-ad text is untrusted data. Callers must escape it before it reaches HTML.

   Company and role are returned only from structured data or a clear heading. Anything unsure is
   left blank so the on-device engine can guess from the text, the way it already does. */

const MIN_TEXT = 80;
const LOGIN = /\b(?:sign[\s-]?in|log[\s-]?in|join now|create an account|sign up to (?:see|view|continue)|please (?:log|sign) in)\b/i;
const WALL_HOST = /(?:^|\.)(?:linkedin\.com|indeed\.com|ziprecruiter\.com|glassdoor\.com)$/i;

const ENTITIES = {
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '...',
  mdash: '-', ndash: '-', rsquo: "'", lsquo: "'", rdquo: '"', ldquo: '"'
};

export function decodeEntities(value) {
  return String(value || '').replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (all, name) => {
    if (name[0] === '#') {
      const hex = name[1] === 'x' || name[1] === 'X';
      const n = parseInt(name.slice(hex ? 2 : 1), hex ? 16 : 10);
      if (!Number.isFinite(n) || n < 0 || n > 0x10ffff) return ' ';
      try { return String.fromCodePoint(n); } catch { return ' '; }
    }
    const key = name.toLowerCase();
    return Object.prototype.hasOwnProperty.call(ENTITIES, key) ? ENTITIES[key] : all;
  });
}

export function htmlToText(html) {
  let s = String(html || '');
  s = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, ' ');
  s = s.replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/<(?:br|hr)\b[^>]*>/gi, '\n');
  s = s.replace(/<li\b[^>]*>/gi, '\n- ');
  s = s.replace(/<\/(?:p|div|li|h[1-6]|tr|section|article|ul|ol|table|blockquote|header|footer)>/gi, '\n');
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s).replace(/\u00a0/g, ' ');
  s = s.replace(/[ \t]+\n/g, '\n').replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function cleanName(value) {
  const s = htmlToText(String(value || '')).replace(/\s+/g, ' ').trim();
  if (!s || s.length > 80) return '';
  const words = s.split(' ').length;
  if (words > 8 || /[!?]/.test(s)) return '';
  return s;
}

function typesOf(node) {
  const t = node && node['@type'];
  const list = Array.isArray(t) ? t : t ? [t] : [];
  return list.map((x) => String(x).toLowerCase());
}

function walkJson(node, out) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) { node.forEach((item) => walkJson(item, out)); return; }
  if (typesOf(node).includes('jobposting')) out.push(node);
  if (node['@graph']) walkJson(node['@graph'], out);
}

export function jobPostings(html) {
  const out = [];
  const re = /<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(String(html || '')))) {
    const raw = m[1].replace(/^\s*<!--|-->\s*$/g, '').trim();
    if (!raw) continue;
    try { walkJson(JSON.parse(raw), out); } catch { /* a broken block is ignored; the visible page can still be read */ }
  }
  return out;
}

function orgName(org) {
  if (!org) return '';
  if (typeof org === 'string') return cleanName(org);
  if (Array.isArray(org)) return orgName(org[0]);
  return cleanName(org.name || '');
}

function metaContent(html, key) {
  const prop = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const a = new RegExp(`<meta\\b[^>]*(?:property|name)\\s*=\\s*["']${prop}["'][^>]*content\\s*=\\s*["']([^"']*)["'][^>]*>`, 'i');
  const b = new RegExp(`<meta\\b[^>]*content\\s*=\\s*["']([^"']*)["'][^>]*(?:property|name)\\s*=\\s*["']${prop}["'][^>]*>`, 'i');
  const m = String(html || '').match(a) || String(html || '').match(b);
  return m ? decodeEntities(m[1]).replace(/\s+/g, ' ').trim() : '';
}

function region(html, pattern) {
  const m = String(html || '').match(pattern);
  return m ? m[1] : '';
}

function headingText(html, pattern) {
  const m = String(html || '').match(pattern);
  return m ? cleanName(m[1]) : '';
}

function hostOf(pageUrl) {
  try { return new URL(pageUrl).hostname.replace(/\.$/, '').toLowerCase(); } catch { return ''; }
}

/* Visible text, preferring the part of the page that is the ad itself. */
function pageText(html) {
  const piece = region(html, /<[^>]+id=["']content["'][^>]*>([\s\S]*?)<\/div>\s*(?:<div|<footer|<\/body)/i)
    || region(html, /<[^>]+class=["'][^"']*(?:job__description|posting-page|section-wrapper|ashby-job-posting-brief-description)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i)
    || region(html, /<[^>]+data-automation-id=["']jobPostingDescription["'][^>]*>([\s\S]*?)<\/div>/i)
    || region(html, /<(?:main|article)\b[^>]*>([\s\S]*?)<\/(?:main|article)>/i)
    || region(html, /<body\b[^>]*>([\s\S]*?)<\/body>/i)
    || html;
  return htmlToText(piece);
}

function fromTitle(html) {
  const title = metaContent(html, 'og:title') || (String(html || '').match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || '';
  const plain = decodeEntities(title).replace(/\s+/g, ' ').trim();
  const cut = plain.split(/\s+[|]\s+|\s+[-–—]\s+(?:jobs?|careers?|greenhouse|lever|ashby|workday)\b/i)[0];
  const at = cut.match(/^(.{2,60}?)\s+(?:at|@)\s+(.{2,60})$/i);
  if (!at) return { role: '', company: '' };
  return { role: cleanName(at[1]), company: cleanName(at[2]) };
}

/**
 * Read one fetched page.
 * Returns { ok:true, text, company, role, title } or { ok:false, reason:'login'|'empty' }.
 * `pageUrl` is only used to recognise login-walled hosts. It is not fetched here.
 */
export function extractJob(html, pageUrl) {
  const source = String(html || '');
  const host = hostOf(pageUrl);
  const postings = jobPostings(source);
  const posting = postings.find((p) => htmlToText(p.description || '').length >= MIN_TEXT) || postings[0] || null;
  let text = posting ? htmlToText(posting.description || '') : '';
  if (text.length < MIN_TEXT) text = pageText(source);
  const title = cleanName(posting && posting.title) || headingText(source, /<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  let company = posting ? orgName(posting.hiringOrganization) : '';
  let role = cleanName(posting && posting.title);
  if (!company) company = headingText(source, /<[^>]+class=["'][^"']*company-name[^"']*["'][^>]*>([\s\S]*?)<\//i);
  if (!role) role = headingText(source, /<h1\b[^>]*class=["'][^"']*(?:app-title|posting-headline)[^"']*["'][^>]*>([\s\S]*?)<\/h1>/i)
    || headingText(source, /<div\b[^>]*class=["'][^"']*posting-headline[^"']*["'][^>]*>[\s\S]*?<h2\b[^>]*>([\s\S]*?)<\/h2>/i);
  if (!company || !role) {
    const guessed = fromTitle(source);
    if (!role) role = guessed.role;
    if (!company) company = guessed.company;
  }
  const walled = WALL_HOST.test(host);
  const login = LOGIN.test(text.slice(0, 1800)) && text.length < 700;
  if ((walled && text.length < 400) || login) return { ok: false, reason: 'login' };
  if (text.length < MIN_TEXT) return { ok: false, reason: 'empty' };
  return { ok: true, text: text.slice(0, 60000), company, role, title: title || role };
}

/* ---------- SSRF: what may be fetched ---------- */

function parseIPv4(host) {
  const h = String(host || '').trim().toLowerCase();
  if (!h || h.startsWith('[')) return null;
  if (/^\d+$/.test(h)) {
    const n = Number(h);
    return Number.isSafeInteger(n) && n >= 0 && n <= 0xffffffff ? n : null;
  }
  if (/^0x[0-9a-f]+$/i.test(h)) {
    const n = parseInt(h, 16);
    return n >= 0 && n <= 0xffffffff ? n : null;
  }
  const parts = h.split('.');
  if (parts.length < 2 || parts.length > 4) return null;
  if (!parts.every((p) => /^(?:0x[0-9a-f]+|\d+)$/i.test(p))) return null;
  const nums = parts.map((p) => (/^0x/i.test(p) ? parseInt(p, 16) : /^0\d/.test(p) ? parseInt(p, 8) : parseInt(p, 10)));
  if (nums.some((n) => !Number.isFinite(n) || n < 0)) return null;
  if (parts.length === 4) {
    if (nums.some((n) => n > 255)) return null;
    return (((nums[0] << 24) | (nums[1] << 16) | (nums[2] << 8) | nums[3]) >>> 0);
  }
  if (parts.length === 3) {
    if (nums[0] > 255 || nums[1] > 255 || nums[2] > 0xffff) return null;
    return (((nums[0] << 24) | (nums[1] << 16) | nums[2]) >>> 0);
  }
  if (nums[0] > 255 || nums[1] > 0xffffff) return null;
  return (((nums[0] << 24) | nums[1]) >>> 0);
}

export function isPrivateIPv4(n) {
  const a = (n >>> 24) & 255;
  const b = (n >>> 16) & 255;
  const c = (n >>> 8) & 255;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true;
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true;
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true;
  if (a === 198 && (b === 18 || b === 19)) return true;
  if (a === 198 && b === 51 && c === 100) return true;
  if (a === 203 && b === 0 && c === 113) return true;
  if (a >= 224) return true;
  return false;
}

function plausibleIPv6(h) {
  if (!h || h.includes(':::')) return false;
  const halves = h.split('::');
  if (halves.length > 2) return false;
  const groups = halves.join(':').split(':').filter(Boolean);
  if (!groups.length || groups.length > 8) return false;
  return groups.every((g) => /^[0-9a-f]{1,4}$/i.test(g) || /^\d{1,3}(?:\.\d{1,3}){3}$/.test(g));
}

function isPrivateIPv6(host) {
  let h = String(host || '').toLowerCase().split('%')[0];
  if (h === '::' || h === '::1') return true;
  const mapped = h.match(/^(?:(?:0:){5}ffff|::ffff):(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) {
    const v4 = parseIPv4(mapped[1]);
    return v4 === null || isPrivateIPv4(v4);
  }
  if (!plausibleIPv6(h)) return true;
  const firstHex = h.startsWith('::') ? '0' : h.split(':')[0] || '0';
  const head = parseInt(firstHex, 16);
  if (!Number.isFinite(head)) return true;
  if ((head & 0xfe00) === 0xfc00) return true;
  if ((head & 0xffc0) === 0xfe80) return true;
  if ((head & 0xffc0) === 0xfec0) return true;
  if ((head & 0xff00) === 0xff00) return true;
  if (h === '2001:db8' || h.startsWith('2001:db8:')) return true;
  return false;
}

export function isBlockedHostname(hostname) {
  let h = String(hostname || '').trim().toLowerCase().replace(/\.$/, '');
  if (!h) return true;
  if (h.startsWith('[') && h.endsWith(']')) h = h.slice(1, -1);
  if (h === 'localhost' || h.endsWith('.localhost') || h.endsWith('.local') || h.endsWith('.internal') || h.endsWith('.localdomain')) return true;
  if (h === 'metadata' || h === 'metadata.google.internal' || h === 'instance-data') return true;
  const v4 = parseIPv4(h);
  if (v4 !== null) return isPrivateIPv4(v4);
  if (h.includes(':')) return isPrivateIPv6(h);
  if (/^[\d.]+$/.test(h)) return true;
  return false;
}

/** Empty string when the URL may be fetched. Otherwise 'invalid' or 'blocked'. */
export function isBlockedUrl(input) {
  let u;
  try { u = new URL(String(input || '').trim()); } catch { return 'invalid'; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return 'invalid';
  if (u.username || u.password) return 'invalid';
  if (isBlockedHostname(u.hostname)) return 'blocked';
  return '';
}

export function isPrivateAddress(ip) {
  const v4 = parseIPv4(ip);
  if (v4 !== null) return isPrivateIPv4(v4);
  if (String(ip || '').includes(':')) return isPrivateIPv6(ip);
  return true;
}
