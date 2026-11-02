import trntRole from './trnt-4cc1eae081ce53ed.role.json' with { type: 'json' };

const trntLabels = {
  'workshop-design': 'Workshop design',
  'prototype-coaching': 'Prototype coaching',
  'accessible-explanation': 'Plain-language explanation',
  'learner-adaptation': 'Mixed-experience groups',
  'product-entrepreneurship': 'Entrepreneurship for students',
  'student-reasoning': 'Students explaining their work',
  'mentoring-feedback': 'Feedback that leaves the work with the student',
  'team-collaboration': 'Planning with the TRNT team'
};

function labeled(role, labels, phrases) {
  return {
    schema: role.schema,
    company: role.company,
    title: role.title,
    location: role.location,
    workArrangement: role.workArrangement,
    compensation: role.compensation,
    employmentTypes: role.employmentTypes,
    audience: role.audience,
    roleFamily: role.roleFamily,
    seniority: role.seniority,
    competencies: role.competencies.map(item => ({ ...item, label: labels[item.id] || item.label })),
    projectExamplesFromAd: role.projectExamplesFromAd,
    namedRequiredTools: role.namedRequiredTools,
    teachingCredentialRequired: role.teachingCredentialRequired,
    teachingExperience: role.teachingExperience,
    candidateEvidenceNeeded: role.candidateEvidenceNeeded,
    generalGuidanceNotClaimedAsEmployerPolicy: role.generalGuidanceNotClaimedAsEmployerPolicy,
    exclusionChecks: role.exclusionChecks,
    exclusionPhrases: phrases,
    source: {
      submittedUrl: role.source.submittedUrl ?? null,
      canonicalUrl: role.source.canonicalUrl ?? null,
      provider: role.source.provider ?? null,
      externalJobId: role.source.externalJobId ?? null,
      retrieval: role.source.retrieval
    }
  };
}

const workshopEvidence = 'Design and deliver engaging, hands-on AI and innovation workshops for students aged 8–18.';
const prototypeEvidence = 'Help students transform their ideas into functional prototypes, digital creations, or real-world solutions.';
const explainEvidence = 'Ability to explain technical or creative concepts in an engaging and accessible way.';
const adaptEvidence = 'Ability to work collaboratively and adapt to students with different skill levels.';
const ventureEvidence = 'Introduce practical applications of AI, creative problem-solving, product development, and entrepreneurship.';

const trntProfile = labeled(trntRole, trntLabels, ['Founding Engineer']);

const backendProfile = {
  schema: 'nextstep.role-profile.v1',
  company: 'Northwind Ledger',
  title: 'Senior Backend Engineer',
  location: 'Remote, Canada',
  workArrangement: 'Remote',
  compensation: 'CAD 160000 to 190000',
  employmentTypes: ['Full-time'],
  audience: null,
  roleFamily: 'Backend services for a double-entry financial ledger',
  seniority: 'senior',
  competencies: [
    { id: 'posting-service', priority: 'core', label: 'Posting service', evidence: 'Design the posting API so concurrent transfers cannot leave account balances inconsistent.', learningObjective: 'Design a posting API whose transaction boundary keeps both sides of a transfer consistent.' },
    { id: 'idempotent-consumers', priority: 'core', label: 'Idempotent consumers', evidence: 'Kafka consumers must retry a transfer event without posting it twice.', learningObjective: 'Make a retried Kafka event a no-op when the transfer id was already posted.' },
    { id: 'incident-response', priority: 'core', label: 'Incident response', evidence: 'Lead an incident when settlement is delayed, including customer impact and a written timeline.', learningObjective: 'Lead a delayed-settlement incident with impact, a rollback choice, and a timeline someone else can read.' },
    { id: 'mentoring', priority: 'core', label: 'Design mentoring', evidence: 'Review a mid-level engineer design and leave the decision with them.', learningObjective: 'Review a design so the other engineer still owns the decision.' },
    { id: 'operational-ownership', priority: 'core', label: 'On-call ownership', evidence: 'Own on-call for the posting service, including paging thresholds and safe deploys.', learningObjective: 'Set paging thresholds and a deploy check that a tired on-call engineer can follow.' }
  ],
  projectExamplesFromAd: ['A transfer posting API', 'A reconciliation job against PostgreSQL'],
  namedRequiredTools: ['Go', 'PostgreSQL', 'Kafka', 'AWS'],
  teachingCredentialRequired: null,
  teachingExperience: null,
  candidateEvidenceNeeded: ['A service you designed where a retry could have double-applied money', 'An incident you led and what the customer actually saw', 'A design review where you did not take the decision away'],
  generalGuidanceNotClaimedAsEmployerPolicy: ['On-call health and escalation policy should be confirmed with the employer. The ad does not describe them.', 'Practice scenarios are exercises, not predicted interview questions.'],
  exclusionChecks: ['Do not turn this into a youth workshop', 'Do not invent a frontend framework or a mobile app requirement'],
  exclusionPhrases: ['youth workshop', 'shrink walk'],
  source: {
    submittedUrl: null,
    canonicalUrl: null,
    provider: 'synthetic-fixture',
    externalJobId: null,
    retrieval: 'synthetic-senior-backend-fixture'
  }
};

