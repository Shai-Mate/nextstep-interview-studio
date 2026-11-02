import { assertPublicAddresses, validateUrl, JobFetchError } from './ssrf.js';
import { extractVacancy } from './html-job.js';

export const MAX_PAGE_BYTES = 1024 * 1024;
export const FETCH_BUDGET_MS = 10000;
const MAX_REDIRECTS = 3;

export async function resolveHostDefault(host, fetchImpl) {
  const ips = [];
  for (const type of ['A', 'AAAA']) {
    const response = await fetchImpl(`https://cloudflare-dns.com/dns-query?name=${encodeURIComponent(host)}&type=${type}`, {
      headers: { accept: 'application/dns-json' }
    });
    if (!response.ok) throw new JobFetchError('dns-failed');
    const data = await response.json();
    for (const answer of data.Answer || []) {
      if ((answer.type === 1 || answer.type === 28) && typeof answer.data === 'string') ips.push(answer.data);
    }
  }
  return ips;
}

async function addressesFor(target, resolveHost) {
  if (target.literal) return [target.host];
  try {
    return await resolveHost(target.host);
  } catch (error) {
    if (error instanceof JobFetchError) throw error;
    throw new JobFetchError('dns-failed');
  }
}

async function readLimited(response, deadline, now) {
  const length = response.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_PAGE_BYTES)) throw new JobFetchError('too-large');
  if (!response.body || typeof response.body.getReader !== 'function') {
    const buffer = new Uint8Array(await response.arrayBuffer());
    if (buffer.byteLength > MAX_PAGE_BYTES) throw new JobFetchError('too-large');
    return new TextDecoder().decode(buffer);
  }
  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    if (now() > deadline) throw new JobFetchError('timeout');
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_PAGE_BYTES) throw new JobFetchError('too-large');
    chunks.push(value);
  }
  const merged = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(merged);
}

export async function fetchVacancy(rawUrl, { fetchImpl, resolveHost, now = () => Date.now() } = {}) {
  if (!fetchImpl || !resolveHost) throw new JobFetchError('dns-failed');
  const deadline = now() + FETCH_BUDGET_MS;
  let current = rawUrl;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    if (now() > deadline) throw new JobFetchError('timeout');
    const target = validateUrl(current);
    const before = await addressesFor(target, resolveHost);
    assertPublicAddresses(before);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), Math.max(1, deadline - now()));
    let response;
    try {
      response = await fetchImpl(target.url.href, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          accept: 'text/html,application/xhtml+xml,text/plain',
          'user-agent': 'NextStepInterviewStudio/3.0'
        }
      });
    } catch {
      throw new JobFetchError('timeout');
    } finally {
      clearTimeout(timer);
    }
    const after = await addressesFor(target, resolveHost);
    assertPublicAddresses(after);
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || hop === MAX_REDIRECTS) throw new JobFetchError('too-many-redirects');
      current = new URL(location, target.url).href;
      continue;
    }
    if (response.status !== 200) throw new JobFetchError('bad-status');
    const type = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    if (type && !['text/html', 'application/xhtml+xml', 'text/plain', ''].includes(type)) throw new JobFetchError('unsupported-type');
    const body = await readLimited(response, deadline, now);
    if (type === 'text/plain') {
      const text = body.split(/\r?\n/).map(line => line.trim()).filter(Boolean).join('\n').slice(0, 60000);
      if (text.length < 200) throw new JobFetchError('unreadable');
      return { text, finalUrl: target.url.href, structured: null };
    }
    const vacancy = extractVacancy(body, target.url.href);
    if (!vacancy.ok) throw new JobFetchError(vacancy.code);
    return { text: vacancy.text.slice(0, 60000), finalUrl: target.url.href, structured: vacancy.structured };
  }
  throw new JobFetchError('too-many-redirects');
}
