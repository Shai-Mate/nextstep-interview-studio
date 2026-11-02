import { htmlToText, jobIdFromUrl, decodeEntities } from '../../shared/text.js';

function asArray(value) {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function isJobPosting(node) {
  const type = node?.['@type'];
  const types = asArray(type).map(item => String(item).toLowerCase());
  return types.includes('jobposting');
}

function collectPostings(node, into) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    node.forEach(item => collectPostings(item, into));
    return;
  }
  if (isJobPosting(node)) into.push(node);
  if (Array.isArray(node['@graph'])) node['@graph'].forEach(item => collectPostings(item, into));
}

function postingText(posting) {
  const description = htmlToText(decodeEntities(String(posting.description || '')));
  const lines = [];
  if (posting.title) lines.push(`Title: ${String(posting.title).trim()}`);
  const company = companyName(posting);
  if (company) lines.push(`Company: ${company}`);
  if (posting.employmentType) lines.push(`Employment: ${asArray(posting.employmentType).join(', ')}`);
  if (posting.jobLocation) lines.push(`Location: ${locationText(posting.jobLocation)}`);
  if (description) lines.push(description);
  return lines.filter(Boolean).join('\n');
}

function companyName(posting) {
  const org = posting.hiringOrganization;
  if (!org) return '';
  if (typeof org === 'string') return org.trim();
  return String(org.name || '').trim();
}

function locationText(location) {
  const item = Array.isArray(location) ? location[0] : location;
  const address = item?.address;
  if (typeof address === 'string') return address;
  if (!address || typeof address !== 'object') return '';
  return [address.addressLocality, address.addressRegion, address.postalCode].filter(Boolean).join(', ');
}

function postingBlob(posting) {
  return JSON.stringify(posting);
}

export function extractJsonLd(html) {
  const blocks = [];
  const re = /<script[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = re.exec(String(html || '')))) {
    const raw = match[1].trim();
    if (!raw) continue;
    try {
      blocks.push(JSON.parse(raw));
    } catch {
      /* Ignore broken structured data and keep looking. */
    }
  }
  const postings = [];
  blocks.forEach(block => collectPostings(block, postings));
  return postings.map(posting => ({
    title: String(posting.title || '').trim(),
    company: companyName(posting),
    url: typeof posting.url === 'string' ? posting.url : '',
    jobId: String(posting.identifier?.value || posting.identifier || ''),
    text: postingText(posting),
    raw: postingBlob(posting)
  })).filter(posting => posting.title || posting.text);
}

function looksLikeLogin(html, text) {
  const hay = `${html}\n${text}`.toLowerCase();
  const gate = /sign in to (see|view|apply)|log in to (see|view)|create an account to (view|see|apply)|sign in required/.test(hay);
  return gate && text.length < 800;
}

function looksLikeListing(text) {
  const lines = text.split('\n').filter(line => /apply|full-time|part-time|\$\d|a day ago|posted/.test(line.toLowerCase()));
  return lines.length >= 4 && text.length < 4000;
}

export function extractVacancy(html, pageUrl) {
  const selectedId = jobIdFromUrl(pageUrl);
  const postings = extractJsonLd(html);
  const matches = selectedId
    ? postings.filter(posting => posting.raw.includes(selectedId) || posting.url.includes(selectedId) || posting.jobId === selectedId)
    : [];
  if (selectedId) {
    if (matches.length === 1) {
      return { ok: true, text: matches[0].text, structured: { title: matches[0].title, company: matches[0].company, url: matches[0].url, jobId: selectedId } };
    }
    if (matches.length > 1) return { ok: false, code: 'ambiguous' };
    return { ok: false, code: postings.length ? 'selection-not-found' : (looksLikeLogin(html, htmlToText(html)) ? 'login-required' : 'selection-not-found') };
  }
  if (postings.length === 1) {
    return { ok: true, text: postings[0].text, structured: { title: postings[0].title, company: postings[0].company, url: postings[0].url, jobId: null } };
  }
  if (postings.length > 1) return { ok: false, code: 'listing-only' };
  const text = htmlToText(html).slice(0, 60000);
  if (looksLikeLogin(html, text)) return { ok: false, code: 'login-required' };
  if (looksLikeListing(text)) return { ok: false, code: 'listing-only' };
  if (text.length < 200) return { ok: false, code: 'unreadable' };
  return { ok: true, text, structured: null };
}
