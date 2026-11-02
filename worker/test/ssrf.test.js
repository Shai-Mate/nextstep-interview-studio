import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPublicIp } from '../src/ip.js';
import { validateUrl } from '../src/ssrf.js';
import { fetchVacancy } from '../src/fetch-job.js';

function response(body, status = 200, headers = {}) {
  return new Response(body, { status, headers: { 'content-type': 'text/plain', ...headers } });
}

describe('public address checks', () => {
  it('allows public addresses and blocks private, mapped, and metadata ranges', () => {
    for (const ip of ['1.1.1.1', '8.8.8.8', '172.15.255.255', '172.32.0.1', '2606:4700:4700::1111']) {
      assert.equal(isPublicIp(ip), true, ip);
    }
    for (const ip of ['127.0.0.1', '10.1.1.1', '192.168.1.9', '172.16.0.1', '169.254.169.254', '100.64.0.1', '192.0.2.1', '198.51.100.2', '203.0.113.5', '0.0.0.0', '255.255.255.255', '::1', 'fc00::1', 'fe80::1', '::ffff:7f00:1', '2002:7f00:1::', '2001:0:1::1']) {
      assert.equal(isPublicIp(ip), false, ip);
    }
  });
});

describe('URL validation', () => {
  it('blocks credentials, local names, odd ports, and rewritten loopback literals', () => {
    for (const url of [
      'http://127.0.0.1/job',
      'http://2130706433/job',
      'http://0x7f000001/job',
      'http://[::1]/job',
      'http://169.254.169.254/latest/meta-data',
      'http://localhost/job',
      'https://user:pass@example.com/job',
      'https://metadata.google.internal/computeMetadata/v1/',
      'https://example.com.internal/job',
      'file:///etc/passwd',
      'https://example.com:8443/job',
      'http://example.com./job'
    ]) {
      assert.throws(() => validateUrl(url), error => error.code === 'bad-url' || error.code === 'blocked-address', url);
    }
  });
});

describe('fetch vacancy', () => {
  it('does not fetch a host that resolves to a private address', async () => {
    let called = 0;
    await assert.rejects(() => fetchVacancy('https://jobs.example/role', {
      fetchImpl() {
        called += 1;
        return Promise.resolve(response('nope'));
      },
      resolveHost: async () => ['10.1.1.1']
    }), error => error.code === 'blocked-address');
    assert.equal(called, 0);
  });

  it('blocks a split answer that includes any private address', async () => {
    let called = 0;
    await assert.rejects(() => fetchVacancy('https://jobs.example/role', {
      fetchImpl() {
        called += 1;
        return Promise.resolve(response('nope'));
      },
      resolveHost: async () => ['1.1.1.1', '192.168.0.5']
    }), error => error.code === 'blocked-address');
    assert.equal(called, 0);
  });

  it('does not follow a redirect to a loopback address', async () => {
    const seen = [];
    await assert.rejects(() => fetchVacancy('https://jobs.example/start', {
      fetchImpl(url) {
        seen.push(String(url));
        return Promise.resolve(new Response(null, { status: 302, headers: { location: 'http://127.0.0.1/secret' } }));
      },
      resolveHost: async () => ['1.1.1.1']
    }), error => error.code === 'blocked-address');
    assert.deepEqual(seen, ['https://jobs.example/start']);
  });

  it('discards a body if DNS flips to a private address after the connection', async () => {
    let lookups = 0;
    await assert.rejects(() => fetchVacancy('https://jobs.example/role', {
      fetchImpl: async () => response('SECRET-JOB-BODY '.repeat(20)),
      resolveHost: async () => {
        lookups += 1;
        return lookups === 1 ? ['1.1.1.1'] : ['10.9.9.9'];
      }
    }), error => error.code === 'blocked-address');
    assert.equal(lookups >= 2, true);
  });

  it('returns text from a public host and does not log the URL itself', async () => {
    const text = 'Senior Backend Engineer at Northwind Ledger. '.repeat(8);
    const result = await fetchVacancy('https://jobs.example/role?id=1', {
      fetchImpl: async () => response(text),
      resolveHost: async () => ['1.1.1.1']
    });
    assert.match(result.text, /Northwind Ledger/);
    assert.equal(result.finalUrl.includes('id=1'), true);
  });
});
