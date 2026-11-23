/* Pull plain text out of a résumé PDF on the phone. The file itself is not stored or sent.
   Handles simple text PDFs and FlateDecode streams. If a file comes back too thin, the
   screen asks the person to paste the text. */
(function (root) {
  'use strict';

  function latin1(bytes) {
    const chunk = 0x8000;
    let text = '';
    for (let i = 0; i < bytes.length; i += chunk) {
      text += String.fromCharCode.apply(null, bytes.subarray(i, Math.min(bytes.length, i + chunk)));
    }
    return text;
  }
  function toBytes(text) {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 255;
    return bytes;
  }
  function inflate(bytes) {
    if (typeof process === 'object' && process.versions && process.versions.node) {
      const zlib = require('zlib');
      return Promise.resolve(new Uint8Array(zlib.inflateSync(bytes)));
    }
    if (typeof DecompressionStream !== 'function') return Promise.reject(Error('inflate'));
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate'));
    return new Response(stream).arrayBuffer().then((buf) => new Uint8Array(buf));
  }
  function findStreams(text) {
    const found = [];
    let i = 0;
    while (i < text.length) {
      const at = text.indexOf('stream', i);
      if (at < 0) break;
      const boundary = at === 0 || /[\s\r\n>]/.test(text[at - 1]);
      if (!boundary) { i = at + 6; continue; }
      const dict = text.slice(Math.max(0, at - 300), at);
      let start = at + 6;
      if (text[start] === '\r') start++;
      if (text[start] === '\n') start++;
      const end = text.indexOf('endstream', start);
      if (end < 0) break;
      let raw = text.slice(start, end);
      if (raw.endsWith('\r\n')) raw = raw.slice(0, -2);
      else if (raw.endsWith('\n') || raw.endsWith('\r')) raw = raw.slice(0, -1);
      found.push({ dict, raw });
      i = end + 9;
    }
    return found;
  }
  function decodeLiteral(raw) {
    let out = '';
    for (let i = 0; i < raw.length; i++) {
      if (raw[i] !== '\\') { out += raw[i]; continue; }
      const n = raw[++i];
      if (n === 'n') out += '\n';
      else if (n === 'r') out += '\r';
      else if (n === 't') out += '\t';
      else if (n === 'b' || n === 'f') out += ' ';
      else if (n === '(' || n === ')' || n === '\\') out += n;
      else if (n >= '0' && n <= '7') {
        let oct = n;
        for (let k = 0; k < 2 && raw[i + 1] >= '0' && raw[i + 1] <= '7'; k++) oct += raw[++i];
        out += String.fromCharCode(parseInt(oct, 8));
      } else if (n) out += n;
    }
    return out;
  }
  function readLiteral(text, i) {
    let depth = 1;
    let j = i + 1;
    let raw = '';
    while (j < text.length && depth) {
      if (text[j] === '\\') { raw += text[j] + (text[j + 1] || ''); j += 2; continue; }
      if (text[j] === '(') depth++;
      else if (text[j] === ')') { depth--; if (!depth) { j++; break; } }
      raw += text[j];
      j++;
    }
    return { text: raw, next: j };
  }
  function readHex(text, i) {
    const end = text.indexOf('>', i + 1);
    const hex = text.slice(i + 1, end < 0 ? text.length : end).replace(/\s+/g, '');
    return { hex, next: end < 0 ? text.length : end + 1 };
  }
  function unicodeHex(hex) {
    if (!hex) return '';
    if (hex.length <= 4) {
      const code = parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : '';
    }
    let out = '';
    for (let i = 0; i + 4 <= hex.length; i += 4) out += String.fromCharCode(parseInt(hex.slice(i, i + 4), 16));
    return out;
  }
  function parseCMap(text) {
    const map = new Map();
    const take = (block, each) => {
      const re = new RegExp('begin' + block + '([\\s\\S]*?)end' + block, 'g');
      let match;
      while ((match = re.exec(text))) each(match[1]);
    };
    take('bfchar', (body) => {
      const row = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
      let item;
      while ((item = row.exec(body))) map.set(item[1].toLowerCase(), unicodeHex(item[2]));
    });
    take('bfrange', (body) => {
      const row = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
      let item;
      while ((item = row.exec(body))) {
        const start = parseInt(item[1], 16);
        const end = parseInt(item[2], 16);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start || end - start > 400) continue;
        let dest = parseInt(item[3], 16);
        const width = item[1].length;
        for (let n = start; n <= end; n++, dest++) map.set(n.toString(16).padStart(width, '0'), String.fromCodePoint(dest));
      }
    });
    return map;
  }
  function decodeHex(hex, map) {
    if (!hex || hex.length % 2) return '';
    if (map && map.size) {
      const width = Math.max(...[...map.keys()].map((key) => key.length));
      let out = '';
      const low = hex.toLowerCase();
      for (let i = 0; i + width <= low.length; i += width) out += map.get(low.slice(i, i + width)) || '';
      if (out.trim()) return out;
    }
    if (hex.toLowerCase().startsWith('feff')) return unicodeHex(hex.slice(4));
    let out = '';
    for (let i = 0; i < hex.length; i += 2) out += String.fromCharCode(parseInt(hex.slice(i, i + 2), 16));
    return out;
  }
  function extractOps(text, map) {
    const parts = [];
    const pending = [];
    const flush = (newline) => {
      if (pending.length) parts.push(pending.splice(0).join(''));
      if (newline) parts.push('\n');
    };
    for (let i = 0; i < text.length;) {
      const ch = text[i];
      if (ch === '%') { while (i < text.length && text[i] !== '\n') i++; continue; }
      if (ch === '(') {
        const parsed = readLiteral(text, i);
        pending.push(decodeLiteral(parsed.text));
        i = parsed.next;
        continue;
      }
      if (ch === '<' && text[i + 1] !== '<') {
        const parsed = readHex(text, i);
        pending.push(decodeHex(parsed.hex, map));
        i = parsed.next;
        continue;
      }
      if (/[A-Za-z*']/.test(ch)) {
        let j = i;
        while (j < text.length && /[A-Za-z*']/.test(text[j])) j++;
        const op = text.slice(i, j);
        if (op === 'Tj' || op === 'TJ' || op === "'" || op === '"') flush(false);
        else if (op === 'T*' || op === 'Td' || op === 'TD' || op === 'Tm') flush(true);
        i = j;
        continue;
      }
      i++;
    }
    flush(false);
    return parts.join(' ').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').replace(/[ \t]{2,}/g, ' ').trim();
  }

  async function extractPdfText(input) {
    const bytes = input instanceof Uint8Array ? input : new Uint8Array(input || []);
    if (!bytes.length || bytes.length > 8000000) return '';
    const source = latin1(bytes);
    if (source.indexOf('%PDF') !== 0 && !source.includes('%PDF')) return '';
    const streams = findStreams(source);
    const decoded = [];
    for (const stream of streams) {
      let body = stream.raw;
      if (/FlateDecode/.test(stream.dict)) {
        try { body = latin1(await inflate(toBytes(stream.raw))); }
        catch { continue; }
      }
      decoded.push(body);
    }
    const map = new Map();
    decoded.forEach((body) => {
      if (!/beginbfchar|beginbfrange/.test(body)) return;
      parseCMap(body).forEach((value, key) => map.set(key, value));
    });
    const text = decoded
      .filter((body) => /Tj|TJ|'/.test(body) && !/beginbfchar/.test(body))
      .map((body) => extractOps(body, map))
      .filter(Boolean)
      .join('\n')
      .replace(/\s+\n/g, '\n')
      .trim();
    const letters = (text.match(/[A-Za-z]/g) || []).length;
    return letters >= 40 ? text : '';
  }

  const api = { extractPdfText };
  root.NextStepPdf = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
