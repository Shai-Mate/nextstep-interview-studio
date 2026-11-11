import { useState, useMemo } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  Clipboard,
  Download,
  FileText,
  Mail,
  MessageCircle,
  CheckCircle2,
  Check,
  ExternalLink,
  UserRound,
  Lightbulb,
  ShieldCheck,
  ChevronRight,
  Sparkles,
  CalendarDays,
} from "lucide-react";
import { generateApplicationKit } from "../../engine.js";
import { copyText, safeURL } from "../lib/api.js";
import { shareDocument } from "../lib/native.js";
import AiCoach from "./AiCoach.jsx";
import CoachingNotes from "./CoachingNotes.jsx";
import { appendCoachingNote } from "../lib/coaching.js";
const tabs = [
  ["resume", "Résumé focus", FileText],
  ["letter", "Cover letter", Mail],
  ["messages", "Messages", MessageCircle],
  ["apply", "Ready to apply", CheckCircle2],
];
const checks = [
  ["truth", "Every claim, date, title and qualification is accurate."],
  ["relevant", "My most relevant evidence is easy to find."],
  ["format", "My résumé uses clear headings and readable formatting."],
  ["custom", "I have checked the company name and role throughout."],
  ["instructions", "I have followed the job ad’s application instructions."],
  ["proof", "I have read everything once more for mistakes."],
];
export default function ApplicationKit({
  prep,
  profile,
  onChange,
  onProfile,
  notify,
  capabilities,
}) {
  const [tab, setTab] = useState("resume");
  const generated = useMemo(
    () => generateApplicationKit(profile, prep),
    [profile, prep.job, prep.role, prep.company, prep.status],
  );
  const fields = {
    summary: generated.resumeSummary,
    letter: generated.coverLetter,
    headline: generated.headline,
    outreach: generated.outreach,
    followup: generated.followUp,
    bullets: Array.isArray(generated.bullets)
      ? generated.bullets.join("\n")
      : generated.bullets || "",
  };
  const draft = (key) => prep.notes[`application-${key}`] ?? fields[key] ?? "";
  const update = (key, value) =>
    onChange({
      ...prep,
      notes: { ...prep.notes, [`application-${key}`]: value },
    });
  const saveCoachingNote = (noteDraft) => {
    try {
      onChange({
        ...prep,
        coaching: appendCoachingNote(prep.coaching, noteDraft),
      });
      return true;
    } catch (error) {
      notify(
        error.message ||
          "These coaching notes could not be saved. Copy or export them before closing.",
      );
      return false;
    }
  };
  const candidateProfile = Object.fromEntries(
    [
      "name",
      "targetRole",
      "location",
      "experience",
      "resume",
      "skills",
      "achievements",
      "preferences",
    ]
      .filter((key) => profile[key] !== undefined)
      .map((key) => [key, profile[key]]),
  );
  const relevantDrafts = {
    resume: {
      resumeSummary: draft("summary"),
      evidenceBullets: draft("bullets"),
    },
    letter: { coverLetter: draft("letter"), resumeSummary: draft("summary") },
    messages: {
      introductionMessage: draft("outreach"),
      followUpMessage: draft("followup"),
    },
    apply: { resumeSummary: draft("summary"), coverLetter: draft("letter") },
  }[tab];
  const coachingContext = {
    focus: tab,
    currentDrafts: relevantDrafts,
    requirementEvidence: prep.requirements
      .slice(0, 5)
      .map((requirement, index) => ({
        requirement,
        evidence: prep.notes[`map-${index}`] || "",
      })),
    ...(tab === "messages" || tab === "apply"
      ? {
          applicationStatus: prep.status,
          applicationNotes: prep.applicationNotes || "",
        }
      : {}),
  };
  const hasProfile =
    profile.resume?.trim().length > 30 ||
    profile.achievements?.trim().length > 20;
  async function copy(key) {
    try {
      await copyText(draft(key));
      notify("Draft copied. Make sure it sounds like you before sharing.");
    } catch (e) {
      notify(e.message);
    }
  }
  async function exportKit() {
    const text = `MOMENTUM · APPLICATION KIT\n${prep.role} at ${prep.company}\n\nRÉSUMÉ INTRODUCTION\n${draft("summary")}\n\nSELECTED EVIDENCE\n${draft("bullets")}\n\nORIGINAL RÉSUMÉ / CAREER NOTES\n${profile.resume || "(Add your résumé in My profile.)"}\n\nCOVER LETTER\n${draft("letter")}\n\nINTRODUCTION MESSAGE\n${draft("outreach")}\n\nFOLLOW-UP\n${draft("followup")}\n\nBefore sending: resolve all [bracketed prompts], check every claim, and follow the employer’s instructions.`;
    try {
      const result = await shareDocument({
        filename: "momentum-application-kit.txt",
        text,
        mimeType: "text/plain",
      });
      if (!result.cancelled)
        notify("Application kit exported. Review it before sending.");
    } catch (e) {
      notify(e.message);
    }
  }
  function Draft({ name, title, description, rows = 7 }) {
    return (
      <section className="card application-draft">
        <div className="card-header">
          <div>
            <span className="eyebrow">MAKE IT SOUND LIKE YOU</span>
            <h2>{title}</h2>
            <p className="muted">{description}</p>
          </div>
          <button
            className="btn btn-secondary btn-small"
            onClick={() => copy(name)}
          >
            <Clipboard size={15} /> Copy
          </button>
        </div>
        <label className="field">
          <span className="sr-only">Edit {title.toLowerCase()}</span>
          <textarea
            className="output-paper"
            rows={rows}
            maxLength={30000}
            value={draft(name)}
            onChange={(e) => update(name, e.target.value)}
          />
        </label>
        <div className="draft-footer">
          <span className="muted small-text">
            Edits save as you type. Replace any [bracketed prompts].
          </span>
          <button
            className="text-link"
            onClick={() => {
              update(name, fields[name]);
              notify("Draft refreshed from your profile.");
            }}
          >
            <Sparkles size={14} /> Refresh draft
          </button>
        </div>
      </section>
    );
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">MAKE YOUR FIRST IMPRESSION COUNT</span>
          <h1>
            Your experience.
            <br />A stronger introduction.
          </h1>
          <p>
            A tailored starting point for <strong>{prep.role}</strong> at{" "}
            <strong>{prep.company}</strong>.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={exportKit}>
          <Download size={16} /> Export application kit
        </button>
      </header>
      {!hasProfile && (
        <div className="profile-nudge">
          <span className="icon-tile">
            <UserRound size={21} />
          </span>
          <div>
            <strong>Bring your experience into the picture.</strong>
            <p>
              Add your résumé or a few achievements to make these drafts useful.
            </p>
          </div>
          <button className="btn btn-primary btn-small" onClick={onProfile}>
            Add my experience <ArrowRight size={16} />
          </button>
        </div>
      )}
      <div className="tabs" aria-label="Application kit sections">
        {tabs.map(([id, label, Icon]) => (
          <button
            key={id}
            className={tab === id ? "active" : ""}
            onClick={() => setTab(id)}
            aria-pressed={tab === id}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>
      {tab === "resume" && (
        <div className="application-layout">
          <div className="stack">
            {Draft({
              name: "summary",
              title: "A relevant introduction.",
              description:
                "Lead with experience that connects to this role. Keep the rest of your résumé factual and easy to scan.",
              rows: 5,
            })}
            {Draft({
              name: "bullets",
              title: "Evidence, not adjectives.",
              description:
                "Use specific actions and outcomes you can explain. Numbers help only when they’re true.",
              rows: 7,
            })}
            <section className="card">
              <div className="card-header">
                <div>
                  <span className="eyebrow">THE CONNECTION</span>
                  <h2>Show how your experience fits.</h2>
                </div>
                <FileText size={22} />
              </div>
              <p className="muted">
                These are excerpts from the ad. For each, write a true
                example—or a learning plan if it’s new to you.
              </p>
              <div className="requirement-evidence">
                {prep.requirements.slice(0, 5).map((requirement, i) => (
                  <div key={i}>
                    <blockquote>{requirement}</blockquote>
                    <label className="field">
                      <span className="sr-only">
                        Your evidence for requirement {i + 1}
                      </span>
                      <textarea
                        rows={3}
                        value={prep.notes[`map-${i}`] || ""}
                        onChange={(e) =>
                          onChange({
                            ...prep,
                            notes: {
                              ...prep.notes,
                              [`map-${i}`]: e.target.value,
                            },
                          })
                        }
                        maxLength={8000}
                        placeholder="My example… / A transferable skill… / How I would learn this…"
                      />
                    </label>
                  </div>
                ))}
              </div>
            </section>
          </div>
          <aside className="stack application-sidebar">
            <section className="card">
              <span className="eyebrow">MENTIONED IN THE AD</span>
              <h3>What to bring into focus.</h3>
              <div className="skill-tags">
                {prep.analysis.skills.map((skill) => (
                  <span key={skill.name}>{skill.name}</span>
                ))}
              </div>
              {!prep.analysis.skills.length && (
                <p className="muted">
                  Use the responsibilities in the ad to identify your most
                  relevant examples.
                </p>
              )}
              <p className="muted small-text">
                These are job-ad mentions, not a score or a list of skills you
                already have. Include only what you can demonstrate.
              </p>
            </section>
            <section className="card application-tips">
              <span className="eyebrow">
                A LITTLE PRESENTATION GOES A LONG WAY
              </span>
              <h3>Make the important things easy to find.</h3>
              <ul>
                <li>Use familiar headings: Experience, Skills, Education.</li>
                <li>Lead each bullet with what you did.</li>
                <li>Keep titles and dates accurate.</li>
                <li>Use a simple layout and selectable text.</li>
                <li>Follow the employer’s preferred file format.</li>
              </ul>
              <button className="text-link" onClick={onProfile}>
                Update my profile <ArrowRight size={15} />
              </button>
            </section>
            <div className="callout">
              <ShieldCheck size={19} />
              <p>
                Your drafts are built locally from supplied details. They are a
                starting point for your review.
              </p>
            </div>
          </aside>
        </div>
      )}
      {tab === "letter" && (
        <div className="stack">
          {Draft({
            name: "letter",
            title: "A letter with a reason to read on.",
            description:
              "Connect one or two real examples to what this team needs. Add a specific, verified reason you’re interested.",
            rows: 17,
          })}
          <div className="callout">
            <Lightbulb size={20} />
            <div>
              <strong>Short, specific, and human wins.</strong>
              <p>
                If an application doesn’t ask for a cover letter, follow its
                instructions. A thoughtful, concise note is more useful than a
                generic extra page.
              </p>
            </div>
          </div>
        </div>
      )}
      {tab === "messages" && (
        <div className="stack">
          {Draft({
            name: "outreach",
            title: "Start a thoughtful conversation.",
            description:
              "A short note to a recruiter or professional connection. Personalize the opening before you send it.",
            rows: 8,
          })}
          {Draft({
            name: "followup",
            title: "Follow up with purpose.",
            description:
              "Respect their timeline. Add a specific detail from your application or conversation.",
            rows: 8,
          })}
          <div className="callout subtle">
            <Mail size={20} />
            <p>
              Momentum doesn’t send messages or update profiles for you. Copy a
              draft when you’re happy with it and use your own account.
            </p>
          </div>
        </div>
      )}
      {tab === "apply" && (
        <div className="research-grid">
          <section className="card">
            <span className="eyebrow">THE FINAL LOOK</span>
            <h2>Ready to open the door.</h2>
            <p className="muted">A few small checks before you hit send.</p>
            <div className="day-checks">
              {checks.map(([key, label]) => (
                <label
                  key={key}
                  className={
                    prep.notes[`apply-check-${key}`] === "done" ? "done" : ""
                  }
                >
                  <input
                    type="checkbox"
                    checked={prep.notes[`apply-check-${key}`] === "done"}
                    onChange={(e) =>
                      onChange({
                        ...prep,
                        notes: {
                          ...prep.notes,
                          [`apply-check-${key}`]: e.target.checked
                            ? "done"
                            : "",
                        },
                      })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="callout subtle">
              <ShieldCheck size={19} />
              <p>
                Apply through the employer’s site or your own job-board account.
                Momentum never collects your LinkedIn or Indeed password.
              </p>
            </div>
            {safeURL(prep.url) ? (
              <a
                className="btn btn-primary"
                href={safeURL(prep.url)}
                target="_blank"
                rel="noreferrer"
              >
                Open the original job ad <ExternalLink size={16} />
              </a>
            ) : (
              <p className="muted">
                Open the original job ad to follow its application instructions.
                You can save its link below.
              </p>
            )}
            <label className="field application-job-link">
              Original job link
              <input
                type="url"
                maxLength={2000}
                value={prep.url || ""}
                onChange={(e) => onChange({ ...prep, url: e.target.value })}
                placeholder="https://company.com/careers/role"
              />
            </label>
          </section>
          <section className="card">
            <span className="eyebrow">KEEP THE MOMENTUM</span>
            <h2>Know what happens next.</h2>
            <label className="field">
              Application notes
              <textarea
                rows={5}
                maxLength={12000}
                value={prep.applicationNotes || ""}
                onChange={(e) =>
                  onChange({ ...prep, applicationNotes: e.target.value })
                }
                placeholder="Where I applied, who I spoke to, documents submitted, or a timeline they shared…"
              />
            </label>
            <label className="field">
              Follow-up date <span className="optional">Optional</span>
              <input
                type="date"
                value={prep.notes["followup-date"] || ""}
                onChange={(e) =>
                  onChange({
                    ...prep,
                    notes: { ...prep.notes, "followup-date": e.target.value },
                  })
                }
              />
              <span className="field-hint">
                A note for your planning. Momentum doesn’t send notifications.
              </span>
            </label>
            {prep.notes["applied-at"] && (
              <p className="inline-notice">
                <CheckCircle2 size={16} />
                You marked this as applied on{" "}
                {new Date(prep.notes["applied-at"]).toLocaleDateString()}.
              </p>
            )}
            <button
              className="btn btn-primary"
              onClick={() => {
                onChange({
                  ...prep,
                  status: prep.status === "Saved" ? "Applying" : prep.status,
                  notes: {
                    ...prep.notes,
                    "applied-at": new Date().toISOString(),
                  },
                });
                notify("Application recorded. A good step forward.");
              }}
            >
              <CheckCircle2 size={17} /> I’ve submitted my application
            </button>
            <p className="muted small-text">
              This updates your tracker. It doesn’t submit an application.
            </p>
          </section>
        </div>
      )}
      <div className="stack">
        <AiCoach
          key={`${prep.id}:${tab}`}
          action="application"
          contextKey={`application:${tab}`}
          job={prep}
          profile={candidateProfile}
          context={coachingContext}
          capabilities={capabilities}
          notify={notify}
          label="Refine with AI"
          onSaveNote={saveCoachingNote}
        />
        <CoachingNotes
          notes={prep.coaching}
          onChange={(notes) => onChange({ ...prep, coaching: notes })}
          notify={notify}
        />
      </div>
    </>
  );
}