const retailProfile = {
  schema: 'nextstep.role-profile.v1',
  company: 'Harbor & Co.',
  title: 'Store Manager',
  location: 'Halifax, NS',
  workArrangement: 'In person',
  compensation: 'CAD 28 per hour',
  employmentTypes: ['Full-time'],
  audience: null,
  roleFamily: 'Daily leadership of a neighborhood retail store',
  seniority: 'manager',
  competencies: [
    { id: 'floor-leadership', priority: 'core', label: 'Floor leadership', evidence: 'Run the opening checklist and keep the floor covered during breaks and deliveries.', learningObjective: 'Open the store with a checklist and keep registers and the floor covered.' },
    { id: 'customer-recovery', priority: 'core', label: 'Customer recovery', evidence: 'Resolve a customer complaint about a damaged item before it becomes a return dispute.', learningObjective: 'Recover a damaged-item complaint without inventing a policy the store did not state.' },
    { id: 'inventory-shrink', priority: 'core', label: 'Shrink and inventory', evidence: 'Walk high-theft categories each week and explain any shrink variance to the district lead.', learningObjective: 'Do a shrink walk and explain a variance with a count, not a hunch.' },
    { id: 'scheduling-coaching', priority: 'core', label: 'Scheduling and coaching', evidence: 'Build the Sunday roster and coach a new cashier through a slow transaction.', learningObjective: 'Write a Sunday roster that covers breaks, then coach a cashier without taking over the till.' },
    { id: 'safe-close', priority: 'core', label: 'Safe close', evidence: 'Close the store, secure the till, and leave a note the morning manager can act on.', learningObjective: 'Close tills and leave a note that tells the next manager what is unfinished.' }
  ],
  projectExamplesFromAd: ['Sunday roster', 'Damaged kettle complaint', 'Weekly shrink walk'],
  namedRequiredTools: [],
  teachingCredentialRequired: null,
  teachingExperience: null,
  candidateEvidenceNeeded: ['A time you recovered an unhappy customer', 'A schedule you built around a constraint', 'A count or checklist you used to close or open a shift'],
  generalGuidanceNotClaimedAsEmployerPolicy: ['Discount and return limits should be confirmed with the store. The ad does not list them.', 'Practice scenes are exercises, not predicted interview questions.'],
  exclusionChecks: ['Do not turn this into a software engineering interview', 'Do not invent a commission plan or a specific POS brand'],
  exclusionPhrases: ['Kafka', 'prototype'],
  source: {
    submittedUrl: null,
    canonicalUrl: null,
    provider: 'synthetic-fixture',
    externalJobId: null,
    retrieval: 'synthetic-store-manager-fixture'
  }
};

function lesson(fields) {
  return fields;
}

