import { handleTabKeys } from "../lib/accessibility.js";
import { useState, useEffect, useRef } from "react";
import {
  ArrowRight,
  ArrowLeft,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  BookOpen,
  MessageCircle,
  Search,
  Mic,
  Play,
  Pause,
  Volume2,
  RotateCcw,
  Clipboard,
  CalendarDays,
  ExternalLink,
  Target,
  Lightbulb,
  ShieldCheck,
  FileCheck2,
  Download,
  Square,
  ArrowUpRight,
  UserRound,
  Sparkles,
} from "lucide-react";
import { evaluateAnswer } from "../../engine.js";
import { copyText, safeURL, requestAPI } from "../lib/api.js";
import { shareDocument, lightHaptic } from "../lib/native.js";
import { CompanyMark } from "../App.jsx";
import AiCoach from "./AiCoach.jsx";
import CoachingNotes from "./CoachingNotes.jsx";
import { appendCoachingNote } from "../lib/coaching.js";
import Modal from "./Modal.jsx";
const sections = [
  { id: "plan", label: "Your learning path", icon: BookOpen },
  { id: "stories", label: "Story bank", icon: MessageCircle },
  { id: "research", label: "Know the people", icon: Search },
  { id: "practice", label: "Practice interview", icon: Play },
  { id: "day", label: "Interview day", icon: CalendarDays },
];
export default function Preparation({
  prep,
  onChange,
  profile,
  notify,
  capabilities,
}) {
  const [section, setSection] = useState("plan");
  const complete = prep.course.filter((l) => l.done).length;
  const percent = Math.round((complete / prep.course.length) * 100);
  const updateNote = (key, text) =>
    onChange({ ...prep, notes: { ...prep.notes, [key]: text } });
  const saveCoaching = (note) => {
    try {
      onChange({ ...prep, coaching: appendCoachingNote(prep.coaching, note) });
      return true;
    } catch (error) {
      notify(error.message);
      return false;
    }
  };
  return (
    <>
      <header className="preparation-heading">
        <div>
          <div className="preparation-company">
            <CompanyMark name={prep.company} />
            <span>
              {prep.company}
              {prep.sample && <span className="badge">Sample role</span>}
            </span>
          </div>
          <h1>
            Show up as your
            <br className="mobile-only" /> most prepared self.
          </h1>
          <p>
            A focused plan for your <strong>{prep.role}</strong> interview.
          </p>
        </div>
        <div
          className="completion-ring"
          style={{ "--progress": `${percent}%` }}
          aria-label={`${complete} of ${prep.course.length} lessons completed`}
        >
          <div>
            <strong>
              {percent}
              <small>%</small>
            </strong>
            <span>course complete</span>
          </div>
        </div>
      </header>
      <div className="preparation-meta">
        <span>
          <Clock size={14} />
          {prep.course.reduce((a, l) => a + l.minutes, 0)} min course
        </span>
        <span>
          <BookOpen size={14} />
          {prep.course.length} focused lessons
        </span>
        <span>
          <ShieldCheck size={14} />
          Based on your job ad
        </span>
      </div>
      <div
        className="tabs preparation-tabs"
        role="tablist"
        onKeyDown={handleTabKeys}
        aria-label="Interview preparation sections"
      >
        {sections.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            tabIndex={section === id ? 0 : -1}
            id={`prep-tab-${id}`}
            aria-selected={section === id}
            aria-controls={`prep-panel-${id}`}
            className={section === id ? "active" : ""}
            onClick={() => setSection(id)}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        id={`prep-panel-${section}`}
        aria-labelledby={`prep-tab-${section}`}
      >
        {section === "plan" && (
          <LearningPath
            prep={prep}
            onChange={onChange}
            updateNote={updateNote}
            notify={notify}
            onPractice={() => setSection("practice")}
            capabilities={capabilities}
            profile={profile}
            onSaveCoaching={saveCoaching}
          />
        )}
        {section === "stories" && (
          <StoryBank prep={prep} updateNote={updateNote} notify={notify} />
        )}
        {section === "research" && (
          <Research
            prep={prep}
            onChange={onChange}
            notify={notify}
            capabilities={capabilities}
          />
        )}
        {section === "practice" && (
          <MockPractice
            prep={prep}
            onChange={onChange}
            notify={notify}
            profile={profile}
            capabilities={capabilities}
            onSaveCoaching={saveCoaching}
          />
        )}
        {section === "day" && (
          <InterviewDay
            prep={prep}
            onChange={onChange}
            updateNote={updateNote}
            notify={notify}
          />
        )}
      </div>
      <CoachingNotes
        notes={prep.coaching}
        onChange={(coaching) => onChange({ ...prep, coaching })}
        notify={notify}
      />
    </>
  );
}
function LearningPath({
  prep,
  onChange,
  updateNote,
  notify,
  onPractice,
  capabilities,
  profile,
  onSaveCoaching,
}) {
  const [selected, setSelected] = useState(
    prep.course.findIndex((l) => !l.done) >= 0
      ? prep.course.findIndex((l) => !l.done)
      : 0,
  );
  const lesson = prep.course[selected];
  const answer = prep.quiz?.answers?.[lesson.id];
  function mark() {
    const done = !lesson.done;
    onChange({
      ...prep,
      course: prep.course.map((l, i) => (i === selected ? { ...l, done } : l)),
    });
    if (done) {
      notify("One more step forward. Lesson completed.");
      lightHaptic();
      if (selected < prep.course.length - 1) setSelected(selected + 1);
    }
  }
  return (
    <div className="learning-layout">
      <aside className="lesson-sidebar">
        <div className="lesson-sidebar-heading">
          <span className="eyebrow">YOUR ROUTE TO READY</span>
          <p>Learn a little. Make it yours.</p>
        </div>
        <ol className="lesson-list">
          {prep.course.map((l, i) => (
            <li key={l.id}>
              <button
                className={`${selected === i ? "active" : ""} ${l.done ? "complete" : ""}`}
                onClick={() => setSelected(i)}
                aria-current={selected === i ? "step" : undefined}
              >
                <span className="lesson-number">
                  {l.done ? (
                    <Check size={16} />
                  ) : (
                    String(i + 1).padStart(2, "0")
                  )}
                </span>
                <span>
                  <strong>{l.title}</strong>
                  <small>
                    {l.minutes} min{l.done ? " · Complete" : ""}
                  </small>
                </span>
                <ChevronRight size={15} />
              </button>
            </li>
          ))}
        </ol>
        <div className="lesson-sidebar-bottom">
          <Play size={17} />
          <div>
            <strong>Put it into practice.</strong>
            <button className="text-link" onClick={onPractice}>
              Try your interview <ArrowRight size={13} />
            </button>
          </div>
        </div>
      </aside>
      <article className="lesson-content card" key={lesson.id}>
        <div className="lesson-content-top">
          <span className="eyebrow">
            LESSON {String(selected + 1).padStart(2, "0")} OF{" "}
            {prep.course.length}
          </span>
          <span className="badge">
            <Clock size={13} />
            {lesson.minutes} min
          </span>
        </div>
        <h2>{lesson.title}</h2>
        <div className="lesson-body preline">{lesson.body}</div>
        {lesson.steps?.length > 0 && (
          <ol className="learning-steps">
            {lesson.steps.map((s, i) => (
              <li key={i}>
                <span>{i + 1}</span>
                <p>{s}</p>
              </li>
            ))}
          </ol>
        )}
        <div className="exercise-box">
          <span className="exercise-label">
            <Target size={17} /> MAKE IT YOURS
          </span>
          <p>{lesson.exercise}</p>
        </div>
        <label className="field">
          Your working notes <span className="optional">Saved as you type</span>
          <textarea
            value={prep.notes[lesson.id] || ""}
            onChange={(e) => updateNote(lesson.id, e.target.value)}
            rows={5}
            maxLength={20000}
            placeholder="You don’t need a perfect answer. Start with a few honest thoughts…"
          />
        </label>
        {lesson.takeaway && (
          <div className="takeaway">
            <Lightbulb size={18} />
            <p>{lesson.takeaway}</p>
          </div>
        )}
        {lesson.quiz && (
          <div className="knowledge-check">
            <span className="eyebrow">A QUICK CHECK-IN</span>
            <h3>{lesson.quiz.question}</h3>
            <div className="quiz-options">
              {lesson.quiz.options.map((option, index) => (
                <button
                  key={index}
                  className={`${answer === index ? "selected" : ""} ${answer !== undefined && index === lesson.quiz.correct ? "correct" : ""}`}
                  onClick={() =>
                    onChange({
                      ...prep,
                      quiz: {
                        ...prep.quiz,
                        answers: { ...prep.quiz?.answers, [lesson.id]: index },
                      },
                    })
                  }
                  aria-pressed={answer === index}
                >
                  <span className="quiz-letter">
                    {String.fromCharCode(65 + index)}
                  </span>
                  {option}
                  {answer === index && <Check size={17} />}
                </button>
              ))}
            </div>
            {answer !== undefined && (
              <p
                className={`quiz-feedback ${answer === lesson.quiz.correct ? "success" : ""}`}
                role="status"
              >
                <Lightbulb size={17} />
                <span>
                  <strong>
                    {answer === lesson.quiz.correct
                      ? "That’s a useful approach."
                      : "A different approach may work better."}
                  </strong>{" "}
                  {lesson.quiz.explanation}
                </span>
              </p>
            )}
          </div>
        )}
        <div className="lesson-actions">
          <button
            className={`btn ${lesson.done ? "btn-secondary" : "btn-primary"}`}
            onClick={mark}
          >
            {lesson.done ? <RotateCcw size={16} /> : <CheckCircle2 size={17} />}{" "}
            {lesson.done ? "Mark as unfinished" : "Complete this lesson"}
          </button>
          {selected < prep.course.length - 1 && (
            <button
              className="btn btn-ghost"
              onClick={() => setSelected(selected + 1)}
            >
              Next lesson <ArrowRight size={16} />
            </button>
          )}
          {selected === prep.course.length - 1 && (
            <button className="btn btn-ghost" onClick={onPractice}>
              Practise now <ArrowRight size={16} />
            </button>
          )}
        </div>
        <AiCoach
          action="course"
          job={prep}
          profile={profile}
          context={{
            intake: prep.intake,
            lesson: {
              title: lesson.title,
              purpose: lesson.takeaway,
              exercise: lesson.exercise,
              content: lesson.body,
              steps: lesson.steps,
            },
            lessonNotes: prep.notes[lesson.id] || "",
            companyNotes: prep.companyNotes,
            interviewer: prep.interviewer,
          }}
          contextKey={`course:${lesson.id}`}
          onSaveNote={onSaveCoaching}
          capabilities={capabilities}
          notify={notify}
          label="Personalize with AI"
        />
      </article>
    </div>
  );
}
function StoryBank({ prep, updateNote, notify }) {
  const [open, setOpen] = useState(prep.questions[0]?.id);
  async function exportStories() {
    const text = `MOMENTUM · STORY BANK\n${prep.role} at ${prep.company}\n\n${prep.questions.map((q) => `${q.question}\n\n${prep.notes[`answer-${q.id}`] || "(Your answer is still taking shape.)"}`).join("\n\n———\n\n")}`;
    try {
      const result = await shareDocument({
        filename: "momentum-story-bank.txt",
        text,
        mimeType: "text/plain",
      });
      if (!result.cancelled) notify("Your story bank is ready to keep.");
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <div className="stack">
      <div className="section-title">
        <div>
          <span className="eyebrow">YOUR EXPERIENCE, IN YOUR WORDS</span>
          <h2>Find the stories only you can tell.</h2>
          <p className="muted">
            Prepare examples, not a script. You can draw on work, study,
            projects, or everyday responsibilities.
          </p>
        </div>
        <button className="btn btn-secondary btn-small" onClick={exportStories}>
          <Download size={15} /> Export stories
        </button>
      </div>
      <div className="star-guide">
        {[
          { letter: "S", title: "Situation", text: "Set the scene." },
          { letter: "T", title: "Task", text: "What needed to happen?" },
          { letter: "A", title: "Action", text: "What did you do?" },
          {
            letter: "R",
            title: "Result",
            text: "What changed or did you learn?",
          },
        ].map((s) => (
          <div key={s.letter}>
            <span>{s.letter}</span>
            <div>
              <strong>{s.title}</strong>
              <small>{s.text}</small>
            </div>
          </div>
        ))}
      </div>
      <div className="story-list">
        {prep.questions.map((q, i) => (
          <article
            className={`card story-card ${open === q.id ? "expanded" : ""}`}
            key={q.id}
          >
            <button
              className="story-toggle"
              onClick={() => setOpen(open === q.id ? null : q.id)}
              aria-expanded={open === q.id}
            >
              <span className="story-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <span>
                <small>{q.category}</small>
                <strong>{q.question}</strong>
              </span>
              <ChevronRight size={20} />
            </button>
            {open === q.id && (
              <div className="story-content">
                <div className="callout subtle">
                  <Lightbulb size={18} />
                  <p>{q.tip}</p>
                </div>
                <label className="field">
                  Your story
                  <textarea
                    rows={7}
                    value={prep.notes[`answer-${q.id}`] || ""}
                    onChange={(e) =>
                      updateNote(`answer-${q.id}`, e.target.value)
                    }
                    maxLength={20000}
                    placeholder="A time I…\nMy responsibility was…\nI decided to…\nAs a result…"
                  />
                </label>
                <div className="story-footer">
                  <span className="muted small-text">
                    Your real experience is enough. Don’t invent a result.
                  </span>
                  <button
                    className="btn btn-ghost btn-small"
                    disabled={!prep.notes[`answer-${q.id}`]}
                    onClick={async () => {
                      try {
                        await copyText(prep.notes[`answer-${q.id}`]);
                        notify("Story copied.");
                      } catch (e) {
                        notify(e.message);
                      }
                    }}
                  >
                    <Clipboard size={14} /> Copy
                  </button>
                </div>
              </div>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
function Research({ prep, onChange, notify, capabilities }) {
  const person = prep.interviewer || { name: "", role: "", url: "", notes: "" };
  const latest = useRef({ prep, onChange });
  latest.current = { prep, onChange };
  const pendingImport = useRef(null);
  useEffect(() => () => pendingImport.current?.abort(), [prep.id]);
  const [researchURL, setResearchURL] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const updatePerson = (key, value) =>
    onChange({ ...prep, interviewer: { ...person, [key]: value } });
  const search = (query) =>
    `https://www.google.com/search?q=${encodeURIComponent(query)}`;
  async function importPage() {
    if (!safeURL(researchURL)) {
      setError("Add a full public page URL starting with https://.");
      return;
    }
    setBusy(true);
    setError("");
    const controller = new AbortController();
    pendingImport.current = controller;
    const importedURL = researchURL;
    try {
      const data = await requestAPI(
        "import-job",
        { url: importedURL },
        { signal: controller.signal },
      );
      if (controller.signal.aborted) return;
      const current = latest.current.prep;
      const companyNotes = [
        current.companyNotes,
        `Source: ${importedURL}\nImported ${new Date().toLocaleDateString()}\n${data.job.text.slice(0, 12000)}`,
      ]
        .filter(Boolean)
        .join("\n\n");
      if (companyNotes.length > 20000)
        throw new Error(
          "Your research notes are nearly full. Export or shorten them before importing another page.",
        );
      latest.current.onChange({ ...current, companyNotes });
      setResearchURL("");
      notify(
        "Public page added to your notes. Review the source and keep what is relevant.",
      );
    } catch (e) {
      if (!controller.signal.aborted) setError(e.message);
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <div className="stack">
      <div className="section-title">
        <div>
          <span className="eyebrow">PEOPLE, PURPOSE, PERSPECTIVE</span>
          <h2>Understand who’s on the other side.</h2>
          <p className="muted">
            Good research gives you better questions. Start with public
            professional information and keep track of your sources.
          </p>
        </div>
      </div>
      <div className="research-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <span className="eyebrow">THE COMPANY</span>
              <h2>{prep.company}</h2>
            </div>
            <CompanyMark name={prep.company} />
          </div>
          <div className="research-links">
            <a
              href={search(`${prep.company} official company about careers`)}
              target="_blank"
              rel="noreferrer"
            >
              Company & mission <ArrowUpRight size={15} />
            </a>
            <a
              href={search(`${prep.company} recent news products`)}
              target="_blank"
              rel="noreferrer"
            >
              Recent developments <ArrowUpRight size={15} />
            </a>
          </div>
          <div className="research-prompts">
            <h3>Find three things that matter.</h3>
            <ol>
              <li>What does the company make or do, and who does it help?</li>
              <li>What might this team be trying to improve?</li>
              <li>Why does that connect with your experience or interests?</li>
            </ol>
          </div>
          <label className="field">
            Company research & sources
            <textarea
              rows={8}
              value={prep.companyNotes || ""}
              maxLength={20000}
              onChange={(e) =>
                onChange({ ...prep, companyNotes: e.target.value })
              }
              placeholder="What I learned…\nSource and date…\nWhat I’d like to ask…"
            />
          </label>
          <details className="optional-details">
            <summary>Import a public company page</summary>
            <label className="field">
              Public page URL
              <input
                type="url"
                value={researchURL}
                onChange={(e) => setResearchURL(e.target.value)}
                placeholder="https://company.com/about"
                maxLength={2000}
              />
            </label>
            <p className="muted small-text">
              This URL is sent to the import service. Login-only pages may need
              to be copied manually.
            </p>
            <button
              className="btn btn-secondary btn-small"
              onClick={importPage}
              disabled={busy || !researchURL}
            >
              {busy ? "Reading page…" : "Add page to notes"}
            </button>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </details>
        </section>
        <section className="card">
          <div className="card-header">
            <div>
              <span className="eyebrow">THE PERSON</span>
              <h2>A more human conversation.</h2>
            </div>
            <span className="icon-tile">
              <UserRound size={22} />
            </span>
          </div>
          <div className="form-grid">
            <label className="field">
              Interviewer’s name
              <input
                value={person.name}
                onChange={(e) => updatePerson("name", e.target.value)}
                maxLength={120}
                placeholder="Their name"
              />
            </label>
            <label className="field">
              Their role
              <input
                value={person.role}
                onChange={(e) => updatePerson("role", e.target.value)}
                maxLength={120}
                placeholder="e.g. Design Manager"
              />
            </label>
          </div>
          <label className="field">
            Professional profile link <span className="optional">Optional</span>
            <input
              type="url"
              value={person.url}
              onChange={(e) => updatePerson("url", e.target.value)}
              maxLength={2000}
              placeholder="A public LinkedIn or company bio"
            />
          </label>
          {person.name && (
            <a
              className="text-link research-person-link"
              href={
                safeURL(person.url) ||
                search(`${person.name} ${prep.company} professional profile`)
              }
              target="_blank"
              rel="noreferrer"
            >
              Research their professional background <ExternalLink size={14} />
            </a>
          )}
          <label className="field">
            Professional background & conversation notes
            <textarea
              rows={6}
              value={person.notes}
              onChange={(e) => updatePerson("notes", e.target.value)}
              maxLength={20000}
              placeholder="Their team or area of expertise…\nA public talk, article, or project relevant to this role…\nA thoughtful question I could ask…\nSources…"
            />
          </label>
          <p className="muted small-text">
            Focus on their work. Avoid private details or assumptions about
            their personality, beliefs, or hiring preferences.
          </p>
        </section>
      </div>
      <section className="card research-questions">
        <div>
          <span className="eyebrow">TURN KNOWLEDGE INTO CONNECTION</span>
          <h2>Ask questions that open a conversation.</h2>
        </div>
        <div className="research-question-grid">
          <blockquote>
            “What would make someone really successful in this role in the first
            90 days?”
          </blockquote>
          <blockquote>
            “What challenge is your team most excited to solve right now?”
          </blockquote>
          <blockquote>
            “I read about [specific public project]. How would this role
            contribute to that work?”
          </blockquote>
        </div>
        <label className="field">
          Questions I want to ask
          <textarea
            rows={4}
            maxLength={12000}
            value={prep.notes["research-questions"] || ""}
            onChange={(e) =>
              onChange({
                ...prep,
                notes: { ...prep.notes, "research-questions": e.target.value },
              })
            }
            placeholder="Pick two or three questions you genuinely want answered."
          />
        </label>
      </section>
      <div className="callout subtle">
        <ShieldCheck size={20} />
        <p>
          Your notes are supplied by you; Momentum hasn’t independently verified
          them. Check names, dates and context before referring to them in an
          interview.
        </p>
      </div>
      <AiCoach
        action="research"
        job={prep}
        context={{ companyNotes: prep.companyNotes, interviewer: person }}
        capabilities={capabilities}
        notify={notify}
        label="Find connections in my research"
        onSave={(text) => {
          const companyNotes = [
            prep.companyNotes,
            `AI research brief · ${new Date().toLocaleDateString()}\n${text}`,
          ]
            .filter(Boolean)
            .join("\n\n");
          if (companyNotes.length > 20000) {
            notify(
              "Your research notes are nearly full. Export this brief or shorten your notes before saving it.",
            );
            return false;
          }
          onChange({ ...prep, companyNotes });
          return true;
        }}
      />
    </div>
  );
}
function Feedback({ text, question }) {
  const feedback = evaluateAnswer(text, question);
  return (
    <div className="answer-feedback">
      <div className="feedback-heading">
        <span className="eyebrow">A MOMENT TO REFLECT</span>
        <span>
          {feedback.wordCount} words · about{" "}
          {Math.max(1, Math.round(feedback.durationSeconds / 60))} min spoken
        </span>
      </div>
      <h3>{feedback.summary}</h3>
      <div className="feedback-checks">
        {feedback.checks.map((check, i) => (
          <div className={check.met ? "met" : ""} key={i}>
            {check.met ? (
              <CheckCircle2 size={17} />
            ) : (
              <span className="check-circle" />
            )}
            <div>
              <strong>{check.label}</strong>
              <p>{check.advice}</p>
            </div>
          </div>
        ))}
      </div>
      <p className="muted small-text">
        This is a local writing checklist. It doesn’t assess truth, technical
        accuracy, or your chances of being hired.
      </p>
    </div>
  );
}
function MockPractice({
  prep,
  onChange,
  notify,
  profile,
  capabilities,
  onSaveCoaching,
}) {
  const mock = prep.mock;
  const [started, setStarted] = useState(mock.index > 0 || Boolean(mock.draft)),
    [feedbackIndex, setFeedbackIndex] = useState(null),
    [error, setError] = useState(""),
    [restart, setRestart] = useState(false),
    [speaking, setSpeaking] = useState(false),
    [seconds, setSeconds] = useState(0),
    [paused, setPaused] = useState(false);
  const answersRef = useRef(null);
  const question = prep.questions[mock.index];
  const completed = mock.finished || mock.index >= prep.questions.length;
  useEffect(() => {
    if (!started || completed || paused || feedbackIndex !== null) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [started, completed, paused, feedbackIndex]);
  useEffect(
    () => () => {
      window.speechSynthesis?.cancel();
    },
    [],
  );
  function speak() {
    if (speaking) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
      return;
    }
    if (!window.speechSynthesis) return;
    const utterance = new SpeechSynthesisUtterance(question.question);
    utterance.rate = 0.95;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    window.speechSynthesis.speak(utterance);
    setSpeaking(true);
  }
  function submit() {
    const answer = mock.draft.trim();
    if (answer.length < 20) {
      setError(
        "Add a little more to your answer—at least 20 characters—so there’s something to reflect on.",
      );
      return;
    }
    window.speechSynthesis?.cancel();
    setSpeaking(false);
    setError("");
    const index = mock.index;
    const next = {
      ...mock,
      answers: [
        ...mock.answers,
        {
          question: question.question,
          text: answer,
          at: new Date().toISOString(),
        },
      ],
      draft: "",
      index: index + 1,
      finished: index + 1 >= prep.questions.length,
    };
    onChange({ ...prep, mock: next });
    setFeedbackIndex(index);
    lightHaptic();
  }
  function newRound() {
    const history = mock.answers.length
      ? [
          { at: new Date().toISOString(), answers: mock.answers },
          ...(prep.mockHistory || []),
        ].slice(0, 10)
      : prep.mockHistory || [];
    onChange({
      ...prep,
      mock: { index: 0, answers: [], draft: "", finished: false },
      mockHistory: history,
    });
    setFeedbackIndex(null);
    setSeconds(0);
    setStarted(true);
    setRestart(false);
    setPaused(false);
    notify("A fresh practice round. Your previous answers are saved below.");
  }
  async function exportPractice() {
    try {
      const result = await shareDocument({
        filename: "momentum-interview-practice.txt",
        mimeType: "text/plain",
        text: `MOMENTUM · INTERVIEW PRACTICE\n${prep.role} at ${prep.company}\n\n${mock.answers.map((a, i) => `${i + 1}. ${a.question}\n\n${a.text}\n\nReflection: ${evaluateAnswer(a.text).summary}`).join("\n\n———\n\n")}`,
      });
      if (!result.cancelled) notify("Practice transcript ready to keep.");
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <div className="stack">
      {!started && !completed ? (
        <section className="practice-intro">
          <div className="practice-intro-copy">
            <span className="eyebrow">A SAFE PLACE TO TRY</span>
            <h2>
              Let’s make the real thing
              <br />
              feel a little more familiar.
            </h2>
            <p>
              Practise a conversation for <strong>{prep.role}</strong> at{" "}
              <strong>{prep.company}</strong>. You’ll get one question at a
              time, space to answer, and a practical structure check.
            </p>
            <div className="practice-facts">
              <span>
                <MessageCircle size={17} />
                {prep.questions.length} questions
              </span>
              <span>
                <Clock size={17} />
                About 15–20 min
              </span>
              <span>
                <ShieldCheck size={17} />
                Saved on your device
              </span>
            </div>
            <button
              className="btn btn-primary"
              onClick={() => setStarted(true)}
            >
              <Play size={17} /> Start practice interview
            </button>
            <p className="muted small-text">
              Speak your answer aloud, then type the key points. No microphone
              or camera recording.
            </p>
          </div>
          <div className="practice-illustration" aria-hidden="true">
            <div className="conversation-bubble bubble-1">
              <span />
              <span />
              <span />
            </div>
            <div className="conversation-bubble bubble-2">
              <Check size={35} />
            </div>
            <div className="practice-orbit" />
            <span className="practice-art-caption">
              YOUR VOICE. YOUR STORY.
            </span>
          </div>
        </section>
      ) : feedbackIndex !== null ? (
        <section className="card feedback-card">
          <span className="badge">
            <CheckCircle2 size={14} /> Answer {feedbackIndex + 1} saved
          </span>
          <h2>{mock.answers[feedbackIndex]?.question}</h2>
          <details className="answer-review">
            <summary>Read your answer</summary>
            <p className="preline">{mock.answers[feedbackIndex]?.text}</p>
          </details>
          <Feedback
            text={mock.answers[feedbackIndex]?.text || ""}
            question={prep.questions[feedbackIndex]}
          />
          <div className="inline-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                setFeedbackIndex(null);
                setSeconds(0);
                setPaused(false);
              }}
            >
              {completed ? "See your session summary" : "Next question"}
              <ArrowRight size={17} />
            </button>
            <AiCoach
              action="interview-feedback"
              job={prep}
              profile={profile}
              question={mock.answers[feedbackIndex]?.question}
              answer={mock.answers[feedbackIndex]?.text}
              context={{
                intake: prep.intake,
                interviewer: prep.interviewer,
                companyNotes: prep.companyNotes,
              }}
              contextKey={`interview-feedback:${prep.questions[feedbackIndex]?.id}`}
              onSaveNote={onSaveCoaching}
              capabilities={capabilities}
              notify={notify}
              label="Get AI feedback"
            />
          </div>
        </section>
      ) : completed ? (
        <section className="card practice-complete">
          <span className="complete-icon">
            <Check size={35} />
          </span>
          <span className="eyebrow">YOU SHOWED UP FOR YOURSELF</span>
          <h2>
            That’s one more conversation
            <br />
            you’re ready to have.
          </h2>
          <p>
            You practised {mock.answers.length} answers. Read them back, choose
            one to refine, and notice what already sounds like you.
          </p>
          <div className="inline-actions">
            <button
              className="btn btn-primary"
              onClick={() => setRestart(true)}
            >
              <RotateCcw size={17} /> Practise again
            </button>
            <button className="btn btn-secondary" onClick={exportPractice}>
              <Download size={17} /> Keep my transcript
            </button>
          </div>
        </section>
      ) : (
        <section className="card mock-session">
          <div className="mock-status">
            <span className="badge">
              <span className="status-dot" />
              {prep.interviewer?.name
                ? `Practising for ${prep.interviewer.name}’s interview`
                : "Your practice room"}
            </span>
            <div className="timer">
              <Clock size={15} />
              <span>
                {Math.floor(seconds / 60)}:
                {String(seconds % 60).padStart(2, "0")}
              </span>
              <button
                className="icon-button"
                aria-label={paused ? "Resume timer" : "Pause timer"}
                onClick={() => setPaused(!paused)}
              >
                {paused ? <Play size={15} /> : <Pause size={15} />}
              </button>
            </div>
          </div>
          <div className="mock-progress">
            {prep.questions.map((q, i) => (
              <span
                key={q.id}
                className={
                  i < mock.index
                    ? "complete"
                    : i === mock.index
                      ? "current"
                      : ""
                }
              />
            ))}
          </div>
          <span className="eyebrow">
            QUESTION {mock.index + 1} OF {prep.questions.length} ·{" "}
            {question.category}
          </span>
          <h2>{question.question}</h2>
          <div className="mock-prompt-actions">
            <details>
              <summary>
                <Lightbulb size={15} /> A little guidance
              </summary>
              <p>{question.tip}</p>
            </details>
            {"speechSynthesis" in window && (
              <button className="text-link" onClick={speak}>
                {speaking ? <Square size={15} /> : <Volume2 size={17} />}{" "}
                {speaking ? "Stop reading" : "Read question aloud"}
              </button>
            )}
          </div>
          <label className="field">
            Your answer
            <textarea
              ref={answersRef}
              rows={8}
              maxLength={20000}
              value={mock.draft}
              onChange={(e) =>
                onChange({ ...prep, mock: { ...mock, draft: e.target.value } })
              }
              placeholder="Take a breath. Think of a real example. What happened, what did you do, and what changed?"
            />
          </label>
          <div className="answer-metadata">
            <span>
              <Check size={13} /> Draft saves as you type
            </span>
            <span>
              {mock.draft.trim() ? mock.draft.trim().split(/\s+/).length : 0}{" "}
              words
            </span>
          </div>
          {error && (
            <p className="field-error" role="alert">
              {error}
            </p>
          )}
          <div className="lesson-actions">
            <button className="btn btn-primary" onClick={submit}>
              Reflect on my answer <ArrowRight size={17} />
            </button>
            <span className="muted small-text">
              No perfect answers required.
            </span>
          </div>
          <p className="muted small-text">
            Guided practice with a local structure checklist. These are practice
            prompts, not predictions of what your interviewer will ask.
          </p>
        </section>
      )}
      {mock.answers.length > 0 && (
        <section className="practice-history">
          <div className="section-title">
            <h2>Your session, in your words.</h2>
            <button className="text-link" onClick={exportPractice}>
              <Download size={15} /> Export
            </button>
          </div>
          {mock.answers.map((a, i) => (
            <details className="card transcript-item" key={i}>
              <summary>
                <span>{String(i + 1).padStart(2, "0")}</span>
                {a.question}
                <ChevronRight size={17} />
              </summary>
              <p className="preline">{a.text}</p>
              <Feedback text={a.text} question={prep.questions[i]} />
            </details>
          ))}
        </section>
      )}
      {prep.mockHistory?.length > 0 && (
        <details className="card">
          <summary>
            Previous practice rounds ({prep.mockHistory.length})
          </summary>
          {prep.mockHistory.map((round, i) => (
            <div className="previous-round" key={i}>
              <h3>
                {new Date(round.at).toLocaleDateString()} ·{" "}
                {round.answers.length} answers
              </h3>
              {round.answers.map((a, j) => (
                <details key={j}>
                  <summary>{a.question}</summary>
                  <p className="preline">{a.text}</p>
                </details>
              ))}
            </div>
          ))}
        </details>
      )}
      {restart && (
        <Modal
          title="A fresh practice round?"
          onClose={() => setRestart(false)}
        >
          <div className="modal-content">
            <p>
              Your current answers will move to previous practice rounds.
              Momentum keeps the latest 10 rounds for this opportunity.
            </p>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setRestart(false)}
              >
                Keep reviewing
              </button>
              <button className="btn btn-primary" onClick={newRound}>
                Start a new round <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
const dayChecks = [
  "I know when, where, and how the interview will happen.",
  "My device, connection, or travel route is ready.",
  "I have a clear 60-second introduction.",
  "I can explain two or three true examples from my experience.",
  "I have two thoughtful questions for the interviewer.",
  "I have reviewed the role and my company research.",
  "I have water, notes, and a little breathing room.",
];
function InterviewDay({ prep, onChange, updateNote, notify }) {
  const done = dayChecks.filter(
    (c, i) => prep.notes[`day-${i}`] === "done",
  ).length;
  async function exportBrief() {
    const text = `MOMENTUM · INTERVIEW BRIEF\n${prep.role} at ${prep.company}\n${prep.interviewDate ? `When: ${new Date(prep.interviewDate).toLocaleString()}\n` : ""}${prep.interviewer?.name ? `With: ${prep.interviewer.name}\n` : ""}\nMY INTRODUCTION\n${prep.notes["day-introduction"] || ""}\n\nMY EXAMPLES\n${prep.questions
      .map((q) =>
        prep.notes[`answer-${q.id}`]
          ? `${q.question}\n${prep.notes[`answer-${q.id}`]}`
          : "",
      )
      .filter(Boolean)
      .join(
        "\n\n",
      )}\n\nQUESTIONS TO ASK\n${prep.notes["research-questions"] || ""}\n\nCOMPANY NOTES\n${prep.companyNotes || ""}\n\nAFTER THE INTERVIEW\n${prep.notes["day-reflection"] || ""}`;
    try {
      const result = await shareDocument({
        filename: "momentum-interview-brief.txt",
        text,
        mimeType: "text/plain",
      });
      if (!result.cancelled) notify("Your interview brief is ready.");
    } catch (e) {
      notify(e.message);
    }
  }
  return (
    <div className="stack">
      <div className="section-title">
        <div>
          <span className="eyebrow">THE DAY IS YOURS</span>
          <h2>You’ve done the work. Bring yourself.</h2>
          <p className="muted">
            A small checklist and a few notes to help you feel grounded.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={exportBrief}>
          <Download size={16} /> Export interview brief
        </button>
      </div>
      <div className="research-grid">
        <section className="card">
          <div className="card-header">
            <div>
              <span className="eyebrow">BEFORE YOU GO</span>
              <h2>Your calm-start checklist.</h2>
              <p className="muted">
                {done} of {dayChecks.length} ready
              </p>
            </div>
            <FileCheck2 size={23} />
          </div>
          <label className="field">
            Interview date & time
            <input
              type="datetime-local"
              value={prep.interviewDate || ""}
              onChange={(e) =>
                onChange({ ...prep, interviewDate: e.target.value })
              }
            />
          </label>
          <div className="day-checks">
            {dayChecks.map((label, i) => (
              <label
                className={prep.notes[`day-${i}`] === "done" ? "done" : ""}
                key={label}
              >
                <input
                  type="checkbox"
                  checked={prep.notes[`day-${i}`] === "done"}
                  onChange={(e) =>
                    updateNote(`day-${i}`, e.target.checked ? "done" : "")
                  }
                />
                <span>{label}</span>
              </label>
            ))}
          </div>
        </section>
        <div className="stack">
          <section className="card">
            <span className="eyebrow">START WITH YOUR STORY</span>
            <h2>Your 60-second introduction.</h2>
            <p className="muted">
              Who you are, one relevant example, and why this opportunity.
            </p>
            <label className="field">
              <span className="sr-only">Your introduction</span>
              <textarea
                rows={6}
                value={prep.notes["day-introduction"] || ""}
                onChange={(e) => updateNote("day-introduction", e.target.value)}
                maxLength={8000}
                placeholder="I’m… Recently, I… What draws me to this role is…"
              />
            </label>
          </section>
          <div className="calm-card">
            <span>✦</span>
            <h3>A pause is allowed.</h3>
            <p>
              “That’s a good question. Let me think of the most relevant
              example.”
            </p>
            <small>You don’t have to rush to be worth listening to.</small>
          </div>
        </div>
      </div>
      <section className="card">
        <span className="eyebrow">AFTER THE CONVERSATION</span>
        <h2>Capture it while it’s fresh.</h2>
        <label className="field">
          What went well, what you learned, and what happens next
          <textarea
            rows={5}
            value={prep.notes["day-reflection"] || ""}
            onChange={(e) => updateNote("day-reflection", e.target.value)}
            maxLength={12000}
            placeholder="A moment I felt good about…\nSomething I’d improve next time…\nWhat they told me about the next steps…\nA detail to include in my thank-you message…"
          />
        </label>
      </section>
    </div>
  );
}
