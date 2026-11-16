/* Local answer coach for the mock interview: structure feedback on a typed practice answer.
   Pure and deterministic: no DOM, no network, no storage, no clock, no randomness.
   The answer, the question and the job ad are untrusted data, never instructions; callers escape every string with esc().
   It is a structure checklist (Situation, Task, Action, Result), never a hiring score or a verdict on the person.

   Coach.live(text) -> { words, seconds, star: { situation, task, action, result } }   cheap enough for every keystroke
   Coach.review(text, { question, info, analysis }) -> { words, seconds, star, starScore: 0..4,
     checks: [{ id: 'structure'|'ownership'|'evidence'|'relevance'|'length'|'clarity', ok, title, detail }],
     echoed: [string], missing: [string] (<= 3), summary: string } */
(function (root) {
  'use strict';

  const WPM = 140;
  const MAX_CHARS = 100000;
  const LONG_SENTENCE = 40;
  const KINDS = new Set(['motivation', 'behavioural', 'role', 'situational', 'gap', 'closing']);
  const PARTS = ['situation', 'task', 'action', 'result'];
  const bag = (s) => new Set(s.trim().split(/\s+/));

  /* ---------- lexicons (lower case, straight apostrophes) ---------- */

  // Action verbs across jobs (base forms). Past forms are derived; irregular ones are listed below.
  const BASE = bag(`help assist support greet welcome serve explain show teach train coach mentor guide calm reassure comfort
    encourage listen apologise apologize answer ask call phone text email contact message tell inform notify report escalate
    update share present suggest recommend offer propose agree negotiate persuade convince remind invite introduce thank
    check double-check recheck inspect test verify confirm measure count recount weigh scan review read reread research
    look watch monitor observe track record log document note chart write rewrite draft edit proofread type enter file label
    tag price sign fix repair replace install wire rewire connect disconnect isolate ground mount hang fasten screw bolt drill
    cut strip splice crimp terminate run pull bend thread trace troubleshoot diagnose service maintain clean wipe sweep mop
    scrub vacuum dust polish sanitise sanitize disinfect wash rinse tidy empty lift move carry push transfer reposition turn
    position load unload stack restock stock shelve sort organise organize arrange rearrange set store pack unpack wrap bag
    fold deliver drive collect fetch bring take give hand return retrieve receive ship send post order reorder book schedule
    reschedule plan prioritise prioritize split divide delegate assign coordinate manage lead own host chair facilitate cook
    prep prepare chop slice bake grill fry plate garnish brew pour steam grind make mix blend seat clear bus feed bathe dress
    groom shave toilet change build create design develop code program script refactor debug deploy release launch merge
    migrate automate configure integrate optimise optimize prototype sketch map model analyse analyze calculate estimate
    compare summarise summarize compile gather survey interview learn study practise practice rehearse memorise memorize
    revise shadow start begin finish complete close open cover step volunteer stay keep wait stop pause switch adjust adapt
    improve reduce increase save solve resolve handle process refund exchange void balance reconcile audit tally cash ring
    decide choose pick apply try use put do find spot notice identify figure work spend raise flag request approve
    stick deal seek lend light ride overcome undertake oversee rebuild redo leave let say draw hold meet pay stand win throw
    fight buy catch sell speak`);
  const IRREG = new Map(`made:make took:take gave:give ran:run led:lead built:build wrote:write rewrote:rewrite spoke:speak
    told:tell sold:sell kept:keep went:go got:get found:find brought:bring taught:teach began:begin chose:choose drove:drive
    caught:catch held:hold met:meet paid:pay sent:send spent:spend stood:stand won:win fed:feed hung:hang swept:sweep did:do
    rang:ring threw:throw fought:fight bought:buy said:say drew:draw undertook:undertake oversaw:oversee rebuilt:rebuild
    redid:redo left:leave stuck:stick dealt:deal sought:seek lent:lend lit:light rode:ride overcame:overcome`
    .trim().split(/\s+/).map((p) => p.split(':')));
  // Words that look like verbs after "I" but are feelings, wishes or states, not things you did.
  const NOT_ACTION = bag(`wanted needed liked loved hated enjoyed hoped wished worried panicked preferred assumed supposed
    guessed imagined expected seemed appeared believed felt knew thought saw heard understood realised realized remembered
    forgot tired bored scared excited interested stressed overwhelmed confused surprised shocked embarrassed frustrated
    annoyed pleased relieved satisfied amazed concerned involved based located named nervous happy sad glad sure able unable
    want need like love hate enjoy hope wish worry think know feel see hear understand realise realize remember forget mean
    meant guess suppose believe seem appear prefer assume expect afraid sorry`);
  const PASSIVE = bag('was were been being is are am be become became');
  const SKIP = bag(`then also first quickly immediately calmly carefully personally always usually often sometimes eventually
    finally later soon just actually really gently politely safely slowly properly myself ourselves together both all still
    even again instead right straight would will could can should might must had have has was were am is are able to been
    being going gonna kinda sorta um uh erm basically literally honestly`);
  const MODAL = bag('would will could can should might must going gonna');
  const I_FORMS = bag("i i'm i've i'd i'll im ive");
  const WE_FORMS = bag("we we're we've we'd we'll");
  const HYP_FORMS = bag("i'd i'll we'd we'll");
  const OTHER = bag(`he she they it you he's she's they're it's you're he'd she'd they'd you'd he'll she'll they'll it'll
    you'll they've you've someone somebody everyone everybody nobody people there this`);
  // These can also be objects ("I fixed it", "I helped people"): only a subject at the start of a clause.
  const AMBIG = bag('it you this there someone somebody everyone everybody nobody people');
  // "I work at a cafe" sets the scene; it is not something you did.
  const SCENE_NEXT = bag('at as in for there here part-time full-time weekends evenings nights');
  const SUBORD = bag(`what that who whom which where how if whether because since when whenever while after before until
    till as though although once unless why cause`);
  const CONJ = bag('and but so then or plus');
  const LEAD_IN = bag('then first next also and so after finally afterwards later');
  const PARTICLE = bag('up out down off over in back through around');
  const SAME_PAST = bag('let put set cut read hit quit shut spread split cost hurt');
  // "I knew I had to do something": do/did with no real object is not a step you took.
  const VAGUE = bag('something anything nothing everything whatever what');

  // Situation, Task and Result markers: token phrases, '|' separates alternatives in a slot, '#num'/'#year' match numbers.
  const SITUATION = compile([
    'at my last|previous|old|first|current|former|summer|weekend|part-time job|role|workplace|employer|position|placement|store|shop|restaurant|cafe|café|company',
    'at my job|work|workplace|store|shop|placement|school', 'in my last|previous|old|first|current|former job|role|position|placement|workplace',
    'my last|previous|first|old|former|current job|role|manager|boss|supervisor|employer|workplace|placement',
    'when i was|worked|started|joined|volunteered|had|did|first|began', 'while i was|worked|volunteered|studied',
    'while working|volunteering|studying', 'back when|then', 'at the|that time', 'ago', 'recently', 'previously',
    'during my|a|an|the|one|our|that|last',
    'one day|time|shift|night|morning|evening|afternoon|weekend|week|summer|winter|saturday|sunday|monday|tuesday|wednesday|thursday|friday|christmas|holiday',
    'last year|summer|winter|spring|fall|autumn|month|week|christmas|holiday|season|term|semester|shift|weekend|night',
    'this past year|summer|winter|spring|fall|month|week|weekend', 'earlier this year|month|week', 'in|since|during #year',
    'at|in|inside|outside the|a|an|our|my store|shop|cafe|café|coffee|restaurant|bar|pub|hotel|warehouse|site|jobsite|clinic|hospital|home|school|college|university|office|bank|pharmacy|kitchen|till|counter|register|checkout|gym|daycare|library|event|market|mall|plant|factory|garage|salon|farm|centre|center|ward|unit|lab|stockroom|field',
    'on a|the|my|our site|jobsite|job|unit|ward|floor|shift|team|project|route|crew|call|renovation|placement|rotation|practicum',
    'on site|shift|call', 'at school|college|university|uni|work|church|camp', 'in class|school|college|university|training|placement',
    'i work|worked|volunteer|volunteered|interned|babysat|tutored|studied',
    'i was working|volunteering|studying|hired|placed|a|an|the|on|in|at|one|part|still|new', 'i used to',
    "i've worked|been|spent|volunteered|done|had", 'i have worked|been|spent|volunteered|done|had', "i'm a|an|currently|still|studying",
    'as a|an cashier|server|barista|cook|chef|dishwasher|volunteer|intern|apprentice|student|aide|assistant|associate|helper|labourer|laborer|driver|tutor|coach|nanny|babysitter|lifeguard|counsellor|counselor|cleaner|host|hostess|bartender|receptionist|clerk|manager|supervisor|lead|developer|nurse|caregiver|carer|technician|electrician|mechanic|teacher|waiter|waitress|janitor|custodian|stocker|picker|packer|mover|guard|agent|rep|representative',
    'internship|bootcamp|practicum|co-op|apprenticeship|placement',
    'a|one|an|the customer|customers|resident|residents|client|clients|patient|patients|guest|guests|homeowner|parent|student|visitor|caller|user|users|tenant|coworker|co-worker|colleague|teammate|family|kid|child|shopper|diner|regular',
    'our|my team|crew|class|group|project|store|shop|unit|ward|site|kitchen|cafe|café|restaurant|office|company|manager|supervisor|boss|shift|department|clinic|customers|clients|residents|patients|regulars|foreman|journeyperson|journeyman|teacher|instructor|professor|coach'
  ]);
  const TASK = compile([
    'needed|need|had|have|has to', 'was|were supposed|asked|expected|told|tasked|assigned|required|hired|trusted to',
    'asked|told|wanted|needed|trusted|got me to', 'make|making sure', 'my|the|our job|role|duty|plan|aim|goal|task was|is',
    'in charge', 'up to me', 'in order to', 'so i|we could|would', 'wanted|tried|trying|aimed|aiming|hoping|planned|planning to',
    'responsible|responsibility|goal|goals|aim|task|challenge|challenges|challenging|problem|problems|issue|issues|target|targets|deadline|deadlines|objective|priority|quota|complaint|complaints|complained|complaining|emergency|urgent|backlog|shortage|short-staffed|understaffed|mistake|mistakes|error|errors|bug|bugs|outage|leak|fault|faulty|hazard|unsafe|conflict|disagreement',
    'upset|angry|frustrated|unhappy|confused|struggling|stuck|overwhelmed|broken|missing|wrong|delayed|difficult|tricky|stressful|injured|hurt|fell|sick',
    'failing|failed|cancel|cancelling|canceling|crashed|crashing|risk|losing|overdue|refused|refusing',
    'did|does nothing', "didn't|wasn't|isn't|doesn't|won't|wouldn't work|working|load|start|open|turn", 'did|does|was|is|would not work|working|load|start|open',
    'not working', 'stopped working', 'kept crashing|failing|breaking|freezing|tripping|leaking',
    'users|customers|clients|people|someone|homeowner|homeowners|residents|guests|patients|parents reported|complained|noticed|asked',
    'yelling|shouting|screaming|rude|alarm|alarms|crisis|accident|spill|spilled|flooded|flooding|shortage',
    'falling|fell|fall|getting|got|running|ran behind', 'behind schedule', 'not enough', 'too many|few|much', 'short on',
    'ran|run|running out', 'out of stock', 'not|wasn\'t ready', 'stopped replying|responding|answering|showing',
    'was|were given|handed'
  ]);
  const RESULT = compile([
    'result|results|resulted|outcome|outcomes|consequently|ultimately|afterwards|afterward', 'as a result', 'in the end',
    'at|by the end', 'ended|end up', 'end result', 'so that', 'which|that|this meant|means|helped|led|resulted|saved|made',
    'because of this|that', 'thanks to', 'since then', 'from then on', 'ever since', 'these days', 'next time',
    'now i|we|they|she|he|it|the|our|my|i\'m|everyone',
    'increased|reduced|decreased|saved|improved|grew|raised|lowered|boosted|doubled|tripled|halved|dropped|shortened',
    'cut down', 'sped up', 'finished|completed|solved|resolved|fixed|succeeded|success|successful|successfully|achieved|won|exceeded|accomplished',
    'met|hit|reached|made|beat the|our|my|their deadline|target|targets|goal|goals|quota|numbers', 'on time',
    'ahead of schedule|time', 'under budget', 'finished|done|ready|arrived early', 'safely', 'safe',
    'without any|a|an injury|injuries|incident|incidents|issue|issues|problem|problems|complaint|complaints|accident|accidents|errors|mistakes|delays',
    'no injuries|incidents|complaints|accidents|errors|mistakes|problems|issues|delays', 'nobody got|was hurt', 'no one got|was hurt',
    'without mistakes|errors|issues|problems|complaints|incidents|injuries|accidents|delays|complaint|problem|issue|incident|injury|distress',
    'best|busiest|biggest|record day|week|month|shift|year|night|sales', 'got|made it through', 'got through',
    'thanked|thank|thanks|grateful|appreciated|smiled|smiling|happy|happier|satisfied|pleased|relieved|calmer',
    'came|come|comes|coming back', 'renewed|renewal|retained|retention|loyal', 'passed|pass inspection|audit|the|an|our|my|their',
    'praised|recognised|recognized|promoted|award|awarded|feedback|compliment|compliments|complimented|shout-out|shoutout',
    'good|great|positive|glowing|five-star|5-star review|reviews|feedback',
    'learned|learnt|lesson|lessons|realised|realized', 'taught me', 'fewer|faster|quicker|smoother|safer|shorter',
    'less time|waste|stress|money', 'more efficient|organised|organized|confident|smoothly', 'no longer', 'never again',
    'went|go|goes down|up', 'it|that|this|everything worked|helped|paid', 'calmed|settled|cooled down', 'difference', 'instead of',
    'within a|an|the|one|two|three minute|minutes|hour|hours|day|days|week|weeks|month|months|shift', 'within a few minutes|hours|days|weeks'
  ]);
  // Concrete outcomes are proof on their own, even without a number ("closed on time", "a good review").
  const OUTCOME = compile([
    'on time', 'ahead of schedule|time', 'under budget', 'never ran|run out', 'no longer',
    'without any|a|an injury|injuries|incident|incidents|issue|issues|problem|problems|complaint|complaints|accident|accidents|errors|mistakes|delays',
    'without mistakes|errors|issues|problems|complaints|incidents|injuries|accidents|delays|complaint|problem|issue|incident|injury|distress',
    'no injuries|incidents|complaints|accidents|errors|mistakes|problems|issues|delays|fracture|fractures|harm|injury',
    'nobody got|was hurt', 'no one got|was hurt', 'passed|pass inspection|audit|the|an|our|my|their', 'came|come|comes|coming back',
    'renewed|retained|promoted|praised|recognised|recognized|complimented|thanked',
    'good|great|positive|glowing|five-star|5-star review|reviews|feedback', 'best|busiest|biggest|record day|week|month|shift|year|night|sales',
    'met|hit|reached|made|beat the|our|my|their deadline|target|targets|goal|goals|quota|numbers', 'asked for me', 'kept the|my route|system|plan|idea|approach',
    'still use|uses|using', 'since then', 'from then on', 'every time|night|day|shift|week since'
  ]);

  // Filler and hedge words: strong ones count fully, soft ones count half.
  const FILLER_ONE = new Map([['um', 1], ['umm', 1], ['uh', 1], ['uhh', 1], ['erm', 1], ['basically', 1], ['literally', 1],
    ['honestly', 1], ['totally', 0.5], ['just', 0.5], ['really', 0.5], ['actually', 0.5], ['maybe', 0.5], ['probably', 0.5], ['stuff', 0.5]]);
  const FILLER_TWO = new Map([['kind of', 1], ['sort of', 1], ['you know', 1], ['i mean', 1], ['i guess', 1], ['i suppose', 1],
    ['or something', 1], ['and stuff', 1], ['pretty much', 0.5], ['i think', 0.5]]);
  const NOUN_KIND = bag('what this that the a any every some which same');
  const FILLER_RANK = ['um', 'umm', 'uh', 'uhh', 'erm', 'like', 'basically', 'literally', 'honestly', 'kind of', 'sort of', 'you know',
    'i mean', 'i guess', 'i suppose', 'or something', 'and stuff', 'totally', 'pretty much', 'just', 'really', 'actually', 'maybe',
    'probably', 'stuff', 'i think'];

  // Common English function words: if almost none appear, the answer is probably not in English.
  const EN = bag(`the a an and to of in i it was is that for on with my we they he she you at as but so had have be this me
    her him our their what when did not then there were are from by or if because about would could can will just all one up out them`);

  const STOP = bag(`a an the and or but nor so yet to of in on at for with by from as into onto over under up down out off about
    above below between through during before after since until while within without across around near via per than then there
    here this that these those it its it's is are was were be been being am do does did done doing have has had having will would
    shall should can could may might must not no yes if because though although whether which who whom whose what when where why
    how all any each every some such more most many much few less least other another own same both either neither very too also
    just only even still again ever already quite rather really i me my mine myself we us our ours ourselves you your yours
    yourself he him his she her hers they them their theirs one ones etc like able`);
  // Job-ad and coaching boilerplate: never worth suggesting as "words from the ad".
  const GENERIC = bag(`experience experienced experiences skill skills knowledge understanding strong excellent good great proven
    demonstrated solid ideal candidate candidates role roles job jobs position positions opportunity opportunities work working
    works worked environment company companies business required require requires requirement requirements preferred prefer plus
    asset assets bonus nice year years month months level levels related relevant similar equivalent ensure ensuring provide
    providing maintain maintaining perform performing duty duties responsibility responsibilities responsible using use used based
    day days daily time times part full week weeks weekly hour hours want wants looking look join joining hire hiring hired apply
    applying offer offers offering benefits benefit including include includes included new team teams member members people
    person everyone someone something thing things way ways example examples answer answers story stories specific specifically
    real clear clearly short brief briefly mention mentions explain explains describe describes show shows showing tell tells talk
    talks share shares give gives result results outcome outcomes situation situations task tasks action actions step steps moment
    moments approach interviewer interviewers listen listening hear make makes making made personally yourself case cases kind type
    types lot lots area areas ability abilities get gets got take takes took keep keeps kept find finds found need needs needed go
    goes went come comes came put set see saw know think say said ask asked try tried let help helps helped helping do does did
    done able must also other others well interest interests interested background connect connects connection tell describe
    walk through approach would could clarify priorities first days ready strength strengths weakness weaknesses yes build
    builds create creates follow follows read reads write writes turn turns fix fixes improve improves assist assists encourage
    encourages take part stay stayed told noticed happened next reason link links turned busy own owned`);
  const IRREG_PLURAL = { shelves: 'shelf', knives: 'knif', halves: 'half', leaves: 'leaf', people: 'person', children: 'child' };

  /* ---------- small helpers ---------- */

  // Phrase specs: slots are separated by single spaces and alternatives by '|', so an alternative is always one word.
  function compile(specs) {
    const map = new Map();
    for (const spec of specs) {
      const slots = spec.split(' ').map((s) => s.split('|'));
      const rest = slots.slice(1).map((a) => new Set(a));
      for (const first of slots[0]) {
        if (!map.has(first)) map.set(first, []);
        map.get(first).push(rest);
      }
    }
    return map;
  }
  const isYear = (t) => /^(?:19|20)\d\d$/.test(t);
  const isNum = (t) => t.charCodeAt(0) >= 48 && t.charCodeAt(0) <= 57;
  function slotHas(slot, t) {
    return slot.has(t) || (isNum(t) && (slot.has('#num') || (slot.has('#year') && isYear(t))));
  }
  const hasPhrase = (toks, map, skip) => findPhrase(toks, map, skip) !== '';
  // The first phrase from the map found in the tokens, as text ('' when none). skip(toks, i) can veto a match at i.
  function findPhrase(toks, map, skip) {
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      let list = map.get(t);
      if (!list && isNum(t)) list = (isYear(t) && map.get('#year')) || map.get('#num');
      if (!list) continue;
      for (const rest of list) {
        let j = 0;
        while (j < rest.length && i + 1 + j < toks.length && slotHas(rest[j], toks[i + 1 + j])) j++;
        if (j === rest.length && !(skip && skip(toks, i))) return toks.slice(i, i + 1 + j).join(' ');
      }
    }
    return '';
  }
  // "make sure they are happy" and "they would be safe" are hopes, not how it turned out.
  const STATE = bag('safe safely happy happier satisfied pleased relieved calmer');
  const HOPE = bag(`would will could should might must can gonna i'd we'd i'll we'll he'd she'd they'd you'd it'd he'll she'll
    they'll it'll you'll`);
  function hoped(toks, i, modal) {
    if (!STATE.has(toks[i])) return false;
    for (let k = i - 1; k >= 0 && k >= i - 8; k--) {
      const t = toks[k];
      if (t === '.' || t === ',' || (CONJ.has(t) && !(t === 'and' && STATE.has(toks[k - 1])))) return false;
      if ((t === 'sure' && /^mak/.test(toks[k - 1] || '')) || /^ensur/.test(t)) return true;
      if (modal && HOPE.has(t)) return true;
    }
    return false;
  }
  const hopedStrict = (toks, i) => hoped(toks, i, true);
  const hopedSure = (toks, i) => hoped(toks, i, false);
  function clean(text) {
    let s = typeof text === 'string' ? text : typeof text === 'number' && Number.isFinite(text) ? String(text) : '';
    if (s.length > MAX_CHARS) s = s.slice(0, MAX_CHARS);
    return s.replace(/[‘’ʼ`´]/g, "'").replace(/[“”„«»]/g, '"');
  }
  const str = (v, max) => (typeof v === 'string' ? clean(v).slice(0, max) : '');
  const strList = (v, max, len) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()).slice(0, max).map((x) => str(x, len)) : []);
  const quote = (s) => `“${s}”`;
  function list(items, joiner) {
    const a = items.filter(Boolean);
    if (a.length < 2) return a.join('');
    return `${a.slice(0, -1).join(', ')} ${joiner || 'and'} ${a[a.length - 1]}`;
  }
  const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
  function spoken(sec) {
    if (sec < 90) return `${Math.max(5, Math.round(sec / 5) * 5)} seconds`;
    const halves = Math.round(sec / 30);
    const whole = Math.floor(halves / 2);
    if (halves % 2) return whole === 1 ? 'a minute and a half' : `${whole} and a half minutes`;
    return `${whole} minutes`;
  }

  /* ---------- tokens ---------- */

  const TOKEN_RE = /\d+(?:[.,:]\d+)*%?|[\p{L}\p{M}\p{N}]+(?:'[\p{L}\p{M}]+)*(?:-[\p{L}\p{M}\p{N}]+)*|[.!?…\n\u3002\uFF01\uFF1F]+|[,;:\u3001\uFF0C]/gu;
  const CJK_RE = /[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu;

  // One pass: lower-case tokens (',' marks a clause break and '.' a sentence end), spoken word count, sentence lengths.
  function tokenize(s) {
    const raw = s.toLowerCase().match(TOKEN_RE) || [];
    const toks = [];
    const sentences = [];
    let words = 0;
    let en = 0;
    let inSentence = 0;
    for (const t of raw) {
      const c = t.charCodeAt(0);
      if (t === ',' || t === ';' || t === ':' || c === 0x3001 || c === 0xff0c) { toks.push(','); continue; }
      if (c === 46 || c === 33 || c === 63 || c === 8230 || c === 10 || c === 0x3002 || c === 0xff01 || c === 0xff1f) {
        if (toks.length && toks[toks.length - 1] !== '.') toks.push('.');
        if (inSentence) sentences.push(inSentence);
        inSentence = 0;
        continue;
      }
      toks.push(t);
      let n = 1;
      if (c >= 0x2e80) {
        const cjk = t.match(CJK_RE);
        if (cjk) n = Math.max(1, Math.ceil(cjk.length / 2));
      }
      words += n;
      inSentence += n;
      if (EN.has(t) || STOP.has(t) || GENERIC.has(t) || NOT_ACTION.has(t) || baseOf(t)) en++;
    }
    if (inSentence) sentences.push(inSentence);
    return { toks, words, sentences, english: words < 12 || en / words >= 0.2 };
  }

  /* ---------- who did what ---------- */

  function baseOf(t) {
    if (BASE.has(t)) return t;
    const ir = IRREG.get(t);
    if (ir) return ir;
    const n = t.length;
    if (n > 4 && t.endsWith('ied')) {
      const b = t.slice(0, -3) + 'y';
      if (BASE.has(b)) return b;
    }
    if (n > 3 && t.endsWith('ed')) {
      const a = t.slice(0, -2);
      if (BASE.has(a)) return a;
      if (BASE.has(a + 'e')) return a + 'e';
      if (a.length > 2 && a[a.length - 1] === a[a.length - 2] && BASE.has(a.slice(0, -1))) return a.slice(0, -1);
    }
    return null;
  }
  // 'base' | 'past' | null for the token in a verb slot.
  function actionForm(toks, k, inherited, lastForm) {
    const t = toks[k];
    const prev = toks[k - 1];
    const next = toks[k + 1];
    if (NOT_ACTION.has(t) || isNum(t)) return null;
    if (t === 'used' && next === 'to') return null;
    if (/^(?:work|worked|volunteer|volunteered)$/.test(t) && SCENE_NEXT.has(next)) return null;
    if ((t === 'did' || t === 'do') && (next === 'not' || next === 'never' || prev === 'to' || VAGUE.has(next))) return null;
    const b = baseOf(t);
    let form = b ? (t === b ? 'base' : 'past') : null;
    if (!form && t.length > 4 && t.endsWith('ed') && /^[a-z-]+$/.test(t) && !t.startsWith('un')) form = 'past';
    if (!form) return null;
    if (form === 'past' && PASSIVE.has(prev)) return null;
    if (inherited && form === 'base' && lastForm !== 'base' && !SAME_PAST.has(t)) return null;
    return form;
  }
  // Walks clauses keeping track of the subject, so "I greeted her, asked what she needed and found her size" counts 3 for I.
  function scanActions(toks) {
    const r = { i: 0, we: 0, iVerbs: [], weVerbs: [], hyp: 0, iCount: 0, weCount: 0, hypAll: 0, habit: 0, vague: 0, iHabit: 0, iVague: 0 };
    const mask = habitMask(toks);
    let lead = null;
    let cur = null;
    let win = 0;
    let sub = false;
    let pos = 0;
    let hyp = false;
    let had = false;
    let habit = false;
    let form = null;
    let inherited = false;
    const record = (who, word, f, k) => {
      form = f;
      const t = PARTICLE.has(toks[k + 1]) ? `${word} ${toks[k + 1]}` : word;
      // "I'd already finished" is "I had": a past form after "I'd" is something you did.
      const h = hyp && !(had && f === 'past');
      const u = habit || mask[k] === 1;
      if (h) r.hypAll++;
      if (u) r.habit++;
      if (h || u) r.vague++;
      if (who === 'i') {
        r.i++;
        if (h) r.hyp++;
        if (u) r.iHabit++;
        if (h || u) r.iVague++;
        if (!r.iVerbs.includes(t) && r.iVerbs.length < 6) r.iVerbs.push(t);
      } else {
        r.we++;
        if (!r.weVerbs.includes(t) && r.weVerbs.length < 6) r.weVerbs.push(t);
      }
    };
    for (let k = 0; k < toks.length; k++) {
      const t = toks[k];
      if (t === '.') { lead = cur = null; win = 0; sub = false; pos = 0; form = null; hyp = had = habit = false; continue; }
      if (t === ',') { cur = lead; win = cur ? 3 : 0; inherited = true; sub = false; continue; }
      if (win > 0 && (t === 'sort' || t === 'kind') && toks[k + 1] === 'of') { k++; continue; }
      if (win > 0 && (SKIP.has(t) || (t.length > 4 && t.endsWith('ly') && !BASE.has(t)))) {
        if (MODAL.has(t)) hyp = true;
        if (HABIT.has(t)) habit = true;
        if (t === 'have') had = false;
        pos++;
        continue;
      }
      if (CONJ.has(t)) { cur = lead; win = cur ? 3 : 0; inherited = true; sub = false; pos++; continue; }
      const prev = toks[k - 1];
      const clauseStart = pos === 0 || prev === ',' || CONJ.has(prev) || SUBORD.has(prev);
      // "Me and my coworker restocked ..." or "my coworker and me restocked ...": a shared subject, like "we".
      let pair = false;
      if (t === 'me') {
        if (clauseStart && toks[k + 1] === 'and') {
          let j = k + 2;
          while (j < toks.length && j < k + 6 && !isPast(toks[j]) && toks[j] !== ',' && toks[j] !== '.') j++;
          if (j < toks.length && isPast(toks[j])) { pair = true; k = j - 1; }
        } else if (prev === 'and' && isPast(toks[k + 1])) pair = true;
      }
      const who = pair ? 'we' : I_FORMS.has(t) ? 'i' : WE_FORMS.has(t) ? 'we' : OTHER.has(t) && (clauseStart || !AMBIG.has(t)) ? 'x' : null;
      if (who) {
        if (who === 'i') r.iCount++;
        else if (who === 'we' && !pair) r.weCount++;
        cur = who;
        if (!sub) lead = who;
        sub = false;
        win = 4;
        inherited = false;
        hyp = HYP_FORMS.has(t);
        had = t === "i'd" || t === "we'd";
        habit = HABIT.has(prev);
        pos++;
        continue;
      }
      if (SUBORD.has(t)) { sub = true; win = 0; pos++; continue; }
      sub = false;
      if (!lead && (pos === 0 || (pos === 1 && LEAD_IN.has(toks[k - 1])))) {
        // Note style without "I": "Restocked the shelves and counted the till." Counts as yours.
        const b = baseOf(t);
        if (b && b !== t && !NOT_ACTION.has(t)) {
          lead = cur = 'i';
          hyp = false;
          record('i', t, 'past', k);
          win = 0;
          pos++;
          continue;
        }
      }
      if (win > 0) {
        win = 0;
        if (cur === 'i' || cur === 'we') {
          const f = actionForm(toks, k, inherited, form);
          if (f) record(cur, t, f, k);
        }
      }
      pos++;
    }
    r.mask = mask;
    return r;
  }
  const isPast = (t) => { const b = t ? baseOf(t) : null; return Boolean(b) && b !== t; };
  // Clauses that say what usually happens ("we always do lockout tagout on our sites") rather than one real time.
  const HABIT = bag('always usually normally generally typically often sometimes regularly');
  const EVERY = bag('time day shift morning night week weekend');
  function habitMask(toks) {
    const mask = new Uint8Array(toks.length);
    let start = 0;
    let marked = false;
    for (let k = 0; k <= toks.length; k++) {
      const t = toks[k];
      if (k === toks.length || t === '.' || t === ',' || CONJ.has(t)) {
        if (marked) mask.fill(1, start, k);
        start = k + 1;
        marked = false;
        continue;
      }
      if (marked) continue;
      const prev = toks[k - 1];
      if (HABIT.has(t) ? prev !== 'who' && prev !== 'that' && prev !== 'which'
        : t === 'whenever' || (t === 'every' && EVERY.has(toks[k + 1])) || (t === 'all' && toks[k + 1] === 'the' && toks[k + 2] === 'time')) marked = true;
    }
    return mask;
  }

  /* ---------- the shared analysis ---------- */

  function analyse(s, full) {
    const tk = tokenize(s);
    const toks = tk.toks;
    const acts = scanActions(toks);
    const habits = acts.mask;
    let result = hasPhrase(toks, RESULT, hopedStrict);
    // For "what would you do" questions a hoped-for outcome ("so they would be happy") is the point, so keep it apart.
    const hopeResult = result || (full && hasPhrase(toks, RESULT, hopedSure));
    let late = false;
    let percent = false;
    if (!result) {
      // A number near the end usually reports what changed ("we served 300 people that night").
      let seen = 0;
      const from = Math.floor(tk.words * 0.6);
      for (const t of toks) {
        if (t === ',' || t === '.') continue;
        seen++;
        if (t.endsWith('%') || t === 'percent') percent = true;
        if (seen > from && isNum(t) && !isYear(t)) late = true;
      }
      result = late || percent;
    }
    const star = {
      situation: hasPhrase(toks, SITUATION, (x, i) => habits[i] === 1) || opensWithPlace(toks, habits),
      task: hasPhrase(toks, TASK),
      action: acts.i + acts.we > 0,
      result
    };
    const a = { words: tk.words, seconds: Math.round((tk.words / WPM) * 60), star, english: tk.english };
    if (!full) return a;
    a.hopeResult = Boolean(hopeResult || result);
    a.toks = toks;
    a.sentences = tk.sentences;
    a.acts = acts;
    a.fillers = fillers(toks);
    return a;
  }

  // "On a basement reno, ..." / "At a summer camp ...": a place or occasion in the first sentence sets the scene.
  const PLACE_PREP = bag('at on in during');
  const PLACE_DET = bag('a an my our one');
  function opensWithPlace(toks, habits) {
    for (let i = 0; i < toks.length - 1 && i < 40; i++) {
      if (toks[i] === '.') return false;
      if (PLACE_PREP.has(toks[i]) && PLACE_DET.has(toks[i + 1]) && habits[i] !== 1) return true;
    }
    return false;
  }

  function fillers(toks) {
    const counts = new Map();
    let weight = 0;
    const bump = (k, w) => { counts.set(k, (counts.get(k) || 0) + 1); weight += w; };
    for (let i = 0; i < toks.length; i++) {
      const t = toks[i];
      const prev = toks[i - 1];
      const next = toks[i + 1];
      const two = next ? `${t} ${next}` : '';
      if (FILLER_TWO.has(two)) {
        if ((t === 'kind' || t === 'sort') && NOUN_KIND.has(prev)) continue;
        bump(two, FILLER_TWO.get(two));
        i++;
        continue;
      }
      if (t === 'like') {
        // Only the spoken filler: ", like," / "was like" / "and like", never "I'd like" or "things like".
        if (prev === ',' || next === ',' || prev === 'was' || prev === 'were' || prev === 'am' || prev === 'and' || prev === 'so' || prev === 'um' || prev === 'uh') bump('like', 1);
        continue;
      }
      if (FILLER_ONE.has(t)) bump(t, FILLER_ONE.get(t));
    }
    const rank = (k) => { const i = FILLER_RANK.indexOf(k); return i < 0 ? 99 : i; };
    const top = [...counts.entries()].sort((x, y) => y[1] - x[1] || rank(x[0]) - rank(y[0]) || (x[0] < y[0] ? -1 : 1))
      .map(([k, n]) => [k.replace(/\bi\b/g, 'I'), n]);
    return { weight, total: [...counts.values()].reduce((x, y) => x + y, 0), top };
  }

  /* ---------- question kind ---------- */

  function kindOf(question, info) {
    const k = info && typeof info.kind === 'string' ? info.kind : '';
    if (KINDS.has(k)) return k;
    const q = question.toLowerCase();
    if (/\b(?:questions? (?:do you have )?for (?:me|us)|any questions|anything (?:else )?(?:you(?:'d| would) like|to ask)|what would you ask)\b/.test(q)) return 'closing';
    if (/\b(?:why (?:do|are|would) you|what (?:interests|attracts|excites|draws) you|why this|why us|why here|interests? you)\b/.test(q)) return 'motivation';
    if (/\b(?:tell me about|describe a time|give (?:me )?an example|share an example|a time (?:when|you)|have you ever|example)\b/.test(q)) return 'behavioural';
    if (/\b(?:what would you do|how would you|how you would|imagine|suppose|if you were|what would you)\b/.test(q)) return 'situational';
    return '';
  }

  /* ---------- relevance to the ad ---------- */

  const WORD_RE = /[\p{L}\p{N}]+(?:['.-][\p{L}\p{N}]+)*[+#]*/gu;
  function stem(w) {
    w = w.toLowerCase().replace(/'s$/, '');
    if (w.length <= 3) return w;
    if (IRREG_PLURAL[w]) return IRREG_PLURAL[w];
    if (w.length > 4 && /ie[sd]$/.test(w)) w = w.slice(0, -3) + 'y';
    else if (/sses$/.test(w)) w = w.slice(0, -2);
    else if (w.length > 5 && /ings?$/.test(w)) w = w.replace(/ings?$/, '');
    else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
    else if (w.length > 7 && /ments?$/.test(w)) w = w.replace(/ments?$/, '');
    else if (w.length > 6 && /ions?$/.test(w)) w = w.replace(/(?:at)?ions?$/, '');
    else if (w.length > 5 && /ers?$/.test(w)) w = w.replace(/ers?$/, '');
    else if (w.length > 5 && /[^i]ly$/.test(w)) w = w.slice(0, -2);
    else if (w.endsWith('s') && !/(?:ss|us|is)$/.test(w)) w = w.slice(0, -1);
    if (w.length > 4 && /(.)\1$/.test(w) && !/(?:ll|ss|ff|zz)$/.test(w)) w = w.slice(0, -1);
    if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
    return w;
  }
  const contentParts = (term) => (term.toLowerCase().match(WORD_RE) || []).filter((w) => !STOP.has(w));
  function answerIndex(toks) {
    const words = toks.filter((t) => t !== ',' && t !== '.');
    const stems = new Set(words.map(stem));
    return { flat: ` ${words.join(' ')} `, tokSet: new Set(words), stems, stemList: [...stems] };
  }
  function stemIn(st, idx) {
    if (idx.stems.has(st)) return true;
    for (const s of idx.stemList) {
      const [a, b] = s.length < st.length ? [s, st] : [st, s];
      if (a.length >= 5 && b.length - a.length <= 3 && b.startsWith(a)) return true;
    }
    return false;
  }
  function termHits(term, idx) {
    // Split the term exactly like the answer, so "C++", "Node.js" and "lockout/tagout" line up with what was typed.
    const words = tokenize(clean(term)).toks.filter((t) => t !== ',' && t !== '.');
    if (words.length && idx.flat.includes(` ${words.join(' ')} `)) return { all: true, part: 1 };
    const parts = words.filter((w) => !STOP.has(w));
    if (!parts.length) return { all: false, part: 0 };
    let hit = 0;
    for (const w of parts) if (w.length <= 2 ? idx.tokSet.has(w) : stemIn(stem(w), idx)) hit++;
    const all = parts.length <= 2 ? hit === parts.length : hit >= Math.ceil((parts.length * 2) / 3);
    return { all, part: hit / parts.length };
  }
  function tidyLabel(v) {
    const s = String(v || '').replace(/\s+/g, ' ').replace(/^[\s"'“”‘’(\[-]+|[\s"'“”‘’)\].,;:!?-]+$/g, '').slice(0, 40).trim();
    if (!s || s.split(' ').length > 5) return '';
    return s;
  }
  const IN_IDIOM = bag('charge order touch line place mind addition advance general particular');
  // Content words from a line of the ad, in the ad's own spelling ("Restock" at a sentence start becomes "restock").
  function contentWords(text, limit) {
    const out = [];
    const seen = new Set();
    let prev = '';
    for (const raw of String(text || '').match(WORD_RE) || []) {
      const w = raw.replace(/'s$/i, '');
      const lw = w.toLowerCase();
      const after = prev;
      prev = lw;
      // "in charge", "in order to": the word means nothing on its own.
      if (after === 'in' && IN_IDIOM.has(lw)) continue;
      if (lw.length < 3 || STOP.has(lw) || GENERIC.has(lw) || isNum(lw) || !/\p{L}/u.test(lw)) continue;
      const st = stem(lw);
      if (seen.has(st) || GENERIC.has(st)) continue;
      seen.add(st);
      out.push(/^\p{Lu}[\p{Ll}]+$/u.test(w) ? lw : w);
      if (out.length >= limit) break;
    }
    return out;
  }
  // Candidate words from the ad, most relevant to this question first. Every term comes from the ad itself:
  // the excerpt the question is about, the analysis skills and keywords, or a "strong answer" word the ad also uses.
  function pool(question, info, analysis) {
    const items = [];
    const byKey = new Map();
    const source = info ? str(info.source, 600) : '';
    const include = info ? strList(info.include, 4, 300) : [];
    const quoted = (question.match(/"([^"]{8,300})"/) || [])[1] || '';
    const focusText = `${source} ${source ? '' : quoted}`.trim();
    const skills = analysis ? strList(analysis.skills, 12, 60) : [];
    const keywords = analysis ? strList(analysis.keywords, 12, 60) : [];
    const reqs = analysis && Array.isArray(analysis.requirements)
      ? analysis.requirements.slice(0, 12).map((r) => (r && typeof r.text === 'string' ? r.text.slice(0, 300) : '')) : [];
    const focus = answerIndex(tokenize(clean(`${focusText} ${include.join(' ')}`)).toks);
    const vocab = answerIndex(tokenize(clean([focusText, ...skills, ...keywords, ...reqs].join(' '))).toks);
    const add = (label, score, skill) => {
      const l = tidyLabel(label);
      const key = contentParts(l).map(stem).join(' ');
      if (!l || !key) return;
      const prev = byKey.get(key);
      if (prev) { prev.score = Math.max(prev.score, score) + 0.2; prev.skill = prev.skill || skill; return; }
      const item = { label: l, key, score, skill, order: items.length };
      byKey.set(key, item);
      items.push(item);
    };
    const near = (term) => focus.stemList.length > 0 && termHits(term, focus).all;
    skills.forEach((s, i) => add(s, 1.6 - i * 0.05 + (near(s) ? 3 : 0), true));
    keywords.forEach((s, i) => add(s, 1.2 - i * 0.05 + (near(s) ? 3 : 0), false));
    contentWords(focusText, 8).forEach((w) => add(w, 2.5, false));
    contentWords(include.join(' '), 8).filter((w) => stemIn(stem(w), vocab)).forEach((w) => add(w, 2, false));
    items.sort((a, b) => b.score - a.score || a.order - b.order);
    return items.slice(0, 24);
  }
  function relevance(toks, question, info, analysis, kind) {
    const items = pool(question, info, analysis);
    const idx = answerIndex(toks);
    const hit = [];
    const rest = [];
    const missing = [];
    const related = items.some((it) => it.score >= 2);
    for (const it of items) {
      const h = termHits(it.label, idx);
      if (h.all) hit.push(it);
      else if (h.part < 0.5) rest.push(it);
    }
    // Suggest only words tied to this question when there are some, never ones the answer half-uses already or
    // that overlap a phrase it echoes ("product" next to "product usage data"). For a "what would you do" or
    // "why this job" question with nothing tied to it, the ad's top skills are beside the point: suggest nothing.
    const open = !related && (kind === 'situational' || kind === 'motivation');
    for (const it of rest) {
      if (open || missing.length >= 3 || (related && it.score < 2)) continue;
      if (missing.some((m) => overlaps(m.key, it.key)) || hit.some((m) => overlaps(m.key, it.key))) continue;
      missing.push(it);
    }
    // Drop an echoed word when a longer echoed phrase already contains it ("POS" inside "POS system").
    const shown = hit.filter((it) => !hit.some((o) => o !== it && o.key.length > it.key.length && ` ${o.key} `.includes(` ${it.key} `)));
    return {
      size: items.length,
      echoed: shown.slice(0, 8).map((it) => it.label),
      skills: shown.filter((it) => it.skill).map((it) => it.label),
      missing: missing.map((it) => it.label)
    };
  }
  // "responsive" and "responsive interfaces" are the same suggestion: keep the first, more relevant one.
  const overlaps = (a, b) => ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `);

  /* ---------- evidence ---------- */

  // A number and the words that say what it counts: "30 small business accounts", "$200", "20%", "6 carts".
  const NUM_RE = /(?:[$£€]\s?)?\d+(?:[.,:]\d+)*(?:\s?(?:%|percent|per cent|k\b))?/gu;
  const NUM_WORD_RE = /\b(?:two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|fifteen|twenty|thirty|forty|fifty|sixty|hundred|hundreds|thousand|thousands|dozen|dozens|twice|half|double|triple)\b/gi;
  const SPAN_RE = /\b(?:within|after|in|under|over)\s+(?:a|an|one|two|three|four|five|six|a few|a couple of|the)\s+(?:minutes?|hours?|days?|weeks?|months?)\b/i;
  const NEXT_WORD_RE = /\s+([\p{L}][\p{L}'-]*)/uy;
  const TENURE = /^(?:years?|months?|weeks?|days?)$/;
  const NUM_END = bag('and or but so then from into with without instead ago ahead early late earlier later faster sooner longer shorter quicker');
  function numberPhrase(s, m) {
    let end = m.index + m[0].length;
    const ws = [];
    const clock = /^\s?(?:am|pm|a\.m\.|p\.m\.)(?![\p{L}])/iu.exec(s.slice(end, end + 6));
    if (clock) return (m[0] + clock[0]).replace(/\s+/g, ' ').trim();
    // Keep hyphenated units whole: "5-star review", "10-minute wait".
    const unit = /^-[\p{L}][\p{L}'-]{0,18}/u.exec(s.slice(end, end + 20));
    const head = unit ? m[0] + unit[0] : m[0];
    if (unit) end += unit[0].length;
    while (ws.length < 3) {
      NEXT_WORD_RE.lastIndex = end;
      const w = NEXT_WORD_RE.exec(s);
      const lw = w ? w[1].toLowerCase() : '';
      if (!w || STOP.has(lw) || NUM_END.has(lw) || (lw.length > 4 && /(?:ed|ing)$/.test(lw) && !/(?:thing|ceiling|building|meeting|booking|listing|setting|clothing|bedding|siding|wiring|piping|flooring|tiling|roofing|training)$/.test(lw))) break;
      ws.push(w[1]);
      end = NEXT_WORD_RE.lastIndex;
    }
    const before = s.slice(Math.max(0, m.index - 12), m.index).toLowerCase();
    const after = s.slice(end, end + 12).toLowerCase();
    const w0 = !unit && ws.length === 1 ? ws[0].toLowerCase() : '';
    // "for 2 years" or "2 years ago" says how long you were there, not that it worked.
    if (TENURE.test(w0) && (/\b(?:for|over|almost|nearly)\s+$/.test(before) || /^\s+ago\b/.test(after))) return '';
    // So does a bare "2 years" ("I work in cafe 2 years"), unless it says how fast: "within 2 months", "2 months early".
    if (/^(?:years?|months?)$/.test(w0) && !/\b(?:within|in|after|under|by)\s+$/.test(before) && !/^\s+(?:early|earlier|ahead|sooner|faster|quicker)\b/.test(after)) return '';
    return [head, ...ws].join(' ').replace(/\s+/g, ' ').trim().slice(0, 40);
  }
  const CAPS_SKIP = bag(`I I'm I've I'd I'll OK Okay Hi Yes No So And But Then The A An My We It This That When While After Before Because If Also First Next Finally Monday Tuesday Wednesday Thursday Friday Saturday Sunday
    January February March April May June July August September October November December Christmas Last Next One Our Her His Their`);
  function evidence(s) {
    const found = [];
    const push = (v, at) => {
      const lv = v.toLowerCase();
      if (v && !isYear(v) && found.length < 6 && !found.some((n) => n.v.toLowerCase().includes(lv) || lv.includes(n.v.toLowerCase()))) found.push({ v, at });
    };
    for (const m of s.matchAll(NUM_RE)) {
      push(numberPhrase(s, m), m.index);
      if (found.length >= 6) break;
    }
    for (const m of s.matchAll(NUM_WORD_RE)) {
      if (found.length >= 6) break;
      const v = numberPhrase(s, m);
      if (v.includes(' ')) push(v.toLowerCase(), m.index);
    }
    const span = SPAN_RE.exec(s);
    if (span) push(span[0].toLowerCase(), span.index);
    // Numbers in the second half usually say what changed, so show those first.
    const half = s.length * 0.45;
    const nums = found.sort((x, y) => (x.at < half) - (y.at < half) || x.at - y.at).slice(0, 4).map((n) => n.v);
    const names = [];
    for (const sentence of s.split(/[.!?\n]+/)) {
      if (names.length >= 4) break;
      const ws = sentence.match(/[\p{L}\p{N}][\p{L}\p{N}'&+-]*/gu) || [];
      const cap = (w) => w && w.length > 1 && /^\p{Lu}/u.test(w) && !CAPS_SKIP.has(w);
      for (let i = 0; i < ws.length && names.length < 4; i++) {
        const w = ws[i];
        if (w.length < 2 || CAPS_SKIP.has(w)) continue;
        // A run of capitalised words is one name: "Queen Street", "Google Sheets", "Little Fern Coffee".
        let j = i + 1;
        while (j < ws.length && j < i + 4 && cap(ws[j]) && cap(ws[i])) j++;
        const name = ws.slice(i, j).join(' ').slice(0, 28);
        if ((i > 0 && /^\p{Lu}/u.test(w)) || (j - i > 1 && cap(w)) || /^\p{Lu}{2,}$/u.test(w)) {
          if (!names.includes(name)) names.push(name);
          i = j - 1;
        }
      }
    }
    // How people reacted afterwards ("she thanked me", a quoted comment) is proof too; look in the later part of the answer.
    const tail = s.slice(Math.floor(s.length * 0.4));
    const said = /"[^"\n]{3,120}"/.test(tail)
      || /\b(?:said|told (?:me|us)|thanked|praised|complimented|recogni[sz]ed|promoted|wrote (?:to )?(?:me|us)|left (?:a|us a|me a)(?: [a-z-]+)? (?:review|note|comment|card)|asked me to (?:share|show|train|teach|lead|mentor|help|cover|run))\b/i.test(tail);
    return { nums, names, said };
  }

  /* ---------- the six checks ---------- */

  const PART_HAS = { situation: 'set the scene', task: 'explain what needed to happen', action: 'say what you did', result: 'share how it turned out' };
  const PART_ADD = {
    situation: 'where and when it happened (the situation)',
    task: 'what needed to happen (the task)',
    action: 'what you did, step by step (the action)',
    result: 'how it turned out or what you learned (the result)'
  };
  const REASON_RE = /\b(?:because|since|so that|i enjoy|i love|i like|i want|i'd love|drawn to|interested|interests me|excit|passion|care about|i fit|fits me|match|suits|proud|appeal|attract|matters to me|meaningful|reason|looking forward)/;
  const ASK_RE = /\?|\b(?:i'd ask|i would ask|i'd like to know|i would like to know|i'm curious|i was wondering|could you tell me|can you tell me)\b/;

  function structureCheck(a, kind, s) {
    const st = a.star;
    const title = 'Situation, Task, Action, Result';
    if (!a.words) return { ok: false, detail: 'Start with a real example: where you were and what was going on.', title };
    if (!a.english) return { ok: false, detail: 'This coach reads English answers for now, so it could not check the parts of your story.', title };
    const low = s.toLowerCase();
    if (kind === 'closing') {
      const asks = (s.match(/\?/g) || []).length;
      return asks || ASK_RE.test(low)
        ? { ok: true, title: 'Your questions for them', detail: asks > 1 ? `You ask ${asks} real questions, which shows you care about the job.` : 'You ask a real question, which shows you care about the job.' }
        : { ok: false, title: 'Your questions for them', detail: 'End with a question or two of your own, like what a good first month looks like.' };
    }
    if (kind === 'motivation') {
      const reason = REASON_RE.test(low);
      const link = st.situation || st.action;
      return reason && link
        ? { ok: true, title: 'A clear reason', detail: 'You give a clear reason and link it to something you have done.' }
        : reason
          ? { ok: false, title: 'A clear reason', detail: 'You give a reason; now link it to something you have done, like a past job, class or volunteering.' }
          : { ok: false, title: 'A clear reason', detail: 'Say one real reason you want this job, then link it to something you have done.' };
    }
    if (kind === 'gap') {
      const t = 'How you would learn it';
      if (!st.action) return { ok: false, title: t, detail: 'Say the steps you would take to learn it, like who you would ask and how you would practise.' };
      return st.situation
        ? { ok: true, title: t, detail: 'You say how you would learn it and back it up with a time you picked up something new.' }
        : { ok: true, title: t, detail: 'You say how you would learn it; a time you picked up something new quickly would make it even stronger.' };
    }
    if (kind === 'situational') {
      const t = 'Your steps';
      if (!st.action) return { ok: false, title: t, detail: 'Say what you would do first, then next, starting with “I would …”.' };
      if (st.result || a.hopeResult) return { ok: true, title: t, detail: 'You say what you would do and how you would know it worked.' };
      if (st.task) return { ok: true, title: t, detail: 'You say what you would do and why; you could finish with how you would know it worked.' };
      return { ok: false, title: t, detail: 'You say what you would do; add why it matters and how you would know it worked.' };
    }
    // "Tell me about a time" asks for something that really happened.
    // Steps you would take, or what you always do, are the most common thing to fix here.
    const r = a.acts;
    const n = r.i + r.we;
    if (n > 0 && r.vague * 2 > n) {
      return { ok: false, title, detail: r.habit > r.hypAll
        ? 'This says what you usually do; tell it as one real time it happened: where you were, what you did and how it turned out.'
        : 'This says what you would do; tell it as a real time it happened: where you were, what you did and how it turned out.' };
    }
    const have = PARTS.filter((p) => st[p]);
    const lack = PARTS.filter((p) => !st[p]);
    if (!lack.length) {
      return { ok: true, title, detail: a.words < 50 ? 'All four parts are there in short form; a sentence or two more on what you did would bring it to life.' : 'All four parts are there: the situation, the task, what you did and how it turned out.' };
    }
    const ok = st.action && st.result && (st.situation || st.task);
    if (!have.length) return { ok: false, title, detail: 'Try telling it as a short story: where you were, what needed to happen, what you did and how it turned out.' };
    const lead = `You ${list(have.map((p) => PART_HAS[p]))}`;
    if (ok) return { ok, title, detail: `${lead}; adding ${list(lack.map((p) => PART_ADD[p]))} would make it even clearer.` };
    // Name the most useful missing parts first: what you did, then how it turned out.
    const next = ['action', 'result', 'situation', 'task'].filter((p) => !st[p]).slice(0, 2);
    return { ok, title, detail: `${lead}; now add ${next.map((p) => PART_ADD[p]).join(', then ')}.` };
  }

  function ownershipCheck(a, kind) {
    const title = 'Your part in it';
    const r = a.acts;
    if (!a.words) return { ok: false, title, detail: 'Say what you did yourself, starting with “I …”.' };
    if (!a.english) return { ok: true, title, detail: 'Not checked: this coach reads English answers for now.' };
    if (kind === 'closing') return { ok: true, title, detail: 'Nothing to add here: this is your turn to ask.' };
    if (r.weCount >= 3 && r.weCount > r.iCount) {
      return { ok: false, title, detail: r.iCount ? `You said “we” ${times(r.weCount)} and “I” ${times(r.iCount)}; try saying what you did yourself.` : `You said “we” ${times(r.weCount)} but never “I”; try saying what you did yourself.` };
    }
    const doing = r.i > 0 && r.iVague * 2 > r.i ? (r.iHabit > r.hyp ? 'you usually do' : 'you would do') : 'you did';
    const verbs = list(r.iVerbs.slice(0, 2).map(quote));
    if (kind === 'motivation') {
      return r.iCount + r.i >= 2
        ? { ok: true, title, detail: 'You speak for yourself, in your own words.' }
        : { ok: false, title, detail: 'Say it in your own words, starting with “I …”.' };
    }
    if (r.i >= 2) return { ok: true, title, detail: `You name ${r.i} things ${doing} yourself, like ${verbs}.` };
    if (r.i === 1) return { ok: false, title, detail: `You name one thing ${doing} yourself (${verbs}); add one or two more steps in your own words.` };
    if (r.we > 0) return { ok: false, title, detail: 'You describe what the team did; add what you did yourself, starting with “I …”.' };
    if (r.iCount) return { ok: false, title, detail: 'Describe what you did, step by step, like “I checked …” or “I asked …”.' };
    return { ok: false, title, detail: 'Say what you did yourself, step by step, starting with “I …”.' };
  }

  function evidenceCheck(a, kind, s, rel) {
    const soft = kind === 'motivation' || kind === 'closing' || kind === 'situational' || kind === 'gap';
    const title = soft ? 'Real details' : 'Proof it worked';
    if (!a.words) return { ok: false, title, detail: 'Add one detail that shows it worked, like how many, how long, or what someone said.' };
    if (kind === 'closing') return { ok: true, title, detail: 'Not needed for this question: it is your turn to ask.' };
    const e = evidence(s);
    const names = [...rel.skills, ...e.names.filter((n) => !rel.skills.some((k) => k.toLowerCase() === n.toLowerCase()))];
    if (soft) {
      const first = e.nums[0] || names[0] || (kind === 'motivation' ? rel.echoed[0] : '');
      if (first) return { ok: true, title, detail: `You mention real details, like ${quote(first)}.` };
      if (!a.english) return { ok: true, title, detail: 'Not checked: this coach reads English answers for now.' };
      if (e.said) return { ok: true, title, detail: 'You mention how people reacted, which makes it feel real.' };
      return { ok: false, title, detail: kind === 'motivation' ? 'Add one real detail, like something from the ad or a past job, that shows why it fits you.' : 'Add one real detail, like a time you did something similar, to show you can do it.' };
    }
    if (e.nums.length) return { ok: true, title, detail: `You back it up with numbers like ${list(e.nums.slice(0, 2).map(quote))}.` };
    if (!a.english) return { ok: true, title, detail: 'Not checked: this coach reads English answers for now.' };
    const more = 'a number, like how many or how long, would make it even stronger';
    const outcome = findPhrase(a.toks, OUTCOME);
    if (outcome) return { ok: true, title, detail: `You show how it turned out (${quote(outcome)}); ${more}.` };
    if (e.said) return { ok: true, title, detail: `You say how people reacted, which is good proof; ${more}.` };
    if (names.length && a.star.result) return { ok: true, title, detail: `You name real details like ${list(names.slice(0, 2).map(quote))}; ${more}.` };
    // Tool or place names alone do not show it worked ("I use React and TypeScript").
    if (names.length) return { ok: false, title, detail: `You mention ${list(names.slice(0, 2).map(quote))}; add how you know it worked, like how many, how long, or what someone said.` };
    return { ok: false, title, detail: 'Add one detail that shows it worked, like how many, how long, or what someone said afterwards.' };
  }

  function relevanceCheck(a, rel, kind) {
    const title = 'Matches the job ad';
    if (!a.words) return { ok: false, title, detail: 'Use the job ad’s own words where they are true for you.' };
    if (!rel.size) return { ok: true, title, detail: 'Nothing from the job ad to compare with for this question.' };
    if (!a.english && !rel.echoed.length) return { ok: true, title, detail: 'Not checked: this coach reads English answers for now.' };
    const miss = rel.missing.slice(0, 2).map(quote);
    const used = `You use the ad’s own words, like ${list(rel.echoed.slice(0, 2).map(quote))}`;
    if (kind === 'closing') {
      if (rel.echoed.length) return { ok: true, title, detail: `${used}.` };
      return { ok: true, title, detail: miss.length ? `You could also ask about something from the ad, like ${list(miss, 'or')}.` : 'You could also ask about something from the ad.' };
    }
    if (rel.echoed.length >= Math.min(2, rel.size)) return { ok: true, title, detail: `${used}.` };
    if (rel.echoed.length) return { ok: false, title, detail: miss.length ? `You use ${quote(rel.echoed[0])} from the ad; if it is true for you, also mention ${list(miss, 'or')}.` : `You use ${quote(rel.echoed[0])} from the ad; one more of its words would tie it in even more.` };
    return { ok: false, title, detail: miss.length ? `Tie it to the ad by using its words where they are true for you, like ${list(miss, 'or')}.` : 'Tie it to the ad by using its words where they are true for you.' };
  }

  // Typed answers run shorter than speech: people add detail when they say them out loud. So a typed answer is
  // long enough from `min` seconds (about 50 words for a story, 30 for a reason) and a comfortable spoken length from `full`.
  const LENGTHS = {
    closing: { min: 4, full: 4, max: 90, cap: 'a minute and a half' },
    motivation: { min: 13, full: 25, max: 120, cap: '2 minutes', aim: '30 seconds' },
    situational: { min: 13, full: 35, max: 150, cap: '2 and a half minutes', aim: 'a minute' },
    gap: { min: 13, full: 35, max: 150, cap: '2 and a half minutes', aim: 'a minute' },
    other: { min: 20, full: 40, max: 150, cap: '2 and a half minutes', aim: 'a minute' }
  };
  function lengthCheck(a, kind) {
    const title = 'Time to say it';
    if (!a.words) return { ok: false, title, detail: 'Nothing to time yet: most answers take 1 to 2 minutes to say.' };
    const L = LENGTHS[kind] || LENGTHS.other;
    const t = spoken(a.seconds);
    if (a.seconds < L.min) {
      const st = a.star;
      const add = !a.english ? 'most answers take about a minute to say'
        : kind === 'closing' ? 'one or two short questions of your own is plenty'
        : kind === 'motivation' ? 'add one reason and one example, so it runs about 30 seconds'
        : kind === 'situational' ? `add ${!st.action ? 'what you would do first, then next' : 'what you would do next and why'}, so it runs closer to a minute`
        : kind === 'gap' ? `add ${!st.action ? 'the steps you would take to learn it' : 'a time you learned something new quickly'}, so it runs closer to a minute`
        : `add ${!st.action ? 'what you did, step by step' : !st.result ? 'how it turned out' : 'a little more on what you did'}, so it runs closer to a minute`;
      return { ok: false, title, detail: `About ${t} out loud; ${add}.` };
    }
    if (a.seconds > L.max) return { ok: false, title, detail: `About ${t} out loud; try to keep it under ${L.cap} and save extra detail for follow-up questions.` };
    if (a.seconds < L.full) {
      const near = kind === 'motivation' || a.seconds >= 30 ? 'about' : 'closer to';
      return { ok: true, title, detail: `About ${t} as written; said out loud with a little detail it will run ${near} ${L.aim}, which is a good length.` };
    }
    return { ok: true, title, detail: `About ${t} out loud, a comfortable length.` };
  }

  function clarityCheck(a) {
    const title = 'Easy to follow';
    if (!a.words) return { ok: false, title, detail: 'Short, plain sentences are easiest to follow out loud.' };
    const long = a.sentences.filter((n) => n > LONG_SENTENCE);
    const f = a.english ? a.fillers : { weight: 0, total: 0, top: [] };
    const tooMany = f.weight > Math.max(2, a.words / 50);
    const fillerText = list(f.top.slice(0, 2).map(([k, n]) => `${quote(k)} ${times(n)}`));
    const longText = long.length === 1 ? `one sentence runs to ${long[0]} words` : `${long.length} sentences run past ${LONG_SENTENCE} words`;
    if (tooMany && long.length) return { ok: false, title, detail: `You used ${fillerText}, and ${longText}; trim the fillers and split long sentences.` };
    if (tooMany) return { ok: false, title, detail: `You used ${fillerText}; leaving them out will make you sound more sure of yourself.` };
    if (long.length) return { ok: false, title, detail: `${longText[0].toUpperCase()}${longText.slice(1)}; try splitting ${long.length === 1 ? 'it' : 'them'} so ${long.length === 1 ? 'it is' : 'they are'} easier to follow.` };
    const avg = Math.round(a.words / Math.max(1, a.sentences.length));
    if (a.words < 12) return { ok: true, title, detail: 'Clear so far.' };
    if (!a.english) return { ok: true, title, detail: `Sentences of about ${avg} words, which is easy to follow.` };
    return { ok: true, title, detail: `Clear sentences of about ${avg} words${f.total ? `, with only ${plural(f.total, 'filler word')}` : ' and no filler words'}.` };
  }

  /* ---------- public API ---------- */

  function live(text) {
    const a = analyse(clean(text), false);
    return { words: a.words, seconds: a.seconds, star: a.star };
  }

  function review(text, ctx) {
    const s = clean(text);
    const c = ctx && typeof ctx === 'object' ? ctx : {};
    const question = str(c.question, 1000);
    const info = c.info && typeof c.info === 'object' && !Array.isArray(c.info) ? c.info : null;
    const analysis = c.analysis && typeof c.analysis === 'object' && !Array.isArray(c.analysis) ? c.analysis : null;
    const a = analyse(s, true);
    const kind = kindOf(question, info);
    const rel = relevance(a.toks, question, info, analysis, kind);
    const checks = [
      { id: 'structure', ...structureCheck(a, kind, s) },
      { id: 'ownership', ...ownershipCheck(a, kind) },
      { id: 'evidence', ...evidenceCheck(a, kind, s, rel) },
      { id: 'relevance', ...relevanceCheck(a, rel, kind) },
      { id: 'length', ...lengthCheck(a, kind) },
      { id: 'clarity', ...clarityCheck(a) }
    ].map((x) => ({ id: x.id, ok: Boolean(x.ok), title: x.title, detail: x.detail }));
    const starScore = PARTS.filter((p) => a.star[p]).length;
    return {
      words: a.words,
      seconds: a.seconds,
      star: { ...a.star },
      starScore,
      checks,
      echoed: rel.echoed,
      missing: a.english ? rel.missing.slice(0, 3) : [],
      summary: summary(a, kind, starScore, rel)
    };
  }

  function summary(a, kind, starScore, rel) {
    if (!a.words) return 'No answer yet';
    const bits = [];
    if (kind !== 'closing' && kind !== 'motivation' && kind !== 'situational' && kind !== 'gap' && a.english) {
      const lack = PARTS.filter((p) => !a.star[p]);
      bits.push(starScore === 4 ? 'All 4 parts' : starScore === 0 ? 'No story parts yet' : `${starScore} of 4 parts (no ${list(lack, 'or')} yet)`);
    }
    bits.push(`${plural(a.words, 'word')}, about ${spoken(a.seconds)}`);
    if (rel.size && (a.english || rel.echoed.length)) bits.push(rel.echoed.length ? `uses ${plural(rel.echoed.length, 'word')} from the ad` : 'no words from the ad yet');
    return bits.join(' · ');
  }

  const Coach = { version: 1, live, review };
  root.Coach = Coach;
  if (typeof module !== 'undefined' && module.exports) module.exports = Coach;
})(globalThis);