const trntCatalog = {
  schema: 'nextstep.plan-catalog.v1',
  lessons: [
    lesson({
      id: 'workshop-design-main',
      competencyId: 'workshop-design',
      title: 'Plan a workshop that ends with something a student made',
      objective: 'Design an age-appropriate workshop with one tangible output, a success check, and a timebox.',
      minutes: 8,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: null,
      adClaims: [workshopEvidence],
      body: 'Decide the age band before you choose the tool. Students aged 8 to 12 need one output they can point at, not a tour of features. A 90 minute block usually holds a warm-up, a build, and a show-back. Write the success check in their words: a classmate can ask the chatbot a question, or the poster names who the invention helps. Stop the build while there is still time to talk, so you are not finishing the project for them.',
      deepBody: 'Write the session as three columns: minutes, what the student does, and what you do if they stall. For ages 8 to 12, the build step should be shorter than the explanation. For ages 15 to 18, add a constraint such as a budget or a real user. Bring a backup output that still counts if the tool fails, such as a paper storyboard of the same invention. The ad asks you to design and deliver the workshop, so your example should name the age, the output, and the timebox.',
      example: 'A Saturday group of 10 year olds builds a paper prototype of a lunch-line helper, then uses one AI tool only to rewrite the instructions in simpler words. Success is that another student can follow the instructions.',
      exercise: 'Sketch a 90 minute plan for ages 11 to 12. Name the output, the success check, and the minute you will stop building.'
    }),
    lesson({
      id: 'prototype-coaching-main',
      competencyId: 'prototype-coaching',
      title: 'Help a student shrink an idea into a prototype',
      objective: 'Coach a learner to scope one testable piece and check whether it solves the problem they named.',
      minutes: 8,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: null,
      adClaims: [prototypeEvidence],
      body: 'Students often arrive with a whole product: a game, a robot, and a business. Your job is to help them pick the smallest piece that can be tried today. Ask what the user will do in the first minute, then cut everything else. A functional prototype can be a clickable paper screen, a short animation, or a chatbot that answers only three questions. Check the prototype against the problem they stated, not against how polished it looks.',
      deepBody: 'Use a three-question gate before they build: who is it for, what does that person do today, and what will be different after this small version. If they cannot answer, they are not ready to add features. When they want a new tool, ask which part of the problem it tests. The ad includes websites, games, animations, and robotics as examples, so your coaching should fit the project they actually brought, not a project you wish they had chosen.',
      example: 'A 16 year old wants an app that fixes climate change. You help them prototype one screen that lets a neighbor log a broken bike rack, then ask whether that neighbor would use it.',
      exercise: 'Take one project example from the ad and write the smallest version a student could finish in one session.'
    }),
    lesson({
      id: 'accessible-explanation-main',
      competencyId: 'accessible-explanation',
      title: 'Explain one AI idea at two ages',
      objective: 'Explain the same concept without unexplained jargon, then check what the student can say back.',
      minutes: 7,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: null,
      adClaims: [explainEvidence],
      body: 'Pick one concept you will actually use in the room, such as why an AI guess can be wrong. For a younger student, use a classroom object: the model is like a classmate who finishes your sentence and sometimes finishes it wrongly. For an older student, name the limit: it does not know your local street just because it sounds confident. After the explanation, ask them to teach it back in one sentence. If they repeat your jargon, the explanation is not done.',
      deepBody: 'Prepare two versions before the session and a check question for each. Avoid naming a tool setting you will not have time to show. When a student asks a question you cannot answer, say so and write it down instead of inventing a rule. The ad asks for an engaging and accessible explanation, so the practice is the translation, not a list of model names.',
      example: 'You explain a training example with a lunch menu. Younger students sort foods the model has seen. Older students point out a food from home that the menu never included, and say what the model might wrongly guess.',
      exercise: 'Write a six-sentence explanation of one concept for age 9 and another for age 17. End each with a check question.'
    }),
    lesson({
      id: 'learner-adaptation-main',
      competencyId: 'learner-adaptation',
      title: 'Keep a mixed group working without doing it for them',
      objective: 'Use a scaffold, a paired role, and an extension so different skill levels stay in the same workshop.',
      minutes: 7,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: null,
      adClaims: [adaptEvidence],
      body: 'In one room you will have a student who has never saved a file and a student who already builds games. Give both the same goal and different supports. The newer student gets a starter with blanks. The experienced student gets a constraint, such as removing a feature so a younger partner can use it. Pair them with roles: one operates, one describes. You circulate with questions. You do not take the keyboard to make the demo look finished.',
      deepBody: 'Plan the extension before the session or the faster student will invent chaos. A good extension still serves the same output: extra test, clearer instructions, or a second user. If someone is stuck for more than a few minutes, change the scaffold, not the goal. The ad asks you to adapt to different skill levels, so your story should show both students still doing the work.',
      example: 'During a chatbot workshop, one student freezes on the first prompt and another wants to add three features. You hand the first a prompt frame and ask the second to write the test questions the first student will try.',
      exercise: 'Describe the starter, the extension, and the paired roles for one activity. Say what you will not take over.'
    }),
    lesson({
      id: 'venture-main',
      competencyId: 'product-entrepreneurship',
      title: 'Start from a user, not from the tool',
      objective: 'Teach a student to name a user and a problem before they add more technology.',
      minutes: 8,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: null,
      adClaims: [ventureEvidence],
      body: 'Entrepreneurship in this workshop is not a slide about startups. It is a student saying who has a problem and how they would know a small product helped. Ask them to interview one person, even a classmate, before they open a tool. The value sentence should fit on a sticky note: who, problem, and what changes. A business concept, a digital product, or a simple tool that solves an everyday problem all count. A clever demo with no user does not.',
      deepBody: 'Have them test the sentence with someone who is not their friend in the group. If that person shrugs, the problem is still vague. Price, ads, and a company name can wait. The ad pairs product development with entrepreneurship, so the practice is the user test, not a pitch costume.',
      example: 'A student wants an AI poster shop. You ask who would pay or even stop to look. They talk to the school play committee and come back with one needed poster, not a store.',
      exercise: 'Write the sticky-note value sentence for a student project, then the question they would ask a real user.'
    }),
    lesson({
      id: 'mentor-transfer',
      competencyId: 'workshop-design',
      title: 'Bring a non-teaching background into a youth workshop',
      objective: 'Translate a project you already built into a workshop move a student can try.',
      minutes: 8,
      kind: 'transfer',
      generalGuidance: true,
      fitsSeniority: null,
      adClaims: [],
      body: 'You do not need a teaching certificate for this ad. Previous teaching is an asset, not a requirement. If your background is a studio, a lab, or a hobby project, pick one decision you made and turn it into a student step. Drop the workplace jargon. Keep the decision: who the thing was for, what you cut, and how you knew it worked. General practice guidance: confirm safeguarding with the employer. The ad does not state those policies.',
      deepBody: 'Write a one minute story that names your real project and then the student version. Do not claim you taught a class you did not teach. The transferable piece is the decision, not a job title. Say what you would still need to learn about working with young people.',
      example: 'You once built a small chatbot for a community newsletter. In the workshop you show only the step where you deleted half the features so a volunteer could use it, and you ask students which half they would cut.',
      exercise: 'Name one real project. Write the student step it becomes, and one thing you would not claim.'
    }),
    lesson({
      id: 'stage-screening',
      competencyId: 'accessible-explanation',
      title: 'A short first conversation about this mentor role',
      objective: 'Introduce yourself with one real project and one workshop idea, without guessing company policy.',
      minutes: 6,
      kind: 'stage',
      stage: 'screening',
      generalGuidance: true,
      fitsSeniority: null,
      adClaims: [],
      body: 'A first conversation usually has time for a short introduction, why this role, and one concrete example. Say what you built and who it was for. Then offer one workshop idea with an age and an output. Do not invent TRNT policies, a required language, or a certificate the ad does not ask for. General practice guidance: this is not a predicted script.',
      deepBody: 'Keep the introduction under a minute. If you are early in your career, use a school or personal project you actually finished. If you are asked about pay or hours, use only the figures in the ad and ask what a typical week looks like.',
      example: 'You say you built a storytelling bot for a cousin, then describe a 90 minute workshop where 12 year olds storyboard a helper for a school problem.',
      exercise: 'Say your introduction aloud once. Cut any sentence that is not about you or this role.'
    }),
    lesson({
      id: 'stage-skills',
      competencyId: 'learner-adaptation',
      title: 'A scenario conversation about a mixed workshop',
      objective: 'Walk through a mixed-skill room with the moves you would make in the moment.',
      minutes: 8,
      kind: 'stage',
      stage: 'skills',
      generalGuidance: true,
      fitsSeniority: null,
      adClaims: [],
      body: 'In a skills conversation, expect a scene: the tool fails, one student finishes early, another is lost. Narrate what you would say and what the students would still do. General practice guidance: do not present the scene as the employer\'s actual question. Tie your moves to workshop design, explanation, or adaptation, because those are in the ad.',
      deepBody: 'Structure the answer as what you notice, what you change, and how you check. Mention a backup output if the tool is down. Leave the work with the students.',
      example: 'The animation tool will not load. You switch the group to a paper storyboard of the same invention and ask the fast student to write the test the others will try.',
      exercise: 'Answer this scene in five sentences: two students, one broken tool, ten minutes left.'
    })
  ],
  quiz: [
    {
      id: 'quiz-workshop-output',
      competencyId: 'workshop-design',
      question: 'You have 90 minutes with students aged 11. What is the strongest workshop plan?',
      options: ['One output they can show, a success check in their words, and a timebox', 'A tour of as many AI tools as possible, with the build left for homework', 'A lecture on startup vocabulary, then a quiz on definitions'],
      correctIndex: 0,
      why: 'The ad asks for a hands-on workshop. A single output and a timebox fit the room better than a tool tour.'
    },
    {
      id: 'quiz-prototype-scope',
      competencyId: 'prototype-coaching',
      question: 'A student wants a game, a robot, and a shop. What should you coach first?',
      options: ['The smallest piece they can test with one user today', 'A full product roadmap with milestones for the year', 'Your own idea, because it will look better at show-back'],
      correctIndex: 0,
      why: 'Prototype coaching means shrinking the idea until it can be tried, then checking it against the problem.'
    },
    {
      id: 'quiz-explain',
      competencyId: 'accessible-explanation',
      question: 'How do you know an explanation was accessible?',
      options: ['The student can teach the idea back without your jargon', 'You used the official term at least three times', 'You finished the explanation even if nobody asked a question'],
      correctIndex: 0,
      why: 'An accessible explanation is checked by what the student can say, not by how complete your script felt.'
    },
    {
      id: 'quiz-adapt',
      competencyId: 'learner-adaptation',
      question: 'One student is stuck and another is far ahead. What fits this role?',
      options: ['A starter for one and an extension for the other, while both keep the same goal', 'You finish the stuck student\'s project so the demo looks even', 'You send the advanced student out so the room is easier'],
      correctIndex: 0,
      why: 'The ad asks you to adapt to different skill levels, not to do the work for the student.'
    }
  ],
  scenarios: [
    {
      id: 'scene-workshop',
      competencyId: 'workshop-design',
      stageFit: ['skills', 'panel', 'final'],
      opening: 'Walk me through a workshop you would actually run for 12 year olds. What do they leave holding, and how do you know it worked?',
      followUps: ['What do you cut if the group is restless after twenty minutes?', 'What is your backup if the tool will not load?']
    },
    {
      id: 'scene-explain',
      competencyId: 'accessible-explanation',
      stageFit: ['screening', 'skills', 'any'],
      opening: 'Explain an AI idea you would teach in this program as if I were 10, then tell me how you would check I understood.',
      followUps: ['What word would you refuse to use with that age, and why?', 'How would the same idea change for a 17 year old?']
    },
    {
      id: 'scene-adapt',
      competencyId: 'learner-adaptation',
      stageFit: ['skills', 'panel'],
      opening: 'Two students are in the same chatbot activity. One has never typed a prompt. The other wants three extra features. What do you do in the next ten minutes?',
      followUps: ['What does each student still do themselves?', 'How do you know you did not take the work away?']
    }
  ]
};

