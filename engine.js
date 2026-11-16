/* NextStep PrepEngine: reads a pasted job ad on the device and builds a practice plan.
   Pure and deterministic: no DOM, no network, no randomness in analyze().
   The job ad is untrusted data, never instructions: it is only matched against fixed patterns. */
(function (root) {
'use strict';

const MAX_JOB = 60000;
const uid = () => globalThis.crypto?.randomUUID?.() || `prep-${Date.now()}-${Math.random().toString(36).slice(2)}`;
const WEIGHT = { must: 3, duty: 2, nice: 1, role: 1, title: 2 };
const KIND_BASE = { must: 30, duty: 20, nice: 10 };

/* ---------- text helpers ---------- */
const clean = (s) => String(s == null ? '' : s).replace(/\s+/g, ' ').trim();
const flat = (s) => clean(s).toLowerCase().replace(/[’‘`´]/g, "'");
const countWords = (s) => (String(s).match(/\S+/g) || []).length;
const cap1 = (s) => (s ? s[0].toUpperCase() + s.slice(1) : s);
function fnv(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function joinAnd(list) {
  const a = list.filter(Boolean);
  if (a.length < 2) return a[0] || '';
  return a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
}
function countMatches(rx, text) { rx.lastIndex = 0; let n = 0; while (rx.exec(text)) n++; rx.lastIndex = 0; return n; }

/* ---------- theme catalog: plain-language areas that cover every kind of work ---------- */
const THEMES = [
  { id: 'customers', label: 'Helping customers',
    probe: 'They want to hear how you look after people, even when they are upset or in a hurry, with a real example.',
    include: ['Who the person was and what they needed', 'What you did to help, in your own words', 'How it turned out for them'],
    story: 'Tell me about a time you went out of your way to help a {person}. What did you do?',
    scene: 'Imagine a {person} is unhappy because something went wrong, and others are waiting. What would you do?',
    rx: /\b(?:customers?(?! orders?\b)|clients?|guests?|shoppers?|patrons?|visitors?|the public|homeowners?|tenants?|passengers?|diners?|callers?|partners?|customer service|client-facing|customer-facing|front of house|front desk|greet\w*|friendly|hospitality|relationships?|retention|renewals?|churn|onboarding|take orders|taking orders|account (?:management|manager|health)|help them find|users?)\b/g },
  { id: 'teamwork', label: 'Teamwork',
    probe: 'They want to hear how you work with others: pitching in, sharing the load and sorting out problems kindly.',
    include: ['What the team was trying to get done', 'Your part, and how you helped someone else', 'What you achieved together'],
    story: 'Tell me about a time you worked closely with others to get something done. What was your part?',
    scene: 'Imagine a teammate is falling behind and it is starting to affect your work. What would you do?',
    rx: /\b(?:teams?|teammates?|team players?|crew|colleagues?|co-?workers?|together|collaborat\w*|cooperat\w*|works? well with|working well with|(?:work|works|working) closely with|alongside|journey(?:person|man)|nurse in charge|stand-?ups?|code reviews?|planning|pitch in|supervision of)\b/g },
  { id: 'communication', label: 'Communication',
    probe: 'They want to hear that you explain things clearly, listen well and keep the right people in the loop.',
    include: ['Who you needed to talk to, and why', 'How you made it clear and checked they understood', 'What happened because the message got through'],
    story: 'Tell me about a time you had to explain something clearly or pass on important information.',
    scene: 'Imagine someone misunderstood what you told them and did the wrong thing. What would you do?',
    rx: /\b(?:communicat\w*|explain\w*|written|verbal|spoken|speak\w*|english|french|bilingual|second language|languages?|listen\w*|present(?:ing|ations?)|talk\w*|conversations?|report (?:them|it|this|changes|issues|problems|back)|feedback|point of contact|kickoff|phone|emails?|instructions|ask questions|keep (?:\w+ )?informed|updates?)\b/g },
  { id: 'reliability', label: 'Reliability and showing up',
    probe: 'They want to hear that they can count on you: on time, ready to work and doing what you said you would.',
    include: ['A time someone was counting on you', 'What you did to be there or get it done', 'How you kept it up over time'],
    story: 'Tell me about a time someone was counting on you. How did you make sure you came through?',
    scene: 'Imagine you wake up sick on a day you are scheduled to work. What would you do?',
    rx: /\b(?:reliab\w*|dependab\w*|punctual\w*|on time|show up|shows up|showing up|attendance|availab\w*|shifts?|weekends?|evenings?|nights?|overnight|early mornings?|rotating (?:shifts?|schedules?|days|weekends)|holidays?|transportation|follow(?:s|ing)? through|follow-through|consisten\w*|committed|commitment|trustworth\w*|criminal record|vulnerable sector|police check|background check|driver'?s licen[cs]e)\b/g },
  { id: 'safety', label: 'Safety and following procedures',
    probe: 'They want to hear how you keep yourself and others safe on the job, with a real example.',
    include: ['The risk or rule involved', 'The steps you followed, and why they matter', 'How everyone stayed safe'],
    story: 'Tell me about a time you spotted something unsafe and did something about it.',
    scene: 'Imagine you see a coworker skip a safety step to save time. What would you do?',
    rx: /\b(?:food ?safe|food safety|food handl\w*|safe|safely|safety|unsafe|hazards?|hazardous|ppe|protective equipment|procedures?|protocols?|regulations?|complian\w*|electrical code|building code|fire code|lockout|tagout|whmis|fall protection|first aid|cpr|infection|hygien\w*|saniti\w*|sanitary|smart serve|inspections?|injur\w*|accidents?|incidents?|steel[- ]toe\w*|safety (?:boots|shoes|gear))\b/g },
  { id: 'physical', label: 'Hands-on and physical work',
    probe: 'They want to hear that you are comfortable with hands-on work and do it carefully, without cutting corners.',
    include: ['The hands-on task and the conditions', 'How you did it properly and safely', 'The finished result'],
    story: 'Tell me about a hands-on job you did that took care and stamina.',
    scene: 'Imagine a physical task is taking much longer than planned and you are getting tired. What would you do?',
    rx: /\b(?:lift|lifts|lifting|carry\w*|standing|on your feet|physical\w*|ladders?|crawl spaces?|outdoors?|all weather|kg|kilograms?|lbs?|pounds|heavy|bending|hand tools|power tools|install\w*|repair\w*|wiring|wire|conduit|terminate|restock\w*|deliveries|boxes|cleaning|dishes|labou?r|warehouse|forklift|hands-on|manual|transfers?|pour-?overs?|espresso|drinks|cook\w*|grill\w*|saut[eé]\w*|fryers?|knife|knives|chop\w*|prep (?:vegetables|food|ingredients|stations?)|food prep|sweep\w*|mop\w*|keep (?:job sites|the counter|the \w+ floor|the floor|the store|work areas?))\b/g },
  { id: 'care', label: 'Care and compassion',
    probe: 'They want to hear how you treat people with patience, dignity and kindness, especially when they need help.',
    include: ['Who you were helping and what they needed', 'What you did to keep them comfortable and respected', 'How they, or their family, responded'],
    story: 'Tell me about a time you looked after someone who needed extra patience or kindness.',
    scene: 'Imagine a {person} you are helping refuses care they need and is getting upset. What would you do?',
    rx: /\b(?:personal care|patient care|resident care|direct care|child ?care|long-term care|home care|dementia(?: care)?|elder care|palliative|respite|compassion\w*|caring|care for|care aide|care home|care worker|health care aide|personal support worker|dignity|kindness|empath\w*|residents?|patients|families|family members|wellbeing|well-being|bathing|dressing|grooming|toileting|feeding|seniors|elderly|older adults|children|kids|nurse|nursing|medications?|vital signs|wound care|comfort)\b/g },
  { id: 'detail', label: 'Attention to detail and accuracy',
    probe: 'They want to hear how you get the small things right and catch mistakes before they cause problems.',
    include: ['What had to be exactly right', 'How you checked your work', 'A mistake you caught or prevented'],
    story: 'Tell me about a time you caught a mistake before it caused a problem.',
    scene: 'Imagine you notice a mistake in your own work after you thought it was finished. What would you do?',
    rx: /\b(?:accura\w*|detail\w*|careful\w*|precis\w*|thorough\w*|double-check\w*|quality|mistakes?|errors?|charting|documentation|observ\w*|notic(?:e|ing) (?:changes|problems|issues)|tidy|unit tests?|testing|counts|counting|measur\w*|neat\w*)\b/g },
  { id: 'numbers', label: 'Numbers, cash and data',
    probe: 'They want to hear that you are careful and honest with money, counts or data, and can explain what the numbers mean.',
    include: ['The money, counts or data you looked after', 'How you kept them accurate', 'What the numbers showed or helped decide'],
    story: 'Tell me about a time you used numbers or data to spot a problem or explain something to others.',
    storyCash: 'Tell me about a time you handled money or counts that had to be exactly right.',
    scene: 'Imagine the numbers in a report look wrong just before you share it. What would you do?',
    sceneCash: 'Imagine your cash drawer is short at the end of your shift. What would you do?',
    rx: /\b(?:cash\w*|money|tills?|registers?|pos|point of sale|payments?|transactions?|returns|exchanges|refunds?|counts|inventory|data|reports|reporting|a (?:simple )?report|excel|spreadsheets?|google sheets|sql|numbers|budgets?|invoic\w*|metrics|analytics|dashboards?|figures|math\w*|rates|pricing|quotes|estimates|bookkeeping|accounting|payroll|totals|looker|bi tool)\b/g },
  { id: 'organisation', label: 'Organisation and time',
    probe: 'They want to hear how you plan your time, juggle several things and still get the important ones done.',
    include: ['What you had to juggle', 'How you decided what came first', 'What got done on time because of it'],
    story: 'Tell me about a time you had a lot to do at once. How did you decide what came first?',
    scene: 'Imagine you are given three urgent tasks at the same time. How would you decide what to do first?',
    rx: /\b(?:organi[sz]\w*|priorit\w*|time management|deadlines?|on schedule|planning|multi-?task\w*|juggl\w*|competing|portfolio|coordinat\w*|logistics|efficien\w*|follow[- ]?up|next steps|calendar|appointments?|restock\w*|displays?|tidy|set up|setup)\b/g },
  { id: 'problem', label: 'Problem solving and troubleshooting',
    probe: 'They want to hear how you work out what went wrong and fix it step by step, instead of guessing.',
    include: ['The problem and why it mattered', 'The steps you took to find the cause', 'How you fixed it, and what you learned'],
    story: 'Tell me about a problem you had to figure out step by step.',
    scene: 'Imagine something stops working in the middle of a job and nobody knows why. How would you figure it out?',
    rx: /\b(?:problems?|problem-solv\w*|solv\w*|troubleshoot\w*|fix\w*|bugs?|issues?|resolv\w*|escalat\w*|diagnos\w*|figure out|repair\w*|improv\w*|root cause|complaints?|challenges?|act early|find solutions)\b/g },
  { id: 'learning', label: 'Learning and taking feedback',
    probe: 'They want to hear that you pick things up quickly, ask good questions and use feedback to get better.',
    include: ['Something new you had to learn', 'How you learned it: asking, practising, feedback', 'How you used it afterwards'],
    story: 'Tell me about a time you had to learn something new quickly, or changed how you worked after feedback.',
    scene: 'Imagine you are asked to do a task you have never done before and your supervisor is busy. What would you do?',
    rx: /\b(?:learn\w*|eager\w*|curio\w*|willing\w*|ask for help|ask questions|(?:take|taking|accept\w*|act on|acting on|use|using|welcome|open to|receive|receiving) feedback|(?:get|getting|receive|receiving|ongoing|with) coaching|coaching and (?:feedback|support|mentoring|training)|coached|mentoring|mentorship|apprentice\w*|supervision|grow (?:your|with)|new skills|study\w*|school|working toward|adapt\w*|attitude|pick up|will train|we train|on-the-job training|training provided|bootcamp|internships?)\b/g },
  { id: 'pressure', label: 'Staying calm under pressure',
    probe: 'They want to hear how you stay calm and kind when things get busy or tense, and still get it right.',
    include: ['How busy or tense it was', 'What you did to stay calm and keep going', 'How it turned out'],
    story: 'Tell me about a time things got really busy or tense. How did you stay calm?',
    scene: 'Imagine it is the busiest time of the day and two things go wrong at once. What would you do first?',
    rx: /\b(?:calm\w*|pressure|busy|rush\w*|fast-paced|fast paced|high-volume|high volume|peak|stress\w*|tight deadlines|upset|difficult|demanding|escalations?|urgent\w*|emergenc\w*|(?:friendly|calm|kind|warm|caring|polite|be|stay|remain)(?:,| and)? patient|patient(?= and\b| manner\b| with\b|,)|patience|holiday season|competing priorities|think on your feet|multitask\w*)\b/g },
  { id: 'leadership', label: 'Leading and owning outcomes',
    probe: 'They want to hear about a time you took charge of something and saw it through, even without being asked.',
    include: ['What you took responsibility for', 'The choices you made and why', 'The result you can point to'],
    story: 'Tell me about a time you took charge of something and saw it through.',
    scene: 'Imagine a plan is going off track and nobody is taking charge. What would you do?',
    rx: /\b(?:lead|leading|leadership|leaders?|own (?:the|onboarding|projects?|outcomes?|results?|relationships?|it)|ownership|take charge|initiative|accountab\w*|responsible for|supervis(?:e|ing|or)|manag(?:e|ing) (?:a |the )?(?:team|staff|crew|people)|decisions?|outcomes?|results|track record|take pride|pride in)\b/g },
  { id: 'technical', label: 'Technical and tool skills',
    probe: 'They want to hear how you actually use the tools and skills in the ad, step by step, and how you check your work.',
    include: ['The tool, skill or method you used', 'Exactly what you did with it, step by step', 'How you checked that it worked'],
    story: 'Walk me through a time you used {skills} to get something done. How did you check it worked?',
    scene: 'Imagine a tool or system you rely on stops working while someone is waiting on you. What would you do?',
    rx: /\b(?:technical|technolog\w*|software|platforms?|coding|programming|web apps?|apps?|interfaces?|components|front-end|back-end|database\w*|equipment|machinery|machines?|electrical|wiring|circuits?|panels|blueprints?|drawings|schematics|multimeter|diagnostic\w*|devices|computers?|digital|responsive|accessib\w*|page speed|core web vitals|code|configur\w*)\b/g },
  { id: 'sales', label: 'Sales and persuasion',
    probe: 'They want to hear how you find out what someone needs and help them say yes, honestly and without pressure.',
    include: ['What the person needed or worried about', 'How you explained the value in their terms', 'What they decided, and the result'],
    story: 'Tell me about a time you helped someone decide to buy or say yes to something.',
    scene: 'Imagine a {person} is interested but unsure. How would you help them decide, without pushing?',
    rx: /\b(?:sell\w*|upsell\w*|cross-sell\w*|sales (?:targets?|goals?|quotas?|experience|role|team|pipeline)|quotas?|revenue|commission\w*|negotiat\w*|persua\w*|pitch\w*|close deals|closing deals|prospect\w*|lead generation|generate leads|business development|recommend\w*|promot(?:e|ing) (?:products|services|offers)|retention|renewals?|upgrades?|memberships?|conversions?)\b/g }
];
const THEME = Object.fromEntries(THEMES.map((t) => [t.id, t]));
const THEME_INDEX = Object.fromEntries(THEMES.map((t, i) => [t.id, i]));
const TITLE_HINTS = [
  [/\b(?:store|retail|associate|cashier|clerk|server|waiter|waitress|host|hostess|barista|bartender|receptionist|front desk|customer|concierge|call cent(?:re|er)|agent|representative|success)\b/i, 'customers'],
  [/\b(?:aide|nurse|nursing|care|caregiver|support worker|psw|attendant|companion|nanny|childcare|educator|teacher)\b/i, 'care'],
  [/\b(?:electrician|electrical|technician|mechanic|plumber|carpenter|welder|millwright|installer|developer|engineer|programmer|software|front-end|back-end|full-stack|devops|it support|analyst)\b/i, 'technical'],
  [/\b(?:driver|courier|delivery)\b/i, 'reliability'],
  [/\b(?:cook|chef|kitchen|dishwasher|baker|warehouse|picker|packer|mover|cleaner|janitor|custodian|housekeep\w*|landscap\w*|labou?rer)\b/i, 'physical'],
  [/\b(?:supervisor|team lead|director|head of|foreman)\b/i, 'leadership'],
  [/\b(?:sales|account executive|business development)\b/i, 'sales'],
  [/\b(?:accountant|bookkeeper|accounting|finance|payroll)\b/i, 'numbers'],
  [/\b(?:security|guard)\b/i, 'safety'],
  [/\b(?:administrative|admin|office assistant|coordinator|scheduler)\b/i, 'organisation']
];
const CRED = /\b(?:certif\w*|licen[cs]es?|registered|check|diploma|degree|seal|ticket|clearance)\b/i;
function isCredential(text, skillCount) {
  return CRED.test(text) || /\b\d+\+?\s*years?\b/i.test(text) || (skillCount > 0 && countWords(text) <= 6) || (skillCount > 0 && /\b(?:experience|familiarity) (?:with|in|using)\b/i.test(text));
}

/* ---------- skills: tools, certificates and hard skills across fields ----------
   [name, regex, theme, tokens]. A regex with a capture group reports that group. A pattern only runs on lines
   that contain one of its tokens (lowercase words), which keeps a 60k-character ad fast.
   Case-sensitive patterns guard words that are also ordinary English (Excel, React, Square...). */
const SK = (name, rx, theme, tokens) => ({ name, rx, theme: theme || 'technical',
  tokens: tokens == null ? [(name.toLowerCase().match(/[a-z0-9#+]+/g) || ['']).sort((a, b) => b.length - a.length)[0]] : Array.isArray(tokens) ? tokens : tokens ? [tokens] : null });
const SKILLS = [
  // office, admin, business
  SK('Excel', /\b(?:Microsoft |MS )?Excel\b(?! at\b| in\b)/g, 'numbers'),
  SK('Google Sheets', /\bGoogle Sheets\b/gi, 'numbers'),
  SK('Google Workspace', /\bGoogle Workspace\b|\bG Suite\b/gi, 'technical', ['workspace', 'suite']),
  SK('Google Docs', /\bGoogle Docs\b/gi, 'technical'),
  SK('Microsoft Office', /\b(?:Microsoft|MS) Office\b|\bOffice 365\b|\bMicrosoft 365\b/gi, 'technical', ['office', '365']),
  SK('Word', /\b(?:Microsoft|MS) Word\b/gi, 'technical'),
  SK('PowerPoint', /\bPowerPoint\b/gi, 'communication'),
  SK('Outlook', /\b(?:Microsoft |MS )?Outlook\b/g, 'technical'),
  SK('Microsoft Teams', /\b(?:Microsoft|MS) Teams\b/gi, 'technical'),
  SK('Slack', /\bSlack\b/g, 'technical'),
  SK('Zoom', /\bZoom\b/g, 'technical'),
  SK('Salesforce', /\bSalesforce\b/gi, 'customers'),
  SK('HubSpot', /\bHubSpot\b/gi, 'customers'),
  SK('Zendesk', /\bZendesk\b/gi, 'customers'),
  SK('Intercom', /\bIntercom\b/g, 'customers'),
  SK('CRM', /\bCRMs?\b/g, 'customers'),
  SK('ERP', /\bERP\b/g, 'technical'),
  SK('SAP', /\bSAP\b/g, 'technical'),
  SK('QuickBooks', /\bQuickBooks\b/gi, 'numbers'),
  SK('Dentrix', /\bDentrix\b/gi, 'technical'),
  SK('Eaglesoft', /\bEaglesoft\b/gi, 'technical'),
  SK('Xero', /\bXero\b/g, 'numbers'),
  SK('Sage', /\bSage (?:50|300|Accounting|Intacct)\b/g, 'numbers'),
  SK('bookkeeping', /\bbookkeeping\b/gi, 'numbers'),
  SK('accounts payable', /\baccounts payable\b/gi, 'numbers'),
  SK('accounts receivable', /\baccounts receivable\b/gi, 'numbers'),
  SK('payroll', /\bpayroll\b/gi, 'numbers'),
  SK('invoicing', /\binvoicing\b/gi, 'numbers'),
  SK('data entry', /\bdata entry\b/gi, 'detail'),
  SK('spreadsheets', /\bspreadsheets?\b/gi, 'numbers', ['spreadsheet', 'spreadsheets']),
  SK('MySQL', /\bMySQL\b/gi, 'technical'),
  SK('PostgreSQL', /\bPostgre(?:SQL|s)\b/gi, 'technical', ['postgresql', 'postgres']),
  SK('SQL', /\bSQL\b/gi, 'numbers'),
  SK('Looker', /\bLooker(?: Studio)?\b/gi, 'numbers'),
  SK('Tableau', /\bTableau\b/gi, 'numbers'),
  SK('Power BI', /\bPower ?BI\b/gi, 'numbers', ['power', 'powerbi']),
  SK('Google Analytics', /\bGoogle Analytics\b|\bGA4\b/gi, 'numbers', ['analytics', 'ga4']),
  SK('SEO', /\bSEO\b/g, 'technical'),
  SK('Jira', /\bJira\b/gi, 'organisation'),
  SK('Confluence', /\bConfluence\b/g, 'communication'),
  SK('Trello', /\bTrello\b/gi, 'organisation'),
  SK('Asana', /\bAsana\b/g, 'organisation'),
  SK('Notion', /\bNotion\b/g, 'organisation'),
  SK('Mailchimp', /\bMailchimp\b/gi, 'technical'),
  SK('Shopify', /\bShopify\b/gi, 'technical'),
  SK('WordPress', /\bWordPress\b/gi, 'technical'),
  SK('Canva', /\bCanva\b/gi, 'technical'),
  SK('Photoshop', /\b(?:Adobe )?Photoshop\b/gi, 'technical'),
  SK('Illustrator', /\b(?:Adobe )?Illustrator\b/g, 'technical'),
  SK('InDesign', /\bInDesign\b/gi, 'technical'),
  SK('Adobe XD', /\bAdobe XD\b/gi, 'technical', ['xd']),
  SK('Premiere Pro', /\bPremiere Pro\b/gi, 'technical'),
  SK('Figma', /\bFigma\b/gi, 'technical'),
  SK('Agile', /\bAgile\b/g, 'teamwork'),
  SK('Scrum', /\bScrum\b/gi, 'teamwork'),
  SK('A/B tests', /\bA\/B test(?:s|ing)?\b/gi, 'numbers', ['test', 'tests', 'testing']),
  SK('PMP', /\bPMP\b/g, 'organisation'),
  // software and web
  SK('JavaScript', /\bJavaScript\b/gi, 'technical'),
  SK('TypeScript', /\bTypeScript\b/gi, 'technical'),
  SK('React', /\bReact(?: Native)?\b/g, 'technical'),
  SK('Next.js', /\bNext\.js\b/gi, 'technical', ['next']),
  SK('Node.js', /\bNode(?:\.js|JS)\b/gi, 'technical', ['node', 'nodejs']),
  SK('Vue', /\bVue(?:\.js)?\b/g, 'technical', ['vue']),
  SK('Angular', /\bAngular(?:JS)?\b/g, 'technical', ['angular', 'angularjs']),
  SK('Svelte', /\bSvelte(?:Kit)?\b/gi, 'technical', ['svelte', 'sveltekit']),
  SK('HTML', /\bHTML5?\b/gi, 'technical', ['html', 'html5']),
  SK('Tailwind', /\bTailwind(?: CSS)?\b/gi, 'technical'),
  SK('CSS', /\bCSS3?\b/gi, 'technical', ['css', 'css3']),
  SK('Sass', /\bSass\b|\bSCSS\b/g, 'technical', ['sass', 'scss']),
  SK('GitHub', /\bGitHub\b/gi, 'technical'),
  SK('GitLab', /\bGitLab\b/gi, 'technical'),
  SK('Git', /\bGit\b/gi, 'technical'),
  SK('Jest', /\bJest\b/g, 'detail'),
  SK('Cypress', /\bCypress\b/g, 'detail'),
  SK('Playwright', /\bPlaywright\b/g, 'detail'),
  SK('Selenium', /\bSelenium\b/gi, 'detail'),
  SK('unit tests', /\bunit test(?:s|ing)?\b/gi, 'detail', ['unit']),
  SK('GraphQL', /\bGraphQL\b/gi, 'technical'),
  SK('REST APIs', /\bREST(?:ful)?(?: APIs?)?\b/g, 'technical', ['rest', 'restful']),
  SK('APIs', /\bAPIs?\b/g, 'technical', ['api', 'apis']),
  SK('WCAG', /\bWCAG(?: ?2(?:\.\d)?)?(?: AA)?\b/g, 'technical', ['wcag', 'wcag2']),
  SK('Core Web Vitals', /\bCore Web Vitals\b/gi, 'technical', 'vitals'),
  SK('Python', /\bPython\b/gi, 'technical'),
  SK('Java', /\bJava\b/g, 'technical'),
  SK('C#', /(?:^|[^\w#])(C#)(?![\w#])/g, 'technical', ['c#']),
  SK('C++', /(?:^|[^\w+])(C\+\+)(?![\w+])/g, 'technical', ['c++']),
  SK('.NET', /(?:^|[^\w.])(\.NET)\b/g, 'technical', ['net']),
  SK('PHP', /\bPHP\b/g, 'technical'),
  SK('Ruby on Rails', /\bRuby on Rails\b|\bRails\b/g, 'technical', ['rails']),
  SK('Go', /\b(Golang)\b|\b(Go)\b(?= (?:programming|language|developer|services|microservices|backend|code))/g, 'technical', ['go', 'golang']),
  SK('R', /\b(R)\b(?= (?:programming|language|or Python|and Python|Studio))|\b(RStudio)\b/g, 'numbers', ['r', 'rstudio']),
  SK('Rust', /\bRust\b(?! prevention| removal| proofing)/g, 'technical'),
  SK('Kotlin', /\bKotlin\b/g, 'technical'),
  SK('Swift', /\bSwift(?:UI)?\b/g, 'technical', ['swift', 'swiftui']),
  SK('Flutter', /\bFlutter\b/g, 'technical'),
  SK('MongoDB', /\bMongoDB\b/gi, 'technical'),
  SK('Firebase', /\bFirebase\b/gi, 'technical'),
  SK('Docker', /\bDocker\b/gi, 'technical'),
  SK('Kubernetes', /\bKubernetes\b|\bK8s\b/gi, 'technical', ['kubernetes', 'k8s']),
  SK('AWS', /\bAWS\b|\bAmazon Web Services\b/g, 'technical', ['aws', 'amazon']),
  SK('Azure', /\bAzure\b/g, 'technical'),
  SK('Google Cloud', /\bGCP\b|\bGoogle Cloud(?: Platform)?\b/g, 'technical', ['gcp', 'cloud']),
  SK('Linux', /\bLinux\b/gi, 'technical'),
  SK('CI/CD', /\bCI\/CD\b/gi, 'technical', ['ci']),
  SK('Active Directory', /\bActive Directory\b/gi, 'technical', 'directory'),
  SK('ServiceNow', /\bServiceNow\b/gi, 'technical'),
  // retail, hospitality, food
  SK('POS', /\bPOS\b|\b[Pp]oint[- ]of[- ][Ss]ale\b/g, 'numbers', ['pos', 'point']),
  SK('Square', /\b(Square)\b(?= (?:POS|register|terminal|reader|point of sale|payments?|app|stand))|\b(?:on|using|with|via) (?:our |a |the )?(Square)\b(?! (?:feet|foot|footage|metres?|meters?|kilometres?|miles?|inch(?:es)?|one))/g, 'numbers', 'square'),
  SK('Clover', /\bClover\b(?= (?:POS|register|terminal|system))/g, 'numbers'),
  SK('Lightspeed', /\bLightspeed\b/g, 'numbers'),
  SK('Toast', /\bToast\b(?= (?:POS|system|terminal|register))/g, 'numbers'),
  SK('Moneris', /\bMoneris\b/gi, 'numbers'),
  SK('cash handling', /\bcash handling\b|\bhandl(?:e|es|ing) (?:cash|money|payments)\b|\bcash (?:register|management|out|counts?)\b|\bcash\b/gi, 'numbers', ['cash', 'handle', 'handles', 'handling']),
  SK('inventory', /\binventory(?: counts?| management| control| systems?)?\b|\bstock ?(?:taking|counts?)\b/gi, 'numbers', ['inventory', 'stock', 'stocktaking']),
  SK('merchandising', /\b(?:visual )?merchandising\b/gi, 'organisation'),
  SK('upselling', /\bupsell(?:ing)?\b/gi, 'sales', ['upsell', 'upselling']),
  SK('espresso', /\bespresso(?: drinks| machines?| bar)?\b/gi, 'physical'),
  SK('pour-overs', /\bpour[- ]overs?\b/gi, 'physical', 'pour'),
  SK('latte art', /\blatte art\b/gi, 'physical'),
  SK('bartending', /\bbartending\b|\bmixology\b/gi, 'physical', ['bartending', 'mixology']),
  SK('Food Safe', /\bFood ?Safe(?: Level [12])?\b/gi, 'safety', ['food', 'foodsafe']),
  SK('food safety', /\bfood safety(?: certificat\w+)?\b/gi, 'safety', 'food'),
  SK('food handling', /\bfood handl(?:ing|ers?)(?:'s)?(?: certificat\w+)?\b/gi, 'safety', 'food'),
  SK('Smart Serve', /\bSmart ?Serve\b/gi, 'safety', ['smart', 'smartserve']),
  SK('Serving It Right', /\bServing It Right\b/gi, 'safety', 'serving'),
  SK('ProServe', /\bProServe\b/gi, 'safety'),
  SK('HACCP', /\bHACCP\b/gi, 'safety'),
  SK('knife skills', /\bknife skills\b/gi, 'physical', 'knife'),
  SK('OpenTable', /\bOpenTable\b/gi, 'customers'),
  // trades, warehouse, driving
  SK('blueprints', /\bblueprints?(?: reading)?\b/gi, 'technical', ['blueprint', 'blueprints']),
  SK('technical drawings', /\b(?:technical|shop|construction) drawings\b/gi, 'technical', 'drawings'),
  SK('electrical code', /\b(?:Canadian |National )?Electrical Code\b|\bCEC\b|\bNEC\b/gi, 'safety', ['code', 'cec', 'nec']),
  SK('building code', /\b(?:building|fire|plumbing) codes?\b/gi, 'safety', ['code', 'codes']),
  SK('conduit', /\bconduit\b/gi, 'physical'),
  SK('multimeter', /\bmulti-?meters?\b|\bvoltmeters?\b|\bmeggers?\b/gi, 'technical', ['multimeter', 'multimeters', 'multi', 'voltmeter', 'voltmeters', 'megger', 'meggers']),
  SK('lockout/tagout', /\block[- ]?out\s*[\/&-]?\s*tag[- ]?out\b|\bLOTO\b/gi, 'safety', ['lockout', 'lock', 'loto']),
  SK('WHMIS', /\bWHMIS(?: 2015)?\b/gi, 'safety'),
  SK('fall protection', /\bfall (?:protection|arrest)\b/gi, 'safety', 'fall'),
  SK('working at heights', /\bworking at heights\b/gi, 'safety', 'heights'),
  SK('confined space', /\bconfined spaces?(?: entry)?\b/gi, 'safety', 'confined'),
  SK('Red Seal', /\bRed Seal\b/gi, 'technical', 'seal'),
  SK('journeyperson ticket', /\bjourney(?:person|man) (?:ticket|certificate|licen[cs]e)\b/gi, 'technical', ['journeyperson', 'journeyman']),
  SK('forklift', /\bforklifts?(?: licen[cs]e| certificat\w+| operat\w+)?\b/gi, 'physical', ['forklift', 'forklifts']),
  SK('pallet jack', /\bpallet jacks?\b/gi, 'physical', 'pallet'),
  SK('reach truck', /\breach trucks?\b/gi, 'physical', 'reach'),
  SK('RF scanner', /\b(?:RF|hand-?held) scanners?\b/gi, 'technical', ['scanner', 'scanners']),
  SK('power tools', /\bpower tools\b/gi, 'physical', 'tools'),
  SK('hand tools', /\bhand tools\b/gi, 'physical', 'tools'),
  SK('welding', /\bwelding\b|\b(?:MIG|TIG|stick) weld\w*\b/gi, 'physical', ['welding', 'mig', 'tig', 'stick']),
  SK('soldering', /\bsoldering\b/gi, 'technical'),
  SK('AutoCAD', /\bAutoCAD\b/gi, 'technical'),
  SK('Revit', /\bRevit\b/gi, 'technical'),
  SK('SolidWorks', /\bSolidWorks\b/gi, 'technical'),
  SK('PLC', /\bPLCs?\b/g, 'technical', ['plc', 'plcs']),
  SK('HVAC', /\bHVAC\b/gi, 'technical'),
  SK('CNC', /\bCNC\b/g, 'technical'),
  SK('scaffolding', /\bscaffold(?:ing)?\b/gi, 'safety', ['scaffold', 'scaffolding']),
  SK('aerial lift', /\b(?:aerial|scissor|boom) lifts?\b/gi, 'physical', ['lift', 'lifts']),
  SK('heavy equipment', /\bheavy equipment\b/gi, 'physical', 'heavy'),
  SK("driver's licence", /\b((?:driver[’']?s[’']?|driving|drivers) licen[cs]e)\b|\b(Class [1-5][A-Z]? (?:licen[cs]e|driver))\b|\b(CDL)\b/gi, 'reliability', ['licence', 'license', 'cdl']),
  SK('clean driving record', /\bclean (?:driving record|driver[’']?s abstract|driving abstract)\b/gi, 'reliability', ['clean']),
  SK('OSHA', /\bOSHA(?: 10| 30)?\b/g, 'safety'),
  SK('TDG', /\bTransportation of Dangerous Goods\b|\bTDG\b/g, 'safety', ['tdg', 'dangerous']),
  // healthcare, care, education
  SK('Personal Support Worker certificate', /\b(?:Personal Support Worker|PSW|Health Care Aide|HCA|Nursing Assistant|CNA) (?:certificate|certification|diploma)\b/gi, 'care', ['certificate', 'certification', 'diploma']),
  SK('CPR', /\bCPR(?:-C| Level [A-C]| HCP)?\b/g, 'safety'),
  SK('First Aid', /\b(?:Standard |Emergency )?First Aid\b/gi, 'safety', 'aid'),
  SK('BLS', /\bBLS\b/g, 'safety'),
  SK('ACLS', /\bACLS\b/g, 'safety'),
  SK('AED', /\bAED\b/g, 'safety'),
  SK('PointClickCare', /\bPointClickCare\b/gi, 'detail'),
  SK('Epic', /\bEpic\b(?= (?:EMR|EHR|system|charting))/g, 'detail'),
  SK('Cerner', /\bCerner\b/gi, 'detail'),
  SK('Meditech', /\bMeditech\b/gi, 'detail'),
  SK('EHR', /\b(?:EHR|EMR)s?\b|\belectronic (?:health|medical) records?\b/gi, 'detail', ['ehr', 'emr', 'ehrs', 'emrs', 'electronic']),
  SK('charting', /\b(?:electronic )?charting\b/gi, 'detail', 'charting'),
  SK('infection prevention and control', /\binfection (?:prevention and control|prevention|control)\b|\bIPAC\b/gi, 'safety', ['infection', 'ipac']),
  SK('mechanical lifts', /\b(?:mechanical|ceiling|Hoyer|sit-to-stand|patient) lifts?\b/gi, 'physical', ['lift', 'lifts']),
  SK('transfer techniques', /\b(?:safe )?transfer techniques\b|\bsafe transfers\b/gi, 'safety', ['transfer', 'transfers']),
  SK('dementia care', /\bdementia(?: care)?\b|\bAlzheimer[’']?s\b/gi, 'care', ['dementia', 'alzheimer']),
  SK('palliative care', /\bpalliative(?: care)?\b|\bend-of-life care\b/gi, 'care', ['palliative', 'end']),
  SK('medication administration', /\bmedication (?:administration|management|pass(?:es)?)\b|\badminister(?:ing)? medications?\b/gi, 'care', ['medication', 'administer', 'administering']),
  SK('vital signs', /\bvital signs\b|\bvitals\b/gi, 'care', ['vital', 'vitals']),
  SK('wound care', /\bwound care\b/gi, 'care', 'wound'),
  SK('phlebotomy', /\bphlebotomy\b/gi, 'care'),
  SK('Registered Nurse', /\bRegistered (?:Practical )?Nurse\b|\b(?:RN|LPN|RPN)\b/g, 'care', ['registered', 'rn', 'lpn', 'rpn']),
  SK('criminal record check', /\bcriminal record check\b|\bvulnerable sector (?:check|screening)\b|\bpolice (?:check|clearance|information check)\b|\bbackground check\b/gi, 'reliability', ['criminal', 'vulnerable', 'police', 'background']),
  SK('TB test', /\bTB (?:test|skin test|screening)\b/gi, 'safety', 'tb'),
  SK('medical terminology', /\bmedical terminology\b/gi, 'detail', 'terminology'),
  SK('HIPAA', /\bHIPAA\b|\bPHIPA\b/g, 'safety', ['hipaa', 'phipa']),
  SK('Non-Violent Crisis Intervention', /\bNon-?Violent Crisis Intervention\b|\bNVCI\b/gi, 'safety', ['violent', 'nvci']),
  SK('Early Childhood Education', /\bEarly Childhood Education\b|\bECE\b/g, 'care', ['childhood', 'ece']),
  SK('lesson planning', /\blesson planning\b/gi, 'organisation', 'lesson'),
  SK('classroom management', /\bclassroom management\b/gi, 'leadership', 'classroom'),
  SK('sign language', /\bASL\b|\b[Ss]ign [Ll]anguage\b/g, 'communication', ['asl', 'sign']),
  // languages
  SK('bilingual', /\bbilingual\b/gi, 'communication'),
  SK('French', /\bFrench\b(?! press| fries| toast| doors?| windows?)/g, 'communication'),
  SK('Spanish', /\bSpanish\b/g, 'communication'),
  SK('Mandarin', /\bMandarin\b/g, 'communication'),
  SK('Cantonese', /\bCantonese\b/g, 'communication'),
  SK('Punjabi', /\bPunjabi\b/g, 'communication'),
  SK('Arabic', /\bArabic\b/g, 'communication'),
  SK('Tagalog', /\bTagalog\b/g, 'communication'),
  SK('Hindi', /\bHindi\b/g, 'communication'),
  SK('Portuguese', /\bPortuguese\b/g, 'communication')
];

/* ---------- section headings ---------- */
const HEADINGS = [
  ['nice', /^(?:nice[- ]to[- ]haves?|bonus(?: points)?|bonus if you have|preferred(?: qualifications| skills| experience)?|assets?|desirable(?: skills| qualifications)?|(?:it'?s )?a plus|pluses|good to have|great to have|even better|extra points|additional assets)$/],
  ['requirements', /^(?:requirements?|qualifications?|minimum qualifications|basic qualifications|required(?: skills| qualifications| experience)?|must[- ]haves?|what you(?:'ll| will) (?:bring|need)|what we(?:'re| are) looking for|what we need|who you are|about you|you have|you are|you(?:'ll| will) have|you bring|your skills|skills(?: and| &) (?:experience|qualifications|abilities)|skills|experience|key skills|(?:the )?ideal candidate|is this you|you might be a fit if|education(?: and experience)?|certifications?)$/],
  ['duties', /^(?:responsibilities|key responsibilities|main responsibilities|your responsibilities|duties|key duties|main duties|duties and responsibilities|what you(?:'ll| will) do|what you(?:'ll| will) be doing|what you(?:'ll| will) work on|day[- ]to[- ]day|a day in the life|a typical day|in this role,? you will|your day|your role|the work|tasks|what the job involves|the job)$/],
  ['role', /^(?:the role|role|about the role|about the job|about this role|about the position|position|position summary|job summary|summary|overview|role overview|the opportunity|opportunity|job description|the position|description)$/],
  ['offer', /^(?:what we offer|we offer|what you(?:'ll| will) get|what'?s in it for you|benefits|perks|perks and benefits|benefits and perks|why work (?:with|for|at) us|why join us|why you'?ll love (?:it|working here)|compensation|compensation and benefits|salary|pay|pay and benefits|wages|our offer|total rewards|rewards)$/],
  ['apply', /^(?:how to apply|to apply|application process|apply|apply now|next steps|interview process|hiring process)$/],
  ['eeo', /^(?:equal opportunity(?: employer)?|equal employment opportunity|diversity(?:,? equity)?(?: and inclusion)?|accessibility|accommodations?|our commitment(?: to inclusion)?)$/],
  ['about', /^(?:about us|about the company|about the team|who we are|our company|the company|company|our story|our mission|our values|our team|about [a-z0-9][\w &'.,-]{1,48})$/]
];
const OUT_KIND = { requirements: 'requirements', duties: 'duties', nice: 'nice', role: 'role', about: 'about', offer: 'offer', apply: 'other', eeo: 'other', other: 'other' };
function headingKind(s) {
  const h = flat(s).replace(/^[#*_\s]+|[#*_\s]+$/g, '').replace(/[:!?.]+$/, '').trim();
  if (!h || h.length > 60) return null;
  for (const [kind, rx] of HEADINGS) if (rx.test(h)) return kind;
  return null;
}
function guessHeadingKind(s) {
  const h = flat(s);
  if (/nice|bonus|plus|prefer|asset|desirable/.test(h)) return 'nice';
  if (/offer|benefit|perk|salary|pay\b|wage|compensation|reward/.test(h)) return 'offer';
  if (/apply|application/.test(h)) return 'apply';
  if (/require|qualif|skill|experience|need|bring|looking for|you are|about you|must|education|certif/.test(h)) return 'requirements';
  if (/do\b|duties|responsib|day|tasks|work on|involve|^you will\b|^you'll\b/.test(h)) return 'duties';
  if (/role|position|summary|overview|opportunity/.test(h)) return 'role';
  if (/about|who we are|company|mission|values|story/.test(h)) return 'about';
  return 'other';
}

/* ---------- cue words for lines without a clear section ---------- */
const CUE = {
  nice: /\b(?:nice[- ]to[- ]have|(?:we'd|we would|would) love|bonus|preferred|preferably|an asset|is an asset|asset but not required|not required|desirable|a plus|is a plus|would be great|is great but|great but we will train|ideally|an advantage|helpful but not|not essential|not necessary|we will train)\b/i,
  exclude: /^(?:help wanted|now hiring|we(?:'|’)re hiring|we are hiring)[.!:]*$|\b(?:we offer|we provide|we pay|pay (?:is |starts at )?(?:weekly|biweekly|bi-weekly|every|\$)|paid (?:weekly|biweekly|bi-weekly|every two weeks)|bonus(?:es)? (?:for|of|after|program)|signing bonus|tip share|tips? (?:and|plus|on top)|free (?:parking|meals?|drinks?|coffee|uniforms?)|staff meals?|has been (?:serving|providing|helping|operating|proudly)|(?:serving|in business|operating|family business|family-owned|family-run|founded)[^.]{0,40}\bsince (?:19|20)\d\d|benefits (?:include|package)|(?:extended|health|full|great|competitive) (?:health )?benefits|perks|staff discount|employee discount|discounts?|tips|salary|wages?|per hour|an hour|hourly|pay range|compensation|pension|vacation|paid time off|dental|apply|applicants?|resumes?|résumé|cover letter|equal opportunit\w*|accommodations? (?:are|is) available|diversity|we are an?|we're an?|is an? (?:fictional|small|leading|growing|family|local|global|well-known|busy|friendly|new|fast-growing)|is home to|an? fictional|our (?:values|mission|story|team of|company|founders?)|founded|headquartered)\b|[$£€]\s?\d/i,
  role: /\b(?:we(?:'re| are) (?:looking for|hiring|seeking)|join (?:our|the) (?:small )?team|is hiring|are hiring|reporting to|reports to)\b/i,
  must: /\b(?:must|we need|someone who (?:can|is|has)|required|requires|requirement|mandatory|essential|you have|you(?:'ll| will)? need|need to|needs to|you should|you are|you're|experience (?:with|in|as|of|using)|\d+\+? years?|ability to|able to|certificat\w*|licen[cs]e\w*|degree|diploma|registered|knowledge of|proficien\w*|familiar\w*|understanding of|comfortable|available|availability|valid|current)\b/i,
  duty: /\b(?:you will|you'll|you would|responsible for|duties include|assist\w*|help\w*|install\w*|greet\w*|process\w*|build\w*|make|making|prepare\w*|serve|serving|clean\w*|maintain\w*|manage\w*|support\w*|handle\w*|take orders|operate\w*|deliver\w*|provide\w*|run|running|monitor\w*|repair\w*|record\w*|answer\w*|work with|working with|keep|keeping|stock\w*|restock\w*|sell\w*|teach\w*|care for|look after|cook\w*|pour\w*)\b/i
};
// Checks and clearances are yes/no gates. They stay requirements but never become questions, lessons or quiz items.
const CHECK = /\b(?:criminal record|vulnerable sector|police (?:check|clearance|record|information check)|security (?:check|clearance|screening)|background (?:check|screening)|references|(?:professional|work|employment|personal|character) reference|reference checks?|drug (?:test|screen)\w*|work permit|eligib\w* to work|legally (?:entitled|eligible|able) to work|right to work|driver[’']?s abstract|driving abstract|driving record|(?:government|medical) clearance)\b/i;
const STRONG_MUST = /\b(?:must|required|requires|mandatory|essential|\d+\+? years?|certificat\w*|licen[cs]e\w*|degree|diploma)\b/i;
const ABBR = /^(?:e\.g|i\.e|etc|st|dr|mr|mrs|ms|no|approx|incl|vs|a\.m|p\.m|jr|sr|inc|ltd|co)$/i;
const BULLET = /^(\s*)(?:[-*•·▪◦‣●■➢➤►✓✔–—]|\d{1,2}[.)]|[a-z][.)])\s*/;

function splitSentences(text, base, out) {
  let s = 0;
  const push = (a, b) => {
    while (a < b && /\s/.test(text[a])) a++;
    while (b > a && /\s/.test(text[b - 1])) b--;
    if (b > a) out.push({ text: text.slice(a, b), start: base + a, end: base + b });
  };
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch !== '.' && ch !== '!' && ch !== '?') continue;
    let j = i + 1;
    while (j < text.length && /[.!?)"”’]/.test(text[j])) j++;
    if (j < text.length && !/\s/.test(text[j])) continue;
    let k = j;
    while (k < text.length && /\s/.test(text[k])) k++;
    if (k < text.length && !/[A-Z0-9“"'(•-]/.test(text[k])) continue;
    const prev = text.slice(s, i).match(/(\S+)$/);
    if (ch === '.' && prev && ABBR.test(prev[1])) continue;
    push(s, j);
    s = k;
    i = k - 1;
  }
  push(s, text.length);
}

/* ---------- reading the ad ---------- */
function readAd(src, company) {
  const lines = [];
  const re = /[^\r\n]+/g;
  let m;
  while ((m = re.exec(src))) {
    const raw = m[0];
    if (!raw.trim()) continue;
    const b = raw.match(BULLET);
    const isBullet = !!b && b[0].trim().length > 0 && raw.slice(b[0].length).trim().length > 0;
    const lead = isBullet ? b[0].length : raw.length - raw.trimStart().length;
    const body = raw.slice(lead).trimEnd();
    lines.push({ text: body, start: m.index + lead, end: m.index + lead + body.length, bullet: isBullet });
  }
  const items = [];
  const sections = [];
  let section = null;
  let current = null;
  let titleLine = null;
  const companyLow = company && company.length >= 3 && !/^company$/i.test(company) ? flat(company) : '';
  const openSection = (kind, title) => { current = { kind: OUT_KIND[kind] || 'other', title: clean(title), lines: [] }; sections.push(current); };
  const classify = (text, sec, bullet) => {
    const low = flat(text);
    if (sec === 'about' || sec === 'offer' || sec === 'apply' || sec === 'eeo') return sec;
    if (sec === 'requirements' || sec === 'duties' || sec === 'nice') {
      if (CUE.nice.test(low)) return 'nice';
      if (!bullet && CUE.exclude.test(low)) return 'offer';
      return sec === 'requirements' ? 'must' : sec === 'duties' ? 'duty' : 'nice';
    }
    if (CUE.exclude.test(low) || (companyLow && (low.startsWith(companyLow + ' ') || low.includes(companyLow + ' is ')))) return 'about';
    if (CUE.nice.test(low)) return 'nice';
    if (CUE.role.test(low)) return 'role';
    // The company talking about itself ("We have served our town for 20 years") is not something they ask of you.
    if (/^(?:we|our)\b/.test(low) && !/\b(?:you|your|need|needs|require\w*|want|expect|looking|seeking|hiring|ask|must|should|someone|candidates?|applicants?|person who|would love|'d love|love to (?:hear|meet|see))\b/.test(low)) return 'about';
    if (sec === 'role' && !STRONG_MUST.test(low)) return CUE.duty.test(low) ? 'duty' : 'role';
    if (CUE.must.test(low)) return 'must';
    if (CUE.duty.test(low)) return 'duty';
    return sec === 'role' || sec === null ? 'role' : 'other';
  };
  lines.forEach((ln, idx) => {
    const text = ln.text;
    if (!ln.bullet) {
      const hk = headingKind(text);
      if (hk) { section = hk; openSection(hk, text.replace(/[:\s]+$/, '')); return; }
      const inl = text.match(/^([A-Za-z][A-Za-z '’&\/-]{1,40}?)\s*:\s*(\S.*)$/);
      if (inl) {
        const ik = headingKind(inl[1]);
        if (ik) {
          section = ik;
          openSection(ik, inl[1]);
          const restStart = ln.start + text.length - inl[2].length;
          current.lines.push(inl[2]);
          const parts = [];
          splitSentences(inl[2], restStart, parts);
          parts.forEach((p) => items.push({ ...p, section: ik, kind: classify(p.text, ik, false), bullet: false }));
          return;
        }
      }
      const wc = countWords(text);
      const next = lines[idx + 1];
      if (/:\s*$/.test(text) && wc <= 6) { section = guessHeadingKind(text); openSection(section, text.replace(/[:\s]+$/, '')); return; }
      if (wc <= 5 && text.length <= 48 && !/[.,;!?()]/.test(text) && next && next.bullet && idx > 0 &&
          text.split(/\s+/).filter((w) => w.length > 3).every((w) => /^[A-Z]/.test(w))) {
        section = guessHeadingKind(text); openSection(section, text); return;
      }
      if (idx === 0 && wc <= 14 && text.length <= 110 && !/[!?]$/.test(text) && (!/\.$/.test(text) || /\b(?:Co|Inc|Ltd|Corp|LLC|Bros)\.$/.test(text)) && !/^(?:we|our|join|are you|looking)\b/i.test(text)) {
        titleLine = ln;
        items.push({ text, start: ln.start, end: ln.end, section: 'title', kind: 'title', bullet: false });
        return;
      }
      if (section === null && wc <= 8 && !/[.!?]$/.test(text) && !CUE.must.test(flat(text)) && !CUE.duty.test(flat(text))) {
        items.push({ text, start: ln.start, end: ln.end, section: 'meta', kind: 'meta', bullet: false });
        return;
      }
    }
    if (!current) openSection(section || 'other', '');
    current.lines.push(text);
    if (ln.bullet) {
      items.push({ text, start: ln.start, end: ln.end, section, kind: classify(text, section, true), bullet: true });
    } else {
      const parts = [];
      splitSentences(text, ln.start, parts);
      parts.forEach((p) => items.push({ ...p, section, kind: classify(p.text, section, false), bullet: false }));
    }
  });
  // A preamble with only company lines is an "about" section; an ad without headings stays "other".
  sections.forEach((s) => {
    if (s.title || s.kind !== 'other') return;
    const own = items.filter((it) => it.section === null);
    if (own.length && own.every((it) => it.kind === 'about' || it.kind === 'meta')) s.kind = 'about';
  });
  return { items, sections: sections.filter((s) => s.lines.length || s.title), titleLine };
}

/* ---------- skills ---------- */
function companyRanges(src, company) {
  const out = [];
  const c = clean(company);
  if (c.length < 3 || /^company$/i.test(c)) return out;
  const low = src.toLowerCase(), key = c.toLowerCase().replace(/\.$/, '');
  for (let i = low.indexOf(key); i >= 0 && out.length < 200; i = low.indexOf(key, i + key.length)) out.push([i, i + key.length]);
  return out;
}
function findSkills(src, items, company) {
  const found = new Map();
  const ranges = [];
  const skip = { about: 1, offer: 1, apply: 1, eeo: 1, meta: 1, title: 1 };
  const own = companyRanges(src, company);
  // A company called "Swift Parcel" or "Square One" also gets called "Swift" or "Square" for short; that is not a skill.
  const coFirst = own.length ? clean(company).toLowerCase().split(/\s+/)[0] : '';
  const eligible = items.filter((it) => !skip[it.kind]);
  const index = new Map();
  for (const it of eligible) {
    for (const tk of new Set(it.text.toLowerCase().match(/[a-z0-9#+]+/g) || [])) {
      let arr = index.get(tk);
      if (!arr) index.set(tk, (arr = []));
      arr.push(it);
    }
  }
  for (const sk of SKILLS) {
    let cands;
    if (sk.tokens) {
      const set = new Set();
      for (const tk of sk.tokens) for (const it of index.get(tk) || []) set.add(it);
      if (!set.size) continue;
      cands = [...set];
    } else cands = eligible;
    for (const it of cands) {
      sk.rx.lastIndex = 0;
      let m;
      while ((m = sk.rx.exec(it.text))) {
        if (m[0].length === 0) { sk.rx.lastIndex++; continue; }
        let text = m[0], off = m.index;
        for (let g = 1; g < m.length; g++) if (m[g]) { text = m[g]; off = m.index + m[0].indexOf(m[g]); break; }
        const start = it.start + off, end = start + text.length;
        if (own.length && (own.some((r) => r[0] < end && start < r[1]) || (coFirst.length > 2 && text.toLowerCase() === coFirst))) continue;
        const taken = it.taken || (it.taken = []);
        if (taken.some((r) => r[0] < end && start < r[1])) continue;
        taken.push([start, end]);
        ranges.push({ start, end });
        (it.skills || (it.skills = [])).push({ name: sk.name, theme: sk.theme, text });
        const w = WEIGHT[it.kind] || 1;
        const prev = found.get(sk.name);
        if (prev) { prev.score += w; if (start < prev.first) { prev.first = start; prev.text = text.replace(/^(?:valid|current)\s+/i, ''); } }
        else found.set(sk.name, { name: sk.name, text: text.replace(/^(?:valid|current)\s+/i, ''), score: w, first: start, theme: sk.theme });
      }
    }
  }
  const list = [...found.values()].sort((a, b) => b.score - a.score || a.first - b.first);
  return { list, ranges };
}

/* ---------- requirement ranking ---------- */
function specificity(it) {
  const t = it.text;
  let s = Math.min(3, (it.skills || []).length);
  if (/\d/.test(t)) s += 0.5;
  if (/\b(?:certif\w*|licen[cs]e\w*|registered|degree|diploma|training|check|seal|ticket)\b/i.test(t)) s += 0.75;
  if (/\byears?\b/i.test(t)) s += 0.5;
  const w = countWords(t);
  if (w >= 5 && w <= 24) s += 0.5; else if (w < 3) s -= 1; else if (w > 40) s -= 0.5;
  return s;
}
const stripBullet = (t) => clean(String(t).replace(BULLET, ''));

/* ---------- keywords ---------- */
const STOP = new Set(('a an the and or of to in on for with at by from as into about our your you we they them their it its this that these those be is are was were will would can could ' +
  'should must may might have has had do does did not no all any each every some more most other such than then so if when while who what which where how up out ' +
  'able ability experience experienced years year strong good great excellent basic including include includes etc also well very help helps helping assist ' +
  'work working works make makes take takes get use using used keep need needs plus ideally preferred required nice bonus asset previous similar related relevant ' +
  'least one two three new team role job position candidate ideal someone person people like within across per day days week weeks month first just even ' +
  'own clear clean simple show shows agree turn take part part s t ll re ve d m willingness current valid certification certificate system during starting within via').split(' '));
// Keywords are whole noun phrases a candidate could naturally say back ("customer feedback", "job sites"):
// a run of words between stopwords and punctuation, with leading verbs and predicate adjectives and trailing
// adverbs, participles and loose adjectives trimmed off. Fragments of skills and schedule words are left to
// the skills and signals.
const KW_LEAD = new Set(('comfortable available able willing eager happy keen ready proficient familiar fluent confident capable responsible ' +
  'long short good strong excellent basic some own new previous current valid clear great various other similar simple small big high low ' +
  'main every each all any many more most right quick friendly patient reliable cheerful positive solid proven relevant related minimum certain ' +
  'pull stay terminate join bring show agree control love enjoy want know get become do go come see let put another sq ft km kg lbs').split(' '));
const KW_TAIL = new Set(('tidy clean safe calm accurate ready busy great welcome preferred required needed reported count move moves well daily early every private public smooth follow help keep make take get use learn stay').split(' '));
const KW_BREAK = new Set(('under over across within through during after before between without per via using including like such up down out off upon toward towards among around near').split(' '));
const KW_NOUN_LY = /^(?:family|supply|assembly|anomaly|ally|rally|reply|july|italy)$/;
const KW_SCHEDULE = /\b(?:evenings?|weekends?|nights?|overnight|holidays?|mornings|schedules?|shifts?|season)\b/;
function findKeywords(items, skillNames, company) {
  const cands = new Map();
  // The company's own name is never a keyword: skip its full name, and its first word when written as a name ("Swift").
  const co = clean(company || '').replace(/\.$/, '').toLowerCase();
  const coName = co.length >= 3 && co !== 'company' ? co : '';
  const coFirst = coName ? coName.split(/\s+/)[0] : '';
  const skillLow = skillNames.map((s) => ' ' + flat(s).replace(/[()]/g, ' ').replace(/\s+/g, ' ').trim() + ' ');
  const nearSkill = (key) => { const k = ' ' + key + ' '; return skillLow.some((s) => s.includes(k) || k.includes(s)); };
  const weakLead = (low) => VERBS.has(low) || KW_LEAD.has(low);
  const weakTail = (low) => KW_TAIL.has(low) || (low.length > 4 && /[^e]ed$/.test(low)) || (/ly$/.test(low) && !KW_NOUN_LY.test(low));
  for (const it of items) {
    const w = it.kind === 'must' ? 3 : it.kind === 'duty' ? 2 : it.kind === 'nice' ? 1.5 : 0;
    if (!w) continue;
    const re = /[A-Za-z][A-Za-z0-9+#'’\/.-]*[A-Za-z0-9+#]|[A-Za-z]|[,;:()!?]|\s(?:and|or|but|-|–|—)\s/g;
    let m, run = [];
    const coAt = [];
    if (coName) { const low = it.text.toLowerCase(); for (let i = low.indexOf(coName); i >= 0 && coAt.length < 20; i = low.indexOf(coName, i + coName.length)) coAt.push([i, i + coName.length]); }
    const flush = () => {
      let a = 0, b = run.length;
      while (a < b && weakLead(run[a].low)) a++;
      while (b > a && weakTail(run[b - 1].low)) b--;
      const seg = run.slice(a, b);
      run = [];
      if (seg.length < 2 || seg.length > 4) return;
      const key = seg.map((x) => x.low).join(' ');
      const textKey = flat(it.text.slice(seg[0].s, seg[seg.length - 1].e));
      if (key.length < 6 || KW_SCHEDULE.test(key) || nearSkill(key) || nearSkill(textKey)) return;
      if (coAt.some((r) => r[0] < seg[seg.length - 1].e && seg[0].s < r[1])) return;
      if (coFirst && coFirst.length > 2 && !STOP.has(coFirst) && seg.some((x) => x.low === coFirst && /^[A-Z]/.test(it.text[x.s]))) return;
      let c = cands.get(key);
      if (!c) cands.set(key, (c = { text: it.text.slice(seg[0].s, seg[seg.length - 1].e), key, score: 0, first: it.start + seg[0].s, n: seg.length, hits: [] }));
      c.score += w;
      c.hits.push({ start: it.start + seg[0].s, end: it.start + seg[seg.length - 1].e });
    };
    while ((m = re.exec(it.text))) {
      const tok = m[0];
      if (!/^[A-Za-z]/.test(tok)) { flush(); continue; }
      const lw = tok.toLowerCase().replace(/[’']s$/, '');
      if (STOP.has(lw) || KW_BREAK.has(lw) || /^\d/.test(lw)) { flush(); continue; }
      run.push({ s: m.index, e: m.index + tok.length, low: tok.toLowerCase().replace(/’/g, "'") });
    }
    flush();
  }
  const sorted = [...cands.values()].sort((a, b) => (b.score + b.n * 0.6) - (a.score + a.n * 0.6) || a.first - b.first);
  const chosen = [];
  for (const c of sorted) {
    if (chosen.length >= 12) break;
    const k = c.key;
    const h0 = c.hits[0];
    if (chosen.some((x) => x.key.includes(k) || k.includes(x.key) || (x.hits[0].start < h0.end && h0.start < x.hits[0].end))) continue;
    chosen.push(c);
  }
  return chosen;
}

/* ---------- signals and seniority ---------- */
const SIGNALS = [
  ['Remote', /\bremote(?:-first| work| within| role| team|ly)?\b/i],
  ['Hybrid', /\bhybrid\b/i],
  ['On-site', /\bon[- ]site\b|\bin[- ]person\b|\bin the office\b|\bjob sites?\b/i],
  ['schedule', null],
  ['Part-time', /\bpart[- ]time\b/i],
  ['Full-time', /\bfull[- ]time\b/i],
  ['Physical work', /\blift(?:ing)?\b[^.]{0,40}\b(?:kg|lbs?|pounds)\b|\bstanding for long|\bon your feet\b|\bladders?\b|\bcrawl spaces?\b|\boutdoors\b|\ball weather\b|\bphysically (?:demanding|active)\b|\bheavy lifting\b|\bmechanical lifts\b/i],
  ['Customer-facing', /\bcustomers?\b(?! orders?\b)|\bclients?\b|\bguests?\b|\bclient-facing\b|\bcustomer-facing\b|\bhomeowners?\b|\bthe public\b|\bshoppers?\b|\bpatrons?\b/i],
  ['Hands-on care', /\bpersonal care\b|\b(?:bathing|dressing|grooming|toileting|feeding|transfer techniques|wound care|vital signs|medications?|patient care|resident care)\b|\bcare (?:for|to) (?:residents|patients|clients|seniors|children)\b/i],
  ['Fast-paced', /\bfast[- ]paced\b|\bbusy\b|\brush\b|\bhigh[- ]volume\b|\bpeak (?:times|hours|season)\b|\bholiday season\b/i],
  ['Driving or travel', /\b(?:driver[’']?s|driving) licen[cs]e\b|\bclass [1-7][a-z]?(?: licen[cs]e)?\b|\byour (?:van|vehicle|truck|car)\b|\bvehicle check\b|\bdriv(?:e|ing) (?:a |the |our |company )?(?:van|vehicle|truck|car|bus)\b|\breliable transportation\b|\bown vehicle\b|\btravel (?:to|between|required|across|within|up to)\b|\bsome travel\b/i],
  ['Training and support', /\bwe will train\b|\bwe train\b|\bwill train\b|\bpaid training\b|\btraining (?:is )?provided\b|\bon-the-job training\b|\bmentoring\b|\blearning (?:budget|stipend)\b|\bpaid (?:school time|education days)\b|\bunder the supervision\b/i],
  ['Certificates or checks', /\bcriminal record check\b|\bvulnerable sector\b|\bpolice check\b|\bcertificat\w+\b|\blicen[cs]e\b|\bregistered (?:apprentice|nurse)\b|\bred seal\b|\bwhmis\b|\bfirst aid\b|\bcpr\b|\bfood ?safe\b|\bsmart ?serve\b/i],
  ['Small team', /\bsmall team\b|\bfamily-run\b|\bsmall, family\b|\bteam of (?:[2-9]|1\d|20)\b/i]
];
const SCHEDULE = [['weekdays', /\bmonday (?:to|through|-|–) friday\b|\bweekdays only\b/i], ['early mornings', /\bearly mornings?\b|\b(?:at|from|by|before) [4-6] ?am\b/i], ['evenings', /\bevenings?\b/i], ['nights', /\bnights\b|\bovernight\b|\bnight shifts?\b/i], ['weekends', /\bweekends?\b|\bsaturdays?\b|\bsundays?\b/i], ['holidays', /\bholidays?\b|\bholiday season\b/i], ['rotating shifts', /\brotating (?:shifts?|schedules?|days|weekends)\b|\bshifts? (?:will )?rotate\b|\bshift work\b/i]];
function findSignals(items) {
  const out = [];
  const eligible = items.filter((it) => it.kind !== 'about');
  const excerpt = (t) => { const c = clean(t); return c.length > 100 ? c.slice(0, 99).replace(/\s+\S*$/, '') + '…' : c; };
  for (const [label, rx] of SIGNALS) {
    if (out.length >= 6) break;
    if (label === 'On-site') {
      const it = eligible.find((x) => rx.test(x.text) && !/\bapply\b/i.test(x.text));
      if (it) out.push({ label, detail: excerpt(it.text) });
      continue;
    }
    if (label === 'schedule') {
      const hits = [];
      let detail = '';
      for (const [name, srx] of SCHEDULE) {
        const it = eligible.find((x) => (x.kind === 'must' || x.kind === 'duty' || x.kind === 'nice' || x.kind === 'role' || x.kind === 'other') && srx.test(x.text));
        if (it) { hits.push(name); if (!detail) detail = excerpt(it.text); }
      }
      if (hits.length) out.push({ label: cap1(joinAnd(hits.slice(0, 3))), detail });
      continue;
    }
    const pool = label === 'Customer-facing' || label === 'Hands-on care' || label === 'Physical work' || label === 'Fast-paced'
      ? eligible.filter((x) => x.kind === 'must' || x.kind === 'duty' || x.kind === 'nice' || x.kind === 'role' || x.kind === 'title')
      : items;
    const it = pool.find((x) => rx.test(x.text));
    if (it) out.push({ label, detail: excerpt(it.text) });
  }
  return out;
}
function titleParts(items, roleText) {
  const parts = [];
  for (const raw of [roleText].concat(items.filter((it) => it.kind === 'title').map((it) => it.text.split(/\s+[–—|·@]\s+|\s+-\s+/)[0]))) {
    const p = clean(raw), low = flat(p);
    if (!p || parts.some((x) => flat(x).includes(low))) continue;
    for (let i = parts.length - 1; i >= 0; i--) if (low.includes(flat(parts[i]))) parts.splice(i, 1);
    parts.push(p);
  }
  return parts;
}
function findSeniority(items, roleText) {
  const parts = titleParts(items, roleText);
  const titleish = parts.join(' · ');
  const said = (m) => (parts.find((x) => x.toLowerCase().includes(m[0].toLowerCase())) || titleish).slice(0, 160);
  const pool = items.filter((it) => it.kind === 'must' || it.kind === 'duty' || it.kind === 'nice' || it.kind === 'role');
  let years = null, yearsEvidence = null;
  for (const it of pool.filter((x) => x.kind === 'must').concat(pool.filter((x) => x.kind !== 'must'))) {
    const m = it.text.match(/\b(\d{1,2})\s*\+?\s*(?:(?:-|–|to)\s*\d{1,2}\s*)?\+?\s*years?\b/i);
    if (m) { years = Math.min(40, parseInt(m[1], 10)); yearsEvidence = clean(it.text).slice(0, 160); break; }
  }
  const t = titleish.match(/\b(?:intern(?:ship)?|apprentice|trainee|junior|jr\.?|entry[- ]level|graduate|new grad|student|co-?op)\b/i);
  if (t) return { level: 'Entry', years, evidence: said(t) };
  const s = titleish.match(/\b(?:senior|sr\.?|principal|staff engineer|expert)\b/i);
  if (s) return { level: 'Senior', years, evidence: said(s) };
  const l = titleish.match(/\b(?:lead|head of|director|supervisor|foreman|forewoman|chief|team leader)\b/i);
  if (l) return { level: 'Lead', years, evidence: said(l) };
  if (years !== null) return { level: years <= 1 ? 'Entry' : years <= 4 ? 'Mid' : 'Senior', years, evidence: yearsEvidence };
  const e = items.find((it) => /\bno experience (?:is )?(?:necessary|required|needed)\b|\bexperience (?:is )?(?:an asset but )?not required\b|\bwe will train\b|\bwill train the right\b|\btraining (?:is )?provided\b|\bentry[- ]level\b|\bnot required\b/i.test(it.text) && it.kind !== 'about');
  if (e) return { level: 'Entry', years: null, evidence: clean(e.text).slice(0, 160) };
  return { level: 'Unknown', years: null, evidence: null };
}

/* ---------- analyze ---------- */
const RELIABLE_CORE = /\b(?:reliab\w*|dependab\w*|punctual\w*|on time|show up|shows up|showing up|attendance|follow(?:s|ing)? through|follow-through|consisten\w*|committed|commitment|trustworth\w*|transportation|criminal record|vulnerable sector|police check|background check|driver'?s licen[cs]e)\b/;
const SCHEDULE_WORDS = /\b(?:availab\w*|shifts?|weekends?|evenings?|nights?|overnight|early mornings?|rotating (?:shifts?|schedules?)|holidays?)\b/;
const LATER_CREDENTIAL = /\bwithin (?:your|the) first\b|\bwilling(?:ness)? to (?:get|obtain)\b|\b(?:must|will need to|able to) obtain\b|\bobtain(?:ed)? (?:within|after|once)\b|\bafter (?:you are )?hired\b/;
const PHYSICAL_CONDITION = /\b(?:standing|on your feet|lift|lifting|kg|kilograms?|lbs?|pounds|heavy|bending|ladders?|crawl spaces?|outdoors?|all weather)\b/;
function analyze(jobText, opts) {
  const src = String(jobText == null ? '' : jobText).slice(0, MAX_JOB);
  const o = opts || {};
  const roleIn = clean(o.role);
  const role = /^new opportunity$/i.test(roleIn) ? '' : roleIn;
  const companyIn = clean(o.company);
  const company = /^company$/i.test(companyIn) ? '' : companyIn;
  const { items, sections } = readAd(src, company);
  const skills = findSkills(src, items, company);

  // Theme scores from what the job asks for, weighted must > duty > nice.
  const scores = Object.fromEntries(THEMES.map((t) => [t.id, 0]));
  const reach = Object.fromEntries(THEMES.map((t) => [t.id, 0]));
  const evid = Object.fromEntries(THEMES.map((t) => [t.id, []]));
  const memo = new Map();
  for (const it of items) {
    const w = WEIGHT[it.kind];
    if (!w) continue;
    const low = flat(it.text);
    it.clean = clean(it.text);
    let base = memo.get(low);
    if (!base) {
      base = {};
      for (const t of THEMES) { const n = countMatches(t.rx, low); if (n) base[t.id] = n; }
      memo.set(low, base);
    }
    const hits = { ...base };
    for (const sk of it.skills || []) hits[sk.theme] = (hits[sk.theme] || 0) + 1;
    it.themeHits = hits;
    it.firstTheme = THEMES.map((t) => t.id).filter((id) => hits[id]).sort((a, b) => hits[b] - hits[a] || THEME_INDEX[a] - THEME_INDEX[b])[0] || null;
    it.cred = isCredential(it.text, (it.skills || []).length);
    it.check = CHECK.test(it.text);
    const sched = hits.reliability && !RELIABLE_CORE.test(low) && SCHEDULE_WORDS.test(low);
    const later = LATER_CREDENTIAL.test(low) ? 0.5 : 1;
    const condition = hits.physical && it.kind === 'must' && PHYSICAL_CONDITION.test(low);
    it.scheduleOnly = !!sched;
    for (const id of Object.keys(hits)) {
      const add = Math.min(2, hits[id]) * w * later * ((id === 'reliability' && sched) ? 0.75 : (id === 'physical' && condition) ? 0.5 : 1);
      scores[id] += add;
      reach[id] += 1;
      if (it.kind !== 'title' && !it.check) evid[id].push({ text: it.clean, add, start: it.start, key: Math.min(2, hits[id]) + (it.firstTheme === id ? 2 : 0) + (it.kind === 'duty' ? 3 : 0) - (it.cred ? 3 : 0) });
    }
  }
  // The job title says a lot about what the work is (a store associate helps customers, a care aide gives care).
  const titleText = clean(role + ' ' + items.filter((it) => it.kind === 'title').map((it) => it.text.split(/\s+[–—|·@]\s+|\s+-\s+/)[0]).join(' '));
  for (const [rx, id] of TITLE_HINTS) if (titleText && rx.test(titleText)) scores[id] += 4;
  const themeList = THEMES.map((t, i) => ({ t, i, score: scores[t.id] + reach[t.id] }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.i - b.i);
  const top = themeList.length ? themeList[0].score : 0;
  const backed = themeList.filter((x) => evid[x.t.id].length);
  const strong = backed.filter((x) => x.score >= Math.max(3, top * 0.15));
  const themes = (strong.length ? strong : backed.slice(0, 1)).slice(0, 6).map((x) => {
    const seen = new Set();
    const evidence = evid[x.t.id].slice().sort((a, b) => b.key - a.key || b.add - a.add || a.start - b.start)
      .map((e) => e.text).filter((e) => { const k = flat(e); if (seen.has(k)) return false; seen.add(k); return true; })
      .slice(0, 3).map((e) => (e.length > 200 ? e.slice(0, 199).replace(/\s+\S*$/, '') + '…' : e));
    return { id: x.t.id, label: x.t.label, score: x.score, evidence, probe: x.t.probe };
  });

  // Requirements: must-haves first, then duties, then nice-to-haves; specific lines rank higher.
  const seen = new Set();
  const counters = {};
  let reqItems = items.filter((it) => it.kind === 'must' || it.kind === 'duty' || it.kind === 'nice');
  if (!reqItems.length) {
    reqItems = items.filter((it) => (it.kind === 'role' || it.kind === 'other') && countWords(it.text) >= 4 && !/https?:|www\.|@/.test(it.text))
      .sort((a, b) => b.text.length - a.text.length || a.start - b.start).slice(0, 6)
      .map((it) => ({ ...it, kind: 'duty', fallback: true }));
  }
  const ranked = [];
  for (const it of reqItems) {
    const text = (it.clean || clean(it.text)).slice(0, 300);
    const key = flat(text);
    if (!key || seen.has(key) || countWords(text) < 2) continue;
    seen.add(key);
    const secKey = (it.section || 'none') + ':' + it.kind;
    const pos = counters[secKey] = (counters[secKey] || 0) + 1;
    const hits = it.themeHits || {};
    const themeIds = Object.keys(hits).sort((a, b) => hits[b] - hits[a] || THEMES.findIndex((t) => t.id === a) - THEMES.findIndex((t) => t.id === b)).slice(0, 3);
    const score = KIND_BASE[it.kind] + specificity(it) + Math.max(0, 0.6 - (pos - 1) * 0.1) - (it.section === 'role' ? 2 : 0);
    ranked.push({ text, kind: it.kind, themes: themeIds, score: Math.round(score * 100) / 100, start: it.start, _skills: (it.skills || []).map((s) => s.text),
      _tech: (it.skills || []).filter((s) => s.theme === 'technical' && !/seal|ticket|certif|licen/i.test(s.name)).map((s) => s.text), _hits: hits, _cred: !!it.cred, _sched: !!it.scheduleOnly, _fallback: !!it.fallback, _check: !!it.check });
  }
  ranked.sort((a, b) => b.score - a.score || a.start - b.start);
  // Keep room for up to two nice-to-haves in the top 12, after every must-have and duty that fits.
  const niceRanked = ranked.filter((r) => r.kind === 'nice');
  const coreRanked = ranked.filter((r) => r.kind !== 'nice');
  const topReq = coreRanked.slice(0, 12 - Math.min(2, niceRanked.length)).concat(niceRanked).slice(0, 12);

  const keywordList = findKeywords(items.filter((it) => !CHECK.test(it.text)), skills.list.map((s) => s.text), company);

  // Highlights: must and nice lines, then keywords, then skills on top; flattened into sorted, non-overlapping ranges.
  const paint = new Uint8Array(src.length);
  const KINDS = [null, 'must', 'nice', 'keyword', 'skill'];
  for (const it of items) {
    const code = it.kind === 'must' ? 1 : it.kind === 'nice' ? 2 : 0;
    if (code) paint.fill(code, it.start, it.end);
  }
  for (const r of skills.ranges) if (!CHECK.test(src.slice(r.start, r.end))) paint.fill(4, r.start, r.end);
  for (const k of keywordList) {
    for (const h of k.hits) {
      let clash = false;
      for (let i = h.start; i < h.end && !clash; i++) clash = paint[i] === 4;
      if (!clash) paint.fill(3, h.start, h.end);
    }
  }
  const highlights = [];
  for (let i = 0; i < paint.length;) {
    const c = paint[i];
    let j = i + 1;
    while (j < paint.length && paint[j] === c) j++;
    if (c) highlights.push({ start: i, end: j, kind: KINDS[c] });
    i = j;
  }

  const signals = findSignals(items);
  const seniority = findSeniority(items, role);

  return {
    version: 1,
    words: countWords(src),
    sections: sections.map((s) => ({ kind: s.kind, title: s.title, lines: s.lines.map((l) => clean(l)) })),
    requirements: topReq.map((r) => ({ text: r.text, kind: r.kind, themes: r.themes, score: r.score })),
    themes,
    skills: skills.list.filter((s) => !CHECK.test(s.text)).slice(0, 12).map((s) => s.text),
    keywords: keywordList.filter((k) => !CHECK.test(k.text)).map((k) => clean(k.text)),
    seniority,
    signals,
    highlights,
    _ranked: ranked,
    _items: items,
    _scores: Object.fromEntries(themeList.map((x) => [x.t.id, x.score]))
  };
}

/* ---------- writing helpers for questions and lessons ---------- */
const VERBS = new Set(('assist help greet process keep receive share install repair read run troubleshoot talk build turn write take improve own monitor resolve provide observe record ' +
  'follow encourage make prepare serve clean maintain manage support handle operate deliver answer stock restock sell teach care cook pour drive load unload pack sort check ' +
  'test design develop create plan organise organize coordinate lead train mentor work ensure identify review update schedule book collect respond communicate explain document ' +
  'set open close count measure cut lift move transport wash sweep mop file enter track analyse analyze report present negotiate research assess evaluate administer give ' +
  'collaborate partner participate contribute attend act use apply inspect diagnose fix replace assemble paint guide welcome seat host recommend price label unpack rotate ' +
  'be greet visit drive support prepare protect respond complete perform conduct oversee calm book confirm pick ship fill prep stay plate vacuum dust empty wipe stack scan carry fold iron scrub polish garnish bake grill fry chop slice ' +
  'dice brew blend shelve tidy wrap mount sand drill weld supervise coach tutor type invoice reconcile deposit bathe feed transfer reposition accompany ' +
  'escort guard patrol lock unlock liaise upsell promote demonstrate advise investigate debug deploy refactor optimise optimize draft edit proofread ' +
  'translate interpret motivate engage dispatch gather').split(' '));
const NOUN_START = /^(?:a|an|the|our|your|their|all|any|some|this|these|those|each|every|general|various|other|daily|weekly|monthly|[a-z]+ing)\b/i;
// Everyday tools read better with an article ("a multimeter"); names, plurals and mass nouns do not need one.
function withArticle(s) {
  if (!/^[a-z]/.test(s) || /s$/.test(s) || /\b(?:code|conduit|wiring|wire|data|software|equipment|safety|care|control|charting|accessibility|protection)$/.test(s)) return s;
  return (/^[aeiou]/.test(s) ? 'an ' : 'a ') + s;
}
function trimTail(t) { return t.replace(/[\s.;:,!?–—-]+$/, ''); }
function niceCore(t) {
  // "Confident on the phone; Dentrix or another practice system is a plus": the plus is the last part.
  const parts = String(t).split(/;\s+/);
  if (parts.length > 1 && CUE.nice.test(parts[parts.length - 1])) t = parts[parts.length - 1];
  return trimTail(t.replace(/\s+(?:is|are|would be|will be)\s+(?:preferred|an asset|a plus|great|nice|desirable|helpful|an advantage|a bonus|welcome|nice to have)\b.*$/i, '')
    .replace(/^(?:nice to have|bonus|preferred|ideally|a plus)\s*[:,-]\s*/i, ''));
}
function quoteText(t, max) {
  let q = clean(t);
  const noParen = q.replace(/\s*\([^)]*\)\s*[.;:,!?]*$/, '');
  if (countWords(noParen) >= 3) q = noParen;
  q = trimTail(q);
  const colon = q.indexOf(': ');
  if (colon > 0 && countWords(q.slice(0, colon)) >= 3 && q.length > 70) q = q.slice(0, colon);
  if (q.length > max) {
    const cuts = [/,\s(?:including|such as|even|especially|ideally|and|or|with|while)\b/i, /\s[–—-]\s/, /;\s/, /,\s/];
    for (const c of cuts) {
      const i = q.search(c);
      if (i >= 18 && i <= max) { q = q.slice(0, i); break; }
    }
    if (q.length > max) q = q.slice(0, max).replace(/\s+\S*$/, '') + '…';
  }
  return trimTail(q.endsWith('…') ? q.slice(0, -1) : q) + (q.endsWith('…') ? '…' : '');
}
function lcFirst(t, keep) {
  const m = t.match(/^([A-Z][a-z'’]*)(?=\s|$|[,;:])(?:\s+(\S+))?/);
  if (!m) return t;
  const w = m[1], next = m[2] || '';
  if (w === 'I' || keep.has(w.toLowerCase())) return t;
  if (/^[A-Z][a-z]/.test(next) && !VERBS.has(w.toLowerCase()) && !/^(?:a|an|the|some|good|strong|excellent|basic|current|valid|clear|previous|experience|knowledge|confidence|familiarity|able|comfortable|available)$/i.test(w)) return t;
  return w[0].toLowerCase() + t.slice(1);
}
function dutyPhrase(text) { return text.replace(/^(?:you will|you'll|you’ll|will|to)\s+/i, ''); }
function isVerbStart(t) { const w = (t.match(/^[A-Za-z]+/) || [''])[0].toLowerCase(); return VERBS.has(w); }
function isSentence(t) { return /^(?:you|we|our|they|this|the successful)\b/i.test(t) || /\b(?:is|are|will|should|must|need|needs|can)\b/i.test(t); }

/* Role and company, only used when the person left those fields empty. */
const NOT_COMPANY = /^(?:(?:night|day|evening|weekend|morning|overnight|afternoon|graveyard)s?(?: shifts?)?|.*\bshifts?\b.*|part[- ]time|full[- ]time|remote|hybrid|on[- ]site|contract|temporary|temp|seasonal|casual|permanent|internship|co-?op|summer)$/i;
const ROLE_ADJ = /^(?:cheerful|friendly|motivated|reliable|experienced|enthusiastic|passionate|hard-?working|part-time|full-time|new|great|talented|positive|energetic|skilled|dedicated|caring|organized|organised|detail-oriented|outgoing|keen|qualified)$/i;
const HIRING_WORDS = /^(?:help wanted|now hiring|hiring|we(?:'|’)re hiring|we are hiring|job opening|job posting|job opportunity)$/i;
function guessNames(a) {
  let role = '', company = '';
  const title = a._items.find((it) => it.kind === 'title');
  if (title) {
    const parts = title.text.split(/\s+[–—|·@]\s+|\s+-\s+|\s+at\s+/);
    role = clean(parts[0]);
    if (parts[1] && !NOT_COMPANY.test(clean(parts[1]))) company = clean(parts[1].replace(/\s*\([^)]*\)/g, ''));
    // "Help Wanted – Cashier": the second part is the job, not the company.
    if (HIRING_WORDS.test(role)) { role = parts[1] && !NOT_COMPANY.test(clean(parts[1])) ? clean(parts[1]) : ''; company = parts[2] ? clean(parts[2].replace(/\s*\([^)]*\)/g, '')) : ''; }
  }
  const cue = a._items.find((it) => /\b(?:hiring|looking for|seeking)\b/i.test(it.text));
  if (!role && cue) {
    const m = cue.text.match(/\b(?:hiring|looking for|seeking)\s+(?:an?\s+)?((?:[A-Z][\w\/&+-]*\s+){0,4}[A-Z][\w\/&+-]*)/);
    if (m && !/^(?:You|We|Our|The|This)$/.test(m[1])) role = m[1];
    else {
      const w = cue.text.match(/\b(?:hiring|looking for|seeking)\s+(?:an?\s+)?((?:[a-z][\w-]*\s+){0,4}?)([a-z][a-z-]+(?:\s+[a-z][a-z-]+)?)\s+(?:to|who|for|at|with|that|in)\b/);
      const ws = w ? (w[1] + ' ' + w[2]).split(/\s+/).filter(Boolean) : [];
      while (ws.length > 1 && ROLE_ADJ.test(ws[0])) ws.shift();
      if (ws.length && ws.length <= 2 && !ws.some((x) => ROLE_ADJ.test(x)) && !/^(?:person|people|someone|individual|candidate|you|help)$/.test(ws[0])) role = cap1(ws.join(' '));
    }
  }
  if (!company) {
    const about = a.sections.find((s) => s.kind === 'about' && /^about\s+/i.test(s.title) && !/^about\s+(?:us|the|you|this|our)\b/i.test(s.title));
    if (about) company = clean(about.title.replace(/^about\s+/i, ''));
    else if (cue) { const m = cue.text.match(/\bat ((?:[A-Z][\w&'’.-]*\s?){1,5})/); if (m) company = clean(m[1]); }
    if (!company) {
      for (const it of a._items.slice(0, 8)) {
        const m = it.text.match(/^((?:(?:[A-Z][\w'’.-]*|&)\s+){0,4}[A-Z][\w'’.-]*)\s+(?:\([^)]*\)\s+)?(?:(?:is|are)\s+(?:a|an)\b|ha(?:s|ve) been\b)/);
        if (m && !/^(?:This|The|It|We|Our|You|Your|There|Here)\b/.test(m[1])) { company = clean(m[1]); break; }
      }
    }
  }
  if (role) role = role.replace(/\s+(?:needed|wanted|required)\b.*$/i, '');
  if (!role) {
    const first = a._items.find((it) => it.kind !== 'about' && !HIRING_WORDS.test(clean(it.text).replace(/[.!:]+$/, '')));
    const w = first && first.text.match(/^([A-Z][a-z-]+(?:\s+[a-z-]+)?)\s+(?:wanted|needed|for)\b/);
    const h = a._items.map((it) => it.text).join(' ').match(/\b(?:now hiring|hiring)\s*:?\s+(?:an?\s+)?([a-z][a-z-]+(?:\s+[a-z][a-z-]+)?)\s*[.!,]/i);
    const pick = w ? w[1] : h ? h[1] : '';
    if (pick && !/^(?:help|staff|people|someone|workers?|you|we)\b/i.test(pick)) role = cap1(pick);
  }
  const ok = (s) => s && s.length <= 80 && countWords(s) <= 8 && !/[!?]$/.test(s) && (!/\.$/.test(s) || /\b(?:Co|Inc|Ltd|Corp|Bros|LLC|Ltée)\.$/.test(s));
  return { role: ok(role) ? role.slice(0, 120) : '', company: ok(company) ? company.slice(0, 120) : '' };
}

/* ---------- create ---------- */
function stageLesson(s) {
  return ({
    Technical: 'Expect to show how you do the work: talk through your steps, the tools you use and how you check the result. It is fine to say what you do not know yet and how you would find out.',
    Panel: 'You may meet a few people at once. Answer the person who asked, then look around to include everyone. Short, real examples work best.',
    Final: 'The final talk is about fit both ways: your examples, why you want this job and what you need to do well. Never invent facts about the employer.',
    Screening: 'A first call is usually short: a quick introduction, why this job, your availability and one or two examples. Have your questions ready too.'
  })[s] || 'Most interviews ask for a short introduction, a few real examples and your questions. If you can, ask what the next interview will cover.';
}
function stageTitle(s) {
  return ({ Technical: 'Get ready to show how you work', Panel: 'Get ready for a panel', Final: 'Get ready for the final interview', Screening: 'Get ready for a short first call' })[s] || 'Get ready for any interview';
}
function expTip(exp) {
  return ({
    'Early career': 'Examples from school, volunteering, sports, family or part-time work all count.',
    'Career change': 'Use a real moment from a past job, even in a different field, and say what carries over. Volunteering, sports and family life count too.',
    Experienced: 'Pick a recent, specific example and say what you personally did.'
  })[exp] || 'Any real example counts: work, school, volunteering or everyday life.';
}
function focusTip(focus) {
  return ({
    'Role skills': ' Name the tools or steps you used and how you checked the result.',
    'Concise answers': ' Keep it to about four sentences, or one minute out loud.',
    Confidence: ' Say it out loud once. It is fine to pause and think before you answer.'
  })[focus] || '';
}

function create(input) {
  input = input || {};
  const job = String(input.job || '').trim().slice(0, MAX_JOB);
  if (job.length < 40) throw Error('Paste at least 40 characters from the actual job ad.');
  const intake = { experience: 'Prefer not to say', stage: 'Not sure yet', focus: 'Balanced', time: '30 minutes', ...input.intake };
  const exp = String(intake.experience || ''), stage = String(intake.stage || ''), focus = String(intake.focus || '');
  const minutes = parseInt(intake.time, 10) || 30;

  const guess = String(input.role || '').trim() && String(input.company || '').trim() ? { role: '', company: '' } : guessNames(analyze(job, {}));
  const role = String(input.role || '').trim().slice(0, 120) || guess.role || 'New opportunity';
  const company = String(input.company || '').trim().slice(0, 120) || guess.company || 'Company';
  const a = analyze(job, { role, company });
  const ranked = a._ranked;

  let requirements = ranked.slice(0, 8).map((r) => r.text.slice(0, 300));
  if (!requirements.length) {
    const longest = [];
    splitSentences(job.replace(/\s+/g, ' '), 0, longest);
    requirements = longest.map((p) => p.text).filter((t) => countWords(t) >= 3).sort((x, y) => y.length - x.length).slice(0, 3).map((t) => t.slice(0, 300));
    if (!requirements.length) requirements.push(job.slice(0, 300));
  }

  const keep = new Set(a.skills.map((s) => s.toLowerCase().split(/\s+/)[0]).concat(['english', 'french', 'spanish', 'red', 'food', 'first', 'google', 'microsoft']));
  const roleShort = /^new opportunity$/i.test(role) ? '' : clean(role.replace(/\s*\([^)]*\)/g, '').replace(/\s+[–—|·]\s+.*$/, ''));
  const jobName = roleShort ? `the ${roleShort} job` : 'this job';
  const at = /^company$/i.test(company) ? '' : ` at ${company}`;
  const seed = fnv(job.slice(0, 4000) + job.length);
  const used = new Set();
  const people = (() => {
    const P = [['resident', /\bresidents?\b/gi], ['patient', /\bpatients?\b/gi], ['guest', /\bguests?\b/gi], ['customer', /\bcustomers?\b/gi], ['client', /\bclients?\b/gi], ['homeowner', /\bhomeowners?\b/gi], ['child', /\bchild(?:ren)?\b|\bkids?\b/gi], ['student', /\bstudents?\b/gi], ['user', /\busers?\b/gi]];
    const txt = a._items.filter((it) => WEIGHT[it.kind]).map((it) => it.text).join(' ');
    let best = 'customer', bestN = 0;
    for (const [name, rx] of P) { const n = countMatches(rx, txt); if (n > bestN) { best = name; bestN = n; } }
    return best;
  })();
  const techAll = ranked.reduce((acc, r) => acc.concat(r._tech.filter((x) => !acc.includes(x))), []);
  const cashJob = /\b(?:cash|till|register|pos|money|payments?|tips)\b/i.test(job);
  const fill = (s, r) => s.replace(/\{person\}/g, people).replace(/refuses care they need/, /^(?:student|child)$/.test(people) ? 'refuses help they need' : 'refuses care they need')
    .replace(/\{skills\}/g, joinAnd((r && r._tech.length ? r._tech : techAll).slice(0, 2).map(withArticle)) || 'a tool or skill from this job');
  const storyOf = (id, r) => fill(id === 'numbers' && cashJob ? THEME.numbers.storyCash : THEME[id].story, r);

  // The ad line that best hooks a story for an area: duties and plain must-haves, not certificates.
  const byTheme = (id, kinds) => {
    let best = null, bestScore = 0;
    for (const r of ranked) {
      if (used.has(r.text) || !kinds.includes(r.kind) || r._check) continue;
      const h = r._hits[id] || 0;
      const firstIs = r.themes[0] === id;
      if (!h || (!firstIs && h < 2)) continue;
      let sc = Math.min(3, h) + (firstIs ? 3 : 0) + (r.kind === 'duty' ? 2 : 0) + (r.kind === 'must' && !r._cred ? 1 : 0);
      if (r._cred && !['safety', 'learning', 'technical'].includes(id)) continue;
      if (id === 'reliability' && r._sched) sc -= 2;
      if (sc > bestScore) { best = r; bestScore = sc; }
    }
    return best;
  };
  const ADJ_START = /^(?:able|comfortable|available|friendly|reliable|willing|eager|patient|organi[sz]ed|detail-oriented|flexible|happy|keen|confident|fluent|passionate|motivated|calm|punctual|physically|proficient|familiar|knowledgeable|skilled|outgoing|positive|respectful|honest|dependable|curious|good at|great at)\b/i;
  // A long duty line lists several tasks; quote the one that fits the area being asked about.
  const clauseFor = (text, id) => {
    const t = dutyPhrase(clean(text));
    if (!id || !THEME[id] || t.length <= 105) return t;
    const parts = t.split(/,\s+(?:and\s+)?|;\s+/);
    for (let i = 0; i < parts.length && parts.length > 1; i++) {
      const rx = THEME[id].rx;
      rx.lastIndex = 0;
      const hit = rx.test(flat(parts[i]));
      rx.lastIndex = 0;
      if (hit && isVerbStart(parts[i]) && countWords(parts[i]) >= 3) return trimTail(parts[i]);
    }
    return t;
  };
  const dutyLead = (d) => isVerbStart(d) ? `Part of this job is to “${d}”.`
    : (NOUN_START.test(d) || /^[A-Z]/.test(d)) ? `This job involves “${d}”.` : `The ad lists this task: “${d}”.`;
  const lead = (r, max, id) => {
    if (r._fallback) return `The ad says “${quoteText(r.text, max)}”.`;
    if (r.kind === 'duty') return dutyLead(lcFirst(quoteText(clauseFor(r.text, id), max), keep));
    const q = lcFirst(quoteText(r.kind === 'nice' ? niceCore(r.text) : r.text, max), keep);
    if (ADJ_START.test(q)) return `The ad says you should be “${q}”.`;
    return isSentence(q) ? `The ad says “${q}”.` : `The ad asks for “${q}”.`;
  };
  const themeIds = a.themes.map((t) => t.id);
  const fallbackThemes = ['communication', 'teamwork', 'problem', 'learning', 'reliability'].filter((id) => !themeIds.includes(id));
  const areaIds = themeIds.concat(fallbackThemes);

  const questions = [];
  const info = [];
  const add = (q, meta) => { questions.push(q.replace(/\s+/g, ' ').trim()); info.push(meta); };
  const target = minutes <= 15 ? 8 : minutes >= 60 ? 10 : 9;

  // 1. Motivation
  const motivation = exp === 'Career change'
    ? `What made you want to move into this kind of work, and what from your past jobs will help you in ${jobName}?`
    : exp === 'Early career'
      ? `What made you want to apply for ${jobName}${at}, and what have you done so far, at school, work or elsewhere, that prepared you?`
      : `What made you want to apply for ${jobName}${at}, and why do you think it suits you?`;
  add(motivation, { kind: 'motivation', theme: null, source: null,
    probe: 'They want to hear real reasons that connect you to this job, not a memorised speech.',
    include: ['Something specific in the ad that appeals to you', exp === 'Career change' ? 'What carries over from your past work' : 'A real experience that pointed you here', 'What you hope to learn or give'] });

  // Screening calls nearly always ask about availability: ask it plainly, quoting the ad.
  const avail = stage === 'Screening' ? ranked.find((r) => (r.kind === 'must' || r.kind === 'duty') && /\b(?:available|availability|evenings?|weekends?|nights?|shifts?|mornings?|schedule)\b/i.test(r.text)) : null;
  if (avail) {
    used.add(avail.text);
    add(`${lead(avail, 110)} What does your availability look like?`, { kind: 'role', theme: 'reliability', source: avail.text,
      probe: 'They want a clear, honest answer about when you can work.', include: ['The days and times you can work', 'Anything that might limit you, said plainly', 'How you make sure you show up on time'] });
  }
  const extraRole = stage === 'Technical' || focus === 'Role skills' ? 1 : 0;
  const extras = extraRole + (avail ? 1 : 0) + (stage === 'Final' ? 1 : 0);

  // 2. Behavioural, one per top area, quoting the real requirement
  const behaviouralCount = Math.max(2, Math.min(4, target - 5 - extras));
  const behaviouralThemes = [];
  for (const id of areaIds) {
    if (behaviouralThemes.length >= behaviouralCount) break;
    const t = THEME[id];
    const r = byTheme(id, ['must', 'duty']);
    behaviouralThemes.push(id);
    if (r) used.add(r.text);
    if (r && id === 'reliability' && r._sched) {
      add(`${lead(r, 105, id)} How would that schedule work for you, and how do you make sure people can count on you?`, { kind: 'behavioural', theme: id, source: r.text, probe: t.probe,
        include: ['The days and times you can work, said plainly', 'How you make sure you are on time and ready', 'A time someone counted on you and you came through'] });
      continue;
    }
    const stem = storyOf(id, r);
    add(r ? `${lead(r, 105, id)} ${stem}` : stem, { kind: 'behavioural', theme: id, source: r ? r.text : null, probe: t.probe, include: t.include.slice() });
  }

  // 3. Role-specific: the line with the most skills or tools, "walk me through"
  const askable = (r) => !r._check && !(r._cred && (CRED.test(r.text) || !r._skills.length || r._hits.safety));
  const roleLines = ranked.filter((r) => (r.kind === 'duty' || r.kind === 'must') && !used.has(r.text) && askable(r));
  const roleRank = (r) => (r.kind === 'duty' && r._skills.length ? 0 : r.kind === 'must' && r._skills.length ? 1 : r.kind === 'duty' ? 2 : 3);
  const skillLine = roleLines.slice().sort((x, y) => roleRank(x) - roleRank(y) || y._skills.length - x._skills.length || y.score - x.score || x.start - y.start)[0];
  const roleQuestion = (r) => {
    const theme = r.themes.includes('technical') ? 'technical' : r.themes[0] || 'technical';
    used.add(r.text);
    let q;
    if (r.kind === 'duty') {
      const d = lcFirst(quoteText(dutyPhrase(r.text), 110), keep);
      q = isVerbStart(d) ? `Walk me through how you would “${d}”, step by step.`
        : (NOUN_START.test(d) || /^[A-Z]/.test(d)) ? `Walk me through how you would handle “${d}”, step by step.` : `Walk me through this task from the ad, step by step: “${d}”.`;
    } else if (r._skills.length) {
      q = `${lead(r, 100)} Tell me how you have used or learned ${r._skills.length > 1 ? 'these' : 'this'}, with a real example.`;
      add(q, { kind: 'role', theme, source: r.text, probe: 'They want to hear what you have really done with these tools or skills, or how quickly you could learn them.',
        include: ['Which of these you have used, and for what', 'One real example, step by step', 'How you would learn the rest'] });
      return;
    } else {
      q = `${lead(r, 100)} What would that look like for you on a normal day?`;
    }
    add(q, { kind: 'role', theme, source: r.text, probe: 'They want to hear how you would actually do the work, step by step, and how you would check it is right.',
      include: ['The steps you would take, in order', 'Any tools, checks or rules you would use', 'A time you did something similar, if you have one'] });
  };
  if (skillLine) roleQuestion(skillLine);
  if (extraRole) {
    const second = ranked.filter((r) => (r.kind === 'duty' || r.kind === 'must') && !used.has(r.text) && askable(r)).sort((x, y) => roleRank(x) - roleRank(y) || y._skills.length - x._skills.length || y.score - x.score || x.start - y.start)[0];
    if (second) roleQuestion(second);
  }

  // 4. Situational, on an area not covered yet
  const situational = (id) => {
    const t = THEME[id];
    const scene = id === 'numbers' && /\b(?:cash|till|register|pos)\b/i.test(job) ? t.sceneCash : t.scene;
    add(fill(scene), { kind: 'situational', theme: id, source: null, probe: t.probe,
      include: ['What you would do first, and why', 'Who you would tell or ask for help', 'How you would make sure it goes better next time'] });
  };
  // The "what would you do" question goes where it matters most for this job: care work, the cash drawer,
  // safety on site, or else the main area.
  const sitFirst = themeIds[0] === 'care' ? 'care'
    : cashJob && themeIds.slice(0, 5).includes('numbers') && /\b(?:cash|till|register|pos)\b/i.test(job) ? 'numbers'
      : themeIds.slice(0, 3).includes('safety') ? 'safety'
        : themeIds[0] || 'pressure';
  situational(sitFirst);
  if (stage === 'Final') {
    add(`What would you focus on in your first few weeks in ${jobName}?`, { kind: 'situational', theme: themeIds.includes('organisation') ? 'organisation' : (themeIds[0] || null), source: null,
      probe: 'They want to hear that you would learn the basics first, ask good questions and settle in well.', include: ['What you would learn first', 'Who you would get to know', 'One early way you could help'] });
  }

  // 5. Gap or stretch, from a nice-to-have
  const nice = ranked.filter((r) => r.kind === 'nice' && !used.has(r.text) && !r._check && countWords(niceCore(r.text)) >= 2).sort((x, y) => y._skills.length - x._skills.length || y.score - x.score || x.start - y.start)[0];
  if (nice) {
    used.add(nice.text);
    const core = lcFirst(quoteText(niceCore(nice.text), 100), keep);
    const credential = CRED.test(nice.text) && countWords(core) <= 6;
    add(credential
      ? `The ad says “${core}” would be a plus. If you do not have it yet, how would you go about getting it?`
      : `The ad says “${core}” would be a plus. If that is new to you, how would you get up to speed?`, { kind: 'gap', theme: nice.themes[0] || 'learning', source: nice.text,
      probe: 'They want to hear that you are honest about what you have not done yet and have a real plan to learn it.',
      include: credential ? ['Whether you have it now, said honestly', 'Where and when you could get it', 'Anything related you already know'] : ['Where you are now, said honestly', 'Anything related that carries over', 'A clear first step to learn it'] });
  } else {
    add(`Which part of ${jobName} would be newest to you, and how would you get up to speed?`, { kind: 'gap', theme: 'learning', source: null,
      probe: 'They want to hear that you are honest about what you have not done yet and have a real plan to learn it.',
      include: ['The part that is newest to you', 'Anything related that carries over', 'A clear first step to learn it'] });
  }

  // 6. Fill up to the target with more areas, then close
  let extra = 0;
  while (questions.length < target - 1 && extra < 6) {
    extra++;
    const nextBeh = areaIds.find((id) => !behaviouralThemes.includes(id) && id !== sitFirst);
    if (nextBeh && (extra % 2 === 1)) {
      const t = THEME[nextBeh];
      const r = byTheme(nextBeh, ['must', 'duty']);
      behaviouralThemes.push(nextBeh);
      if (r) used.add(r.text);
      add(r ? `${lead(r, 105, nextBeh)} ${storyOf(nextBeh, r)}` : storyOf(nextBeh, r), { kind: 'behavioural', theme: nextBeh, source: r ? r.text : null, probe: t.probe, include: t.include.slice() });
      continue;
    }
    const nextSit = areaIds.find((id) => id !== sitFirst && !info.some((x) => x.kind === 'situational' && x.theme === id) && !behaviouralThemes.includes(id))
      || areaIds.find((id) => !info.some((x) => x.kind === 'situational' && x.theme === id));
    if (nextSit) situational(nextSit);
  }
  // A short duty that starts with a verb makes a natural question to ask ("How do new people learn to ...?").
  const closeDuty = ranked.filter((r) => r.kind === 'duty').sort((x, y) => (dutyPhrase(x.text).length <= 60 ? 0 : 1) - (dutyPhrase(y.text).length <= 60 ? 0 : 1) || y.score - x.score || x.start - y.start)[0];
  const closeTask = (() => {
    if (!closeDuty) return '';
    const d = lcFirst(quoteText(dutyPhrase(closeDuty.text), 60), keep);
    return d && !d.endsWith('…') && isVerbStart(d) && countWords(d) >= 2 ? d : '';
  })();
  add('What questions would you like to ask about the job or the team?', { kind: 'closing', theme: null, source: null,
    probe: 'They want to see that you are curious about doing the job well.',
    include: ['What does a great first month look like in this job?', 'How does training or support work for new people?', closeTask ? `How do new people learn to ${closeTask}?` : 'What does a normal day or shift look like?'] });

  // Lessons: short, plain and built around the top areas and must-haves.
  const tip = expTip(exp);
  const topLabels = a.themes.slice(0, 3).map((t) => t.label.toLowerCase());
  const plainLine = (ranked.find((r) => !r._check) || {}).text || '';
  const leadLine = (a.themes[0] && a.themes[0].evidence[0]) || plainLine;
  const course = [];
  course.push({ title: 'What this job is really about', minutes: 5,
    body: `${topLabels.length > 1 ? `This ad keeps coming back to ${topLabels.length === 2 ? 'two' : 'three'} areas: ${topLabels.join('; ')}.` : topLabels.length ? `This ad keeps coming back to one area: ${topLabels[0]}.` : 'Start with what the ad asks for most.'}${leadLine ? ` The ad says “${quoteText(leadLine, 150)}”.` : ''}\nYour answers should keep pointing back to these. You do not need to be perfect at all of them: real examples of a few go a long way.`,
    exercise: 'Say in one sentence what this job is for and who it helps. Then write down one true example from your life for each area above.', done: false });
  const lessonThemes = a.themes.slice(0, 3);
  for (const t of lessonThemes) {
    const cat = THEME[t.id];
    const ev = t.evidence[0];
    const evItem = ev && ev.length > 140 ? ranked.find((r) => r.kind === 'duty' && clean(r.text) === ev) : null;
    const evText = evItem ? dutyLead(lcFirst(quoteText(clauseFor(evItem.text, t.id), 140), keep)) : ev ? `The ad says “${quoteText(ev, 140)}”.` : '';
    course.push({ title: t.label, minutes: 5, theme: t.id,
      body: `${cat.probe}${evText ? ' ' + evText : ''}\n${tip}`,
      exercise: `Write a short story using Situation, Task, Action, Result (STAR): where you were, what needed doing, what you did and how it turned out. Include: ${cat.include.map((s) => s.toLowerCase()).join('; ')}.${focusTip(focus)}`, done: false });
  }
  const musts = ranked.filter((r) => r.kind === 'must');
  const plainMusts = musts.filter((r) => !r._check);
  if (musts.length) {
    course.push({ title: 'Check the must-haves', minutes: 5,
      body: `The ad lists ${musts.length === 1 ? 'one thing it needs' : musts.length + ' things it needs'}${plainMusts.length ? `, such as “${quoteText(plainMusts[0].text, 140)}”` : ''}.\nFor each one, know where you got it or how you show it. If one is missing, say so honestly and explain how you are working on it. That is a strong answer, not a weak one.`,
      exercise: 'Write one line for each must-have: where you got it, or how you are getting it.', done: false });
  }
  course.push({ title: stageTitle(stage), minutes: 5, body: stageLesson(stage),
    exercise: stage === 'Technical' ? 'Pick one task from the ad and say your steps out loud, including how you would check your work.' : 'Write down two questions you would like to ask, and one example you want to be sure to mention.', done: false });
  course.push({ title: 'Your 60-second introduction', minutes: 5,
    body: exp === 'Career change'
      ? 'Many interviews start by asking you to tell them about yourself. Keep it to about a minute: what you did before, what carries over, and why this job now.'
      : exp === 'Early career'
        ? 'Many interviews start by asking you to tell them about yourself. Keep it to about a minute: what you are doing now, one example that fits this job, and why you want it.'
        : 'Many interviews start by asking you to tell them about yourself. Keep it to about a minute: what you do now, one example that fits this job, and why you want it.',
    exercise: `Say it out loud and time it: who you are, one true example that fits ${jobName}, and why you want it. ${exp === 'Career change' ? 'Explain your switch in one sentence.' : tip}`, done: false });
  course.push({ title: 'Ask good questions and finish well', minutes: 5,
    body: 'No job ad tells you everything. Ask about what matters to you instead of guessing, and finish by saying clearly that you want the job.',
    exercise: 'Prepare two questions, for example: What does a great first month look like? How does training work for new people? Then say one sentence on why you want this job.', done: false });
  while (course.length < 6) {
    course.splice(course.length - 2, 0, { title: 'Turn the duties into stories', minutes: 5,
      body: `${plainLine ? `Take one thing the ad asks for, like “${quoteText(plainLine, 120)}”, and think` : 'Take one thing the ad asks for and think'} of a time you did something similar.\n${tip}`,
      exercise: 'Write a short story using Situation, Task, Action, Result (STAR). Keep it true and specific.', done: false });
  }

  // Quiz: at least three items built from this ad, with plainly wrong distractors and varied answer positions.
  const quizItems = [];
  const lowJob = job.toLowerCase();
  const pick = (pool, n, salt) => { const out = []; const p = pool.slice(); let h = fnv(String(seed) + salt); while (out.length < n && p.length) { out.push(p.splice(h % p.length, 1)[0]); h = fnv(String(h)); } return out; };
  const place = (right, wrong, i) => { const pos = (seed + i * 2) % 3; const options = wrong.slice(0, 2); options.splice(pos, 0, right); return { options, correct: pos }; };
  const REQ_DISTRACT = [['A Class 1 truck driving licence', /truck|class 1|driv/], ['5+ years managing a sales team', /sales|manag/], ['A university degree in accounting', /account|degree|bookkeep|financ/],
    ['Fluent Japanese and Mandarin', /japanese|mandarin|language|bilingual/], ['Experience running a commercial kitchen', /kitchen|cook|chef|food/], ['A forklift operator certificate', /forklift|warehouse/],
    ['A registered nursing licence', /nurs|clinic|patient|health/], ['Experience writing Python code', /python|code|develop|software|program/], ['A teaching certificate', /teach|school|classroom|student/],
    ['A pilot’s licence', /pilot|aviation|flight/], ['Experience as a hair stylist', /hair|salon|styl/], ['Heavy equipment operator experience', /equipment|operator|machinery|excavat/]];
  const SKILL_DISTRACT = [['AutoCAD', 'technical'], ['Phlebotomy', 'care'], ['Forklift certificate', 'physical'], ['QuickBooks', 'numbers'], ['Photoshop', 'technical'], ['Welding', 'physical'],
    ['Smart Serve', 'safety'], ['Python', 'technical'], ['HVAC', 'technical'], ['Salesforce', 'customers'], ['CPR', 'safety'], ['WHMIS', 'safety'], ['Excel', 'numbers'], ['React', 'technical'], ['Food Safe', 'safety']];
  const topIds = themeIds.slice(0, 3);
  let qi = 0;
  const firstMust = plainMusts[0] || ranked.find((r) => !r._check);
  if (firstMust) {
    const right = cap1(quoteText(firstMust.kind === 'nice' ? niceCore(firstMust.text) : firstMust.text, 90));
    const wrong = pick(REQ_DISTRACT.filter(([, rx]) => !rx.test(lowJob)).map(([t]) => t), 2, 'req');
    const { options, correct } = place(right, wrong, qi++);
    quizItems.push({ q: 'Which of these does the ad ask for?', options, correct, why: `The ad says “${quoteText(firstMust.text, 120)}”. The other two are not in this ad.` });
  }
  const quizSkill = a.skills.find((x) => !CHECK.test(x));
  if (quizSkill) {
    const right = quizSkill;
    const pool = SKILL_DISTRACT.filter(([s]) => !lowJob.includes(s.toLowerCase().split(' ')[0]) && !a.skills.some((x) => x.toLowerCase() === s.toLowerCase()));
    const far = pool.filter(([, th]) => !topIds.includes(th));
    const wrong = pick((far.length >= 2 ? far : pool).map(([s]) => s), 2, 'skill');
    const { options, correct } = place(right, wrong, qi++);
    quizItems.push({ q: 'Which skill or certificate does the ad mention?', options, correct, why: `“${right}” is in the ad. Be ready to say where you learned it or how you have used it.` });
  }
  if (a.themes.length) {
    const right = a.themes[0].label;
    const DISTINCT = ['sales', 'technical', 'numbers', 'physical', 'care', 'customers', 'safety', 'leadership'];
    // A wrong answer must be clearly wrong: never an area the ad touches anywhere, even in the company blurb.
    const NEAR = { care: /\b(?:health\w*|clinic\w*|care|patients?|residents?|hospital\w*|nurs\w*)\b/i, technical: /\b(?:software|platforms?|technical|digital|apps?|computers?|systems?|tech)\b/i,
      numbers: /\b(?:cash|money|data|numbers?|reports?|budgets?|sales)\b/i, physical: /\b(?:lift\w*|standing|physical\w*|warehouse|outdoors?|hands-on)\b/i,
      safety: /\b(?:safe\w*|hazard\w*|first aid|cpr)\b/i, customers: /\b(?:customers?|clients?|guests?|public)\b/i, sales: /\b(?:sales|sell\w*|revenue)\b/i, leadership: /\b(?:lead\w*|manag\w*|supervis\w*)\b/i };
    const absent = DISTINCT.filter((id) => !(a._scores[id] > 0) && !NEAR[id].test(job));
    const low = DISTINCT.filter((id) => !absent.includes(id) && !topIds.includes(id)).sort((x, y) => a._scores[x] - a._scores[y]);
    const wrong = pick(absent.length >= 2 ? absent : absent.concat(low).slice(0, Math.max(2, absent.length)), 2, 'theme').map((id) => THEME[id].label);
    const { options, correct } = place(right, wrong, qi++);
    quizItems.push({ q: 'What is this job mostly about?', options, correct, why: a.themes[0].evidence[0] || plainLine ? `The ad keeps coming back to it, for example: “${quoteText(a.themes[0].evidence[0] || plainLine, 110)}”.` : 'It is the area the ad comes back to most.' });
  }
  {
    const right = closeTask ? `How do new people learn to “${closeTask}”?` : 'What does a great first month look like in this job?';
    const { options, correct } = place(right, ['What does your company do?', 'How soon can I take time off?'], qi++);
    quizItems.push({ q: 'Which is the best question to ask at the end of the interview?', options, correct,
      why: 'Asking how the work is learned, or what a good start looks like, shows you care about doing the job well. Look up the basics before you go, and save time-off questions for when you have an offer.' });
  }
  {
    const { options, correct } = place('The Action: what you did', ['The Situation: all the background', 'The Result: only the numbers'], qi++);
    quizItems.push({ q: 'In a Situation, Task, Action, Result (STAR) answer, which part should get the most time?', options, correct,
      why: 'Interviewers want to hear what you did. Keep the background short, then finish with how it turned out.' });
  }
  if (quizItems.length < 6) {
    const n = ranked.find((r) => r.kind === 'nice' && !r._check && countWords(niceCore(r.text)) >= 2);
    const right = 'Be honest, mention anything related, and say how you would learn it';
    const { options, correct } = place(right, ['Say you have it anyway', 'Avoid the topic and hope it does not come up'], qi++);
    quizItems.push({ q: n ? `The ad says “${lcFirst(quoteText(niceCore(n.text), 80), keep)}” would be a plus, and you do not have it yet. What should you do?` : 'You have not done part of this job before. What is the strongest approach?',
      options, correct, why: 'An honest gap with a real plan to learn is a strong answer. Making things up is never worth it.' });
  }

  const GENERIC_QUIZ = [
    ['They ask you to tell them about yourself. What is a strong answer?', 'About a minute: what you do now, one example that fits this job, and why you want it',
      ['Your whole life story, starting from school', 'Say there is not much to tell'], 'A short, focused introduction gives them a clear picture and leads into your examples.'],
    ['You do not know the answer to a question. What is the best thing to do?', 'Say so honestly, then explain how you would find out',
      ['Make up an answer that sounds confident', 'Change the subject quickly'], 'Honesty plus a plan to find out shows you can be trusted and can learn.'],
    ['How should you finish the interview?', 'Thank them and say clearly that you want the job',
      ['Ask how soon you can take time off', 'Leave as soon as the last question is done'], 'A clear, warm ending leaves a good last impression.']
  ];
  for (const [q, right, wrong, why] of GENERIC_QUIZ) {
    if (quizItems.length >= 5) break;
    const { options, correct } = place(right, wrong, qi++);
    quizItems.push({ q, options, correct, why });
  }
  return { schema: 1, id: uid(), company, role, job, url: String(input.url || '').slice(0, 2000), intake, requirements, course, questions, questionInfo: info, quizItems,
    notes: {}, quiz: { answers: {} }, mock: { index: 0, answers: [], draft: '', finished: false }, created: new Date().toISOString(), updated: new Date().toISOString() };
}

function publicAnalyze(jobText, opts) {
  const a = analyze(jobText, opts);
  delete a._ranked;
  delete a._items;
  delete a._scores;
  return a;
}

const catalog = Object.freeze(Object.fromEntries(THEMES.map((t) => [t.id, Object.freeze({ label: t.label, probe: t.probe })])));
root.PrepEngine = { create, analyze: publicAnalyze, themes: catalog };
if (typeof module !== 'undefined') module.exports = root.PrepEngine;
})(globalThis);
