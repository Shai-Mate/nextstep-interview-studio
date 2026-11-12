import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight,
  CheckCircle2,
  Clipboard,
  FileDown,
  FileText,
  Fingerprint,
  LoaderCircle,
  Plus,
  ShieldCheck,
  Sparkles,
  Upload,
  UserRound,
} from "lucide-react";
import { generateProfileKit } from "../../engine.js";
import { extractDocument } from "../lib/documents.js";
import { shareDocument } from "../lib/native.js";

const asText = (value) =>
  Array.isArray(value) ? value.join("\n") : String(value ?? "");
const signatureOf = (value) => {
  let hash = 2166136261;
  for (const character of value) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
};

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      /* An older webview may need the local fallback. */
    }
  }
  const input = document.createElement("textarea");
  input.value = value;
  input.setAttribute("readonly", "");
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.appendChild(input);
  input.select();
  const copied = document.execCommand("copy");
  input.remove();
  if (!copied)
    throw new Error("Select the text and copy it using your device menu.");
}

function DraftField({ title, description, value, onChange, onCopy, rows = 4 }) {
  return (
    <section className="card profile-draft">
      <div className="card-header">
        <div>
          <h3>{title}</h3>
          <p className="muted">{description}</p>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-small"
          onClick={() => onCopy(value, title)}
          disabled={!value?.trim()}
        >
          <Clipboard size={15} /> Copy
        </button>
      </div>
      <label className="field">
        <span className="sr-only">Edit {title.toLowerCase()}</span>
        <textarea
          rows={rows}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          maxLength={20000}
        />
      </label>
    </section>
  );
}