const postingEvidence = 'Design the posting API so concurrent transfers cannot leave account balances inconsistent.';
const kafkaEvidence = 'Kafka consumers must retry a transfer event without posting it twice.';
const incidentEvidence = 'Lead an incident when settlement is delayed, including customer impact and a written timeline.';
const mentorEvidence = 'Review a mid-level engineer design and leave the decision with them.';
const oncallEvidence = 'Own on-call for the posting service, including paging thresholds and safe deploys.';

const backendCatalog = {
  schema: 'nextstep.plan-catalog.v1',
  lessons: [
    lesson({
      id: 'posting-main',
      competencyId: 'posting-service',
      title: 'Keep both sides of a transfer in one boundary',
      objective: 'Design a posting API that cannot commit one account without the other.',
      minutes: 9,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: 'senior',
      adClaims: [postingEvidence],
      body: 'A ledger transfer is two balance changes that must succeed or fail together. If the debit commits and the credit does not, the books are wrong even though no exception reached the client. Put both postings in one PostgreSQL transaction, or use an outbox that records the intent and the result in the same commit. Idempotency belongs on the transfer id, not on a hope that the client will not retry. Senior work here is naming the failure you refuse to leave behind.',
      deepBody: 'Draw the states: requested, posted, rejected. Say which state is visible to the account holder. A retry of a posted transfer returns the original result. A crash after the commit but before the response is still posted, which is why the transfer id is unique. Do not add a second service inside the transaction just to make the diagram look complete. Go is the implementation language in the ad. The boundary matters more than the framework.',
      example: 'Two transfers hit the same account. Your transaction locks the rows in a stable order, posts debit and credit, and a repeated request with the same transfer id returns the first receipt instead of moving the money again.',
      exercise: 'Write the states of a transfer and the one database constraint that stops a double post.'
    }),
    lesson({
      id: 'kafka-main',
      competencyId: 'idempotent-consumers',
      title: 'Retry a Kafka event without paying twice',
      objective: 'Make a replayed transfer event a no-op after the ledger has posted it.',
      minutes: 8,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: 'senior',
      adClaims: [kafkaEvidence],
      body: 'Consumers crash. Kafka will deliver the event again. If your handler posts first and records the offset later, the second delivery posts the money twice. Store the transfer id in PostgreSQL in the same transaction as the posting, and treat a duplicate key as success. Committing the offset only after that transaction is the basic version. The senior version is being able to say what the customer sees on the retry: the same receipt, not a second debit.',
      deepBody: 'Walk a crash at three points: before the post, after the post but before the offset commit, and after both. Only the middle one is dangerous if the transfer id is not unique. Poison messages need a parking topic and a human note, not an infinite retry. The ad names Kafka and PostgreSQL. Do not swap in a queue the ad did not ask for.',
      example: 'A settlement consumer dies after inserting the ledger rows. On restart the same event hits a unique transfer id, the handler returns the stored receipt, and the offset moves forward.',
      exercise: 'List the three crash points and what your handler does at each one.'
    }),
    lesson({
      id: 'incident-main',
      competencyId: 'incident-response',
      title: 'Lead a delayed settlement without guessing the impact',
      objective: 'State customer impact, choose a rollback or a wait, and leave a timeline.',
      minutes: 8,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: 'senior',
      adClaims: [incidentEvidence],
      body: 'When settlement is late, the first fact is who is waiting and what they were promised. Count the stuck transfers before you rewrite code. Decide whether to pause producers, replay from a known offset, or roll back a deploy. Write the timeline as you go: what you observed, what you changed, and what you left for the next person. A senior answer separates the customer impact from the technical cause. It does not end at "we restarted it."',
      deepBody: 'Practice a 15 minute update: impact, current state, next check, and what you will not do yet. If you do not know whether money moved, say that, and name the query that will answer it. The ad asks for a written timeline. Your story should include one sentence someone could paste into that timeline.',
      example: 'Transfers after 14:10 are stuck. You stop the consumer, confirm posted rows match receipts, roll back the deploy that changed the offset commit, and write the times into the incident note.',
      exercise: 'Draft a five line timeline for a delayed settlement. Include one thing you refused to change yet.'
    }),
    lesson({
      id: 'mentor-main',
      competencyId: 'mentoring',
      title: 'Review a design and leave the decision there',
      objective: 'Give a mid-level engineer a review that surfaces risk without taking ownership away.',
      minutes: 7,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: 'senior',
      adClaims: [mentorEvidence],
      body: 'A useful review names the risk and asks for the decision. "This transaction stays open across the network call. What happens if that call hangs?" is a review. Rewriting their design in the comment is not. Ask what they considered and what they would watch in production. Agree on the owner of the follow-up. Senior scope in this ad includes the review, not collecting every design for yourself.',
      deepBody: 'Bring one real review you gave, with the risk you spotted and the choice the other person made. If they disagreed, say what you did next. Do not invent a mentoring program the ad does not describe. The evidence you need is a decision you left with someone else.',
      example: 'A mid-level engineer wants to commit the Kafka offset in a separate step. You ask them to show the crash window. They add a unique transfer id and keep the offset commit after the database transaction. You do not take the keyboard.',
      exercise: 'Write three review questions that leave the posting design decision with the other engineer.'
    }),
    lesson({
      id: 'oncall-main',
      competencyId: 'operational-ownership',
      title: 'Page on customer harm, not on every retry',
      objective: 'Choose a paging threshold and a deploy check another on-call engineer can run half asleep.',
      minutes: 7,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: 'senior',
      adClaims: [oncallEvidence],
      body: 'Owning the posting service means the page means something. A single consumer retry is not an incident. A rise in transfers that are requested but not posted is. Write the threshold in the same words as the customer effect: receipts older than five minutes, or a gap between Kafka lag and posted rows. The deploy check is a small transfer in a test account and a query that shows one debit and one credit. Safe means you can undo it.',
      deepBody: 'Say what you would silence and for how long. A silenced page needs an owner and an end time. The ad does not describe the employer\'s escalation policy, so treat health and escalation as something to confirm, not as a fact. Your practice is the threshold and the deploy check.',
      example: 'You page when posted transfers fall while requests continue for five minutes. The deploy check sends one transfer and reads both rows back before traffic moves.',
      exercise: 'Write one paging rule and the exact check you would run after a deploy.'
    }),
    lesson({
      id: 'backend-transfer',
      competencyId: 'posting-service',
      title: 'Move into ledger work from a different backend',
      objective: 'Connect a service you have shipped to the consistency problem in this ad.',
      minutes: 8,
      kind: 'transfer',
      generalGuidance: true,
      fitsSeniority: 'senior',
      adClaims: [],
      body: 'If you have not posted money before, do not pretend you have. Pick a service where a retry could duplicate a side effect: an email, a shipment, a booking. Explain the id you used, or the bug you would fix now. Then map that lesson onto a transfer: two rows, one id, one transaction. General practice guidance: say what you would still want to pair on before owning on-call alone. This is not a claim that the employer will train you.',
      deepBody: 'Keep the old story short and the mapping specific. Name the table or the key you would introduce. Avoid a tour of every system you have seen.',
      example: 'You once double-sent receipts because the job retried after a timeout. You would bring that scar to the transfer id, and you would ask to shadow one settlement incident before you are primary on-call.',
      exercise: 'Write the bridge: your real retry bug, then the ledger constraint it teaches you to ask about.'
    }),
    lesson({
      id: 'backend-screening',
      competencyId: 'posting-service',
      title: 'A short first conversation about the ledger role',
      objective: 'Introduce one real system and why consistency matters, without a tool dump.',
      minutes: 6,
      kind: 'stage',
      stage: 'screening',
      generalGuidance: true,
      fitsSeniority: 'senior',
      adClaims: [],
      body: 'Use the first conversation for one system you shipped and the failure it was built to avoid. Mention Go, PostgreSQL, Kafka, or AWS only where you actually used them. The ad requires those tools, so a gap should be stated plainly. General practice guidance: do not invent on-call rotations or a team size. This is not a predicted script.',
      deepBody: 'Close by asking what a bad week on this service looks like. That question fits a senior role better than a list of frameworks.',
      example: 'You describe a booking service that used a unique request id to survive retries, then say you have production Go and PostgreSQL and would want a paired week on their Kafka consumer.',
      exercise: 'Cut your introduction until it has one failure and one question for them.'
    }),
    lesson({
      id: 'backend-skills',
      competencyId: 'idempotent-consumers',
      title: 'A scenario conversation about a double post',
      objective: 'Talk through a replayed event and the check that proves money moved once.',
      minutes: 8,
      kind: 'stage',
      stage: 'skills',
      generalGuidance: true,
      fitsSeniority: 'senior',
      adClaims: [],
      body: 'Expect a scene, not a trivia question about a library. They may ask what happens if the consumer crashes after the insert. Draw the crash, name the unique key, and say what you would query to prove the transfer exists once. General practice guidance: this scene is practice. It is not the employer\'s question bank.',
      deepBody: 'If you do not know their exact schema, say which two facts you would look up before changing code: whether the transfer id is unique, and whether the offset commit is inside the same transaction.',
      example: 'You ask to see one stuck transfer id in both the topic and the ledger. If the row exists, you move the offset. If it does not, you replay that id only.',
      exercise: 'Answer the crash-after-insert scene in six sentences. Include the query you would run.'
    })
  ],
  quiz: [
    {
      id: 'quiz-boundary',
      competencyId: 'posting-service',
      question: 'Two balances change in one transfer. What keeps them consistent under concurrency?',
      options: ['One transaction, or one commit that records both sides and the transfer id', 'A longer HTTP timeout so the second call can catch up', 'Writing the credit first and the debit in a later job with no shared id'],
      correctIndex: 0,
      why: 'The ad is about balances staying consistent. Separate commits without a shared id can leave one side posted.'
    },
    {
      id: 'quiz-retry',
      competencyId: 'idempotent-consumers',
      question: 'A Kafka consumer crashes after the ledger insert and before the offset commit. What stops a double post?',
      options: ['A unique transfer id so the replay finds the original post and does not insert again', 'More partitions, so the event lands on a fresh consumer', 'Turning retries off and dropping the event'],
      correctIndex: 0,
      why: 'The ad says a retry must not post twice. The transfer id makes the second delivery a no-op.'
    },
    {
      id: 'quiz-incident',
      competencyId: 'incident-response',
      question: 'Settlement is late. What belongs in the first update?',
      options: ['Who is waiting, what you know, and the next check, written into a timeline', 'A full rewrite of the consumer before you count the stuck transfers', 'A promise that no customer noticed, before you look'],
      correctIndex: 0,
      why: 'The ad asks for customer impact and a written timeline, not a silent rewrite.'
    },
    {
      id: 'quiz-review',
      competencyId: 'mentoring',
      question: 'A mid-level engineer brings you a posting design. What matches this role?',
      options: ['Name the risk and leave the decision with them', 'Replace their design with yours in the same review', 'Approve it quickly so the meeting can end'],
      correctIndex: 0,
      why: 'The ad says to review the design and leave the decision with them.'
    }
  ],
  scenarios: [
    {
      id: 'scene-double-post',
      competencyId: 'idempotent-consumers',
      stageFit: ['skills', 'panel', 'final'],
      opening: 'A transfer event is delivered twice after a consumer crash. Walk me through what you check before you touch the ledger.',
      followUps: ['What would the account holder have seen if your check was wrong?', 'Where do you write that down for the next person on call?']
    },
    {
      id: 'scene-incident',
      competencyId: 'incident-response',
      stageFit: ['skills', 'panel', 'final'],
      opening: 'Settlement has been quiet for ten minutes. Requests are still arriving. What do you say in the first update, and what do you refuse to change yet?',
      followUps: ['How do you tell a delay from a double post?', 'What goes into the written timeline in the first half hour?']
    },
    {
      id: 'scene-review',
      competencyId: 'mentoring',
      stageFit: ['screening', 'panel', 'any'],
      opening: 'A mid-level engineer wants to commit the Kafka offset in a different step from the ledger write. How do you review that without taking the decision away?',
      followUps: ['What question do you ask them to answer in the design?', 'What would you still want to see in the pull request?']
    }
  ]
};

