import * as pdfjs from './vendor/pdfjs/pdf.min.mjs?v=3';
import { extractDocxText } from './shared/docx.js?v=3';
import { messages } from './shared/messages.js?v=3';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('./vendor/pdfjs/pdf.worker.min.mjs?v=3', import.meta.url).href;

async function extractPdf(buffer) {
  const task = pdfjs.getDocument({ data: new Uint8Array(buffer), useWorkerFetch: false, isEvalSupported: false });
  const doc = await task.promise;
  const total = Math.min(doc.numPages, 20);
  const parts = [];
  for (let pageNumber = 1; pageNumber <= total; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    parts.push(content.items.map(item => item.str).join(' '));
  }
  await doc.destroy?.();
  return parts.join('\n');
}

export async function extractUpload(file) {
  if (!file) throw new Error(messages.fileType);
  if (file.size > 5 * 1024 * 1024) throw new Error(messages.fileLarge);
  const name = String(file.name || '').toLowerCase();
  let text = '';
  if (name.endsWith('.txt') || file.type.startsWith('text/')) text = await file.text();
  else if (name.endsWith('.docx')) text = await extractDocxText(await file.arrayBuffer());
  else if (name.endsWith('.pdf') || file.type === 'application/pdf') text = await extractPdf(await file.arrayBuffer());
  else throw new Error(messages.fileType);
  text = String(text || '').replace(/\u0000/g, '').trim();
  if (text.length < 40) throw new Error(messages.fileEmpty);
  return text.slice(0, 60000);
}