export default function Profile({ profile = {}, onChange, notify = () => {} }) {
  const [panel, setPanel] = useState("story");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [pendingImport, setPendingImport] = useState(null);
  const [example, setExample] = useState({
    situation: "",
    action: "",
    result: "",
  });
  const [exampleError, setExampleError] = useState("");
  const drafts = profile.kitDrafts || null;
  const generatedSignature = profile.kitSourceSignature || "";
  const fileInput = useRef(null);
  const profileRef = useRef(profile);
  profileRef.current = profile;
  const mounted = useRef(false);
  const uploadSequence = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      uploadSequence.current += 1;
    };
  }, []);
  const preferences =
    profile.preferences && typeof profile.preferences === "object"
      ? profile.preferences
      : {};
  const fields = [
    { label: "A role to aim for", done: !!profile.targetRole?.trim() },
    { label: "Your experience", done: !!profile.experience?.trim() },
    {
      label: "Résumé or career notes",
      done: asText(profile.resume).trim().length >= 40,
    },
    {
      label: "Skills you can explain",
      done: asText(profile.skills).trim().length >= 3,
    },
    {
      label: "One real achievement",
      done: asText(profile.achievements).trim().length >= 20,
    },
  ];
  const complete = fields.filter((field) => field.done).length;
  const signature = signatureOf(
    JSON.stringify([
      profile.name,
      profile.targetRole,
      profile.experience,
      profile.resume,
      profile.skills,
      profile.achievements,
    ]),
  );
  const hasEvidence =
    asText(profile.resume).trim().length >= 40 ||
    asText(profile.achievements).trim().length >= 20;
  const defaultKit = useMemo(() => generateProfileKit(profile), [signature]);
  const kit = drafts || defaultKit;
  const kitOutdated = !!drafts && generatedSignature !== signature;
  const update = (key, value) => onChange({ ...profile, [key]: value });
  const updatePreference = (key, value) =>
    update("preferences", { ...preferences, [key]: value });
  const copy = async (value, title) => {
    try {
      await copyText(asText(value));
      notify(`${title} copied. Review it before sharing.`);
    } catch (error) {
      notify(error.message);
    }
  };
  const exportKit = async () => {
    try {
      const result = await shareDocument({
        filename: "momentum-profile-kit.txt",
        mimeType: "text/plain",
        text: [
          `PROFILE KIT${profile.name ? ` · ${profile.name}` : ""}`,
          "Review every statement before using this draft.",
          "",
          "PROFESSIONAL HEADLINE",
          asText(kit.headline),
          "",
          "RÉSUMÉ INTRODUCTION",
          asText(kit.resumeSummary),
          "",
          "ABOUT",
          asText(kit.about),
          "",
          "EVIDENCE",
          asText(kit.bullets),
        ].join("\n"),
      });
      if (!result?.cancelled)
        notify("Profile kit exported. Keep your personal information private.");
    } catch (error) {
      notify(
        error.message ||
          "The profile kit could not be exported. You can still copy each draft.",
      );
    }
  };
  const regenerate = () => {
    const generated = generateProfileKit(profile);
    onChange({
      ...profile,
      kitDrafts: Object.fromEntries(
        Object.entries(generated)
          .filter(([key]) =>
            ["headline", "about", "resumeSummary", "bullets"].includes(key),
          )
          .map(([key, value]) => [key, asText(value)]),
      ),
      kitSourceSignature: signature,
    });
    notify("Profile drafts updated from your saved details.");
  };
  const setDraft = (key, value) => {
    onChange({
      ...profile,
      kitDrafts: {
        headline: asText(kit.headline),
        about: asText(kit.about),
        resumeSummary: asText(kit.resumeSummary),
        bullets: asText(kit.bullets),
        [key]: value,
      },
      kitSourceSignature: generatedSignature || signature,
    });
  };
  const uploadResume = async (event) => {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    const sequence = ++uploadSequence.current;
    const resumeBeforeImport = asText(profileRef.current.resume);
    const isCurrent = () =>
      mounted.current && uploadSequence.current === sequence;
    setUploading(true);
    setUploadError("");
    setPendingImport(null);
    try {
      const text = await extractDocument(file);
      if (!isCurrent()) return;
      if (text.trim().length < 20)
        throw new Error(
          "There isn’t enough readable text in this file. Try a text-based document or paste your résumé below.",
        );
      const imported = text.slice(0, 60000);
      if (asText(profileRef.current.resume) !== resumeBeforeImport) {
        setPendingImport({ text: imported, filename: file.name });
        notify(
          "Your résumé changed while the file was being read. Review the import before replacing your edits.",
        );
      } else {
        onChange({ ...profileRef.current, resume: imported });
        notify(
          `Résumé text imported from ${file.name}. Check the formatting below.`,
        );
      }
    } catch (error) {
      if (isCurrent())
        setUploadError(
          error.message ||
            "This document could not be read. You can paste the text below.",
        );
    } finally {
      if (isCurrent()) {
        setUploading(false);
        input.value = "";
      }
    }
  };
  const acceptImportedResume = () => {
    if (!pendingImport) return;
    onChange({ ...profileRef.current, resume: pendingImport.text });
    setPendingImport(null);
    notify(
      "Imported résumé applied. Your other profile details are unchanged.",
    );
  };
  const switchTab = (event) => {
    const tabs = ["story", "kit"];
    if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const next =
      event.key === "Home"
        ? "story"
        : event.key === "End"
          ? "kit"
          : tabs[(tabs.indexOf(panel) + 1) % 2];
    setPanel(next);
    document.getElementById(`profile-${next}-tab`)?.focus();
  };
  const addExample = () => {
    if (!example.action.trim() || !example.result.trim()) {
      setExampleError(
        "Add what you did and what happened. An outcome can be something you learned.",
      );
      return;
    }
    const story = [
      example.situation.trim(),
      example.action.trim(),
      example.result.trim(),
    ]
      .filter(Boolean)
      .join(" ");
    update(
      "achievements",
      [asText(profile.achievements).trim(), story].filter(Boolean).join("\n\n"),
    );
    setExample({ situation: "", action: "", result: "" });
    setExampleError("");
    notify("Your example was added to your achievements.");
  };

  return (
    <div className="profile-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">YOUR FOUNDATION</p>
          <h1>
            Your story. <span className="muted">Your advantage.</span>
          </h1>
          <p>You already have something to offer. Let’s make it easy to see.</p>
        </div>
        <span className="badge">
          <ShieldCheck size={14} /> Your personal workspace
        </span>
      </header>
      <div className="tabs" role="tablist" aria-label="Profile sections">
        <button
          type="button"
          role="tab"
          tabIndex={panel === "story" ? 0 : -1}
          onKeyDown={switchTab}
          aria-selected={panel === "story"}
          aria-controls="profile-story"
          id="profile-story-tab"
          className={panel === "story" ? "active" : ""}
          onClick={() => setPanel("story")}
        >
          <UserRound size={16} /> Your story
        </button>
        <button
          type="button"
          role="tab"
          tabIndex={panel === "kit" ? 0 : -1}
          onKeyDown={switchTab}
          aria-selected={panel === "kit"}
          aria-controls="profile-kit"
          id="profile-kit-tab"
          className={panel === "kit" ? "active" : ""}
          onClick={() => setPanel("kit")}
        >
          <Sparkles size={16} /> Profile kit
        </button>
      </div>
      {panel === "story" ? (
        <div
          className="profile-layout"
          id="profile-story"
          role="tabpanel"
          aria-labelledby="profile-story-tab"
        >
          <div className="stack">
            <section className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">01 · THE BASICS</p>
                  <h2>Start with who you are.</h2>
                </div>
                <UserRound size={22} className="muted" />
              </div>
              <div className="form-grid">
                <label className="field">
                  Your name <span className="muted">Optional</span>
                  <input
                    autoComplete="given-name"
                    value={profile.name || ""}
                    maxLength={100}
                    placeholder="What should we call you?"
                    onChange={(event) => update("name", event.target.value)}
                  />
                </label>
                <label className="field">
                  Role you’re looking for
                  <input
                    value={profile.targetRole || ""}
                    maxLength={160}
                    placeholder="e.g. Customer success manager"
                    onChange={(event) =>
                      update("targetRole", event.target.value)
                    }
                  />
                </label>
                <label className="field">
                  Location <span className="muted">Optional</span>
                  <input
                    autoComplete="address-level2"
                    value={profile.location || ""}
                    maxLength={160}
                    placeholder="e.g. Vancouver, BC"
                    onChange={(event) => update("location", event.target.value)}
                  />
                </label>
                <label className="field">
                  Where are you in your career?
                  <select
                    value={profile.experience || ""}
                    onChange={(event) =>
                      update("experience", event.target.value)
                    }
                  >
                    <option value="">Choose what feels right</option>
                    <option>Just starting out</option>
                    <option>1–3 years of experience</option>
                    <option>3–7 years of experience</option>
                    <option>7+ years of experience</option>
                    <option>Changing careers</option>
                    <option>Returning to work</option>
                  </select>
                </label>
              </div>
            </section>
            <section className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">02 · YOUR EXPERIENCE</p>
                  <h2>Bring what you’ve done.</h2>
                  <p className="muted">
                    Your résumé is a starting point. Work, study, projects,
                    volunteering and caring responsibilities all count.
                  </p>
                </div>
              </div>
              <input
                ref={fileInput}
                className="sr-only"
                tabIndex={-1}
                type="file"
                accept=".pdf,.docx,.txt,.md"
                onChange={uploadResume}
                aria-label="Import résumé document"
              />
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => fileInput.current?.click()}
                disabled={uploading}
              >
                {uploading ? (
                  <LoaderCircle size={17} className="spin" />
                ) : (
                  <Upload size={17} />
                )}
                {uploading ? "Reading your document…" : "Import a résumé"}
              </button>
              <p className="muted small-text">
                PDF, Word, or text · up to 5 MB · read on your device
              </p>
              {uploadError && (
                <p className="form-error" role="alert">
                  {uploadError}
                </p>
              )}
              {pendingImport && (
                <div
                  className="callout resume-import-review"
                  role="group"
                  aria-label="Review imported résumé"
                >
                  <FileText size={20} aria-hidden="true" />
                  <div>
                    <strong>Your edits are still here.</strong>
                    <p>
                      Your résumé changed while {pendingImport.filename} was
                      being read. Review the imported text, then choose which
                      version to keep.
                    </p>
                    <details>
                      <summary>Review imported text</summary>
                      <label className="field">
                        Imported résumé preview
                        <textarea
                          rows={7}
                          value={pendingImport.text}
                          readOnly
                        />
                      </label>
                    </details>
                    <div className="inline-actions">
                      <button
                        type="button"
                        className="btn btn-primary"
                        onClick={acceptImportedResume}
                      >
                        Use imported résumé
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => {
                          setPendingImport(null);
                          notify("Your current résumé was kept.");
                        }}
                      >
                        Keep my current résumé
                      </button>
                    </div>
                  </div>
                </div>
              )}
              <label className="field">
                Résumé or career notes
                <textarea
                  rows={9}
                  value={asText(profile.resume)}
                  maxLength={60000}
                  placeholder="Paste your résumé, or describe your recent roles, education and projects. Leave out private details you don’t need, such as your full address."
                  onChange={(event) => update("resume", event.target.value)}
                />
              </label>
              <p className="muted small-text">
                Imported formatting can change. Review the text before using it
                in an application.
              </p>
            </section>
            <section className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">03 · YOUR EVIDENCE</p>
                  <h2>Make your strengths concrete.</h2>
                  <p className="muted">
                    Specific, honest examples are more convincing than a list of
                    adjectives.
                  </p>
                </div>
              </div>
              <label className="field">
                Skills you can confidently explain
                <textarea
                  rows={3}
                  value={asText(profile.skills)}
                  maxLength={8000}
                  placeholder="e.g. Customer support, Excel, resolving conflict, project coordination"
                  onChange={(event) => update("skills", event.target.value)}
                />
              </label>
              <label className="field">
                Achievements and examples
                <textarea
                  rows={5}
                  value={asText(profile.achievements)}
                  maxLength={20000}
                  placeholder="What did you do, and what changed? Use a number if you have one. A clear outcome or lesson is useful too."
                  onChange={(event) =>
                    update("achievements", event.target.value)
                  }
                />
              </label>
              <details className="evidence-builder">
                <summary>
                  <Plus size={16} /> Need a hand finding an example?
                </summary>
                <div className="stack">
                  <p className="muted">
                    Think of a time you made something easier, solved a problem,
                    learned quickly, or helped someone.
                  </p>
                  <label className="field">
                    What was happening?
                    <input
                      value={example.situation}
                      maxLength={500}
                      placeholder="e.g. Our team was receiving the same questions each week."
                      onChange={(event) =>
                        setExample({
                          ...example,
                          situation: event.target.value,
                        })
                      }
                    />
                  </label>
                  <label className="field">
                    What did you personally do?
                    <textarea
                      rows={2}
                      value={example.action}
                      maxLength={1000}
                      placeholder="Describe your actual contribution."
                      onChange={(event) =>
                        setExample({ ...example, action: event.target.value })
                      }
                    />
                  </label>
                  <label className="field">
                    What changed or what did you learn?
                    <textarea
                      rows={2}
                      value={example.result}
                      maxLength={1000}
                      placeholder="An observable outcome. Don’t add a number unless you can support it."
                      onChange={(event) =>
                        setExample({ ...example, result: event.target.value })
                      }
                    />
                  </label>
                  {exampleError && (
                    <p role="alert" className="form-error">
                      {exampleError}
                    </p>
                  )}
                  <div>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={addExample}
                    >
                      <Plus size={16} /> Add this example
                    </button>
                  </div>
                </div>
              </details>
            </section>
            <section className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">04 · YOUR NEXT CHAPTER</p>
                  <h2>A good fit goes both ways.</h2>
                </div>
              </div>
              <div className="form-grid">
                <label className="field">
                  Preferred work arrangement
                  <select
                    value={preferences.workStyle || ""}
                    onChange={(event) =>
                      updatePreference("workStyle", event.target.value)
                    }
                  >
                    <option value="">I’m open to options</option>
                    <option>On-site</option>
                    <option>Hybrid</option>
                    <option>Remote</option>
                  </select>
                </label>
                <label className="field">
                  What matters most right now?
                  <select
                    value={preferences.priority || ""}
                    onChange={(event) =>
                      updatePreference("priority", event.target.value)
                    }
                  >
                    <option value="">Choose a priority</option>
                    <option>Getting my first opportunity</option>
                    <option>Better compensation</option>
                    <option>Learning and growth</option>
                    <option>Stability</option>
                    <option>Flexibility and balance</option>
                    <option>More meaningful work</option>
                  </select>
                </label>
              </div>
              <label className="field">
                Your non-negotiables <span className="muted">Optional</span>
                <textarea
                  rows={2}
                  value={preferences.nonNegotiables || ""}
                  maxLength={3000}
                  placeholder="e.g. A predictable schedule, no relocation, or a clear path to progression."
                  onChange={(event) =>
                    updatePreference("nonNegotiables", event.target.value)
                  }
                />
              </label>
            </section>
          </div>
          <aside className="profile-sidebar stack">
            <section className="card profile-progress">
              <div className="icon-tile">
                <Fingerprint size={24} />
              </div>
              <p className="eyebrow">A PROFILE THAT’S YOURS</p>
              <h2>One step at a time.</h2>
              <p className="muted">
                A little detail now makes your applications and preparation more
                personal.
              </p>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Profile details added"
                aria-valuenow={complete}
                aria-valuemin={0}
                aria-valuemax={5}
              >
                <span style={{ width: `${complete * 20}%` }} />
              </div>
              <p className="mini-label">{complete} of 5 foundations added</p>
              <ul className="checklist">
                {fields.map((field) => (
                  <li
                    key={field.label}
                    className={`check-item ${field.done ? "done" : ""}`}
                  >
                    {field.done ? (
                      <CheckCircle2 size={17} />
                    ) : (
                      <span className="check-circle" aria-hidden="true" />
                    )}
                    <span>{field.label}</span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setPanel("kit")}
              >
                Build my profile kit <ArrowRight size={16} />
              </button>
            </section>
            <div className="callout">
              <ShieldCheck size={19} />
              <div>
                <strong>Your details stay yours.</strong>
                <p>
                  Edits save on this device. Never add account passwords,
                  identity documents or banking details.
                </p>
              </div>
            </div>
          </aside>
        </div>
      ) : (
        <div
          id="profile-kit"
          role="tabpanel"
          aria-labelledby="profile-kit-tab"
          className="stack"
        >
          <section className="card kit-intro">
            <div>
              <p className="eyebrow">PUT YOUR STORY TO WORK</p>
              <h2>Clearer words. The same you.</h2>
              <p className="muted">
                A local starting draft built from your details. Edit it into
                your own voice, then copy it into your résumé, LinkedIn or
                Indeed profile.
              </p>
            </div>
            <div className="inline-actions">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={regenerate}
              >
                <Sparkles size={16} /> Refresh from my story
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={exportKit}
              >
                <FileDown size={16} /> Export kit
              </button>
            </div>
          </section>
          {!hasEvidence && (
            <div className="callout">
              <FileText size={20} />
              <div>
                <strong>Add some experience to make this useful.</strong>
                <p>
                  Your résumé or one real achievement gives Momentum something
                  specific to work with.
                </p>
                <button
                  type="button"
                  className="text-link"
                  onClick={() => setPanel("story")}
                >
                  Add my experience <ArrowRight size={14} />
                </button>
              </div>
            </div>
          )}
          {kitOutdated && (
            <div className="callout">
              <Sparkles size={19} />
              <div>
                <strong>Your story has changed.</strong>
                <p>
                  Refresh these drafts to include your latest details.
                  Refreshing replaces edits to the drafts below.
                </p>
              </div>
            </div>
          )}
          <div className="kit-grid">
            <DraftField
              title="Professional headline"
              description="A simple introduction for your profile."
              value={asText(kit.headline)}
              rows={2}
              onChange={(value) => setDraft("headline", value)}
              onCopy={copy}
            />
            <DraftField
              title="Résumé introduction"
              description="Keep it specific to the role you want."
              value={asText(kit.resumeSummary)}
              onChange={(value) => setDraft("resumeSummary", value)}
              onCopy={copy}
            />
          </div>
          <DraftField
            title="About you"
            description="A starting point for your LinkedIn or Indeed profile."
            value={asText(kit.about)}
            rows={7}
            onChange={(value) => setDraft("about", value)}
            onCopy={copy}
          />
          <DraftField
            title="Evidence you can build on"
            description="Turn each example into a bullet. Keep only statements you can explain and support."
            value={asText(kit.bullets)}
            rows={6}
            onChange={(value) => setDraft("bullets", value)}
            onCopy={copy}
          />
          <div className="callout">
            <CheckCircle2 size={20} />
            <div>
              <strong>One last human check.</strong>
              <p>
                Keep your actual job titles, dates, qualifications and results
                accurate. These drafts don’t update external profiles
                automatically. Your draft edits save on this device alongside
                your profile.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
