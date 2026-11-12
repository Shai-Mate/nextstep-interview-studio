/** Momentum by Prism's on-device preparation engine. Inputs are evidence, never instructions.
 * No network calls, employer verification, personal inference or hiring predictions. */
const text = (value, max = 60000) =>
  String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, max);
const list = (value) =>
  Array.isArray(value)
    ? value.map((v) => text(v, 1000)).filter(Boolean)
    : text(value)
        .split(/\n|;/)
        .map((v) => v.replace(/^[-•*]\s*/, "").trim())
        .filter(Boolean);
const unique = (values) => [...new Set(values)];
const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `prism-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
const words = (value) =>
  text(value).match(/[\p{L}\p{N}]+(?:['’.-][\p{L}\p{N}]+)*/gu) || [];
const compact = (value, max = 190) => {
  const s = text(value).replace(/\s+/g, " ");
  return s.length <= max ? s : `${s.slice(0, max - 1).replace(/\s+\S*$/, "")}…`;
};
const finish = (value) => (/[.!?]$/.test(value) ? value : `${value}.`);
const SKILLS = [
  [
    "Communication",
    "People",
    /\bcommunicat(?:e|es|ing|ion|ions)|\bpresentation\b/i,
  ],
  [
    "Customer service",
    "People",
    /\bcustomer (?:service|support|care|experience)|\bguest (?:service|experience)/i,
  ],
  ["Collaboration", "People", /\bcollaborat|\bteamwork|cross[- ]functional/i],
  [
    "Leadership",
    "People",
    /\bleadership|\blead a team|\bmanage (?:a |the )?team|\bsupervis(?:e|ion|or)/i,
  ],
  [
    "Stakeholder management",
    "People",
    /\bstakeholder|\brelationship management/i,
  ],
  [
    "Problem solving",
    "Thinking",
    /\bproblem[- ]solv|\btroubleshoot|\broot[- ]cause/i,
  ],
  [
    "Prioritization",
    "Thinking",
    /\bprioriti[sz]|\btime management|\bmultiple priorities/i,
  ],
  [
    "Attention to detail",
    "Thinking",
    /\battention to detail|\bdetail[- ]orient|\baccuracy|\baccurate/i,
  ],
  [
    "Project management",
    "Operations",
    /\bproject management|\bproject plans?|\bproject delivery/i,
  ],
  [
    "Process improvement",
    "Operations",
    /\bprocess improvement|\bcontinuous improvement|\blean\b|\bsix sigma/i,
  ],
  ["Inventory", "Operations", /\binventory|\bstock control|\bwarehouse/i],
  ["Safety", "Operations", /\bsafety|\bOSHA\b|\bWHMIS\b/i],
  [
    "Data analysis",
    "Analytical",
    /\bdata analy|\banaly[sz]e data|\banalytics|\bdata[- ]driven/i,
  ],
  ["Excel", "Analytical", /\bexcel\b|\bspreadsheets?/i],
  ["SQL", "Technical", /\bSQL\b|\bPostgreSQL\b|\bMySQL\b/i],
  ["Python", "Technical", /\bpython\b/i],
  ["JavaScript", "Technical", /\bjavascript\b|\btypescript\b|\bnode\.?js\b/i],
  ["React", "Technical", /\breact(?:\.js|js)?\b/i],
  [
    "Software testing",
    "Technical",
    /\bunit tests?|\btest automation|\bautomated tests?|\bsoftware testing|\bquality assurance/i,
  ],
  [
    "Cloud infrastructure",
    "Technical",
    /\bAWS\b|\bAzure\b|\bGCP\b|\bcloud (?:infrastructure|platform|computing)/i,
  ],
  [
    "Product thinking",
    "Product",
    /\bproduct (?:strategy|discovery|management|roadmap)|\buser needs|\bproduct[- ]led/i,
  ],
  [
    "User research",
    "Design",
    /\buser research|\busability|\buser interviews?|\bUX research/i,
  ],
  [
    "Design",
    "Design",
    /\bvisual design|\bproduct design|\bUI\b|\bUX\b|\bFigma\b|\bdesign systems?/i,
  ],
  [
    "Sales",
    "Commercial",
    /\bsales|\bprospecting|\bpipeline|\bquota|\bclosing deals/i,
  ],
  ["CRM", "Commercial", /\bCRM\b|\bSalesforce\b|\bHubSpot\b/i],
  [
    "Marketing",
    "Commercial",
    /\bmarketing|\bSEO\b|\bcampaigns?\b|\bcontent strategy/i,
  ],
  [
    "Writing",
    "Commercial",
    /\bcopywriting|\bcontent writing|\bwriting skills|\bwritten communication/i,
  ],
  [
    "Financial analysis",
    "Finance",
    /\bfinancial (?:analysis|modelling|modeling|reporting)|\bforecasting|\bFP&A\b/i,
  ],
  [
    "Accounting",
    "Finance",
    /\baccounting|\bbookkeeping|\breconciliation|\baccounts (?:payable|receivable)|\bGAAP\b/i,
  ],
  [
    "Patient care",
    "Care",
    /\bpatient care|\bclinical|\bnursing|\bpatient safety/i,
  ],
  [
    "Teaching",
    "Education",
    /\bteaching|\bcurriculum|\blesson plan|\bclassroom/i,
  ],
  [
    "Recruiting",
    "People",
    /\brecruiting|\brecruitment|\btalent acquisition|\bcandidate sourcing/i,
  ],
];
const FAMILIES = {
  engineering: {
    label: "Software & technology",
    match:
      /\b(?:software|frontend|front-end|backend|back-end|full[- ]stack|developer|DevOps|SRE|programmer|QA engineer|data engineer|machine learning)\b/i,
    method:
      "Clarify the user and constraints before proposing a solution. Break the problem into inputs, behavior, failure cases and a way to verify the result. Explain a trade-off: what does your approach improve, and what does it cost?",
    scenario:
      "A feature works in testing but fails intermittently for customers. Walk me through how you would investigate, reduce the impact and verify a fix.",
    steps: [
      "Clarify symptoms, affected users and severity.",
      "Use evidence to narrow the cause; separate observations from guesses.",
      "Describe a safe mitigation, a testable fix and monitoring after release.",
    ],
    evidence:
      "Choose a project, bug fix or technical decision where you can explain your contribution, constraints, validation and outcome.",
    question:
      "What technical or product constraint most often changes how this team delivers work?",
  },
  design: {
    label: "Design & product",
    match:
      /\b(?:designer|product manager|product owner|UX|UI|user research|design researcher)\b/i,
    method:
      "Start with the user problem and evidence, then explain the choices you explored. Connect the final decision to a constraint or insight. Separate visual polish from whether the solution actually helped a person complete a task.",
    scenario:
      "A team wants to redesign a flow because conversions dropped. How would you understand the problem, choose what to test and decide whether the change helped?",
    steps: [
      "Define the user, task and measurable problem.",
      "Check existing evidence and talk to relevant users or stakeholders.",
      "Test a focused idea, examine the outcome and identify what you would change.",
    ],
    evidence:
      "Choose a case study showing the problem, your contribution, alternatives, a decision and evidence of what happened. A small personal project works if its limits are clear.",
    question:
      "How does the team decide which user problems deserve investment, and what evidence changes that decision?",
  },
  retail: {
    label: "Retail & customer support",
    match:
      /\b(?:retail|customer service|customer support|customer success|cashier|store associate|sales associate|support specialist)\b/i,
    method:
      "Listen for the actual problem, acknowledge the person and explain the options clearly. Know what you can resolve yourself and what needs escalation. Show how you follow policies while treating the customer with respect.",
    scenario:
      "A customer wants an exception you are not authorized to make and is becoming frustrated. How would you respond and move the situation forward?",
    steps: [
      "Listen and summarize the concern without making a promise.",
      "Explain the available options and relevant boundary calmly.",
      "Escalate when needed and make ownership of the next step clear.",
    ],
    evidence:
      "Choose a customer interaction, volunteer task or team situation where you listened, solved a problem and followed through. A strong example does not need an impressive job title.",
    question:
      "Which customer problems should this role solve independently, and when should they be escalated?",
  },
  sales: {
    label: "Sales & account management",
    match:
      /\b(?:sales|account executive|account manager|business development|SDR|BDR|revenue)\b/i,
    method:
      "Show how you understand a customer’s situation before proposing a solution. Explain the questions you ask, how you qualify an opportunity and how you agree on a useful next step. Use real numbers only when you can support them.",
    scenario:
      "A promising customer says your solution is too expensive and stops responding. How would you understand the objection and decide on the next step?",
    steps: [
      "Clarify the customer’s priority and actual objection.",
      "Connect value to their stated needs without promising unsupported results.",
      "Agree on a concrete next step, or explain when you would respectfully close the opportunity.",
    ],
    evidence:
      "Choose a real conversation where you understood a need, handled an objection and created a clear next step. Include actual conversion or retention results if available.",
    question:
      "What distinguishes a healthy opportunity here, and where do deals most often stall?",
  },
  marketing: {
    label: "Marketing & communications",
    match:
      /\b(?:marketing|content|copywriter|communications|social media|SEO|brand manager)\b/i,
    method:
      "Connect the audience, message, channel and goal. Explain why an idea is relevant to the audience, how you would test it and which measure would show progress. Distinguish attention metrics from the outcome the business actually needs.",
    scenario:
      "A campaign gets plenty of clicks but few useful inquiries. What would you investigate and what would you test first?",
    steps: [
      "Confirm the audience and business goal.",
      "Inspect the path from message to landing experience to useful action.",
      "Choose one test, define success and explain what would make you stop or iterate.",
    ],
    evidence:
      "Choose a campaign, piece of content or communication where you can explain the audience, your choices, your contribution and an observable outcome.",
    question:
      "Which customer behavior matters most to this role, and how is it measured?",
  },
  healthcare: {
    label: "Healthcare & care",
    match:
      /\b(?:nurse|nursing|caregiver|healthcare assistant|medical assistant|clinical|patient care|pharmacist|therapist)\b/i,
    method:
      "Explain priorities in terms of safety, dignity, communication and scope of practice. Use your employer’s protocols and actual training. Remove identifying details from cases. Escalate uncertainty instead of improvising outside your competence.",
    scenario:
      "You notice a change in a patient’s condition while several other tasks need attention. How would you prioritize, communicate and escalate within your role?",
    steps: [
      "Identify the immediate safety concern and your scope of responsibility.",
      "Follow the applicable protocol and seek appropriate clinical support.",
      "Communicate clearly, document according to policy and follow through.",
    ],
    evidence:
      "Choose an anonymized example of safe prioritization, communication and follow-through within your training. Never include patient-identifying information.",
    question:
      "How does the team support escalation and handover when priorities change quickly?",
  },
  education: {
    label: "Education & learning",
    match:
      /\b(?:teacher|teaching|educator|tutor|instructor|curriculum|school counselor)\b/i,
    method:
      "Connect a learner’s starting point, a clear learning goal, your teaching choices and a way to check understanding. Show how you adapt when a learner needs a different approach. Use anonymized examples and follow safeguarding procedures.",
    scenario:
      "Partway through a lesson, you realize a group has not understood the core idea. What would you do now and how would that change your next lesson?",
    steps: [
      "Check understanding with a small, specific task.",
      "Adapt the explanation or activity to the observed gap.",
      "Recheck learning and plan a next step without labeling the learner.",
    ],
    evidence:
      "Choose an anonymized example of planning, adapting instruction and checking understanding. Show evidence of learning, not just that students enjoyed it.",
    question:
      "How do teachers here share evidence of learning and support students who need a different approach?",
  },
  finance: {
    label: "Finance & accounting",
    match:
      /\b(?:accountant|accounting|bookkeeper|financial analyst|finance|auditor|controller|payroll|accounts payable|accounts receivable)\b/i,
    method:
      "Make assumptions and checks visible. Explain the source of a number, how you reconcile it, how you investigate an unexpected difference and when you seek review. Accuracy and confidentiality matter as much as speed.",
    scenario:
      "A report is due soon and a key total does not reconcile. How would you investigate, communicate the risk and decide what can be delivered?",
    steps: [
      "Confirm the source, period and definition of the numbers.",
      "Trace the difference, document checks and seek review where needed.",
      "Communicate the unresolved risk and agree on an accurate, realistic next step.",
    ],
    evidence:
      "Choose a reconciliation, forecast, report or analysis where you can describe inputs, checks, your contribution and the decision it supported.",
    question:
      "Which controls and review steps are most important for this role’s work?",
  },
  hospitality: {
    label: "Hospitality & service",
    match:
      /\b(?:server|bartender|barista|hostess|hospitality|hotel|restaurant|chef|cook|front desk|housekeep)\b/i,
    method:
      "Show how you balance a guest’s experience with safety, teamwork and the limits of your authority. Describe how you stay organized during a rush, communicate a delay and make a practical next step clear.",
    scenario:
      "It is a busy shift, a guest is upset about a delay and a teammate needs help. How would you handle the next few minutes?",
    steps: [
      "Acknowledge the guest and clarify the immediate issue.",
      "Coordinate priorities with the team and follow safety procedures.",
      "Offer an authorized option, set a realistic expectation and check back.",
    ],
    evidence:
      "Choose a busy shift, guest concern or team handover where your actions helped. An event or volunteering example works if you are new to the industry.",
    question:
      "What does excellent service look like here during the busiest part of a shift?",
  },
  operations: {
    label: "Operations & skilled work",
    match:
      /\b(?:operations|warehouse|logistics|supply chain|manufacturing|technician|electrician|mechanic|driver|construction|production|maintenance)\b/i,
    method:
      "Explain the standard process, safety and quality checks, and how you respond when something changes. Show how you communicate a delay or risk early. Never imply you hold a license or certification you have not earned.",
    scenario:
      "A deadline is at risk and you notice a safety or quality issue. How would you respond, involve the right people and keep the work moving responsibly?",
    steps: [
      "Make the immediate situation safe and identify the issue.",
      "Follow the relevant procedure and communicate the impact.",
      "Agree on a safe plan, verify the result and record the handover.",
    ],
    evidence:
      "Choose a process, repair, delivery or shift where you improved reliability, solved a problem or prevented an error. Include only credentials you actually hold.",
    question:
      "What are the most common safety, quality or delivery challenges in this role?",
  },
  people: {
    label: "People & administration",
    match:
      /\b(?:human resources|HR|recruiter|recruiting|talent|administrative|administrator|executive assistant|office manager|coordinator)\b/i,
    method:
      "Show how you organize competing requests, protect confidential information and keep people informed. Explain the process you use, how you check details and when an issue needs someone else’s decision.",
    scenario:
      "Two stakeholders need urgent help, and one request involves confidential information. How would you prioritize and communicate what you can do?",
    steps: [
      "Clarify deadlines, impact and who is authorized to see the information.",
      "Agree on priorities and a realistic timeline.",
      "Track next actions, protect sensitive details and close the loop.",
    ],
    evidence:
      "Choose a scheduling, coordination, recruiting or administrative task where you handled details carefully. Remove confidential information from examples.",
    question:
      "Which competing priorities and confidential decisions does this role handle most often?",
  },
  general: {
    label: "Professional skills",
    match: /$a/,
    method:
      "Clarify the goal, identify constraints and explain the action you would take first. Make your reasoning visible: why this step, what could go wrong and how would you know the work was successful?",
    scenario:
      "You receive two important tasks with the same deadline and cannot finish both to a good standard. How would you decide what to do and communicate the plan?",
    steps: [
      "Clarify impact, deadlines and dependencies.",
      "Explain the trade-off and agree on priorities with the right person.",
      "Deliver the agreed next step, check quality and communicate any change early.",
    ],
    evidence:
      "Choose a real example from work, study, caring responsibilities, volunteering or a personal project. Identify your contribution and an observable outcome.",
    question:
      "What would someone in this role need to get right in their first 90 days?",
  },
};
function sentences(value) {
  return text(value)
    .replace(/([.!?])\s+(?=[A-Z])/g, "$1\n")
    .split(/\n+/)
    .map((s) => s.replace(/^\s*(?:[-•*▪◦]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}
function inferRole(raw) {
  const labeled = raw.match(
    /(?:^|\n)\s*(?:job title|position|role)\s*[:–—-]\s*([^\n]{3,100})/i,
  );
  if (labeled) return labeled[1].trim();
  const hiring = raw.match(
    /(?:we(?:'re| are) (?:hiring|looking for|seeking)|seeking|hiring)\s+(?:an?\s+)?([^.!?\n]{3,90})/i,
  );
  if (hiring) {
    const candidate = hiring[1]
      .split(/\s+(?:to |who |with |at |for our |to join)/i)[0]
      .trim();
    if (
      candidate.length < 70 &&
      !/^(someone|somebody|people|person|individual|candidate|professional)$/i.test(
        candidate,
      )
    )
      return candidate;
  }
  const heading = raw
    .split(/\n+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 5)
    .find(
      (s) =>
        s.length < 95 &&
        !/https?:|about us|job description|careers|apply now|full.time|part.time|salary/i.test(
          s,
        ) &&
        /\b(?:engineer|developer|designer|manager|analyst|associate|assistant|specialist|coordinator|nurse|teacher|technician|representative|executive|accountant|barista|cashier|server|director|lead|intern|recruiter|cook|driver|supervisor)\b/i.test(
          s,
        ),
    );
  return heading
    ? heading.replace(/\s+(?:at|@)\s+.+$/, "").trim()
    : "Your next role";
}
function inferCompany(raw) {
  const labeled = raw.match(
    /(?:^|\n)\s*(?:company|employer|organization|organisation)\s*[:–—-]\s*([^\n]{2,100})/i,
  );
  if (labeled) return labeled[1].trim();
  const heading = raw
    .split(/\n+/)
    .slice(0, 5)
    .join("\n")
    .match(/^[^\n]{2,100}\s+(?:at|@)\s+([\p{L}\p{N}][^\n.!?]{1,70})$/mu);
  if (
    heading &&
    !/\b(?:least|our|the|a|an|home|work|all|this|their)\b/i.test(heading[1])
  )
    return heading[1].trim();
  return "Your next company";
}
function findFamily(role, raw) {
  const entries = Object.entries(FAMILIES).filter(([key]) => key !== "general");
  const titleMatch = entries.find(([, family]) => family.match.test(role));
  if (titleMatch) return titleMatch[0];
  const bodyMatch = entries
    .map(([key, family]) => ({
      key,
      score: sentences(raw).filter((s) => family.match.test(s)).length,
    }))
    .sort((a, b) => b.score - a.score)[0];
  return bodyMatch?.score > 1 ? bodyMatch.key : "general";
}
export function analyzeJob(input = {}) {
  if (typeof input === "string") input = { text: input };
  const raw = text(input.text || input.job),
    role = text(input.role, 120) || inferRole(raw),
    company = text(input.company, 120) || inferCompany(raw);
  const pieces = sentences(raw);
  const scored = pieces
    .map((s, index) => ({
      s,
      index,
      score:
        (/\b(?:responsib\w*|you will|you’ll|must|require\w*|experience|proficien\w*|knowledge|skill\w*|ability|qualified|qualifications|deliver|develop|manage|support|maintain|design|lead|build|coordinate|ensure|work with)\b/i.test(
          s,
        )
          ? 4
          : 0) +
        SKILLS.filter(([, , re]) => re.test(s)).length -
        (/\b(?:equal opportunity|discriminat\w*|benefits include|salary|compensation|apply now|privacy policy|cookies|visa sponsorship|accommodation|our mission|about us)\b/i.test(
          s,
        )
          ? 8
          : 0) -
        (s.length > 500 ? 2 : 0),
    }))
    .filter(({ s }) => s.length >= 24 && !/^https?:\/\//i.test(s));
  const selected = scored
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .slice(0, 8)
    .sort((a, b) => a.index - b.index);
  const requirements = unique(
    (selected.length ? selected : scored.slice(0, 5)).map((x) =>
      compact(x.s, 320),
    ),
  );
  const skills = SKILLS.filter(([, , re]) => re.test(raw))
    .map(([name, category, re]) => ({
      name,
      category,
      excerpt: compact(pieces.find((s) => re.test(s)) || raw, 240),
    }))
    .slice(0, 12);
  const roleFamily = findFamily(role, raw);
  return {
    role,
    company,
    roleFamily,
    roleFamilyLabel: FAMILIES[roleFamily].label,
    skills,
    requirements,
    keywords: skills.map((s) => s.name),
    summary: requirements.length
      ? `Prepare to connect your experience to ${
          skills.length
            ? skills
                .slice(0, 3)
                .map((s) => s.name.toLowerCase())
                .join(", ")
            : "the responsibilities in this job description"
        }. Start with evidence you can explain in your own words.`
      : "Add a fuller job description to identify the responsibilities and skills to prepare for.",
    source: "Your supplied job description",
    caveat:
      "Skills are mentions in the ad, not verified requirements or an assessment of your qualifications.",
  };
}
function stageGuide(stage) {
  const key = text(stage).toLowerCase();
  if (/technical|case|assessment/.test(key))
    return {
      title: "Make your thinking visible",
      body: "A technical or case conversation often tests how you reason, not only the answer. Clarify the problem, state assumptions and work through an approach. If you get stuck, explain what you know, what you would check and how you would ask for help.",
      practice:
        "Practice one scenario aloud. Spend the first 20 seconds clarifying the goal and constraints, then explain your method before the details.",
    };
  if (/panel/.test(key))
    return {
      title: "Connect with the whole panel",
      body: "Different interviewers may listen for delivery, collaboration, depth or leadership. Begin with shared context, answer the person who asked and include the rest of the panel. Give a concise first answer, then offer detail.",
      practice:
        "Practice a 90-second example that someone outside your specialty can follow. Replace unexplained acronyms with plain language.",
    };
  if (/final/.test(key))
    return {
      title: "Test the fit in both directions",
      body: "Use a final conversation to connect your experience to team priorities and clarify expectations. Explain why this work interests you without making claims about a company you have not verified. Ask what would make the first six months successful.",
      practice:
        "Prepare a statement of interest, one relevant example and three practical questions about the work, manager and expectations.",
    };
  return {
    title: "Make your first minute count",
    body: "A first conversation needs a clear introduction, a reason for your interest and a realistic picture of your experience. Use a simple arc: what you do now, one relevant piece of evidence and what you want to contribute next. Prepare practical details such as availability and questions about the process.",
    practice:
      "Say your introduction aloud in 45–60 seconds. Remove one detail that does not help the interviewer understand your fit for this role.",
  };
}
const quiz = (question, options, correct, explanation) => ({
  question,
  options,
  correct,
  explanation,
});
export function generateCourse(prep = {}, profile = {}) {
  const a = prep.analysis || analyzeJob(prep),
    f = FAMILIES[a.roleFamily] || FAMILIES.general,
    role = prep.role || a.role,
    company = prep.company || a.company;
  const requirement =
      prep.requirements?.[0] ||
      a.requirements[0] ||
      "the main responsibility in the role",
    skill = a.skills[0]?.name || "a core responsibility",
    stage = stageGuide(prep.intake?.stage || prep.stage);
  const careerChange = /career change|early career|first job/i.test(
    text(prep.intake?.experience || profile.experience),
  );
  return [
    {
      id: "understand-role",
      title: "Decode the opportunity",
      category: "Understand",
      minutes: 5,
      body: `The job description is your starting evidence. A long list of requirements can feel overwhelming; turn it into three priorities. For ${role}, begin with this excerpt: “${requirement}”\n\nSeparate what the ad explicitly says from what you still need to learn. A skill mentioned in an ad does not prove how often it is used, how deeply it is needed or what the team values most. Your preparation should make those questions easier to ask.`,
      steps: [
        "Highlight three outcomes this job needs to deliver.",
        "For each outcome, write what good performance might look like; label that as a hypothesis.",
        "Choose the most important unknown to clarify with the interviewer.",
      ],
      exercise:
        "Finish: “This role exists to…”, “My strongest relevant evidence is…”, and “I need to ask about…”.",
      takeaway:
        "Translate a job description into outcomes, evidence and questions.",
      quiz: quiz(
        "The ad mentions a skill you have used only briefly. What should you do?",
        [
          "Claim expert-level experience so you qualify.",
          "Describe your actual experience and a credible learning plan.",
          "Ignore the requirement and hope it never comes up.",
        ],
        1,
        "Accurate evidence plus a clear learning plan is stronger than an unsupported claim.",
      ),
      done: false,
    },
    {
      id: "research-context",
      title: "Know the company. Know the conversation.",
      category: "Research",
      minutes: 7,
      body: `Research ${company} with a specific purpose: understand its product or service, the people it serves and the problem this role helps solve. Start with the official website, original job ad and recent company announcements. Record the source and date beside each fact.\n\nIf you know your interviewer, use only public professional information they chose to share: their role, team, published work or talks. Do not guess their personality, private life or opinions. A job title can suggest a useful question, but it cannot tell you exactly what they will ask.`,
      steps: [
        "Write one sourced fact about what the company does and who it serves.",
        "Save a recent company update and explain why it might matter to this role.",
        "Review the interviewer’s public professional context and prepare one respectful work-related question.",
      ],
      exercise:
        "Save two facts with sources in Research. Turn one unknown into a question: “I read ___; how does that affect this team’s priorities?”",
      takeaway:
        "Useful research produces better questions, not assumptions about people.",
      quiz: quiz(
        "You find an old company article. How should you use it?",
        [
          "Treat it as a confirmed current priority.",
          "Infer the interviewer’s personal beliefs from it.",
          "Check its date and source, then ask whether it is still relevant.",
        ],
        2,
        "Information becomes outdated. Keep its source and date, and verify its relevance.",
      ),
      done: false,
    },
    {
      id: "evidence-stories",
      title: "Build your three strongest stories",
      category: "Your evidence",
      minutes: 8,
      body: `Strong answers make your contribution visible. Use STAR: Situation is brief context, Task is the goal, Action is what you personally did and Result is what changed. Spend most of your answer on action, then name the result and what you learned.\n\n${f.evidence}\n\n${careerChange ? "Study, volunteering, caring responsibilities and personal projects count when they demonstrate relevant behavior. State the context honestly; do not turn a project into employment." : "Choose examples with enough detail to answer a follow-up. Avoid taking credit for an entire team’s result; explain your part."} A result can be an observable improvement or lesson. Do not invent a percentage because a template asks for a number.`,
      steps: [
        "Pick one example of solving a problem, one of working with others and one of learning.",
        "For each, write a sentence of context, a goal, three actions and one honest result.",
        `Connect one story to ${skill.toLowerCase()} in this ad.`,
      ],
      exercise:
        "Draft a 90-second story. Underline every sentence about your own action. If most of it is setup, shorten the setup.",
      takeaway:
        "Real, specific evidence is more convincing than impressive adjectives.",
      quiz: quiz(
        "Your project helped a team, but you do not have a measured result. What can you say?",
        [
          "Describe an observable outcome and what you learned.",
          "Estimate a large percentage to sound stronger.",
          "Present the whole team’s work as your own.",
        ],
        0,
        "A truthful qualitative result is useful. Numbers help only when you can support them.",
      ),
      done: false,
    },
    {
      id: "role-practice",
      title: "Make your approach clear",
      category: f.label,
      minutes: 8,
      body: `${f.method}\n\nPractice scenario: ${f.scenario}\n\nYou do not need to pretend you know the employer’s internal systems. State what you would need to learn before acting. Explain unfamiliar terms simply and show how you would check the result.`,
      steps: f.steps,
      exercise:
        "Answer the scenario aloud in two minutes. Then write the first question you would ask before acting and one risk you would check.",
      takeaway:
        "A clear method shows judgment even when you do not know every detail.",
      quiz: quiz(
        "A scenario leaves out an important detail. What is the best first move?",
        [
          "Choose a confident answer without mentioning it.",
          "Ask a focused question, or state a reasonable assumption.",
          "Say the question is impossible and stop.",
        ],
        1,
        "Clarifying the goal or stating an assumption makes your reasoning understandable and testable.",
      ),
      done: false,
    },
    {
      id: "introduction",
      title: stage.title,
      category: "Tell your story",
      minutes: 5,
      body: `${stage.body}\n\nTry: “My background is in [true context]. One relevant example is [your contribution and outcome]. I’m interested in this role because [specific connection to the work].” Use it as a structure, not a script to memorize.\n\nYou can pause before answering. A short pause is more useful than filling the space with an answer that does not address the question.`,
      steps: [
        "Choose a true starting point from your experience.",
        "Add one piece of evidence relevant to this role.",
        "Close with a specific reason for your interest, in natural language.",
      ],
      exercise: stage.practice,
      takeaway: "Make it easy to understand your experience and direction.",
      quiz: quiz(
        "What belongs in a concise introduction?",
        [
          "Every job and qualification you have ever had.",
          "A memorized list of positive personality traits.",
          "Relevant background, a specific example and a reason for your interest.",
        ],
        2,
        "A focused introduction gives the conversation a useful starting point.",
      ),
      done: false,
    },
    {
      id: "difficult-questions",
      title: "Handle the questions that feel hard",
      category: "Confidence",
      minutes: 6,
      body: "For a gap: name what you have not done, connect the closest relevant experience and explain how you would learn. For a mistake: explain what happened, take responsibility for your part, describe the repair and show what changed afterward.\n\nFor a career break or change, share only context you are comfortable sharing, then return to readiness for the work. You do not need to disclose private health, family or sensitive details to practice a strong answer. If a question feels inappropriate, ask how it relates to the role or redirect to your ability to do the work.",
      steps: [
        "Choose the question you are most likely to avoid.",
        "Write an honest opening without excuses or unnecessary personal detail.",
        "Add evidence of learning, a relevant strength and a practical next step.",
      ],
      exercise:
        "Complete: “I haven’t done ___ yet. My closest relevant experience is ___. My first steps to learn it would be ___.”",
      takeaway:
        "Honesty, boundaries and a plan are compatible with confidence.",
      quiz: quiz(
        "How should you discuss a mistake?",
        [
          "Explain your part, the repair and what changed afterward.",
          "Blame a teammate to protect your record.",
          "Use a disguised strength such as “I care too much.”",
        ],
        0,
        "Ownership and a specific behavior change provide evidence of learning.",
      ),
      done: false,
    },
    {
      id: "questions-close",
      title: "Ask questions that help you decide",
      category: "Mutual fit",
      minutes: 5,
      body: `An interview is your chance to understand the job. Prepare questions about outcomes, support, expectations and the practical realities of the work. A question should help you make a decision, not just demonstrate research.\n\nA role-specific starting point: “${f.question}”\n\nBefore leaving, clarify the next step and expected timeline. If you want the role, close with concise interest grounded in what you learned.`,
      steps: [
        "Choose one question about success, one about day-to-day work and one about support.",
        "Avoid asking something clearly answered in the ad unless you need clarification.",
        "Prepare a closing sentence and a question about next steps.",
      ],
      exercise:
        "Write three questions. Mark the one answer that would most affect your decision to accept.",
      takeaway:
        "Good questions reveal whether the opportunity is right for you.",
      quiz: quiz(
        "Which question reveals useful expectations?",
        [
          "Would you say this is a great company?",
          "What would good performance look like in the first 90 days?",
          "Can you tell me everything about the business?",
        ],
        1,
        "A specific question about success invites concrete expectations.",
      ),
      done: false,
    },
    {
      id: "rehearse-follow-up",
      title: "Rehearse, reflect and follow through",
      category: "Put it together",
      minutes: 8,
      body: "Complete a mock interview without rewriting every sentence as you go. Afterward, choose one answer to improve: make its main point earlier, clarify your action or add a truthful outcome.\n\nBefore the real conversation, check the time zone, location or video link, connection, accessibility needs and requested materials. Afterward, record what you learned while it is fresh. A short follow-up can thank the interviewer, mention a specific point and confirm interest.\n\nThe practice checklist measures answer structure only. It cannot verify technical correctness, predict an offer or determine readiness for a regulated profession.",
      steps: [
        "Complete a mock session using your own words.",
        "Choose one improvement and answer that question again.",
        "Prepare interview logistics and a short follow-up note.",
      ],
      exercise:
        "Run the mock interview. Then write: “I explained ___ well. I will improve ___. My next practice step is ___.”",
      takeaway:
        "A small, specific improvement beats endlessly rehearsing a perfect script.",
      quiz: quiz(
        "What does the local practice feedback tell you?",
        [
          "Whether you are certain to get an offer.",
          "Whether every technical detail is correct.",
          "Which structure cues may be present and what to review next.",
        ],
        2,
        "The checklist looks for writing cues. It does not evaluate truth, technical accuracy or hiring prospects.",
      ),
      done: false,
    },
  ];
}
export function generateQuestions(prep = {}) {
  const a = prep.analysis || analyzeJob(prep),
    f = FAMILIES[a.roleFamily] || FAMILIES.general,
    role = prep.role || a.role,
    company = prep.company || a.company,
    requirement = prep.requirements?.[0] || a.requirements[0],
    skill = a.skills[0]?.name.toLowerCase() || "a core responsibility";
  return [
    {
      id: "introduction",
      category: "Motivation",
      question: `Tell me about yourself and what interests you in the ${role} role at ${company}.`,
      tip: "Your relevant background, one piece of evidence and why this work interests you.",
      followUp:
        "Which part of your experience would be most useful in this role, and why?",
    },
    {
      id: "evidence",
      category: "Experience",
      question: `Tell me about a real example where you used ${skill}. What did you personally do, and what happened?`,
      tip: "Brief context, clear goal, your actions and an honest result. Work, study and volunteering all count.",
      followUp:
        "What was your individual contribution, and what would you do differently?",
    },
    {
      id: "scenario",
      category: f.label,
      question: f.scenario,
      tip: f.steps.join(" "),
      followUp:
        "What information would you need before acting, and how would you check the outcome?",
    },
    {
      id: "collaboration",
      category: "Working with others",
      question:
        "Describe a time you and another person had different views on how to get something done. How did you work through it?",
      tip: "Explain both perspectives respectfully, your action and the result.",
      followUp:
        "What did you learn about the other person’s priorities, and did that change your approach?",
    },
    {
      id: "learning",
      category: "Adaptability",
      question:
        "Tell me about a mistake or a time something did not go to plan. What did you do next?",
      tip: "Take responsibility for your part. Include the repair and one change afterward.",
      followUp: "What evidence shows that your new approach worked better?",
    },
    {
      id: "role-depth",
      category: "Role understanding",
      question: requirement
        ? `The job description includes: “${compact(requirement, 220)}” How would you approach that responsibility, and where would you need support?`
        : "What would you need to learn first to contribute well in this role?",
      tip: "Connect the responsibility to real experience. Name an honest gap and a practical way to learn.",
      followUp: "What would a useful first step look like in your first month?",
    },
    {
      id: "priorities",
      category: "Judgment",
      question:
        "How do you decide what to do first when several important things need your attention?",
      tip: "Use a real example. Explain impact, urgency, dependencies and how you communicate a trade-off.",
      followUp:
        "When would you ask someone else to make or confirm the priority decision?",
    },
    {
      id: "closing",
      category: "Your questions",
      question:
        "What would you like to ask us about the role, team or next steps?",
      tip: "Ask questions that help you understand the work and decide whether it fits.",
      followUp: f.question,
    },
  ];
}
export function buildResearch(prep = {}) {
  const company = text(prep.company, 120) || "the company",
    interviewer = text(prep.interviewer || prep.interviewerName, 120);
  return {
    companyNotes: text(prep.companyNotes || prep.research?.companyNotes, 20000),
    interviewerNotes: text(
      prep.interviewerNotes || prep.research?.interviewerNotes,
      20000,
    ),
    interviewer,
    sourceNote:
      "Research notes are supplied by you. Momentum has not independently verified these claims.",
    companyQuestions: [
      `What does ${company} offer, and who uses or buys it?`,
      "What recent, dated company announcement might affect this role?",
      "What is still unclear about the team’s priorities?",
    ],
    interviewerQuestions: [
      interviewer
        ? `What is ${interviewer}’s publicly listed role and team?`
        : "What is your interviewer’s publicly listed role and team?",
      "Have they shared a relevant professional article, talk or project?",
      "What respectful question about their work would help you understand the team?",
    ],
    checklist: [
      {
        id: "company-basics",
        label: "Understand the product or service",
        prompt:
          "Save one fact from the official website, with its source and date.",
      },
      {
        id: "company-news",
        label: "Check recent company context",
        prompt:
          "Save a relevant announcement. Check its date and distinguish a company claim from a verified fact.",
      },
      {
        id: "interviewer-role",
        label: "Understand the interviewer’s professional context",
        prompt:
          "Use public professional sources only. Record their role or published work; do not infer personality or private details.",
      },
      {
        id: "research-question",
        label: "Turn research into a useful question",
        prompt:
          "Ask how a sourced fact relates to the team’s work. Phrase uncertain information as a question.",
      },
    ],
  };
}
export const researchChecklist = buildResearch;
export function createPreparation(input = {}) {
  const job = text(input.job || input.text);
  if (job.length < 40 || /^https?:\/\/\S+$/i.test(job))
    throw new Error(
      "Add at least 40 characters from the job description. A link alone needs to be imported first.",
    );
  const analysis = analyzeJob({ ...input, job }),
    created = new Date().toISOString(),
    intake = {
      experience: "Prefer not to say",
      stage: "Screening",
      focus: "Balanced",
      time: "30 minutes",
      ...input.intake,
    };
  const prep = {
    schema: 2,
    id: uid(),
    role: analysis.role,
    company: analysis.company,
    job,
    url: text(input.url, 2000),
    intake,
    analysis,
    requirements: analysis.requirements,
    interviewer: text(input.interviewer || input.interviewerName, 120),
    companyNotes: text(input.companyNotes, 20000),
    interviewerNotes: text(input.interviewerNotes, 20000),
    notes: {},
    quiz: { answers: {} },
    mock: { index: 0, answers: [], draft: "", finished: false },
    status: "Preparing",
    created,
    updated: created,
  };
  prep.course = generateCourse(prep, input.profile);
  prep.questions = generateQuestions(prep);
  prep.research = buildResearch(prep);
  return prep;
}
export const create = createPreparation;
export function evaluateAnswer(answer, question = {}) {
  const raw = text(answer, 20000),
    wordCount = words(raw).length,
    category =
      typeof question === "string"
        ? question
        : `${question.id || ""} ${question.category || ""}`,
    closing = /closing|your questions/i.test(category),
    scenario =
      /scenario|role-depth|judgment|software|design|sales|healthcare|finance|operations/i.test(
        category,
      );
  const checks = closing
    ? [
        {
          label: "A specific question",
          met: /\?|\b(?:what|how|which|when|could you|can you)\b/i.test(raw),
          advice: "Ask a focused question about the role, team or process.",
        },
        {
          label: "Useful to your decision",
          met: /\b(?:success|expect|priorit|team|support|challenge|manager|next|timeline|learn|work|role|feedback)\w*/i.test(
            raw,
          ),
          advice:
            "Ask something that helps you understand the work or decide whether it fits.",
        },
        {
          label: "Concise wording",
          met: wordCount >= 8 && wordCount <= 130,
          advice:
            "Aim for one or two clear questions, then give the interviewer room to answer.",
        },
      ]
    : [
        {
          label: scenario ? "Goal or context" : "Specific context",
          met: /\b(?:when|while|during|project|team|customer|client|patient|student|shift|task|goal|situation|problem|needed|asked|working|worked|first|clarify)\b/i.test(
            raw,
          ),
          advice:
            "Add a brief situation or goal so the listener understands what you were trying to do.",
        },
        {
          label: "Your contribution",
          met: /\bI\s+(?:\w+\s+){0,3}(?:did|made|led|built|created|asked|listened|checked|organized|organised|wrote|spoke|helped|decided|changed|tested|worked|would|will|took|used|designed|noticed|reviewed|identified|supported|learned|learnt|implemented|developed|communicated|prioriti[sz]ed|followed|investigated|coordinated|reduced|increased|delivered|managed)\b/i.test(
            raw,
          ),
          advice: scenario
            ? "State the action you would personally take and why."
            : "Make your own action clear. “We” describes the team; explain your part too.",
        },
        {
          label: scenario ? "How you would check" : "Outcome or learning",
          met: /\b(?:result|outcome|learned|learnt|improved|reduced|increased|resolved|completed|delivered|prevented|saved|achieved|feedback|verify|measure|check|test|confirm|follow up|followed up|so that|as a result)\b|\b\d+(?:\.\d+)?\s*(?:%|percent|hours?|days?|minutes?|customers?|weeks?)\b/i.test(
            raw,
          ),
          advice: scenario
            ? "Explain how you would check whether the approach worked."
            : "Add an observable result or lesson. Use a number only when you can support it.",
        },
        {
          label: "Focused length",
          met: wordCount >= 45 && wordCount <= 250,
          advice:
            wordCount < 45
              ? "Give a little more detail: context, your action and what changed."
              : "Try a shorter first answer, then offer more detail if asked.",
        },
      ];
  const strengths = checks
      .filter((c) => c.met)
      .map((c) => `${c.label}: a possible cue is present.`),
    improvements = checks.filter((c) => !c.met).map((c) => c.advice);
  return {
    wordCount,
    durationSeconds: Math.round((wordCount / 130) * 60),
    checks,
    strengths,
    improvements,
    summary: !wordCount
      ? "Start with a real example or explain your approach."
      : improvements.length
        ? `${wordCount} words. Your next improvement: ${improvements[0]}`
        : `${wordCount} words. Structure cues are present. Review accuracy, relevance and your specific contribution.`,
    caveat:
      "This is a local writing checklist. Keywords can miss good answers or match weak ones. It does not verify facts, technical correctness or hiring readiness.",
  };
}
// A mention inside a gap or learning plan is not evidence of a possessed skill.
function positiveSkillMention(value, re) {
  return sentences(value).some(
    (sentence) =>
      re.test(sentence) &&
      !/\b(?:no|not|never|lack|lacking|without|haven['’]t|hasn['’]t|don['’]t|doesn['’]t|need to learn|want to learn|learning plan|interested in learning|hope to learn)\b/i.test(
        sentence,
      ),
  );
}
function profileData(profile = {}) {
  return {
    name: text(profile.name || profile.fullName, 120),
    targetRole: text(profile.targetRole || profile.role, 120),
    experience: text(
      profile.experience || profile.background || profile.summary,
      4000,
    ),
    resume: text(profile.resume || profile.resumeText, 30000),
    skills: unique(
      list(profile.skills)
        .flatMap((s) => s.split(/,\s*/))
        .map((s) => s.trim())
        .filter(Boolean),
    ).slice(0, 20),
    achievements: list(profile.achievements || profile.wins).slice(0, 8),
    location: text(profile.location, 120),
  };
}
function experienceSentence(value, max, missing) {
  const experience = text(value);
  const careerStages = {
    "Just starting out": "I’m at the beginning of my career.",
    "Changing careers": "I’m making a career change.",
    "Returning to work": "I’m returning to work.",
    "Prefer not to say": missing,
  };
  if (!experience) return missing;
  if (Object.prototype.hasOwnProperty.call(careerStages, experience))
    return careerStages[experience];
  if (/^\d+(?:[–-]\d+|\+)? years? of experience$/i.test(experience))
    return `I have ${experience}.`;
  return finish(compact(experience, max));
}
export function generateProfileKit(profile = {}) {
  const p = profileData(profile),
    known = SKILLS.filter(
      ([name, , re]) =>
        p.skills.some((s) => s.toLowerCase() === name.toLowerCase()) ||
        positiveSkillMention(`${p.resume}\n${p.experience}`, re),
    ).map(([name]) => name),
    supportedSkills = unique([...p.skills, ...known]).slice(0, 6),
    target = p.targetRole || "[Target role]";
  const background = experienceSentence(
      p.experience,
      450,
      "[Add one sentence about your actual background.]",
    ),
    evidence = p.achievements[0] ? finish(p.achievements[0]) : "",
    skillLine = supportedSkills.length
      ? `Skills I bring: ${supportedSkills.join(", ")}.`
      : "";
  return {
    headline: `${target}${supportedSkills.length ? ` | ${supportedSkills.slice(0, 3).join(" · ")}` : " | [Add 2–3 skills you can demonstrate]"}`,
    about: [
      background,
      evidence,
      skillLine,
      `I’m interested in ${target} roles${p.location ? ` in ${p.location}` : ""}.`,
    ]
      .filter(Boolean)
      .join("\n\n"),
    resumeSummary: [background, skillLine, evidence].filter(Boolean).join(" "),
    bullets: p.achievements.map((a) => finish(a.replace(/^[-•*]\s*/, ""))),
    supportedSkills,
    checklist: [
      "Check every claim against your actual experience.",
      "Keep job titles, dates and credentials accurate across profiles.",
      "Add projects, education or volunteering that demonstrate relevant skills.",
      "Review visibility and contact settings before publishing.",
    ],
    caveat:
      "Drafts use only information you supplied. Bracketed text needs your input. Nothing is posted to a job platform.",
  };
}
export function generateApplicationKit(profile = {}, prep = {}) {
  const p = profileData(profile),
    a = prep.analysis || analyzeJob(prep),
    role = text(prep.role || a.role, 120),
    company = text(prep.company || a.company, 120),
    kit = generateProfileKit({ ...profile, targetRole: role }),
    supplied = `${p.resume}\n${p.experience}\n${p.skills.join(" ")}\n${p.achievements.join(" ")}`;
  const matches = a.skills.filter((s) => {
      const re = SKILLS.find(([name]) => name === s.name)?.[2];
      return re
        ? positiveSkillMention(supplied, re)
        : supplied.toLowerCase().includes(s.name.toLowerCase());
    }),
    gaps = a.skills
      .filter((s) => !matches.some((m) => m.name === s.name))
      .map((s) => s.name);
  const background = experienceSentence(
      p.experience,
      600,
      "[Add one sentence about your relevant background.]",
    ),
    evidence = p.achievements[0]
      ? `One relevant example from my experience: ${finish(p.achievements[0])}`
      : "[Add a real example: your goal, action and an observable result.]",
    connection = matches.length
      ? `The role’s focus on ${matches
          .slice(0, 3)
          .map((s) => s.name.toLowerCase())
          .join(", ")} connects with the experience I have described above.`
      : `[Explain why ${role} interests you, using a specific responsibility from the description.]`,
    signature = p.name || "[Your name]";
  return {
    coverLetter: `Dear ${company === "Your next company" ? "hiring team" : `${company} hiring team`},\n\nI’m applying for the ${role} position. ${background}\n\n${evidence}\n\n${connection} I would welcome the opportunity to discuss how my experience could contribute to your team.\n\nThank you for your consideration.\n\n${signature}`,
    resumeSummary: kit.resumeSummary,
    headline: kit.headline,
    bullets: kit.bullets,
    outreach: `Hello [Name],\n\nI’m interested in the ${role} opportunity at ${company}. ${p.achievements[0] ? `A relevant example from my background: ${finish(compact(p.achievements[0], 240))}` : "[Add one brief, relevant fact about your experience.]"}\n\nIf you’re the right person to ask, I’d appreciate learning more about the team’s priorities for this role. Thank you for your time.\n\n${signature}`,
    followUp: ["Interview", "Offer", "Accepted"].includes(prep.status)
      ? `Hello [Name],\n\nThank you for [the conversation on date] about the ${role} role. I appreciated learning about [a specific point from our conversation].\n\nThe conversation strengthened my interest in [a truthful reason]. Please let me know if I can provide additional information as you consider next steps.\n\nBest,\n${signature}`
      : `Hello [Name],\n\nI’m writing about the ${role} opportunity at ${company}. [If you have submitted an application, add its date or reference number.]\n\nI remain interested because [a specific, truthful reason]. Could you share any update on the hiring timeline or next steps? Please let me know if I can provide additional information.\n\nThank you for your time,\n${signature}`,
    gaps,
    matches: matches.map((s) => s.name),
    evidenceMap: a.skills.map((s) => ({
      skill: s.name,
      mentionedInProfile: matches.some((m) => m.name === s.name),
      prompt: matches.some((m) => m.name === s.name)
        ? "Add a specific example showing your contribution."
        : "Add evidence if you have it, or prepare an honest learning plan. Do not add an unsupported skill.",
    })),
    checklist: [
      "Replace every bracketed placeholder.",
      "Verify the company, job title and recipient.",
      "Check dates, credentials and every claim.",
      "Match the requested file format and instructions.",
      "Review the final application on the employer’s site before submitting.",
    ],
    caveat:
      "Mentions in your profile are not verified expertise. Drafts do not add qualifications, employment history or results you did not provide. No application is submitted automatically.",
  };
}
function money(value) {
  if (value == null || text(value) === "") return null;
  const n =
    typeof value === "number"
      ? value
      : Number(String(value).replace(/[$£€¥,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? n : null;
}
export function negotiateOffer(input = {}) {
  const base = money(input.base),
    target = money(input.target),
    bonus = money(input.bonus) ?? 0,
    equity = money(input.equity) ?? 0,
    currency = /^[A-Z]{3}$/.test(text(input.currency).toUpperCase())
      ? text(input.currency).toUpperCase()
      : "USD";
  const format = (value) => {
    try {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(value);
    } catch {
      return `${currency} ${value.toLocaleString("en-US")}`;
    }
  };
  const role = text(input.role, 120) || "[Role]",
    company = text(input.company, 120) || "[Company]",
    priorities = list(input.priorities || input.benefits).slice(0, 5),
    delta = base != null && target != null ? target - base : null;
  return {
    base,
    target,
    currency,
    delta,
    deltaPercent:
      base > 0 && target != null
        ? Math.round(((target - base) / base) * 1000) / 10
        : null,
    totalComp: base != null ? base + bonus + equity : null,
    counterEmail: `Hello [Name],\n\nThank you for the offer for the ${role} position at ${company}. I’m excited about the opportunity and appreciate the time the team has invested in the process.\n\nBefore I make a final decision, I’d like to discuss the compensation package. ${target > 0 ? `Would you be able to bring the base salary to ${format(target)}?` : "[Add the base salary or specific package change you would like to discuss.]"} [Add a brief, truthful reason based on the role’s scope, relevant experience or reliable market evidence.]${priorities.length ? `\n\nI’d also welcome a conversation about ${priorities.join(", ")}.` : ""}\n\nI remain interested in the role and would be happy to discuss a package that works for both sides. Could you also confirm the deadline for my response?\n\nThank you,\n${text(input.name, 120) || "[Your name]"}`,
    questions: [
      "What is the base salary, pay frequency and currency?",
      "Is the bonus guaranteed or variable, and what determines payout?",
      "For equity, what are the vesting schedule, exercise terms and liquidity limits?",
      "What benefits, leave, work location and schedule are included in writing?",
      "Are there conditions, probation terms or restrictive clauses to review?",
      "What is the response deadline, and who can answer questions about the written terms?",
    ],
    checklist: [
      { id: "written", label: "Get the complete offer in writing" },
      {
        id: "total",
        label:
          "Separate guaranteed pay from estimates and variable compensation",
      },
      {
        id: "priorities",
        label: "Choose the two terms that matter most to you",
      },
      { id: "evidence", label: "Prepare a truthful reason for your request" },
      {
        id: "review",
        label:
          "Review conditions and ask a qualified adviser about unclear legal or tax terms",
      },
      { id: "confirm", label: "Confirm the final agreed terms before signing" },
    ],
    caveat:
      "This is a conversation draft and arithmetic, not a market salary estimate or legal, tax or financial advice. Bonus and equity inputs are your annual estimates, not guaranteed cash.",
  };
}
export function preparationProgress(prep = {}) {
  const lessons = Array.isArray(prep.course) ? prep.course : [],
    completed = lessons.filter((l) => l.done).length,
    answered = Array.isArray(prep.mock?.answers) ? prep.mock.answers.length : 0,
    totalQuestions = Array.isArray(prep.questions) ? prep.questions.length : 0;
  return {
    completedLessons: completed,
    totalLessons: lessons.length,
    answeredQuestions: answered,
    totalQuestions,
    percent: lessons.length
      ? Math.round((completed / lessons.length) * 100)
      : 0,
    label: "Practice progress, not a prediction of interview success",
  };
}
export default {
  analyzeJob,
  createPreparation,
  create,
  generateCourse,
  generateQuestions,
  buildResearch,
  researchChecklist,
  evaluateAnswer,
  generateApplicationKit,
  generateProfileKit,
  negotiateOffer,
  preparationProgress,
};