const openEvidence = 'Run the opening checklist and keep the floor covered during breaks and deliveries.';
const recoveryEvidence = 'Resolve a customer complaint about a damaged item before it becomes a return dispute.';
const shrinkEvidence = 'Walk high-theft categories each week and explain any shrink variance to the district lead.';
const rosterEvidence = 'Build the Sunday roster and coach a new cashier through a slow transaction.';
const closeEvidence = 'Close the store, secure the till, and leave a note the morning manager can act on.';

const retailCatalog = {
  schema: 'nextstep.plan-catalog.v1',
  lessons: [
    lesson({
      id: 'open-main',
      competencyId: 'floor-leadership',
      title: 'Open the floor so breaks and deliveries do not empty a zone',
      objective: 'Run an opening checklist and keep registers and the floor covered.',
      minutes: 7,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: 'manager',
      adClaims: [openEvidence],
      body: 'Opening is a sequence, not a mood. Lights, safe, tills, the delivery door, and who is on the floor before the first customer. When a delivery arrives at the same time as a break, you already know who slides to the door and who stays on the register. Write the names on the checklist. A manager who only "keeps an eye on it" finds the front empty. The ad is about coverage during breaks and deliveries, so your story needs those two interruptions.',
      deepBody: 'Make a one page opening list with times. Include who counts the till and who walks the floor first. If you are short a person, say which task waits and which does not. The door and the register do not both wait. Leave the list where the closer can see what you inherited.',
      example: 'Sunday open: you count the till with one cashier, send another to the delivery door, and delay the ad display until the floor has two people again.',
      exercise: 'Write a 20 minute opening list that still covers the register when a delivery truck arrives.'
    }),
    lesson({
      id: 'recovery-main',
      competencyId: 'customer-recovery',
      title: 'Handle a damaged kettle without inventing a policy',
      objective: 'Recover a damaged-item complaint using only the authority you actually have.',
      minutes: 8,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: 'manager',
      adClaims: [recoveryEvidence],
      body: 'A customer brings a kettle with a cracked lid and a receipt from last week. You listen to the whole story before you offer a path. You do not invent a discount, a delivery promise, or a rule the ad never stated. You can offer the options your store already uses, or you can say you need the district lead if the request is outside them. The goal in the ad is to resolve the complaint before it hardens into a dispute. That means a clear next step today, not a speech.',
      deepBody: 'Practice the sentence you will use when you cannot say yes: what you can do today, what you cannot, and when they will hear the rest. Write down the receipt date and the damage in the note. Confirm return limits with the store. The ad does not list them, so do not memorize a fake policy for the interview.',
      example: 'The kettle arrived cracked. You apologize, offer the exchange your store already allows for damaged goods, and if they want extra compensation you write the request for the district lead instead of making up a number.',
      exercise: 'Script the first minute of the kettle complaint, including the sentence where you do not invent a rule.'
    }),
    lesson({
      id: 'shrink-main',
      competencyId: 'inventory-shrink',
      title: 'Explain a shrink number with a count',
      objective: 'Walk high-theft categories and explain a variance with what you counted.',
      minutes: 7,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: 'manager',
      adClaims: [shrinkEvidence],
      body: 'Shrink talk without a count is a hunch. Walk the categories the store already treats as high theft. Compare the shelf to the expected on-hand. Note misses, damage, and a mis-scan you watched. When you tell the district lead, lead with the number and the category, then the likely cause you actually saw. "People steal" is not an explanation. A missing case of headphones and two unscanned small items is.',
      deepBody: 'Pick three categories and a day of the week. Write what you would photograph or count. Separate known damage from unknown loss. The ad asks for a weekly walk and an explanation of variance. Your practice answer should sound like that note, not like a loss-prevention slogan.',
      example: 'Headphones are short two units. You saw one leave in a damaged-return bin that was not written off, and one hole on the peg with no matching sale. You send that, not a speech about culture.',
      exercise: 'Write the note to the district lead for one variance. Include the count and one cause you saw.'
    }),
    lesson({
      id: 'roster-main',
      competencyId: 'scheduling-coaching',
      title: 'Build Sunday coverage, then coach the till',
      objective: 'Write a Sunday roster that covers breaks, and coach a cashier without taking the sale.',
      minutes: 8,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: 'manager',
      adClaims: [rosterEvidence],
      body: 'Sunday fails when the roster looks full but nobody can take a break after noon. Start from the legally required breaks and the busiest hour, then place people. A new cashier still needs a coach during a slow transaction. Stand where they can hear you and the customer cannot feel rushed. Prompt the next step. Do not reach over and finish the sale unless they ask you to take it. The ad pairs the roster and the coaching, so a strong answer includes both.',
      deepBody: 'Name the constraint: one person who cannot work past 15:00, a delivery at 11:00, and a trainee. Show the hour where two people overlap so the trainee can be slow. Coaching lines are short: "Tell them the total, then the bag." You still own the floor while you coach.',
      example: 'You put the trainee on a mid-morning till with you nearby, schedule your own break after the delivery, and leave the closer with two people for the last hour.',
      exercise: 'Sketch Sunday from open to close with one trainee. Mark the hour you will coach and the hour you will not be the only keyholder off the floor.'
    }),
    lesson({
      id: 'close-main',
      competencyId: 'safe-close',
      title: 'Leave a close note the morning manager can use',
      objective: 'Secure the till and write a note that says what is unfinished.',
      minutes: 6,
      kind: 'core',
      generalGuidance: false,
      fitsSeniority: 'manager',
      adClaims: [closeEvidence],
      body: 'Closing is the till, the doors, and a note. Count with a second person when you can. Write the number you got, not the number you hoped. The note tells the morning manager what is unfinished: a delivery still in the back, a customer returning for the kettle, a variance you did not finish explaining. "All good" is not a note. The ad asks for a note they can act on.',
      deepBody: 'Use three lines: money, building, people. If something is unsafe to leave, say what you did, not only what you noticed. Do not invent an alarm code or a cash limit the ad does not give. Ask the employer for those procedures.',
      example: 'You record the till, lock the office, and write: kettle customer returns Saturday with the receipt, two headphone units still unexplained, delivery left in aisle 3.',
      exercise: 'Write a six line close note from a messy Sunday. Include one unfinished customer issue.'
    }),
    lesson({
      id: 'retail-transfer',
      competencyId: 'floor-leadership',
      title: 'Move onto the floor from another kind of work',
      objective: 'Turn a real coordination example into a store opening or a roster decision.',
      minutes: 7,
      kind: 'transfer',
      generalGuidance: true,
      fitsSeniority: 'manager',
      adClaims: [],
      body: 'If you have not managed a store, use a time you covered a busy shift, a volunteer roster, or a cafe counter. Name the constraint and what you moved. Then map it onto this floor: who is on the register, who takes the delivery, what the customer hears. General practice guidance: do not claim retail years you do not have. Say which close procedure you would want to learn on a shadow shift.',
      deepBody: 'Keep the old workplace in one or two sentences. Spend the rest on the Harbor & Co. scene: Sunday, a trainee, a delivery. The interviewer should hear a floor decision, not a career summary.',
      example: 'You coordinated a weekend food stall with one person who had to leave early. You would use the same overlap idea on the Sunday roster so the trainee is never alone on the till.',
      exercise: 'Write the bridge from your real shift to one decision on this store\'s opening checklist.'
    }),
    lesson({
      id: 'retail-screening',
      competencyId: 'customer-recovery',
      title: 'A short first conversation about the store',
      objective: 'Introduce one real customer or team example and one question about the floor.',
      minutes: 6,
      kind: 'stage',
      stage: 'screening',
      generalGuidance: true,
      fitsSeniority: 'manager',
      adClaims: [],
      body: 'In a first conversation, tell one true story about a person you helped or a shift you organized. Then ask what a hard Sunday looks like in this store. Do not invent a commission plan or a point-of-sale brand. General practice guidance: this is not a predicted script. Hours and pay in your answer should match the ad or be asked as a question.',
      deepBody: 'If you are early in customer work, use a smaller true example and say what you want to learn about shrink counts. Honesty beats a polished store you never ran.',
      example: 'You describe calming a catering customer whose order was short, then ask how this store wants damaged goods handled before you promise anything.',
      exercise: 'Say a 45 second introduction that includes one action you took and one question for them.'
    }),
    lesson({
      id: 'retail-skills',
      competencyId: 'customer-recovery',
      title: 'A scenario conversation on the floor',
      objective: 'Handle a live complaint and a coverage gap in the same half hour.',
      minutes: 8,
      kind: 'stage',
      stage: 'skills',
      generalGuidance: true,
      fitsSeniority: 'manager',
      adClaims: [],
      body: 'A skills scene stacks the floor: the kettle complaint arrives while the delivery truck is at the door and one cashier is on break. Say who you move, what you tell the customer, and what you will not promise. General practice guidance: the scene is practice, not their question bank. Use the checklist, the complaint, and the roster, because those are the job.',
      deepBody: 'Answer in order: make the floor safe, then the customer, then the note. If you skip the note, the morning manager inherits a surprise.',
      example: 'You call the cashier back early from break only if the roster allows it, walk the customer to the side, offer the exchange you are allowed to offer, and send someone else to count the delivery.',
      exercise: 'Give the order of the next ten minutes for the kettle, the truck, and the break.'
    })
  ],
  quiz: [
    {
      id: 'quiz-open',
      competencyId: 'floor-leadership',
      question: 'A delivery arrives as a break starts. What matches this store manager role?',
      options: ['You already named who takes the door and who stays on the register', 'Everyone helps with the delivery and the register waits', 'You leave a sign and hope the regulars understand'],
      correctIndex: 0,
      why: 'The ad asks you to keep the floor covered during breaks and deliveries, which means the coverage was decided before the truck arrived.'
    },
    {
      id: 'quiz-kettle',
      competencyId: 'customer-recovery',
      question: 'A customer wants more than the usual exchange for a damaged kettle. What is the sound move?',
      options: ['Offer only what you are already allowed to do, and write down anything that needs a lead', 'Invent a partial refund so they leave happy', 'Argue the receipt until they give up'],
      correctIndex: 0,
      why: 'The ad asks you to resolve the complaint before it becomes a dispute, not to invent a policy.'
    },
    {
      id: 'quiz-shrink',
      competencyId: 'inventory-shrink',
      question: 'Headphones are short at the weekly walk. What do you tell the district lead?',
      options: ['The count, the category, and the cause you actually saw', 'That shrink is a culture problem and the team will try harder', 'Nothing until the month-end report, because one week does not matter'],
      correctIndex: 0,
      why: 'The ad asks you to explain a variance. A count beats a slogan.'
    },
    {
      id: 'quiz-coach',
      competencyId: 'scheduling-coaching',
      question: 'A new cashier is slow and a line is forming. What fits the ad?',
      options: ['Prompt the next step and let them finish, if the roster still covers the floor', 'Take the till immediately so the line looks efficient', 'Send them to the back for the rest of the shift'],
      correctIndex: 0,
      why: 'Coaching a slow transaction means the cashier still does it. Coverage is a roster problem, not a reason to grab the till every time.'
    }
  ],
  scenarios: [
    {
      id: 'scene-kettle',
      competencyId: 'customer-recovery',
      stageFit: ['skills', 'panel', 'screening'],
      opening: 'A customer says a kettle they bought last week arrived with a cracked lid. They want more than an exchange. What do you do in the first few minutes?',
      followUps: ['What do you say when the request is outside what you can approve?', 'What do you write down for the next manager?']
    },
    {
      id: 'scene-sunday',
      competencyId: 'scheduling-coaching',
      stageFit: ['skills', 'panel', 'final'],
      opening: 'Build Sunday in your head: one trainee, a delivery at 11, and someone who must leave at 15:00. Where do you stand, and when do you coach?',
      followUps: ['What happens to the register during that delivery?', 'Which hour is the risky one, and what do you change?']
    },
    {
      id: 'scene-shrink',
      competencyId: 'inventory-shrink',
      stageFit: ['skills', 'final', 'any'],
      opening: 'The headphone peg is short two units on your weekly walk. What do you check before you explain it to the district lead?',
      followUps: ['What would you refuse to claim as the cause?', 'What does the note say in two or three lines?']
    }
  ]
};

