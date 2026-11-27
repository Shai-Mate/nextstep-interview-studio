/* Practice interview: one question at a time, a follow-up when the answer is thin, then a short debrief.
   The tower writes the live lines. With no subscription, the questions come from the job ad.
   Classic script. The state machine does not touch the network or the microphone. */
(function (root) {
  'use strict';

  const CHECK = /\b(?:criminal record|vulnerable sector|police (?:check|clearance|record|information check)|security (?:check|clearance|screening)|background (?:check|screening)|references|(?:professional|work|employment|personal|character) reference|reference checks?|drug (?:test|screen)\w*|work permit|eligib\w* to work|legally (?:entitled|eligible|able) to work|right to work|driver[’']?s abstract|driving abstract|driving record|(?:government|medical) clearance)\b/i;
  const KINDS = ['question', 'follow', 'done'];

  const turnSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['say', 'kind'],
    properties: {
      say: { type: 'string', minLength: 8, maxLength: 500 },
      kind: { type: 'string', enum: KINDS }
    }
  };
  const debriefItemSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['landed', 'fix', 'stronger'],
    properties: {
      landed: { type: 'string', minLength: 8, maxLength: 300 },
      fix: { type: 'string', minLength: 8, maxLength: 300 },
      stronger: { type: 'string', minLength: 8, maxLength: 500 }
    }
  };
  const debriefSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['items', 'overall'],
    properties: {
      items: { type: 'array', minItems: 1, maxItems: 7, items: debriefItemSchema },
      overall: { type: 'string', minLength: 12, maxLength: 500 }
    }
  };

  function plain(text) {
    return String(text || '').replace(/\s*[—–]\s*/g, ', ').replace(/\s+/g, ' ').trim();
  }
  function words(text) {
    const t = String(text || '').trim();
    return t ? t.split(/\s+/) : [];
  }
  function clip(text, max) {
    const t = String(text || '').replace(/\u0000/g, '').trim();
    return t.length <= max ? t : t.slice(0, max);
  }
  function uid() {
    return 'live-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
  }
  function answerIsThin(text) {
    const list = words(text);
    if (list.length < 35) return true;
    return !/\b(I|I'm|I’m|I've|I’ve|I'd|I’d)\b/.test(String(text || ''));
  }
  function fullAnswer(item) {
    return [item && item.answer, item && item.followAnswer].filter(Boolean).join(' ');
  }

  function templateQuestions(prep) {
    const p = prep || {};
    const role = plain(p.role) || 'this job';
    const list = (Array.isArray(p.questions) ? p.questions : [])
      .filter((q) => typeof q === 'string' && plain(q).length >= 12 && !CHECK.test(q))
      .map((q) => plain(q));
    const picked = [];
    list.forEach((q) => { if (picked.length < 6 && !picked.includes(q)) picked.push(q); });
    const pads = [
      'What made you want to apply for the ' + role + ' job?',
      'Tell me about a real moment that shows how you work.',
      'What part of this job would be newest to you, and how would you learn it?',
      'How do you make sure people can count on you?',
      'What questions would you like to ask about the job?'
    ];
    pads.forEach((q) => { if (picked.length < 5) picked.push(q); });
    return picked.slice(0, 6);
  }

  function createSession(prep, opts) {
    const provider = !!(opts && opts.provider);
    const questions = templateQuestions(prep);
    const session = {
      id: uid(),
      mode: provider ? 'live' : 'template',
      generic: !provider,
      phase: provider ? 'wait' : 'listen',
      paused: false,
      index: 0,
      follow: false,
      questions,
      current: provider ? '' : questions[0],
      answers: [],
      transcript: [],
      debrief: null,
      ended: false,
      userEnded: false,
      pending: provider ? 'turn' : '',
      note: provider ? '' : 'These questions come from the ad, not a live interviewer.',
      at: new Date().toISOString()
    };
    if (!provider) session.transcript.push({ who: 'interviewer', text: session.current });
    return session;
  }

  function checkShape(value, schema, path, errors) {
    if (schema.enum) {
      if (!schema.enum.includes(value)) errors.push(path + ' enum');
      return value;
    }
    if (schema.type === 'string') {
      if (typeof value !== 'string') { errors.push(path + ' type'); return ''; }
      const text = plain(value);
      if (text.length < schema.minLength) errors.push(path + ' short');
      if (text.length > schema.maxLength) errors.push(path + ' long');
      return text;
    }
    if (schema.type === 'array') {
      if (!Array.isArray(value)) { errors.push(path + ' type'); return []; }
      if (value.length < schema.minItems || value.length > schema.maxItems) errors.push(path + ' length');
      return value.map((item, i) => checkShape(item, schema.items, path + '[' + i + ']', errors));
    }
    if (!value || typeof value !== 'object' || Array.isArray(value)) { errors.push(path + ' type'); return null; }
    Object.keys(value).forEach((key) => { if (!schema.properties[key]) errors.push(path + ' extra ' + key); });
    schema.required.forEach((key) => { if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(path + ' missing ' + key); });
    const out = {};
    Object.keys(schema.properties).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) out[key] = checkShape(value[key], schema.properties[key], path + '.' + key, errors);
    });
    return out;
  }

  function validateTurn(value) {
    const errors = [];
    const cleaned = checkShape(value, turnSchema, 'turn', errors);
    if (errors.length) return { ok: false, reason: 'schema', errors: errors.slice(0, 8) };
    if (CHECK.test(cleaned.say)) return { ok: false, reason: 'checks', errors: ['clearance'] };
    return { ok: true, value: cleaned };
  }

  function validateDebrief(value, count) {
    const errors = [];
    const cleaned = checkShape(value, debriefSchema, 'debrief', errors);
    if (errors.length) return { ok: false, reason: 'schema', errors: errors.slice(0, 8) };
    if (count && cleaned.items.length !== count) return { ok: false, reason: 'schema', errors: ['items length'] };
    const blob = JSON.stringify(cleaned);
    if (CHECK.test(blob)) return { ok: false, reason: 'checks', errors: ['clearance'] };
    return { ok: true, value: cleaned };
  }

  function templateFollow() {
    return 'Say a bit more about what you yourself did, in that real moment.';
  }

  function quoteBit(text, max) {
    const t = plain(text);
    if (!t) return '';
    const sentence = t.split(/(?<=\.)\s+/).find((part) => part.length > 30) || t;
    return sentence.length <= max ? sentence : sentence.slice(0, max).replace(/\s+\S*$/, '');
  }

  function strongerFrom(answer, about) {
    const said = plain(answer);
    if (words(said).length >= 35) {
      const parts = said.split(/(?<=\.)\s+/).slice(0, 2).join(' ');
      return parts || said.slice(0, 320);
    }
    const kept = quoteBit(said, 180);
    const mine = quoteBit(about, 160);
    if (kept && mine) return kept + ' Then add how it turned out. You already shared this too: ' + mine;
    if (kept) return kept + ' Then add what you did next and how it turned out.';
    if (mine) return 'Start from what you already shared: ' + mine + ' Then add what you did and how it turned out.';
    return 'Use one real moment you lived. Say what you did, then how it turned out.';
  }

  function templateDebrief(session, about) {
    const items = session.answers.map((item) => {
      const text = fullAnswer(item);
      const thin = answerIsThin(text);
      return {
        landed: thin ? 'You started an answer in your own words.' : 'You gave a real example and said what you did.',
        fix: thin ? 'Add what you did, step by step, and how it turned out.' : 'Keep the background to one sentence so the action gets the time.',
        stronger: strongerFrom(text, about)
      };
    });
    const thinCount = session.answers.filter((item) => answerIsThin(fullAnswer(item))).length;
    const overall = thinCount
      ? 'You showed up and answered. Next time, spend most of the answer on what you did. This is practice, not a hiring verdict.'
      : 'Your answers had real detail. Keep them to about a minute when you say them out loud. This is practice, not a hiring verdict.';
    return { items, overall };
  }

  function applyAnswer(session, text) {
    const said = plain(text);
    if (!session || session.paused) return { ok: false, reason: 'paused' };
    if (session.phase !== 'listen') return { ok: false, reason: 'phase' };
    if (words(said).length < 2) return { ok: false, reason: 'short' };
    session.transcript.push({ who: 'you', text: said });
    if (!session.follow) {
      session.answers.push({ question: session.current, answer: said, follow: '', followAnswer: '' });
    } else {
      const last = session.answers[session.answers.length - 1];
      if (last) last.followAnswer = said;
    }
    if (session.mode === 'live') {
      session.phase = 'wait';
      session.pending = 'turn';
      return { ok: true, session, effect: 'request-turn' };
    }
    const last = session.answers[session.answers.length - 1];
    if (!session.follow && answerIsThin(said)) {
      session.follow = true;
      if (last) last.follow = templateFollow();
      session.current = templateFollow();
      session.transcript.push({ who: 'interviewer', text: session.current });
      session.phase = 'listen';
      return { ok: true, session, effect: 'speak' };
    }
    session.follow = false;
    session.index += 1;
    if (session.index >= session.questions.length) {
      session.phase = 'review';
      session.pending = '';
      session.ended = true;
      session.debrief = templateDebrief(session, session.about || '');
      return { ok: true, session, effect: 'review' };
    }
    session.current = session.questions[session.index];
    session.transcript.push({ who: 'interviewer', text: session.current });
    session.phase = 'listen';
    return { ok: true, session, effect: 'speak' };
  }

  function applyTurn(session, turn) {
    const checked = validateTurn(turn);
    if (!checked.ok) return checked;
    const say = checked.value.say;
    const kind = checked.value.kind;
    if (kind === 'follow') {
      if (session.follow || !session.answers.length) return { ok: false, reason: 'follow' };
      session.follow = true;
      const last = session.answers[session.answers.length - 1];
      if (last) last.follow = say;
      session.current = say;
      session.transcript.push({ who: 'interviewer', text: say });
      session.phase = 'listen';
      session.pending = '';
      return { ok: true, session, effect: 'speak' };
    }
    if (kind === 'done') {
      if (session.answers.length < 5 && !session.userEnded) return { ok: false, reason: 'early' };
      session.transcript.push({ who: 'interviewer', text: say });
      session.current = say;
      session.phase = 'debrief';
      session.pending = 'debrief';
      session.ended = true;
      return { ok: true, session, effect: 'request-debrief' };
    }
    if (session.answers.length >= 7) {
      session.phase = 'debrief';
      session.pending = 'debrief';
      session.ended = true;
      return { ok: true, session, effect: 'request-debrief' };
    }
    if (session.current && session.answers.length) session.index += 1;
    session.follow = false;
    session.current = say;
    session.transcript.push({ who: 'interviewer', text: say });
    session.phase = 'listen';
    session.pending = '';
    return { ok: true, session, effect: 'speak' };
  }

  function endSession(session) {
    if (!session) return { ok: false, reason: 'session' };
    session.userEnded = true;
    session.paused = false;
    if (!session.answers.length) {
      session.phase = 'closed';
      session.pending = '';
      session.ended = true;
      return { ok: true, session, effect: 'close' };
    }
    if (session.mode === 'template') {
      session.debrief = templateDebrief(session, session.about || '');
      session.phase = 'review';
      session.pending = '';
      session.ended = true;
      return { ok: true, session, effect: 'review' };
    }
    session.phase = 'debrief';
    session.pending = 'debrief';
    session.ended = true;
    return { ok: true, session, effect: 'request-debrief' };
  }

  function applyDebrief(session, value) {
    const checked = validateDebrief(value, session.answers.length);
    if (!checked.ok) return checked;
    session.debrief = checked.value;
    session.phase = 'review';
    session.pending = '';
    return { ok: true, session, effect: 'review' };
  }

  // Only the owner sees these: only the owner has a tower set up.
  const TOWER_NOTES = {
    login: 'Codex on your tower needs signing in again. On the tower, run codex login. These are generic questions from the ad for now.',
    codex: 'The tower could not run the interviewer this time, so these are generic questions from the ad.'
  };
  function useTemplate(session, about, reason) {
    session.mode = 'template';
    session.generic = true;
    session.note = TOWER_NOTES[reason] || 'The live interviewer could not be reached, so these are generic questions from the ad.';
    session.about = about || session.about || '';
    session.pending = '';
    if (!session.current) {
      session.current = session.questions[Math.min(session.index, session.questions.length - 1)] || session.questions[0];
      session.transcript.push({ who: 'interviewer', text: session.current });
    }
    if (session.phase === 'wait' || session.phase === 'debrief') session.phase = session.ended ? 'review' : 'listen';
    if (session.ended && !session.debrief) {
      session.debrief = templateDebrief(session, session.about);
      session.phase = 'review';
    }
    return session;
  }

  function contextFrom(prep) {
    const p = prep || {};
    const about = p.aboutYou && p.aboutYou.text ? p.aboutYou.text : '';
    return {
      company: /^company$/i.test(clip(p.company, 120)) ? '' : clip(p.company, 120),
      role: clip(p.role, 120),
      stage: clip(p.intake && p.intake.stage, 40),
      ad: clip(p.job, 4000),
      about: clip(about, 2500)
    };
  }

  function turnPayload(session, prep) {
    const ctx = contextFrom(prep);
    return {
      company: ctx.company,
      role: ctx.role,
      stage: ctx.stage,
      ad: ctx.ad,
      about: ctx.about,
      questions: (session.questions || []).slice(0, 6),
      transcript: (session.transcript || []).slice(-10).map((line) => ({
        who: line.who === 'you' ? 'you' : 'interviewer',
        text: clip(line.text, 600)
      })),
      answerCount: session.answers.length,
      follow: !!session.follow,
      userEnded: !!session.userEnded
    };
  }

  function debriefPayload(session, prep) {
    const ctx = contextFrom(prep);
    return {
      company: ctx.company,
      role: ctx.role,
      ad: ctx.ad,
      about: ctx.about,
      answers: session.answers.map((item) => ({
        question: clip(item.question, 300),
        answer: clip(fullAnswer(item), 800)
      }))
    };
  }

  function buildTurnPrompt(input) {
    const data = input || {};
    const lines = (Array.isArray(data.transcript) ? data.transcript : []).map((line) => (line.who === 'you' ? 'Candidate' : 'You') + ': ' + line.text);
    return [
      'You are the interviewer in a practice interview for one person and one job.',
      'Speak one turn only. Plain words. No em dash. Do not invent jobs, dates, or results.',
      'If the last answer is thin, ask one short follow-up about what they themselves did. Only one follow-up per question.',
      'Otherwise ask the next question, tied to this ad and their background.',
      'After 5 to 7 main questions, set kind to done and say a one-sentence close.',
      'kind is question, follow, or done. say is the exact words you speak.',
      'Never ask about a criminal record check, a clearance, a work permit, or the right to work.',
      '',
      'Company: ' + (data.company || 'Unknown'),
      'Role: ' + (data.role || 'Unknown'),
      'Stage: ' + (data.stage || 'Not sure yet'),
      'Main questions so far: ' + (data.answerCount || 0),
      'Follow-up already asked for this question: ' + (data.follow ? 'yes' : 'no'),
      'The person asked to stop: ' + (data.userEnded ? 'yes' : 'no'),
      '',
      'PLANNED QUESTIONS',
      (data.questions || []).map((q) => '- ' + q).join('\n') || '- none',
      '',
      'ABOUT YOU',
      data.about || '(nothing shared)',
      '',
      'JOB AD',
      data.ad || '(missing)',
      '',
      'SO FAR',
      lines.join('\n') || '(this is the opening question)'
    ].join('\n');
  }

  function buildDebriefPrompt(input) {
    const data = input || {};
    const answers = (data.answers || []).map((item, i) => (i + 1) + '. Question: ' + item.question + '\nAnswer: ' + item.answer).join('\n\n');
    return [
      'Write a short practice debrief for one person and one job.',
      'For each answer: what landed, one fix, and a stronger version.',
      'The stronger version may use only words from that answer and from ABOUT YOU. Do not invent employers, dates, numbers, or results.',
      'overall is 2 or 3 plain sentences. It is practice, not a hiring verdict. No em dash.',
      'items must be one per answer, in the same order.',
      '',
      'Company: ' + (data.company || 'Unknown'),
      'Role: ' + (data.role || 'Unknown'),
      '',
      'ABOUT YOU',
      data.about || '(nothing shared)',
      '',
      'JOB AD',
      data.ad || '(missing)',
      '',
      'ANSWERS',
      answers || '(none)'
    ].join('\n');
  }

  function cleanSessions(list) {
    if (!Array.isArray(list)) return [];
    return list.filter((item) => item && typeof item.id === 'string' && Array.isArray(item.answers)).slice(0, 8).map((item) => ({
      id: item.id,
      at: typeof item.at === 'string' ? item.at : '',
      mode: item.mode === 'live' ? 'live' : 'template',
      generic: !!item.generic,
      note: typeof item.note === 'string' ? item.note.slice(0, 300) : '',
      questions: Array.isArray(item.questions) ? item.questions.filter((q) => typeof q === 'string').slice(0, 7) : [],
      answers: item.answers.filter((a) => a && typeof a.question === 'string' && typeof a.answer === 'string').slice(0, 7).map((a) => ({
        question: a.question.slice(0, 500),
        answer: a.answer.slice(0, 4000),
        follow: typeof a.follow === 'string' ? a.follow.slice(0, 500) : '',
        followAnswer: typeof a.followAnswer === 'string' ? a.followAnswer.slice(0, 4000) : ''
      })),
      debrief: item.debrief && Array.isArray(item.debrief.items) ? {
        items: item.debrief.items.slice(0, 7).map((part) => ({
          landed: String(part.landed || '').slice(0, 300),
          fix: String(part.fix || '').slice(0, 300),
          stronger: String(part.stronger || '').slice(0, 500)
        })),
        overall: String(item.debrief.overall || '').slice(0, 500)
      } : null
    }));
  }

  function snapshot(session) {
    return {
      id: session.id,
      at: session.at,
      mode: session.mode,
      generic: session.generic,
      note: session.note,
      questions: session.questions,
      answers: session.answers,
      debrief: session.debrief
    };
  }

  const api = {
    CHECK, turnSchema, debriefSchema, answerIsThin, templateQuestions, createSession,
    validateTurn, validateDebrief, applyAnswer, applyTurn, applyDebrief, endSession, useTemplate,
    templateDebrief, strongerFrom, contextFrom, turnPayload, debriefPayload, buildTurnPrompt, buildDebriefPrompt,
    cleanSessions, snapshot, fullAnswer
  };
  root.NextStepLive = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  if (typeof document === 'undefined') return;

  let liveSession = null;
  let liveHeard = '';
  let liveListening = false;
  let liveRec = null;
  let liveTyped = false;
  let liveMicNote = '';
  let liveBusy = false;

  function livePrep() { return active; }
  function liveShow(name) { show(name); }
  function liveSave() {
    const prep = livePrep();
    if (!prep || !liveSession) return;
    const list = Array.isArray(prep.liveSessions) ? prep.liveSessions.slice() : [];
    const shot = snapshot(liveSession);
    const at = list.findIndex((item) => item.id === shot.id);
    if (at >= 0) list[at] = shot;
    else list.unshift(shot);
    prep.liveSessions = list.slice(0, 8);
    if (typeof save === 'function') save();
  }
  function liveRecognizer() {
    const Ctor = window.SpeechRecognition || window.webkitSpeechRecognition;
    return Ctor ? new Ctor() : null;
  }
  function liveStopRec() {
    liveListening = false;
    if (!liveRec) return;
    try { liveRec.onend = null; liveRec.stop(); } catch { /* already stopped */ }
    liveRec = null;
  }
  function liveStopSpeak() {
    try { if (typeof ivStopSpeech === 'function') ivStopSpeech(); } catch { /* no speech */ }
    try { if (window.speechSynthesis) window.speechSynthesis.cancel(); } catch { /* none */ }
  }
  function liveVoice() {
    if (typeof ivVoices === 'function') {
      const found = ivVoices();
      if (found && found.voice) return found.voice;
    }
    return null;
  }
  function liveSpeak(text) {
    liveStopSpeak();
    const synth = typeof ivSynth === 'function' ? ivSynth() : window.speechSynthesis;
    if (!synth || typeof window.SpeechSynthesisUtterance !== 'function') return;
    const voice = liveVoice();
    if (!voice) return;
    try {
      const utter = new window.SpeechSynthesisUtterance(text);
      utter.voice = voice;
      utter.lang = voice.lang || 'en-GB';
      utter.rate = 0.96;
      synth.speak(utter);
    } catch { /* captions still show the words */ }
  }
  function liveListen() {
    liveMicNote = '';
    const rec = liveRecognizer();
    if (!rec) {
      liveMicNote = 'This phone has no speech recognition. Type your answer instead.';
      liveTyped = true;
      liveShow('live');
      return;
    }
    liveStopRec();
    liveListening = true;
    liveHeard = liveHeard || '';
    try {
      rec.lang = (navigator && navigator.language) || 'en-GB';
      rec.continuous = true;
      rec.interimResults = true;
      rec.onresult = (event) => {
        let finalText = '';
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const bit = event.results[i][0] ? event.results[i][0].transcript : '';
          if (event.results[i].isFinal) finalText += bit;
          else interim += bit;
        }
        if (finalText) liveHeard = plain(liveHeard + ' ' + finalText);
        const box = document.getElementById('live-you');
        if (box) box.textContent = plain(liveHeard + ' ' + interim) || 'Listening';
      };
      rec.onerror = (event) => {
        const code = event && event.error;
        if (code === 'not-allowed' || code === 'service-not-allowed') {
          liveMicNote = 'The microphone is off. Type your answer instead.';
          liveTyped = true;
          liveListening = false;
          liveShow('live');
        }
      };
      rec.onend = () => {
        if (liveListening) {
          try { rec.start(); } catch { liveListening = false; }
        }
      };
      rec.start();
      liveRec = rec;
      liveShow('live');
    } catch {
      liveMicNote = 'The microphone is off. Type your answer instead.';
      liveTyped = true;
      liveListening = false;
      liveShow('live');
    }
  }
  async function liveRequest(kind) {
    const prep = livePrep();
    if (!liveSession || !prep || liveBusy) return;
    liveBusy = true;
    liveShow('live');
    const provider = window.NextStepProvider;
    const prefs = typeof corePrefs === 'function' ? corePrefs() : {};
    const path = kind === 'debrief' ? '/interview/debrief' : '/interview/turn';
    const body = kind === 'debrief' ? debriefPayload(liveSession, prep) : turnPayload(liveSession, prep);
    let result = { ok: false, reason: 'unconfigured' };
    try {
      if (provider && typeof provider.requestInterview === 'function') result = await provider.requestInterview(prefs, path, body);
    } catch { result = { ok: false, reason: 'unreachable' }; }
    liveBusy = false;
    if (!liveSession) return;
    if (!result.ok) {
      useTemplate(liveSession, (prep.aboutYou && prep.aboutYou.text) || '', result.reason);
      if (typeof notify === 'function') notify(liveSession.note);
      liveSave();
      if (liveSession.phase === 'review') { liveSpeak(''); liveShow('live-review'); }
      else { liveSpeak(liveSession.current); liveShow('live'); }
      return;
    }
    const applied = kind === 'debrief' ? applyDebrief(liveSession, result.debrief) : applyTurn(liveSession, result.turn);
    if (!applied.ok) {
      useTemplate(liveSession, (prep.aboutYou && prep.aboutYou.text) || '');
      if (typeof notify === 'function') notify(liveSession.note);
    }
    liveSave();
    if (liveSession.phase === 'review' || liveSession.pending === 'debrief' && applied.effect === 'review') {
      liveShow('live-review');
      return;
    }
    if (liveSession.pending === 'debrief') {
      liveRequest('debrief');
      return;
    }
    if (liveSession.current) liveSpeak(liveSession.current);
    liveShow('live');
  }
  function liveSubmit(text) {
    if (!liveSession) return;
    liveStopRec();
    liveStopSpeak();
    const result = applyAnswer(liveSession, text);
    if (!result.ok) {
      if (typeof notify === 'function') notify(result.reason === 'short' ? 'Say a little more, then tap I am done answering.' : 'Wait for the question to finish.');
      return;
    }
    liveHeard = '';
    liveSave();
    if (result.effect === 'request-turn') { liveRequest('turn'); return; }
    if (result.effect === 'review') { liveShow('live-review'); return; }
    liveSpeak(liveSession.current);
    liveShow('live');
  }

  screens.live = function () {
    const session = liveSession;
    if (!session) return screens.today ? screens.today() : '';
    const you = plain(liveHeard);
    const status = session.paused ? 'Paused' : liveBusy ? 'One moment' : liveListening ? 'Listening' : session.phase === 'wait' ? 'One moment' : 'Your turn';
    return `<div class="screen live-screen${liveListening ? ' is-listening' : ''}" data-screen="live">
      <div class="topbar">${iconBtn('live-end', 'End interview', I.close)}<span class="label">Practice the interview</span><button type="button" class="quiet" data-action="live-pause">${session.paused ? 'Resume' : 'Pause'}</button></div>
      ${session.generic ? `<section class="glass pad-sm generic-banner" role="status"><p class="kicker">Generic interview</p><p>${esc(session.note || 'These questions come from the ad, not a live interviewer.')}</p></section>` : ''}
      <p class="kicker">Interviewer</p>
      <h1 class="live-say" id="live-say">${esc(session.current || (liveBusy ? 'Getting the next question.' : ''))}</h1>
      <p class="kicker">You</p>
      <p class="live-you" id="live-you">${esc(you || (liveListening ? 'Listening' : 'Your words show up here.'))}</p>
      <p class="live-status" role="status">${esc(status)}${liveMicNote ? '. ' + esc(liveMicNote) : ''}</p>
      ${liveTyped ? `<label class="field" for="live-type">Type your answer</label><textarea id="live-type" class="compact" maxlength="4000"></textarea>` : '<button type="button" class="text-btn" data-action="live-type">Type instead</button>'}
      <div class="spacer"></div>
      <p class="fine">Tap to talk may send your voice to Apple or Google to turn it into text. Type instead keeps it on this phone.</p>
      <button type="button" class="primary live-talk" data-action="live-talk" ${liveBusy || session.paused ? 'disabled' : ''}>${liveListening ? 'Listening' : 'Tap to talk'}</button>
      <button type="button" class="primary" data-action="live-done" ${liveBusy || session.paused ? 'disabled' : ''}>I am done answering</button>
    </div>`;
  };
  screens['live-review'] = function () {
    const session = liveSession;
    const debrief = session && session.debrief;
    if (!session || !debrief) return screens.today ? screens.today() : '';
    const items = debrief.items.map((item, i) => {
      const q = session.answers[i] ? session.answers[i].question : '';
      const said = session.answers[i] ? fullAnswer(session.answers[i]) : '';
      return `<article class="glass pad-sm live-card"><p class="kicker">Question ${i + 1}</p><h2>${esc(q)}</h2>${said ? `<p><strong>What you said.</strong> ${esc(said)}</p>` : ''}<p><strong>What landed.</strong> ${esc(item.landed)}</p><p><strong>One fix.</strong> ${esc(item.fix)}</p><p><strong>A stronger version.</strong> ${esc(item.stronger)}</p></article>`;
    }).join('');
    return `<div class="screen" data-screen="live-review">
      <div class="topbar">${iconBtn('close-today', 'Close', I.close)}<span class="label">Debrief</span></div>
      <h1>How that interview went</h1>
      <p class="italic lg">Practice, not a verdict.</p>
      ${session.generic ? '<p class="flow-note">Generic debrief from the ad and your words. A live interviewer was not connected.</p>' : ''}
      <p class="live-overall">${esc(debrief.overall)}</p>
      ${items}
      <button type="button" class="primary gap-top" data-action="close-today"><span>Back to today</span></button>
    </div>`;
  };

  actions['open-live'] = function () {
    if (typeof needPrep === 'function' && !needPrep()) return;
    if (typeof ivPrime === 'function') ivPrime();
    liveStopRec();
    liveStopSpeak();
    liveHeard = '';
    liveTyped = false;
    liveMicNote = '';
    const prep = livePrep();
    liveSession = createSession(prep, { provider: typeof coreProviderReady === 'function' && coreProviderReady() });
    liveSession.about = prep && prep.aboutYou ? prep.aboutYou.text : '';
    liveSave();
    if (liveSession.pending === 'turn') liveRequest('turn');
    else { liveSpeak(liveSession.current); liveShow('live'); }
  };
  actions['live-talk'] = function () {
    if (!liveSession || liveSession.paused || liveBusy) return;
    if (typeof ivPrime === 'function') ivPrime();
    liveStopSpeak();
    if (liveListening) return;
    liveListen();
  };
  actions['live-type'] = function () {
    liveTyped = true;
    liveShow('live');
    const box = document.getElementById('live-type');
    if (box) box.focus();
  };
  actions['live-done'] = function () {
    if (!liveSession || liveBusy) return;
    const typed = document.getElementById('live-type');
    const text = typed && typed.value.trim() ? typed.value : liveHeard;
    liveSubmit(text);
  };
  actions['live-pause'] = function () {
    if (!liveSession) return;
    liveSession.paused = !liveSession.paused;
    if (liveSession.paused) { liveStopRec(); liveStopSpeak(); }
    liveShow('live');
  };
  actions['live-end'] = function () {
    if (!liveSession) { liveShow('today'); return; }
    liveStopRec();
    liveStopSpeak();
    const result = endSession(liveSession);
    liveSave();
    if (result.effect === 'request-debrief') { liveRequest('debrief'); return; }
    if (result.effect === 'review') { liveShow('live-review'); return; }
    liveSession = null;
    liveShow('today');
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
