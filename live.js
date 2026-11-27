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
  /* A live interviewer that does not answer: the interview stays live. A timeout or an unreachable
     tower is retried once on its own; after that the person sees why, with Try again and Continue with
     general questions. These are the reasons, in plain words, for the toast and the screen. */
  const STALL_REASONS = {
    login: 'Codex on your tower needs signing in again. On the tower, run codex login, then try again.',
    codex: 'The tower could not run the interviewer this time.',
    unauthorized: 'The tower did not accept the secret in Settings.',
    limited: 'The tower is busy right now. Wait a minute, then try again.',
    offline: "You're offline. Try again when you have a connection, or continue with general questions.",
    timeout: 'The interviewer took too long to answer.',
    unreachable: 'The tower could not be reached.',
    large: 'This interview is too long to send.',
    invalid: 'The answer did not come back in a usable shape.',
    forbidden: 'That tower address is not allowed.'
  };
  const RETRY_ON_ITS_OWN = ['timeout', 'unreachable'];
  const stallMessage = (reason) => STALL_REASONS[reason] || STALL_REASONS.invalid;
  const retryOnItsOwn = (reason, retried) => !retried && RETRY_ON_ITS_OWN.includes(reason);
  /* What the debrief says about a generic interview: one that was live and then switched is not
     described as never connected. */
  function genericNote(session) {
    if (!session || !session.generic) return '';
    return session.wasLive
      ? 'The live interviewer stopped answering partway, so the rest is generic, from the ad and your words.'
      : 'Generic debrief from the ad and your words. A live interviewer was not connected.';
  }

  function useTemplate(session, about, reason) {
    if (session.mode === 'live') session.wasLive = true;
    session.mode = 'template';
    session.generic = true;
    session.note = TOWER_NOTES[reason] || 'The live interviewer could not be reached, so these are generic questions from the ad.';
    session.about = about || session.about || '';
    session.pending = '';
    session.index = Math.min(session.index, Math.max(0, session.questions.length - 1));
    if (!session.current) {
      session.current = session.questions[session.index] || session.questions[0];
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
      wasLive: !!item.wasLive,
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
      } : null,
      // Where an unfinished interview stood, so it can be resumed. Sessions saved before v15 lack these;
      // resumeSession rebuilds them from the answers.
      state: cleanState(item.state)
    }));
  }

  const PHASES = ['wait', 'listen', 'debrief', 'review', 'closed'];
  function cleanState(value) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
    const index = Number.isInteger(value.index) && value.index >= 0 && value.index <= 7 ? value.index : 0;
    return {
      phase: PHASES.includes(value.phase) ? value.phase : 'wait',
      pending: value.pending === 'turn' || value.pending === 'debrief' ? value.pending : '',
      index,
      follow: !!value.follow,
      current: typeof value.current === 'string' ? value.current.slice(0, 500) : '',
      ended: !!value.ended,
      userEnded: !!value.userEnded,
      transcript: Array.isArray(value.transcript) ? value.transcript
        .filter((t) => t && (t.who === 'interviewer' || t.who === 'you') && typeof t.text === 'string')
        .slice(-40).map((t) => ({ who: t.who, text: t.text.slice(0, 4000) })) : []
    };
  }

  /* A saved interview is finished once it has a debrief. One with answers and no debrief is unfinished;
     one with neither was opened and left, so there is nothing to show. */
  const finishedSession = (s) => !!(s && s.debrief && Array.isArray(s.debrief.items));
  const worthListing = (s) => !!s && (finishedSession(s) || (Array.isArray(s.answers) && s.answers.length > 0));
  function pastSessions(prep) {
    const list = cleanSessions(prep && prep.liveSessions).filter(worthListing);
    const newestOpen = list.find((s) => !finishedSession(s));
    return list.map((s) => ({
      id: s.id,
      at: s.at,
      live: s.mode === 'live' || s.wasLive,
      finished: finishedSession(s),
      resume: !!newestOpen && s.id === newestOpen.id
    }));
  }

  /* Keep at most `max` saved interviews, newest first. When one has to go, the oldest finished one goes
     first, so unfinished ones survive; the one being saved and the newest unfinished one are never
     dropped. Only with nothing finished left does the oldest other unfinished one go. */
  const MAX_SESSIONS = 8;
  function trimSessions(list, keepId, max) {
    const cap = max || MAX_SESSIONS;
    const out = Array.isArray(list) ? list.slice() : [];
    const openOne = out.find((s) => s && s.id !== keepId && !finishedSession(s) && Array.isArray(s.answers) && s.answers.length);
    const protect = new Set([keepId, openOne && openOne.id].filter(Boolean));
    while (out.length > cap) {
      let at = -1;
      for (let i = out.length - 1; i >= 0 && at < 0; i -= 1) if (!protect.has(out[i] && out[i].id) && finishedSession(out[i])) at = i;
      for (let i = out.length - 1; i >= 0 && at < 0; i -= 1) if (!protect.has(out[i] && out[i].id)) at = i;
      if (at < 0) break;
      out.splice(at, 1);
    }
    return out;
  }

  function transcriptFrom(answers) {
    const out = [];
    answers.forEach((a) => {
      out.push({ who: 'interviewer', text: a.question }, { who: 'you', text: a.answer });
      if (a.follow) out.push({ who: 'interviewer', text: a.follow });
      if (a.followAnswer) out.push({ who: 'you', text: a.followAnswer });
    });
    return out;
  }

  /* Rebuild a working session from a saved one, ready to carry on. A live interview that was waiting asks
     again for its pending turn or debrief; one that ended waits for its debrief. A generic one carries on
     from its question, and one with no questions left gets its generic debrief. */
  function resumeSession(saved, about) {
    const clean = cleanSessions([saved])[0];
    if (!clean || finishedSession(clean)) return null;
    const st = clean.state || { phase: 'wait', pending: '', index: clean.answers.length, follow: false, current: '', ended: false, userEnded: false, transcript: [] };
    const session = {
      id: clean.id,
      at: clean.at,
      mode: clean.mode,
      generic: clean.generic,
      wasLive: clean.wasLive,
      note: clean.note,
      questions: clean.questions.length ? clean.questions : templateQuestions({}),
      answers: clean.answers,
      transcript: st.transcript.length ? st.transcript : transcriptFrom(clean.answers),
      debrief: null,
      paused: false,
      follow: st.follow,
      index: clean.state ? st.index : clean.answers.length,
      current: '',
      ended: st.ended,
      userEnded: st.userEnded,
      pending: '',
      phase: 'wait',
      about: about || ''
    };
    if (session.mode === 'live') {
      // Keep the question that was on screen: the caption shows it while the turn is asked again, and
      // applyTurn only moves `index` on when there is a current question.
      session.current = st.current;
      if (session.ended) { session.phase = 'debrief'; session.pending = 'debrief'; return session; }
      if (st.phase === 'listen' && st.current && !st.pending) { session.phase = 'listen'; return session; }
      session.pending = 'turn';
      return session;
    }
    // A generic interview saved at a question carries on at that question, even when its index ran
    // past the generic list (one that was live first keeps the live count).
    if (!session.ended && st.phase === 'listen' && st.current) {
      session.current = st.current;
      session.index = Math.min(session.index, Math.max(0, session.questions.length - 1));
      session.phase = 'listen';
      return session;
    }
    if (session.ended || session.index >= session.questions.length) {
      session.ended = true;
      session.debrief = templateDebrief(session, session.about);
      session.phase = 'review';
      return session;
    }
    session.current = st.current || session.questions[session.index];
    if (session.transcript[session.transcript.length - 1]?.text !== session.current) session.transcript.push({ who: 'interviewer', text: session.current });
    session.phase = 'listen';
    return session;
  }

  function snapshot(session) {
    return {
      id: session.id,
      at: session.at,
      mode: session.mode,
      generic: session.generic,
      wasLive: !!session.wasLive,
      note: session.note,
      questions: session.questions,
      answers: session.answers,
      debrief: session.debrief,
      state: {
        phase: session.phase,
        pending: session.pending || '',
        index: session.index,
        follow: !!session.follow,
        current: session.current || '',
        ended: !!session.ended,
        userEnded: !!session.userEnded,
        transcript: Array.isArray(session.transcript) ? session.transcript.slice(-40) : []
      }
    };
  }

  const api = {
    CHECK, turnSchema, debriefSchema, answerIsThin, templateQuestions, createSession,
    validateTurn, validateDebrief, applyAnswer, applyTurn, applyDebrief, endSession, useTemplate,
    templateDebrief, strongerFrom, contextFrom, turnPayload, debriefPayload, buildTurnPrompt, buildDebriefPrompt,
    cleanSessions, snapshot, fullAnswer, stallMessage, retryOnItsOwn, genericNote,
    pastSessions, resumeSession, finishedSession, trimSessions
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
  // The interviewer did not answer: { kind: 'turn' | 'debrief', reason }. The interview stays live.
  let liveStall = null;
  // A past interview opened from Practise, shown read-only on the review screen. Never saved back.
  let liveViewing = null;
  /* Each request to the tower belongs to one interview. Starting, resuming or ending one lets go of the
     request in flight, so its reply, when it comes, is dropped instead of landing in another interview. */
  let liveAsk = 0;
  function liveLetGo() { liveAsk += 1; liveBusy = false; }

  function livePrep() { return active; }
  function liveShow(name) { liveViewing = null; show(name); }
  function liveSave() {
    const prep = livePrep();
    if (!prep || !liveSession) return;
    const list = Array.isArray(prep.liveSessions) ? prep.liveSessions.slice() : [];
    const shot = snapshot(liveSession);
    const at = list.findIndex((item) => item.id === shot.id);
    if (at >= 0) list[at] = shot;
    else list.unshift(shot);
    prep.liveSessions = trimSessions(list, shot.id);
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
  function liveStalled(kind, reason) {
    liveStall = { kind, reason };
    if (typeof notify === 'function') notify(stallMessage(reason));
    liveSave();
    liveSpeak('');
    liveShow('live');
  }
  async function liveRequest(kind, retried) {
    const prep = livePrep();
    if (!liveSession || !prep || liveBusy) return;
    const mine = liveSession;
    const ask = ++liveAsk;
    liveStall = null;
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
    if (ask !== liveAsk || liveSession !== mine) return;
    liveBusy = false;
    if (!result.ok) {
      if (result.reason === 'cancelled') { liveShow('live'); return; }
      if (retryOnItsOwn(result.reason, retried)) return liveRequest(kind, true);
      liveStalled(kind, result.reason);
      return;
    }
    const applied = kind === 'debrief' ? applyDebrief(liveSession, result.debrief) : applyTurn(liveSession, result.turn);
    if (!applied.ok) { liveStalled(kind, 'invalid'); return; }
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
      ${liveStall ? `<section class="glass pad-sm generic-banner" role="alert"><p class="kicker">The interviewer didn't answer.</p><p>${esc(stallMessage(liveStall.reason))}</p>
        <button type="button" class="primary" data-action="live-retry">Try again</button>
        <button type="button" class="text-btn" data-action="live-general">Continue with general questions</button></section>` : ''}
      ${session.generic ? `<section class="glass pad-sm generic-banner" role="status"><p class="kicker">Generic interview</p><p>${esc(session.note || 'These questions come from the ad, not a live interviewer.')}</p></section>` : ''}
      <p class="kicker">Interviewer</p>
      <h1 class="live-say" id="live-say">${esc(session.current || (liveBusy ? 'Getting the next question.' : ''))}</h1>
      <p class="kicker">You</p>
      <p class="live-you" id="live-you">${esc(you || (liveListening ? 'Listening' : 'Your words show up here.'))}</p>
      <p class="live-status" role="status">${esc(status)}${liveMicNote ? '. ' + esc(liveMicNote) : ''}</p>
      ${liveTyped ? `<label class="field" for="live-type">Type your answer</label><textarea id="live-type" class="compact" maxlength="4000"></textarea>` : '<button type="button" class="text-btn" data-action="live-type">Type instead</button>'}
      <div class="spacer"></div>
      <p class="fine">Tap to talk may send your voice to Apple or Google to turn it into text. Type instead keeps it on this phone.</p>
      <button type="button" class="primary live-talk" data-action="live-talk" ${liveBusy || liveStall || session.paused ? 'disabled' : ''}>${liveListening ? 'Listening' : 'Tap to talk'}</button>
      <button type="button" class="primary" data-action="live-done" ${liveBusy || liveStall || session.paused ? 'disabled' : ''}>I am done answering</button>
    </div>`;
  };
  screens['live-review'] = function () {
    const session = liveViewing || liveSession;
    const debrief = session && session.debrief;
    if (!session || (!debrief && !liveViewing)) return screens.today ? screens.today() : '';
    // An unfinished past interview opened read-only: what was said, and no debrief.
    if (!debrief) {
      const said = session.answers.map((a, i) => `<article class="glass pad-sm live-card"><p class="kicker">Question ${i + 1}</p><h2>${esc(a.question)}</h2><p><strong>What you said.</strong> ${esc(fullAnswer(a))}</p></article>`).join('');
      return `<div class="screen" data-screen="live-review">
      <div class="topbar">${iconBtn('close-today', 'Close', I.close)}<span class="label">Past interview</span></div>
      <h1>An unfinished interview</h1>
      <p class="italic lg">Unfinished, so there is no debrief.</p>
      ${said}
      ${session.transcript.length ? `<details class="fold"><summary>Transcript</summary>${session.transcript.map((t) => `<p><strong>${t.who === 'you' ? 'You' : 'Interviewer'}.</strong> ${esc(t.text)}</p>`).join('')}</details>` : ''}
      <button type="button" class="primary gap-top" data-action="close-today"><span>Back to today</span></button>
    </div>`;
    }
    const items = debrief.items.map((item, i) => {
      const q = session.answers[i] ? session.answers[i].question : '';
      const said = session.answers[i] ? fullAnswer(session.answers[i]) : '';
      return `<article class="glass pad-sm live-card"><p class="kicker">Question ${i + 1}</p><h2>${esc(q)}</h2>${said ? `<p><strong>What you said.</strong> ${esc(said)}</p>` : ''}<p><strong>What landed.</strong> ${esc(item.landed)}</p><p><strong>One fix.</strong> ${esc(item.fix)}</p><p><strong>A stronger version.</strong> ${esc(item.stronger)}</p></article>`;
    }).join('');
    return `<div class="screen" data-screen="live-review">
      <div class="topbar">${iconBtn('close-today', 'Close', I.close)}<span class="label">Debrief</span></div>
      <h1>How that interview went</h1>
      <p class="italic lg">Practice, not a verdict.</p>
      ${session.generic ? `<p class="flow-note">${esc(genericNote(session))}</p>` : ''}
      <p class="live-overall">${esc(debrief.overall)}</p>
      ${items}
      ${liveViewing && liveViewing.transcript.length ? `<details class="fold"><summary>Transcript</summary>${liveViewing.transcript.map((t) => `<p><strong>${t.who === 'you' ? 'You' : 'Interviewer'}.</strong> ${esc(t.text)}</p>`).join('')}</details>` : ''}
      <button type="button" class="primary gap-top" data-action="close-today"><span>Back to today</span></button>
    </div>`;
  };

  actions['live-past'] = function (el) {
    const prep = livePrep();
    const id = el && el.dataset ? el.dataset.id : '';
    const saved = NextStepLive.cleanSessions(prep && prep.liveSessions).find((s) => s.id === id);
    if (!saved || !Array.isArray(saved.answers) || (!finishedSession(saved) && !saved.answers.length)) return;
    liveViewing = { ...saved, transcript: saved.state && saved.state.transcript.length ? saved.state.transcript : transcriptFrom(saved.answers) };
    show('live-review');
  };
  actions['live-resume'] = function (el) {
    const prep = livePrep();
    const id = el && el.dataset ? el.dataset.id : '';
    const saved = prep && Array.isArray(prep.liveSessions) ? prep.liveSessions.find((s) => s && s.id === id) : null;
    const session = saved && resumeSession(saved, prep.aboutYou && prep.aboutYou.text);
    if (!session) return undefined;
    if (typeof ivPrime === 'function') ivPrime();
    liveStopRec();
    liveStopSpeak();
    liveHeard = '';
    liveTyped = false;
    liveMicNote = '';
    liveStall = null;
    liveLetGo();
    liveSession = session;
    liveSave();
    if (session.pending) return liveRequest(session.pending);
    if (session.phase === 'review') { liveShow('live-review'); return undefined; }
    liveSpeak(session.current);
    liveShow('live');
    return undefined;
  };

  actions['open-live'] = function () {
    if (typeof needPrep === 'function' && !needPrep()) return;
    const open = pastSessions(livePrep()).find((s) => s.resume);
    if (open && !confirm('Start a new one? The unfinished one stays in Past interviews.')) return;
    if (typeof ivPrime === 'function') ivPrime();
    liveStopRec();
    liveStopSpeak();
    liveHeard = '';
    liveTyped = false;
    liveMicNote = '';
    liveStall = null;
    liveLetGo();
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
  actions['live-retry'] = function () {
    if (!liveSession || liveBusy || !liveStall) return undefined;
    const kind = liveStall.kind;
    liveStall = null;
    return liveRequest(kind, true);
  };
  actions['live-general'] = function () {
    if (!liveSession || liveBusy || !liveStall) return;
    const reason = liveStall.reason;
    liveStall = null;
    const prep = livePrep();
    useTemplate(liveSession, (prep && prep.aboutYou && prep.aboutYou.text) || '', reason);
    liveSave();
    if (liveSession.phase === 'review') { liveSpeak(''); liveShow('live-review'); return; }
    liveSpeak(liveSession.current);
    liveShow('live');
  };
  actions['live-done'] = function () {
    if (!liveSession || liveBusy || liveStall) return;
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
    liveLetGo();
    const result = endSession(liveSession);
    liveSave();
    if (result.effect === 'request-debrief') { liveRequest('debrief'); return; }
    if (result.effect === 'review') { liveShow('live-review'); return; }
    liveSession = null;
    liveStall = null;
    liveShow('today');
  };
})(typeof globalThis !== 'undefined' ? globalThis : this);