const trntAd = `${trntProfile.title} at ${trntProfile.company}. ${trntProfile.location}. ${trntProfile.workArrangement}. ${trntProfile.compensation}. ${trntProfile.employmentTypes.join(', ')}. ${trntProfile.audience}. ${trntProfile.competencies.map(item => item.evidence).join(' ')} Project examples: ${trntProfile.projectExamplesFromAd.join('; ')}. Previous teaching experience is an asset, but not required.`;

const backendAd = `${backendProfile.title} at ${backendProfile.company}. ${backendProfile.location}. ${backendProfile.compensation}. Tools: Go, PostgreSQL, Kafka, and AWS. ${backendProfile.competencies.map(item => item.evidence).join(' ')} Examples include a transfer posting API and a reconciliation job against PostgreSQL.`;

const retailAd = `${retailProfile.title} at ${retailProfile.company}. ${retailProfile.location}. ${retailProfile.compensation}. ${retailProfile.competencies.map(item => item.evidence).join(' ')} Examples include a Sunday roster, a damaged kettle complaint, and a weekly shrink walk.`;

export const packs = [
  {
    id: 'trnt-4cc1eae081ce53ed',
    title: 'Youth AI mentor',
    match: { jobIds: ['4cc1eae081ce53ed'], phrases: ['TRNT Educational Institute', 'AI Innovation & Entrepreneurship Mentor'] },
    profile: trntProfile,
    catalog: trntCatalog,
    sampleAd: trntAd
  },
  {
    id: 'senior-backend-engineer',
    title: 'Senior backend engineer',
    match: { jobIds: [], phrases: ['Northwind Ledger', 'Senior Backend Engineer'] },
    profile: backendProfile,
    catalog: backendCatalog,
    sampleAd: backendAd
  },
  {
    id: 'retail-store-manager',
    title: 'Retail store manager',
    match: { jobIds: [], phrases: ['Harbor & Co.', 'Store Manager'] },
    profile: retailProfile,
    catalog: retailCatalog,
    sampleAd: retailAd
  }
];

export function packById(id) {
  return packs.find(pack => pack.id === id) || null;
}
