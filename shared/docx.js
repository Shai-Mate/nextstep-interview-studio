/* Minimal DOCX reader. Only word/document.xml is inflated, with a size cap. */

const MAX_XML = 2_000_000;

function findEocd(bytes) {
  const start = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= start; i -= 1) {
    if (bytes[i] === 0x50 && bytes[i + 1] === 0x4b && bytes[i + 2] === 0x05 && bytes[i + 3] === 0x06) return i;
  }
  return -1;
}

function readCentralDirectory(bytes) {
  const eocd = findEocd(bytes);
  if (eocd < 0) throw new Error('That Word file could not be read here. Paste the ad text instead.');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const count = view.getUint16(eocd + 10, true);
  const offset = view.getUint32(eocd + 16, true);
  if (count > 4000 || offset >= bytes.length) throw new Error('That Word file could not be read here. Paste the ad text instead.');
  const entries = [];
  let cursor = offset;
  for (let n = 0; n < count; n += 1) {
    if (cursor + 46 > bytes.length || view.getUint32(cursor, true) !== 0x02014b50) break;
    const method = view.getUint16(cursor + 10, true);
    const comp = view.getUint32(cursor + 20, true);
    const uncomp = view.getUint32(cursor + 24, true);
    const nameLen = view.getUint16(cursor + 28, true);
    const extraLen = view.getUint16(cursor + 30, true);
    const commentLen = view.getUint16(cursor + 32, true);
    const local = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLen));
    entries.push({ name, method, comp, uncomp, local });
    cursor += 46 + nameLen + extraLen + commentLen;
  }
  return entries;
}

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const out = new Uint8Array(await new Response(stream).arrayBuffer());
  if (out.byteLength > MAX_XML) throw new Error('That Word file is too large to read here. Paste the ad text instead.');
  return new TextDecoder().decode(out);
}

export function docxXmlToText(xml) {
  const parts = [];
  const re = /<w:p[ >]|<w:tab\/>|<w:br\/>|<w:t[^>]*>([^<]*)<\/w:t>/g;
  let match;
  while ((match = re.exec(xml))) {
    if (match[0].startsWith('<w:p')) parts.push('\n');
    else if (match[0].startsWith('<w:tab') || match[0].startsWith('<w:br')) parts.push(' ');
    else parts.push(match[1]);
  }
  return parts.join('').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").split('\n').map(line => line.replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n');
}

export async function extractDocxText(buffer) {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  const entry = readCentralDirectory(bytes).find(item => item.name === 'word/document.xml');
  if (!entry) throw new Error('That Word file has no document text. Paste the ad text instead.');
  if (entry.name.includes('..') || entry.uncomp > MAX_XML || entry.comp > MAX_XML) {
    throw new Error('That Word file is too large to read here. Paste the ad text instead.');
  }
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (entry.local + 30 > bytes.length || view.getUint32(entry.local, true) !== 0x04034b50) {
    throw new Error('That Word file could not be read here. Paste the ad text instead.');
  }
  const nameLen = view.getUint16(entry.local + 26, true);
  const extraLen = view.getUint16(entry.local + 28, true);
  const dataStart = entry.local + 30 + nameLen + extraLen;
  const data = bytes.subarray(dataStart, dataStart + entry.comp);
  if (data.length !== entry.comp) throw new Error('That Word file could not be read here. Paste the ad text instead.');
  let xml;
  if (entry.method === 0) xml = new TextDecoder().decode(data);
  else if (entry.method === 8) xml = await inflateRaw(data);
  else throw new Error('That Word file uses compression this app cannot read. Paste the ad text instead.');
  const text = docxXmlToText(xml).trim();
  if (!text) throw new Error('No text was found in that file. Paste the ad text instead.');
  return text.slice(0, 60000);
}
