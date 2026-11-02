import assert from 'node:assert/strict';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import puppeteer from 'puppeteer-core';
import { packs } from '../fixtures/packs.js';

const root = path.resolve(import.meta.dirname, '..');
const shots = '/opt/cursor/artifacts/screenshots';
fs.mkdirSync(shots, { recursive: true });

const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.webmanifest': 'application/manifest+json'
};

function startServer() {
  return new Promise(resolve => {
    const server = http.createServer((request, response) => {
      const url = new URL(request.url, 'http://127.0.0.1');
      let pathname = decodeURIComponent(url.pathname);
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = path.normalize(path.join(root, pathname));
      if (!file.startsWith(root)) {
        response.writeHead(403);
        response.end();
        return;
      }
      fs.readFile(file, (error, data) => {
        if (error) {
          response.writeHead(404);
          response.end('missing');
          return;
        }
        response.writeHead(200, {
          'content-type': types[path.extname(file)] || 'application/octet-stream',
          'cache-control': 'no-cache'
        });
        response.end(data);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

function pdf(text) {
  const content = `BT /F1 18 Tf 48 720 Td (${text.replace(/[()\\]/g, '')}) Tj ET`;
  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  ];
  let body = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(body));
    body += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) body += `${String(offsets[index]).padStart(10, '0')} 00000 n \n`;
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(body);
}

async function textIncludes(page, needle) {
  const body = await page.evaluate(() => document.body.innerText);
  assert.equal(body.includes(needle), true, `missing: ${needle}`);
  assert.equal(body.includes('\u2014'), false);
}

async function shot(page, name) {
  await page.screenshot({ path: path.join(shots, name) });
}

async function noOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  assert.equal(overflow, false);
}

const server = await startServer();
const port = server.address().port;
const browser = await puppeteer.launch({
  executablePath: '/usr/local/bin/google-chrome',
  headless: true,
  args: ['--no-sandbox', '--disable-dev-shm-usage']
});
const page = await browser.newPage();
const pageErrors = [];
page.on('pageerror', error => pageErrors.push(String(error)));
page.setDefaultTimeout(20000);
await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });

try {
  await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('#new');
  await textIncludes(page, 'Paste a job link or the job ad');
  await noOverflow(page);
  await shot(page, '01-home.png');

  await page.click('#new');
  await page.waitForSelector('#job-input');
  await textIncludes(page, 'Saved practice packs');
  await shot(page, '02-job-input.png');

  await page.type('#job-input', 'https://ca.indeed.com/viewjob?jk=4cc1eae081ce53ed');
  await page.click('#analyze');
  await page.waitForFunction(() => document.body.innerText.includes('A few choices for this role'));
  await textIncludes(page, 'TRNT Educational Institute');
  await textIncludes(page, 'Workshop design');
  await textIncludes(page, 'Saved practice pack');
  await noOverflow(page);
  await shot(page, '03-questionnaire.png');

  await page.click('#build');
  await page.waitForFunction(() => document.body.textContent.includes('v3 role practice'));
  await page.evaluate(() => [...document.querySelectorAll('[data-tab]')].find(button => button.dataset.tab === 'Study').click());
  await page.waitForSelector('details.lesson');
  await textIncludes(page, 'Plan a workshop that ends with something a student made');
  await textIncludes(page, 'From the job ad.');
  const course = await page.evaluate(() => document.body.innerText);
  assert.equal(course.includes('Kafka'), false);
  assert.equal(course.includes('three columns'), true);
  await page.evaluate(() => document.querySelector('details.lesson').scrollIntoView({ block: 'start' }));
  await noOverflow(page);
  await shot(page, '04-course.png');

  await page.evaluate(() => [...document.querySelectorAll('[data-tab]')].find(button => button.dataset.tab === 'Role-play').click());
  await page.waitForSelector('#roleplay-answer');
  const answer = 'I designed a 90 minute workshop for 12 year olds. I checked that each student left with a paper prototype, and I adapted the task because one student was new. I did not finish it for them.';
  await page.type('#roleplay-answer', answer);
  await page.click('#send-turn');
  await page.waitForFunction(() => document.body.textContent.includes('You wrote'));
  await textIncludes(page, 'workshop');
  await page.evaluate(() => document.querySelector('#chat').scrollIntoView({ block: 'start' }));
  await shot(page, '05-roleplay.png');

  await page.click('#grade-answer');
  await page.waitForSelector('.score');
  await textIncludes(page, 'Practice feedback, not a hiring decision.');
  await textIncludes(page, 'I designed a 90 minute workshop');
  await noOverflow(page);
  await shot(page, '06-grade.png');

  await page.evaluate(() => {
    const created = PrepEngine.create({
      company: 'Old Co',
      role: 'Support lead',
      job: 'Answer customer calls, write weekly reports, and coach two new agents on the weekend roster.',
      intake: { experience: 'Experienced', stage: 'Screening', focus: 'Balanced', time: '30 minutes' }
    });
    const key = 'nextstep.preparations.v1';
    const records = JSON.parse(localStorage.getItem(key) || '[]');
    records.push(created);
    localStorage.setItem(key, JSON.stringify(records));
  });
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => document.body.textContent.includes('v2 rules practice') && document.body.textContent.includes('v3 role practice'));
  await shot(page, '07-library-versions.png');
  await page.evaluate(() => {
    const card = [...document.querySelectorAll('article.card')].find(item => item.textContent.includes('v2 rules practice'));
    card.querySelector('button').click();
  });
  await page.waitForFunction(() => document.body.textContent.includes('original rules-based plan'));
  await page.evaluate(() => [...document.querySelectorAll('[data-tab]')].find(button => button.dataset.tab === 'Quiz').click());
  await page.waitForFunction(() => document.body.textContent.includes('Which answer best demonstrates a job requirement?'));

  await page.click('#library');
  await page.click('#new');
  await page.click('[data-pack="retail-store-manager"]');
  await page.waitForFunction(() => document.body.textContent.includes('Store Manager'));
  await page.click('#build');
  await page.waitForFunction(() => document.body.textContent.includes('v3 role practice'));
  await page.evaluate(() => [...document.querySelectorAll('[data-tab]')].find(button => button.dataset.tab === 'Study').click());
  await page.waitForFunction(() => {
    const text = document.body.textContent;
    return text.includes('damaged kettle') || text.includes('opening checklist') || text.includes('Open the floor');
  });
  const retailText = await page.evaluate(() => document.body.textContent);
  assert.equal(retailText.includes('Kafka'), false);
  assert.equal(retailText.includes('workshop for students'), false);
  await shot(page, '08-retail-course.png');

  const retail = packs.find(pack => pack.id === 'retail-store-manager');
  const pdfPath = path.join('/tmp', 'harbor-role.pdf');
  fs.writeFileSync(pdfPath, pdf(`${retail.profile.title} at ${retail.profile.company}. Run the opening checklist and keep the floor covered during breaks and deliveries.`));
  await page.click('#library');
  await page.click('#new');
  const file = await page.$('#file');
  await file.uploadFile(pdfPath);
  await page.click('#analyze');
  await page.waitForFunction(() => document.body.textContent.includes('A few choices for this role'), { timeout: 20000 });
  await textIncludes(page, 'Harbor & Co.');

  const keys = await page.evaluate(async () => {
    const ready = await navigator.serviceWorker.ready;
    const names = await caches.keys();
    return { controller: Boolean(ready), names };
  });
  assert.equal(keys.names.includes('nextstep-phone-v3'), true, JSON.stringify(keys));
  assert.deepEqual(pageErrors, []);
  console.log('browser flow ok');
} finally {
  await browser.close();
  await new Promise(resolve => server.close(resolve));
}
