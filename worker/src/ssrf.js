import { isPublicIp } from './ip.js';

const BLOCKED_SUFFIXES = ['.localhost', '.local', '.internal', '.home', '.test', '.invalid', '.arpa'];

export class JobFetchError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}

export function validateUrl(raw) {
  if (typeof raw !== 'string' || raw.length < 8 || raw.length > 4096) throw new JobFetchError('bad-url');
  if (raw.includes('\\') || /[\u0000-\u0020\u007f]/.test(raw)) throw new JobFetchError('bad-url');
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new JobFetchError('bad-url');
  }
  if (url.username || url.password) throw new JobFetchError('bad-url');
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new JobFetchError('bad-url');
  const host = url.hostname.toLowerCase();
  if (!host || host.endsWith('.') || host === 'localhost' || BLOCKED_SUFFIXES.some(suffix => host.endsWith(suffix))) {
    throw new JobFetchError('bad-url');
  }
  const port = url.port ? Number(url.port) : (url.protocol === 'https:' ? 443 : 80);
  if (port !== 80 && port !== 443) throw new JobFetchError('bad-url');
  const literal = host.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes(':');
  if (literal) {
    if (!isPublicIp(host)) throw new JobFetchError('blocked-address');
    return { url, host: host.replace(/^\[|\]$/g, ''), literal: true };
  }
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host) || !host.includes('.')) throw new JobFetchError('bad-url');
  return { url, host, literal: false };
}

export function assertPublicAddresses(addresses) {
  if (!Array.isArray(addresses) || addresses.length < 1) throw new JobFetchError('dns-failed');
  if (!addresses.every(address => isPublicIp(address))) throw new JobFetchError('blocked-address');
}
