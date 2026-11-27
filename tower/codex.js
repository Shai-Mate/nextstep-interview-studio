/* Run Codex non-interactively and read the schema-constrained final message.
   Flags checked against the Codex CLI reference (codex exec):
   --ephemeral, --skip-git-repo-check, --sandbox read-only, --color never,
   --output-schema, --output-last-message (-o). --json is an event stream, not the course. */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');

/* Codex says why it failed on stderr. Only the last few KB are kept, in memory, to tell a lapsed login
   from any other failure. That text is never logged and never returned: it can quote the prompt. */
const STDERR_TAIL = 4096;
const LOGIN_FAILURE = /\b401\b|token_revoked|not logged in|log in|sign in again|unauthori[sz]ed/i;
function failureCode(stderrTail) {
  return LOGIN_FAILURE.test(String(stderrTail || '')) ? 'login' : 'codex';
}

function runCodex(options) {
  const opts = options || {};
  const prompt = String(opts.prompt || '');
  if (!prompt.trim()) return Promise.reject(Object.assign(Error('prompt'), { code: 'invalid' }));
  const bin = opts.bin || 'codex';
  const spawnImpl = opts.spawn || spawn;
  const timeoutMs = opts.timeoutMs || 90000;
  const dir = fs.mkdtempSync(path.join(opts.tmpRoot || os.tmpdir(), 'nextstep-course-'));
  const schemaPath = path.join(dir, 'schema.json');
  const outPath = path.join(dir, 'course.json');
  fs.writeFileSync(schemaPath, JSON.stringify(opts.schema || {}), { mode: 0o600 });
  const args = [
    'exec',
    '--ephemeral',
    '--skip-git-repo-check',
    '--sandbox', 'read-only',
    '--color', 'never',
    '--output-schema', schemaPath,
    '--output-last-message', outPath,
    prompt
  ];
  return new Promise((resolve, reject) => {
    let child;
    let settled = false;
    let killed = false;
    const finish = (err, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try { fs.rmSync(dir, { recursive: true, force: true }); } catch { /* already gone */ }
      if (err) reject(err);
      else resolve(value);
    };
    const timer = setTimeout(() => {
      killed = true;
      try { child.kill('SIGKILL'); } catch { /* not started */ }
      finish(Object.assign(Error('timeout'), { code: 'timeout' }));
    }, timeoutMs);
    try {
      child = spawnImpl(bin, args, { cwd: dir, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: true });
    } catch (err) {
      finish(Object.assign(err, { code: 'codex' }));
      return;
    }
    let stderrTail = '';
    if (child.stderr && typeof child.stderr.on === 'function') {
      child.stderr.on('data', (chunk) => { stderrTail = (stderrTail + String(chunk)).slice(-STDERR_TAIL); });
    }
    if (child.stderr && typeof child.stderr.resume === 'function') child.stderr.resume();
    child.on('error', (err) => finish(Object.assign(err, { code: 'codex' })));
    child.on('close', (code) => {
      if (killed) return;
      if (code !== 0) {
        const reason = failureCode(stderrTail);
        stderrTail = '';
        finish(Object.assign(Error(reason), { code: reason }));
        return;
      }
      let raw = '';
      try { raw = fs.readFileSync(outPath, 'utf8'); } catch (err) {
        finish(Object.assign(err, { code: 'invalid' }));
        return;
      }
      try { finish(null, JSON.parse(raw)); }
      catch { finish(Object.assign(Error('invalid'), { code: 'invalid' })); }
    });
  });
}

module.exports = { runCodex, failureCode };
