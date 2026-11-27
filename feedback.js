/* Send feedback: a small sheet (#feedback in index.html) with a note, an optional way to reach the person,
   and Send. Every send goes through NextStepFeedback.send({ text, contact, version, screen }).
   For now it does not use the network: the note is kept on this phone under nextstep.feedback.v1 and the
   person is told sending isn't switched on yet. Delete all data removes it too (clear()).
   Classic script. No network. No inline style or script, so the strict CSP stays as it is. */
(function (root) {
  'use strict';

  const KEY = 'nextstep.feedback.v1';
  const MAX_NOTES = 20;
  const MAX_TEXT = 2000;
  const MAX_CONTACT = 200;
  const NOT_ON = "Feedback sending isn't switched on yet. Your note is saved on this phone.";
  const NOT_SAVED = "Feedback sending isn't switched on yet, and this browser won't let Next Step save the note.";

  const clip = (v, max) => String(v || '').replace(/\u0000/g, '').trim().slice(0, max);
  const store = () => { try { return root.localStorage || null; } catch { return null; } };

  function saved() {
    const ls = store();
    if (!ls) return [];
    try {
      const list = JSON.parse(ls.getItem(KEY) || '[]');
      return Array.isArray(list) ? list : [];
    } catch { return []; }
  }

  /* The one place a note leaves the sheet. Resolves { ok, saved, message }; ok means it was sent. */
  async function send(input) {
    const note = {
      text: clip(input && input.text, MAX_TEXT),
      contact: clip(input && input.contact, MAX_CONTACT),
      version: clip(input && input.version, 20),
      screen: clip(input && input.screen, 40),
      at: new Date().toISOString()
    };
    if (!note.text) return { ok: false, saved: false, message: 'Write a few words first.' };
    // TODO(backend): Shai to choose the endpoint. Until then nothing is sent; when it is chosen, send `note`
    // here, add only that origin to connect-src in index.html, and keep the local copy if the send fails.
    const ls = store();
    if (!ls) return { ok: false, saved: false, message: NOT_SAVED };
    try {
      ls.setItem(KEY, JSON.stringify([...saved(), note].slice(-MAX_NOTES)));
    } catch {
      return { ok: false, saved: false, message: NOT_SAVED };
    }
    return { ok: false, saved: true, message: NOT_ON };
  }

  function clear() {
    const ls = store();
    try { if (ls) ls.removeItem(KEY); } catch { /* nothing saved to clear */ }
  }

  /* ---------- the sheet ---------- */
  let returnTo = null;
  let screen = '';
  const $ = (id) => root.document.getElementById(id);

  function open(from) {
    const sheet = $('feedback');
    if (!sheet) return;
    screen = clip(from, 40);
    returnTo = root.document.activeElement;
    $('feedback-status').textContent = '';
    sheet.hidden = false;
    $('feedback-text').focus();
  }

  function close() {
    const sheet = $('feedback');
    if (!sheet || sheet.hidden) return;
    sheet.hidden = true;
    if (returnTo && typeof returnTo.focus === 'function') returnTo.focus();
    returnTo = null;
  }

  function wire() {
    const doc = root.document;
    doc.addEventListener('click', (e) => {
      const opener = e.target.closest && e.target.closest('[data-feedback]');
      if (opener) { e.preventDefault(); open(opener.dataset.feedback); return; }
      if (e.target.closest && e.target.closest('[data-close-feedback]')) close();
    });
    doc.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
    const form = $('feedback-form');
    if (!form) return;
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const version = root.NextStepUpdate && root.NextStepUpdate.version ? root.NextStepUpdate.version : '';
      const res = await send({ text: $('feedback-text').value, contact: $('feedback-contact').value, version, screen });
      $('feedback-status').textContent = res.message;
      if (res.saved) { $('feedback-text').value = ''; $('feedback-contact').value = ''; }
    });
  }

  const api = { send, saved, clear, open, close, KEY };
  root.NextStepFeedback = api;
  if (root.document) {
    if (root.document.readyState === 'loading') root.document.addEventListener('DOMContentLoaded', wire);
    else wire();
  }
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
