/* Public-address checks. Private, mapped, 6to4, and Teredo addresses fail closed. */

function ipv4ToInt(host) {
  const match = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
  if (!match) return null;
  const parts = match.slice(1).map(Number);
  if (parts.some(part => part > 255)) return null;
  return (((parts[0] << 24) >>> 0) + (parts[1] << 16) + (parts[2] << 8) + parts[3]) >>> 0;
}

function inCidr(value, base, bits) {
  const mask = bits === 0 ? 0 : (0xffffffff << (32 - bits)) >>> 0;
  return (value & mask) === (base & mask);
}

const IPV4_BLOCKS = [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.0.2.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['198.51.100.0', 24],
  ['203.0.113.0', 24],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4]
];

export function isPublicIpv4(host) {
  const value = ipv4ToInt(host);
  if (value == null) return false;
  return !IPV4_BLOCKS.some(([base, bits]) => inCidr(value, ipv4ToInt(base), bits));
}

export function parseIpv6(host) {
  let text = String(host || '').toLowerCase();
  if (text.startsWith('[') && text.endsWith(']')) text = text.slice(1, -1);
  if (!text || text.includes('%') || text.includes(':::')) return null;
  if (text.includes('.')) {
    const last = text.lastIndexOf(':');
    const v4 = ipv4ToInt(text.slice(last + 1));
    if (v4 == null) return null;
    text = `${text.slice(0, last + 1)}${((v4 >>> 16) & 0xffff).toString(16)}:${(v4 & 0xffff).toString(16)}`;
  }
  const halves = text.split('::');
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(':') : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(':') : [];
  if (halves.length === 1 && left.length !== 8) return null;
  const missing = 8 - left.length - right.length;
  if (halves.length === 2 && missing < 1) return null;
  if (missing < 0) return null;
  const parts = halves.length === 1 ? left : [...left, ...Array(missing).fill('0'), ...right];
  if (parts.length !== 8) return null;
  const hextets = [];
  for (const part of parts) {
    if (!/^[0-9a-f]{1,4}$/.test(part)) return null;
    hextets.push(parseInt(part, 16));
  }
  return hextets;
}

export function isPublicIpv6(host) {
  const parts = parseIpv6(host);
  if (!parts) return false;
  const [a, b] = parts;
  if (parts.every(part => part === 0)) return false;
  if (parts.slice(0, 7).every(part => part === 0) && parts[7] === 1) return false;
  if (parts.slice(0, 5).every(part => part === 0) && parts[5] === 0xffff) return false;
  if (a === 0x2002) return false;
  if (a === 0x2001 && b === 0) return false;
  if ((a & 0xfe00) === 0xfc00) return false;
  if ((a & 0xffc0) === 0xfe80) return false;
  if ((a & 0xff00) === 0xff00) return false;
  if (a === 0x2001 && b === 0x0db8) return false;
  if (a === 0x0100 && parts.slice(1, 4).every(part => part === 0)) return false;
  if (a === 0x2001 && (b & 0xfff0) === 0x0010) return false;
  if (a === 0x64 && b === 0xff9b) return false;
  return true;
}

export function isPublicIp(host) {
  const text = String(host || '').replace(/^\[|\]$/g, '');
  if (text.includes(':')) return isPublicIpv6(text);
  return isPublicIpv4(text);
}
