/* Personal course: the shape a model must return, the checks, and the prompt.
   Classic script. The phone validates here and falls back to PrepEngine.create.
   The tower service uses the same schema and prompt. No network in this file. */
(function (root) {
  'use strict';

  /* Same gate as engine.js: checks and clearances are yes/no. They are not lessons,
     questions, or quiz items. */
  const CHECK = /\b(?:criminal record|vulnerable sector|police (?:check|clearance|record|information check)|security (?:check|clearance|screening)|background (?:check|screening)|references|(?:professional|work|employment|personal|character) reference|reference checks?|drug (?:test|screen)\w*|work permit|eligib\w* to work|legally (?:entitled|eligible|able) to work|right to work|driver[’']?s abstract|driving abstract|driving record|(?:government|medical) clearance)\b/i;
  const GENERIC = /write down one true example from your life|say in one sentence what this job is for|one true example from your life|any real example counts/i;
  const STOP = new Set('about,which,their,there,would,could,should,because,while,where,after,before,still,other,every,going,being,really,people,worked,working,years,year,thing,things,something,someone,through,those,these,them,they,your,from,with,have,this,that,what,when,into,over,under,than,then,just,very,also,only,most,more,some,such,each,both,same,been,were,was,are,and,for,you,but,not,can,will,who,how,its,our,the,job,work,time,make,made,like,well,back,good,much,many,need,needs,want,wants,help,helps,used,using,able,even,once,here,short,again,think,might,today,polite,answer,answers,story,stories,first,point,write,wrote,read,keep,three,four,five,seven,eight,true,sentence,sentences,example,examples,please,never,always,practice,practise,question,questions,strong,stronger,honest,honesty,closest,already,without'.split(','));
  const NAME_STOP = new Set('the,a,an,and,or,for,with,your,this,that,from,into,about,what,when,where,how,why,then,they,them,their,you,one,two,new,old,good,first,next,last,each,every,some,more,most,only,just,very,also,than,over,under,after,before,during,while,because,which,who,not,but,yet,our,was,were,are,has,had,have,been,being,its,his,her,she,him,did,does,can,may,let,say,says,said,tell,use,get,got,all,any,own,out,off,too,now,per,via,job,work,role,team,time,day,days,week,weeks'.split(','));
  const ACRONYMS = new Set(['star', 'cpr', 'pos', 'whmis', 'html', 'css', 'api', 'rest', 'json', 'pdf', 'ok', 'wcag', 'aed', 'hvac', 'sql', 'ssh', 'url']);
  const KINDS = ['motivation', 'behavioural', 'role', 'situational', 'closing'];
  const SOURCES = { resume: 'résumé', linkedin: 'LinkedIn', answers: 'answers' };

  const lessonSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['title', 'minutes', 'theme', 'body', 'exercise', 'done'],
    properties: {
      title: { type: 'string', minLength: 3, maxLength: 80 },
      minutes: { type: 'integer', minimum: 3, maximum: 20 },
      theme: { type: ['string', 'null'], minLength: 1, maxLength: 40 },
      body: { type: 'string', minLength: 80, maxLength: 1600 },
      exercise: { type: 'string', minLength: 20, maxLength: 600 },
      done: { type: 'boolean', const: false }
    }
  };
  const infoSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['kind', 'theme', 'source', 'probe', 'include', 'useStory'],
    properties: {
      kind: { type: 'string', enum: KINDS },
      theme: { type: ['string', 'null'], minLength: 1, maxLength: 40 },
      source: { type: ['string', 'null'], minLength: 3, maxLength: 300 },
      probe: { type: 'string', minLength: 8, maxLength: 400 },
      include: { type: 'array', minItems: 2, maxItems: 4, items: { type: 'string', minLength: 3, maxLength: 180 } },
      useStory: { type: 'string', minLength: 12, maxLength: 400 }
    }
  };
  const quizSchema = {
    type: 'object',
    additionalProperties: false,
    required: ['q', 'options', 'correct', 'why'],
    properties: {
      q: { type: 'string', minLength: 12, maxLength: 300 },
      options: { type: 'array', minItems: 3, maxItems: 3, items: { type: 'string', minLength: 2, maxLength: 180 } },
      correct: { type: 'integer', minimum: 0, maximum: 2 },
      why: { type: 'string', minLength: 12, maxLength: 400 }
    }
  };
  const courseSchema = {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    type: 'object',
    additionalProperties: false,
    required: ['requirements', 'course', 'questions', 'questionInfo', 'quizItems'],
    properties: {
      requirements: { type: 'array', minItems: 3, maxItems: 8, items: { type: 'string', minLength: 3, maxLength: 180 } },
      course: { type: 'array', minItems: 6, maxItems: 10, items: lessonSchema },
      questions: { type: 'array', minItems: 8, maxItems: 10, items: { type: 'string', minLength: 12, maxLength: 400 } },
      questionInfo: { type: 'array', minItems: 8, maxItems: 10, items: infoSchema },
      quizItems: { type: 'array', minItems: 5, maxItems: 5, items: quizSchema }
    }
  };

  function clip(value, max) {
    return String(value || '').replace(/\u0000/g, '').trim().slice(0, max);
  }
  function wordsOf(text) {
    return String(text || '').toLowerCase().match(/[a-z0-9]+/g) || [];
  }
  function validDay(value) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || '').trim());
    if (!m) return '';
    const y = +m[1], mo = +m[2], d = +m[3];
    if (y < 2000 || y > 2100) return '';
    const date = new Date(y, mo - 1, d);
    if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return '';
    return m[0];
  }
  function plain(text) {
    return String(text || '').replace(/\s*[—–]\s*/g, ', ').replace(/[ \t]{2,}/g, ' ').trim();
  }
  function listOf(value, max, len) {
    if (!Array.isArray(value)) return [];
    const out = [];
    for (const item of value) {
      if (typeof item !== 'string') continue;
      const text = plain(item).slice(0, len);
      if (!text || CHECK.test(text)) continue;
      out.push(text);
      if (out.length >= max) break;
    }
    return out;
  }

  function schemaStrict(schema, path) {
    const problems = [];
    (function walk(node, at) {
      if (!node || typeof node !== 'object') return;
      if (node.type === 'object' || (Array.isArray(node.type) && node.type.includes('object'))) {
        if (node.additionalProperties !== false) problems.push(at + ' additionalProperties');
        const keys = node.properties ? Object.keys(node.properties) : [];
        const required = Array.isArray(node.required) ? node.required : [];
        if (keys.length && required.slice().sort().join('|') !== keys.slice().sort().join('|')) problems.push(at + ' required');
        keys.forEach((key) => walk(node.properties[key], at + '.' + key));
      }
      if (node.items) walk(node.items, at + '[]');
    })(schema, path || 'schema');
    return problems;
  }

  function typeOk(value, type) {
    const types = Array.isArray(type) ? type : [type];
    return types.some((kind) => {
      if (kind === 'null') return value === null;
      if (kind === 'string') return typeof value === 'string';
      if (kind === 'boolean') return typeof value === 'boolean';
      if (kind === 'integer') return Number.isInteger(value);
      if (kind === 'array') return Array.isArray(value);
      if (kind === 'object') return !!value && typeof value === 'object' && !Array.isArray(value);
      return false;
    });
  }

  function checkSchema(value, schema, path, errors) {
    if (!typeOk(value, schema.type)) {
      errors.push(path + ' type');
      return null;
    }
    if (value === null) return null;
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(path + ' enum');
      return null;
    }
    if (Object.prototype.hasOwnProperty.call(schema, 'const') && value !== schema.const) {
      errors.push(path + ' const');
      return null;
    }
    if (typeof value === 'string') {
      const text = plain(value);
      if (schema.minLength && text.length < schema.minLength) errors.push(path + ' short');
      if (schema.maxLength && text.length > schema.maxLength) errors.push(path + ' long');
      return text;
    }
    if (Number.isInteger(value)) {
      if (schema.minimum !== undefined && value < schema.minimum) errors.push(path + ' min');
      if (schema.maximum !== undefined && value > schema.maximum) errors.push(path + ' max');
      return value;
    }
    if (typeof value === 'boolean') return value;
    if (Array.isArray(value)) {
      if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(path + ' few');
      if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(path + ' many');
      return value.map((item, i) => checkSchema(item, schema.items, path + '[' + i + ']', errors));
    }
    const props = schema.properties || {};
    Object.keys(value).forEach((key) => {
      if (!props[key]) errors.push(path + ' extra ' + key);
    });
    (schema.required || []).forEach((key) => {
      if (!Object.prototype.hasOwnProperty.call(value, key)) errors.push(path + ' missing ' + key);
    });
    const out = {};
    Object.keys(props).forEach((key) => {
      if (Object.prototype.hasOwnProperty.call(value, key)) out[key] = checkSchema(value[key], props[key], path + '.' + key, errors);
    });
    return out;
  }

  function walkStrings(value, visit) {
    if (typeof value === 'string') visit(value);
    else if (Array.isArray(value)) value.forEach((item) => walkStrings(item, visit));
    else if (value && typeof value === 'object') Object.keys(value).forEach((key) => walkStrings(value[key], visit));
  }
  function personalTokens(about, ad) {
    const seen = new Set(wordsOf(ad));
    const out = [];
    wordsOf(about).forEach((word) => {
      if (word.length < 5 || STOP.has(word) || seen.has(word) || out.includes(word)) return;
      out.push(word);
    });
    return out;
  }
  function hasToken(text, token) {
    return new RegExp('(?<![a-z0-9])' + token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(?![a-z0-9])', 'i').test(text);
  }
  function inventedNames(value, source) {
    const known = new Set(wordsOf(source));
    const found = [];
    walkStrings(value, (text) => {
      const phrases = text.match(/\b[A-Z][A-Za-z0-9'’-]*(?:\s+[A-Z][A-Za-z0-9'’-]*)+\b/g) || [];
      phrases.forEach((phrase) => {
        const unknown = wordsOf(phrase).filter((word) => word.length > 2 && !NAME_STOP.has(word) && !known.has(word) && !ACRONYMS.has(word));
        if (unknown.length >= 2) found.push(phrase);
      });
      const caps = text.match(/\b[A-Z]{3,}\b/g) || [];
      caps.forEach((token) => {
        if (!ACRONYMS.has(token.toLowerCase()) && !known.has(token.toLowerCase())) found.push(token);
      });
      const camel = text.match(/\b[A-Z][a-z]+[A-Z][A-Za-z0-9]+\b/g) || [];
      camel.forEach((token) => {
        if (!source.includes(token)) found.push(token);
      });
    });
    return found;
  }

  function validateCourse(value, context) {
    const errors = [];
    const cleaned = checkSchema(value, courseSchema, 'course', errors);
    if (errors.length) return { ok: false, reason: 'schema', errors: errors.slice(0, 12) };
    if (cleaned.questions.length !== cleaned.questionInfo.length) {
      return { ok: false, reason: 'schema', errors: ['questions length'] };
    }
    let checkHit = '';
    walkStrings(cleaned, (text) => { if (!checkHit && CHECK.test(text)) checkHit = text.slice(0, 80); });
    if (checkHit) return { ok: false, reason: 'checks', errors: [checkHit] };
    let genericHit = '';
    walkStrings(cleaned, (text) => { if (!genericHit && GENERIC.test(text)) genericHit = text.slice(0, 80); });
    if (genericHit) return { ok: false, reason: 'generic', errors: [genericHit] };
    const ctx = context && typeof context === 'object' ? context : {};
    const source = [ctx.ad, ctx.about, ctx.company, ctx.role].filter(Boolean).join('\n');
    const invented = inventedNames(cleaned, source);
    if (invented.length) return { ok: false, reason: 'invented', errors: invented.slice(0, 6) };
    const tokens = personalTokens(ctx.about || '', ctx.ad || '');
    if (tokens.length >= 3) {
      const lessonHits = cleaned.course.filter((lesson) => tokens.some((token) => hasToken(lesson.body + ' ' + lesson.exercise, token))).length;
      const storyHits = cleaned.questionInfo.filter((info) => tokens.some((token) => hasToken(info.useStory, token))).length;
      if (lessonHits < 4 || storyHits < 4) {
        return { ok: false, reason: 'thin', errors: ['lessons ' + lessonHits, 'stories ' + storyHits] };
      }
    }
    cleaned.course.forEach((lesson) => { lesson.done = false; });
    return { ok: true, value: cleaned };
  }

  function sourceKey(value) {
    const raw = String(value || '').trim().toLowerCase();
    if (raw === 'resume' || raw === 'résumé') return 'resume';
    if (raw === 'linkedin') return 'linkedin';
    if (raw === 'answers') return 'answers';
    return '';
  }
  function normalizeAbout(about) {
    if (!about || typeof about !== 'object') return null;
    const text = clip(about.text, 40000);
    if (text.length < 40) return null;
    const source = sourceKey(about.source) || sourceKey(about.label) || 'answers';
    return { source, label: SOURCES[source], text };
  }

  function courseMaterials(input) {
    input = input || {};
    const about = normalizeAbout(typeof input.about === 'string' ? { text: input.about, source: input.aboutSource } : input.aboutYou || input.about);
    const hints = input.hints && typeof input.hints === 'object' ? input.hints : {};
    return {
      company: /^company$/i.test(clip(input.company, 120)) ? '' : clip(input.company, 120),
      role: clip(input.role, 120),
      stage: clip(input.stage || (input.intake && input.intake.stage), 40) || 'Not sure yet',
      interviewAt: validDay(input.interviewAt),
      ad: clip(input.ad || input.job, 60000),
      about: about ? about.text : '',
      aboutSource: about ? about.label : '',
      hints: {
        themes: listOf(hints.themes, 4, 80),
        musts: listOf(hints.musts, 8, 300)
      }
    };
  }

  function courseHints(analysis) {
    const a = analysis && typeof analysis === 'object' ? analysis : {};
    return {
      themes: listOf((Array.isArray(a.themes) ? a.themes : []).map((theme) => theme && theme.label), 4, 80),
      musts: listOf((Array.isArray(a.requirements) ? a.requirements : []).filter((item) => item && item.kind === 'must').map((item) => item.text), 8, 300)
    };
  }

  const INSTRUCTIONS = [
    'You write a short interview prep course for one person and one job.',
    '',
    'Rules:',
    '- Use only facts from ABOUT YOU and the JOB AD. Never invent jobs, employers, dates, tools, numbers, or results.',
    '- If a must-have is missing from their background, say so and coach an honest gap answer. Name the closest real experience they did give.',
    '- Write in the second person. Short sentences. Plain words. Do not use an em dash.',
    '- Every lesson names a real experience from ABOUT YOU and ties it to a line in this ad. Every useStory does the same.',
    '- Do not turn a check or a clearance into a lesson, a question, or a quiz item. Leave out criminal record checks, vulnerable sector checks, police checks, background checks, security clearances, reference checks, drug tests, work permits, and right-to-work lines completely.',
    '- Do not write a generic exercise. Never write "write down one true example from your life" or "say in one sentence what this job is for".',
    '- Each lesson body is two short paragraphs. When you use a line from the ad, quote it in straight double quotes.',
    '- useStory says which of their real experiences to tell, or how to give an honest gap answer. It must name something that is actually in ABOUT YOU.',
    '- The quiz checks that they can match their own stories to this ad. A wrong option must be clearly wrong, not another true fact about them.',
    '- theme is a short word or null. source is the ad line you used, or null. done is false.',
    '- Return JSON only, matching the schema. No markdown and no extra keys.',
    '',
    'A weak exercise, which you must not write: "Write down one true example from your life."',
    'A strong exercise, for a different person, which you must not copy: "Say your River Market Saturday recount out loud, then point to the ad line about handling cash. Four sentences."',
    'Do not use River Market, or any name that is not in ABOUT YOU or the JOB AD.'
  ].join('\n');

  function buildCoursePrompt(input) {
    const m = courseMaterials(input);
    const lines = [
      INSTRUCTIONS,
      '',
      'JOB',
      'Company: ' + (m.company || 'Unknown'),
      'Role: ' + (m.role || 'Unknown'),
      'Interview stage: ' + m.stage,
      'Interview date: ' + (m.interviewAt || 'not set'),
      'About you came from: ' + (m.aboutSource || 'not shared'),
      '',
      'THEMES ALREADY READ FROM THE AD',
      m.hints.themes.length ? m.hints.themes.map((item) => '- ' + item).join('\n') : '- none',
      '',
      'MUST-HAVES ALREADY READ FROM THE AD',
      m.hints.musts.length ? m.hints.musts.map((item) => '- ' + item).join('\n') : '- none',
      '',
      'ABOUT YOU',
      m.about || '(nothing shared)',
      '',
      'JOB AD',
      m.ad || '(missing)'
    ];
    return lines.join('\n');
  }

  function finishCourse(input, generated) {
    const engine = root.PrepEngine;
    if (!engine || typeof engine.create !== 'function') throw Error('PrepEngine is missing');
    const prep = engine.create(input || {});
    const about = normalizeAbout(input && (input.aboutYou || (input.about ? { text: input.about, source: input.aboutSource } : null)));
    if (about) prep.aboutYou = about;
    const day = validDay(input && input.interviewAt);
    if (day) prep.interviewAt = day;
    if (generated === undefined || generated === null) return prep;
    const checked = validateCourse(generated, {
      ad: prep.job,
      about: about ? about.text : '',
      company: /^company$/i.test(clip(prep.company, 120)) ? '' : prep.company,
      role: prep.role
    });
    if (!checked.ok) {
      prep.generatedBy = 'template';
      prep.generateNote = 'The personal course did not pass the checks, so these are the general lessons.';
      return prep;
    }
    const course = checked.value;
    prep.requirements = course.requirements;
    prep.course = course.course;
    prep.questions = course.questions;
    prep.questionInfo = course.questionInfo;
    prep.quizItems = course.quizItems;
    prep.generatedBy = 'subscription';
    return prep;
  }

  /* Replacing a preparation with a freshly written course keeps the person's work. Lessons, questions
     and requirements are matched by their text, since the new course numbers them differently:
     `done` flags and notes move to the matching item, quiz answers move to the same question with the
     same options, and the mock interview stays when its questions are still asked in the same order.
     Saved live interviews, the day log and the plan settings carry over as they are. A note whose item
     the new course no longer has is kept in `earlierNotes` (with what it was about), never dropped. */
  const MAX_EARLIER = 60;
  const sameText = (a, b) => clip(a, 4000).toLowerCase() === clip(b, 4000).toLowerCase();
  function carryWork(old, prep) {
    if (!old || typeof old !== 'object' || !prep || typeof prep !== 'object') return prep;
    if (old.id) prep.id = old.id;
    if (old.created) prep.created = old.created;
    if (old.interviewAt && !prep.interviewAt) prep.interviewAt = old.interviewAt;
    if (old.dailyMinutes) prep.dailyMinutes = old.dailyMinutes;
    if (old.dayLog && typeof old.dayLog === 'object') prep.dayLog = { ...old.dayLog };
    if (Array.isArray(old.liveSessions) && old.liveSessions.length) prep.liveSessions = old.liveSessions.slice();
    if (!prep.aboutYou && old.aboutYou) prep.aboutYou = old.aboutYou;
    prep.notes = prep.notes && typeof prep.notes === 'object' ? prep.notes : {};
    const notes = old.notes && typeof old.notes === 'object' ? old.notes : {};
    const earlier = Array.isArray(old.earlierNotes) ? old.earlierNotes.slice() : [];
    const lists = {
      lesson: [(old.course || []).map((c) => c && c.title), (prep.course || []).map((c) => c && c.title)],
      answer: [old.questions || [], prep.questions || []],
      map: [old.requirements || [], prep.requirements || []]
    };
    for (const [key, text] of Object.entries(notes)) {
      if (typeof text !== 'string' || !text.trim()) continue;
      const m = /^(lesson|answer|map)-(\d+)$/.exec(key);
      if (!m) { prep.notes[key] = text; continue; }
      const [was, now] = lists[m[1]];
      const about = was[+m[2]];
      const to = about === undefined ? -1 : now.findIndex((item) => sameText(item, about));
      if (to >= 0 && !prep.notes[m[1] + '-' + to]) prep.notes[m[1] + '-' + to] = text;
      else earlier.push({ kind: m[1], about: clip(about, 2000), text });
    }
    if (earlier.length) prep.earlierNotes = earlier.slice(-MAX_EARLIER);
    (old.course || []).forEach((c) => {
      if (!c || !c.done) return;
      const to = (prep.course || []).find((n) => n && sameText(n.title, c.title));
      if (to) to.done = true;
    });
    const answers = old.quiz && old.quiz.answers && typeof old.quiz.answers === 'object' ? old.quiz.answers : {};
    if (Array.isArray(old.quizItems) && Array.isArray(prep.quizItems)) {
      prep.quiz = prep.quiz && typeof prep.quiz === 'object' ? prep.quiz : { answers: {} };
      prep.quiz.answers = prep.quiz.answers || {};
      for (const [k, v] of Object.entries(answers)) {
        const item = old.quizItems[+k];
        if (!item) continue;
        const to = prep.quizItems.findIndex((n) => n && sameText(n.q, item.q) && JSON.stringify(n.options) === JSON.stringify(item.options));
        if (to >= 0) prep.quiz.answers[to] = v;
      }
    }
    const mock = old.mock;
    if (mock && Array.isArray(mock.answers) && mock.answers.length && Array.isArray(prep.questions)
      && mock.answers.every((a, k) => a && a.question === prep.questions[k])) {
      prep.mock = { ...mock, answers: mock.answers.slice(), finished: mock.index === prep.questions.length };
    }
    return prep;
  }

  /* Swap the preparation `replaceId` for `prep` only when a personal course came back; on any other
     result the old one stays exactly as it was. Returns the new list, the preparation to show, and
     whether it was swapped. */
  function replaceWith(records, replaceId, prep) {
    const list = Array.isArray(records) ? records : [];
    const at = replaceId ? list.findIndex((item) => item && item.id === replaceId) : -1;
    if (at < 0) return { records: [prep, ...list], active: prep, swapped: false, added: true };
    const old = list[at];
    if (!prep || prep.generatedBy !== 'subscription') return { records: list, active: old, swapped: false, added: false };
    const next = carryWork(old, prep);
    return { records: [next, ...list.slice(0, at), ...list.slice(at + 1)], active: next, swapped: true, added: false };
  }

  const api = {
    CHECK,
    courseSchema,
    schemaStrict,
    validateCourse,
    normalizeAbout,
    courseMaterials,
    courseHints,
    buildCoursePrompt,
    finishCourse,
    carryWork,
    replaceWith,
    instructions: INSTRUCTIONS
  };
  root.NextStepCourse = api;
  if (typeof module !== 'undefined') module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
