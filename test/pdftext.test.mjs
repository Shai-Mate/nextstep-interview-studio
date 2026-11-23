// node --test test/pdftext.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import zlib from 'node:zlib';

const require = createRequire(import.meta.url);
const { extractPdfText } = require('../pdftext.js');

function buildPdf(streams) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>'];
  const kids = streams.map((_, index) => (4 + index) + ' 0 R').join(' ');
  objects[1] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
  objects.push('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents [' + kids + '] >>');
  streams.forEach((stream) => {
    const bytes = Buffer.from(stream.body, 'latin1');
    const data = stream.flate ? zlib.deflateSync(bytes) : bytes;
    const filter = stream.flate ? '/Filter /FlateDecode ' : '';
    objects.push({ dict: '<< ' + filter + '/Length ' + data.length + ' >>', data });
  });
  const chunks = [Buffer.from('%PDF-1.4\n')];
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.concat(chunks).length);
    const n = index + 1;
    if (typeof object === 'string') chunks.push(Buffer.from(n + ' 0 obj\n' + object + '\nendobj\n'));
    else chunks.push(Buffer.concat([
      Buffer.from(n + ' 0 obj\n' + object.dict + '\nstream\n'),
      object.data,
      Buffer.from('\nendstream\nendobj\n')
    ]));
  });
  const startxref = Buffer.concat(chunks).length;
  let xref = 'xref\n0 ' + (objects.length + 1) + '\n0000000000 65535 f \n';
  for (let i = 1; i < offsets.length; i++) xref += String(offsets[i]).padStart(10, '0') + ' 00000 n \n';
  chunks.push(Buffer.from(xref + 'trailer << /Size ' + (objects.length + 1) + ' /Root 1 0 R >>\nstartxref\n' + startxref + '\n%%EOF\n'));
  return new Uint8Array(Buffer.concat(chunks));
}

const SENTENCE = 'Barista at Harbour Cafe for three years. Trained two new hires and recounted the till with Priya Shah.';

test('plain and compressed résumé text stays on the device as text', async () => {
  const literal = '(' + SENTENCE.replace(/([()\\])/g, '\\$1') + ') Tj';
  const plain = await extractPdfText(buildPdf([{ body: 'BT /F1 12 Tf 72 720 Td ' + literal + ' ET' }]));
  assert.match(plain, /Harbour Cafe/);
  assert.match(plain, /Priya Shah/);
  const packed = await extractPdfText(buildPdf([{ body: 'BT /F1 12 Tf 72 720 Td ' + literal + ' ET', flate: true }]));
  assert.match(packed, /recounted the till/);
});

test('a ToUnicode map is applied, and a file with no real words is refused', async () => {
  const hex = Buffer.from(SENTENCE, 'latin1').toString('hex');
  const chars = [...new Set(SENTENCE)].map((ch) => {
    const byte = ch.charCodeAt(0).toString(16).padStart(2, '0');
    return '<' + byte + '> <00' + byte + '>';
  });
  const cmap = 'beginbfchar\n' + chars.join('\n') + '\nendbfchar';
  const text = await extractPdfText(buildPdf([
    { body: cmap },
    { body: 'BT <' + hex + '> Tj ET' }
  ]));
  assert.match(text, /Harbour Cafe/);
  const empty = await extractPdfText(buildPdf([{ body: 'BT (Hi) Tj ET' }]));
  assert.equal(empty, '');
  assert.equal(await extractPdfText(new Uint8Array([1, 2, 3])), '');
});
