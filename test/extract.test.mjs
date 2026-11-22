// node --test test/extract.test.mjs
// Saved job-page fixtures are fictional. The extractor never fetches them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { extractJob, isBlockedUrl, isPrivateAddress } from '../worker/src/extract.js';
import { handle } from '../worker/src/index.js';

const here = dirname(fileURLToPath(import.meta.url));
const page = (name) => readFileSync(join(here, 'fixtures', 'pages', name), 'utf8');

test('Greenhouse JSON-LD yields the ad, the company and the role', () => {
  const job = extractJob(page('greenhouse.html'), 'https://boards.greenhouse.io/northwind/jobs/1');
  assert.equal(job.ok, true);
  assert.equal(job.company, 'Northwind Coffee');
  assert.equal(job.role, 'Barista');
  assert.match(job.text, /Pull espresso shots/);
  assert.match(job.text, /Food Safe/);
  assert.equal(job.text.includes('SECRET_SCRIPT'), false);
});

test('Lever, Ashby, Workday and a company career page all yield usable ad text', () => {
  const lever = extractJob(page('lever.html'), 'https://jobs.lever.co/harbour/line-cook');
  assert.equal(lever.ok, true);
  assert.equal(lever.role, 'Line cook');
  assert.match(lever.text, /Prep stations before service/);

  const ashby = extractJob(page('ashby.html'), 'https://jobs.ashbyhq.com/cedargrove/care-aide');
  assert.equal(ashby.ok, true);
  assert.equal(ashby.company, 'Cedar Grove Care');
  assert.equal(ashby.role, 'Care aide');
  assert.match(ashby.text, /First Aid is required/);

  const workday = extractJob(page('workday.html'), 'https://northgate.wd5.myworkdayjobs.com/en-US/careers/job/warehouse');
  assert.equal(workday.ok, true);
  assert.equal(workday.company, 'Northgate Supply');
  assert.equal(workday.role, 'Warehouse associate');
  assert.match(workday.text, /handheld scanner/);

  const company = extractJob(page('company.html'), 'https://brightsmile.example/careers/receptionist');
  assert.equal(company.ok, true);
  assert.equal(company.role, 'Receptionist');
  assert.equal(company.company, 'Bright Smile Dental');
  assert.match(company.text, /Available some Saturdays/);
  assert.equal(company.text.includes('Privacy'), false);
});

test('a login wall and an empty page are fallbacks, not ads', () => {
  const wall = extractJob(page('linkedin-wall.html'), 'https://www.linkedin.com/jobs/view/123');
  assert.deepEqual(wall, { ok: false, reason: 'login' });
  const indeed = extractJob('<html><body><p>Sign in to see the full job description on Indeed.</p></body></html>', 'https://www.indeed.com/viewjob?jk=abc');
  assert.equal(indeed.ok, false);
  assert.equal(indeed.reason, 'login');
  const empty = extractJob(page('empty.html'), 'https://example.com/careers');
  assert.deepEqual(empty, { ok: false, reason: 'empty' });
});

test('private, local and non-http targets are refused before any fetch', () => {
  const blocked = [
    'http://127.0.0.1/latest/meta-data',
    'http://127.0.0.1:8080/admin',
    'http://127.1/',
    'http://2130706433/',
    'http://0x7f000001/',
    'http://0177.0.0.1/',
    'http://10.1.2.3/',
    'http://192.168.1.9/secret',
    'http://172.16.0.4/',
    'http://169.254.169.254/latest/meta-data',
    'http://[::1]/',
    'http://[fd00::1]/',
    'http://localhost/admin',
    'http://printer.local/',
    'http://metadata.google.internal/computeMetadata/v1/',
    'http://0.0.0.0/',
    'file:///etc/passwd',
    'javascript:alert(1)',
    'http://user:pass@jobs.example/role',
    'http://jobs.example@127.0.0.1/'
  ];
  for (const url of blocked) {
    const why = isBlockedUrl(url);
    assert.ok(why === 'blocked' || why === 'invalid', url + ' -> ' + why);
  }
  assert.equal(isBlockedUrl('https://boards.greenhouse.io/northwind/jobs/1'), '');
  assert.equal(isPrivateAddress('8.8.8.8'), false);
  assert.equal(isPrivateAddress('10.0.0.8'), true);
  assert.equal(isPrivateAddress('2001:4860:4860::8888'), false);
});

function req(url, body, origin) {
  return new Request('https://extract.example/extract', {
    method: 'POST',
    headers: { origin: origin || 'https://shai-mate.github.io', 'content-type': 'application/json' },
    body: JSON.stringify(body === undefined ? { url } : body)
  });
}

test('the endpoint returns fixture text and locks CORS to the Pages origin', async () => {
  let fetched = 0;
  const html = page('greenhouse.html');
  const fetchImpl = async (url) => {
    fetched += 1;
    assert.equal(url, 'https://boards.greenhouse.io/northwind/jobs/1');
    return new Response(html, { status: 200, headers: { 'content-type': 'text/html; charset=utf-8' } });
  };
  const res = await handle(req('https://boards.greenhouse.io/northwind/jobs/1'), {}, {
    fetch: fetchImpl,
    lookup: async () => ['1.2.3.4']
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('access-control-allow-origin'), 'https://shai-mate.github.io');
  const data = await res.json();
  assert.equal(data.ok, true);
  assert.equal(data.company, 'Northwind Coffee');
  assert.match(data.text, /espresso shots/);
  assert.equal(fetched, 1);

  const denied = await handle(req('https://boards.greenhouse.io/northwind/jobs/1', undefined, 'https://evil.example'), {}, {
    fetch: async () => { throw new Error('should not fetch'); },
    lookup: async () => ['1.2.3.4']
  });
  assert.equal(denied.status, 403);
  assert.equal(denied.headers.get('access-control-allow-origin'), null);
});

test('a public name that resolves to a private address is refused', async () => {
  let fetched = 0;
  const res = await handle(req('https://jobs.example/role'), {}, {
    fetch: async () => { fetched += 1; return new Response('nope'); },
    lookup: async () => ['10.0.0.4']
  });
  const data = await res.json();
  assert.equal(data.ok, false);
  assert.equal(data.reason, 'blocked');
  assert.equal(fetched, 0);
});

test('a redirect onto a private address is not followed', async () => {
  const seen = [];
  const fetchImpl = async (url) => {
    seen.push(url);
    return new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data' } });
  };
  const res = await handle(req('https://jobs.example/role'), {}, {
    fetch: fetchImpl,
    lookup: async () => ['1.2.3.4']
  });
  const data = await res.json();
  assert.equal(data.reason, 'blocked');
  assert.deepEqual(seen, ['https://jobs.example/role']);
});

test('oversized pages and timeouts become fallback reasons', async () => {
  const huge = new Uint8Array(1500001);
  huge.fill(97);
  const big = await handle(req('https://jobs.example/role'), {}, {
    fetch: async () => new Response(huge, { status: 200, headers: { 'content-type': 'text/html' } }),
    lookup: async () => ['1.2.3.4']
  });
  assert.equal((await big.json()).reason, 'large');

  const slow = await handle(req('https://jobs.example/role'), {}, {
    fetch: async () => { const err = new Error('timed out'); err.name = 'TimeoutError'; throw err; },
    lookup: async () => ['1.2.3.4']
  });
  assert.equal((await slow.json()).reason, 'timeout');
});
