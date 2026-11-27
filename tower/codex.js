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
   from any other failure. That text is never logged and never returned.
   `codex exec` echoes the prompt to stderr, so the tail is mostly the job ad and the transcript, and ad
   text such as "401(k)", "log in to the POS" or "unauthorized access" must not read as a login failure.
   So: drop every line that is also a line of the prompt, look only at lines shaped like a Codex error,
   and match only sign-in phrases Codex itself prints. */
const STDERR_TAIL = 4096;
const ERROR_LINE = /^(?:ERROR\b|error:|Error:)|token_revoked/;
const LOGIN_FAILURE = /token_revoked|refresh token was revoked|\b401 Unauthorized\b|not logged in|please (?:log|sign) in|codex login|(?:log|sign) in again/i;
function failureCode(stderrTail, prompt) {
  const asked = new Set(String(prompt || '').split('\n').map((line) => line.trim()).filter(Boolean));
  const said = String(stderrTail || '').split('\n').map((line) => line.trim())
    .filter((line) => line && !asked.has(line) && ERROR_LINE.test(line));
  return said.some((line) => LOGIN_FAILURE.test(line)) ? 'login' : 'codex';
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
        const reason = failureCode(stderrTail, prompt);
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
