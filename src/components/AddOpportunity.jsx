import { handleTabKeys } from "../lib/accessibility.js";
import { useState, useRef } from "react";
import {
  FileText,
  Link2,
  Upload,
  ArrowRight,
  ArrowLeft,
  Check,
  LoaderCircle,
  ShieldCheck,
  Info,
} from "lucide-react";
import Modal from "./Modal.jsx";
import { analyzeJob } from "../../engine.js";
import { extractDocument } from "../lib/documents.js";
import { requestAPI, safeURL } from "../lib/api.js";
export default function AddOpportunity({ onClose, onCreate, capabilities }) {
  const [mode, setMode] = useState("text"),
    [step, setStep] = useState(1),
    [job, setJob] = useState(""),
    [url, setURL] = useState(""),
    [role, setRole] = useState(""),
    [company, setCompany] = useState(""),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [fileName, setFileName] = useState(""),
    [notice, setNotice] = useState("");
  const [intake, setIntake] = useState({
      experience: "Experienced",
      stage: "Not sure yet",
      focus: "Balanced",
      time: "30 minutes",
    }),
    [interviewDate, setInterviewDate] = useState(""),
    [interviewerName, setInterviewerName] = useState("");
  const alive = useRef(true);
  async function importLink() {
    setError("");
    setNotice("");
    if (!safeURL(url)) {
      setError("Add a full job link, starting with https://.");
      return;
    }
    setBusy(true);
    try {
      const data = await requestAPI("import-job", { url });
      setJob(data.job.text);
      setRole(data.job.role || "");
      setCompany(data.job.company || "");
      setNotice(
        data.warnings?.join(" ") ||
          "Job text imported. Review it before continuing.",
      );
      setMode("text");
    } catch (e) {
      setError(
        e.message +
          " Some job sites block imports; copying the description works just as well.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function upload(file) {
    if (!file) return;
    setError("");
    setBusy(true);
    try {
      setJob(await extractDocument(file));
      setFileName(file.name);
      setMode("text");
      setNotice(
        `Text extracted from ${file.name}. Review it before continuing.`,
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  function next(e) {
    e.preventDefault();
    setError("");
    if (job.trim().length < 40) {
      setError(
        "Add a little more of the job description—at least 40 characters. Include the responsibilities and requirements.",
      );
      return;
    }
    const result = analyzeJob({ job, role, company });
    if (!role)
      setRole(
        ["New opportunity", "Your next role"].includes(result.role)
          ? ""
          : result.role,
      );
    if (!company)
      setCompany(
        ["Company", "Your next company"].includes(result.company)
          ? ""
          : result.company,
      );
    setStep(2);
  }
  function create(e) {
    e.preventDefault();
    if (!role.trim() || !company.trim()) {
      setError(
        "Add the job title and company so your workspace is easy to find.",
      );
      return;
    }
    try {
      onCreate({
        job,
        role: role.trim(),
        company: company.trim(),
        url,
        intake,
        interviewDate,
        interviewerName,
      });
    } catch (e) {
      setError(e.message);
    }
  }
  return (
    <Modal title="Your next opportunity" onClose={onClose} wide>
      <div className="modal-content">
        <div className="setup-progress">
          <span className="active">
            {step > 1 ? <Check size={14} /> : 1} The opportunity
          </span>
          <i />
          <span className={step === 2 ? "active" : ""}>2 Make it yours</span>
        </div>
        {step === 1 ? (
          <>
            <div className="setup-intro">
              <span className="eyebrow">GOOD THINGS START HERE</span>
              <h3>One role. A clearer path.</h3>
              <p>
                Add the job description. We’ll turn it into a personal
                preparation plan.
              </p>
            </div>
            <div
              className="segmented"
              role="tablist"
              onKeyDown={handleTabKeys}
              aria-label="Add job description"
            >
              {[
                { id: "text", label: "Paste text", icon: FileText },
                { id: "link", label: "Job link", icon: Link2 },
                { id: "file", label: "Upload a file", icon: Upload },
              ].map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  tabIndex={mode === id ? 0 : -1}
                  aria-selected={mode === id}
                  className={mode === id ? "active" : ""}
                  onClick={() => {
                    setMode(id);
                    setError("");
                  }}
                >
                  <Icon size={16} />
                  {label}
                </button>
              ))}
            </div>
            <form onSubmit={next}>
              {mode === "text" && (
                <label className="field">
                  Job description
                  <textarea
                    data-autofocus
                    value={job}
                    onChange={(e) => setJob(e.target.value)}
                    maxLength={60000}
                    rows={9}
                    placeholder="Paste the job ad here. Include what you’ll do, the skills they’re looking for, and anything about the interview process…"
                  />
                  <span className="field-hint">
                    The more relevant detail you add, the more focused your plan
                    will be.
                  </span>
                </label>
              )}
              {mode === "link" && (
                <div className="stack">
                  <label className="field">
                    Link to the job ad
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => setURL(e.target.value)}
                      maxLength={2000}
                      placeholder="https://company.com/careers/your-next-role"
                    />
                  </label>
                  <div className="callout subtle">
                    <Link2 size={19} />
                    <p>
                      We’ll read this public page through Momentum’s import
                      service. Some sites require a login or block imports. In
                      that case, paste the description instead.
                    </p>
                  </div>
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={importLink}
                    disabled={busy || !url.trim()}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <ArrowRight size={17} />
                    )}{" "}
                    {busy ? "Reading the job ad…" : "Import job description"}
                  </button>
                </div>
              )}
              {mode === "file" && (
                <label className={`upload-zone ${busy ? "busy" : ""}`}>
                  <span className="upload-icon">
                    {busy ? (
                      <LoaderCircle className="spin" size={26} />
                    ) : (
                      <Upload size={26} />
                    )}
                  </span>
                  <strong>
                    {busy
                      ? "Reading your document…"
                      : "Choose your job description"}
                  </strong>
                  <span>PDF, Word, or text · up to 5 MB</span>
                  <small>Files are read on your device.</small>
                  <input
                    type="file"
                    accept=".pdf,.docx,.txt,.md"
                    disabled={busy}
                    onChange={(e) => upload(e.target.files[0])}
                  />
                </label>
              )}
              {notice && (
                <p className="inline-notice">
                  <Check size={15} />
                  {notice}
                </p>
              )}
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="modal-footer">
                <span className="privacy-caption">
                  <ShieldCheck size={14} /> Private by default
                </span>
                <button
                  className="btn btn-primary"
                  type="submit"
                  disabled={busy || !job.trim()}
                >
                  Continue <ArrowRight size={17} />
                </button>
              </div>
            </form>
          </>
        ) : (
          <>
            <div className="setup-intro">
              <span className="eyebrow">A PLAN THAT FITS YOU</span>
              <h3>A few details. Then you’re in.</h3>
              <p>
                Check the role details and choose where you’d like to focus.
              </p>
            </div>
            <form onSubmit={create}>
              <div className="form-grid">
                <label className="field">
                  Job title
                  <input
                    autoFocus
                    required
                    value={role}
                    maxLength={120}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="e.g. Product Designer"
                  />
                </label>
                <label className="field">
                  Company
                  <input
                    required
                    value={company}
                    maxLength={120}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="e.g. Forma"
                  />
                </label>
                <label className="field">
                  Your experience
                  <select
                    value={intake.experience}
                    onChange={(e) =>
                      setIntake({ ...intake, experience: e.target.value })
                    }
                  >
                    <option>Early career</option>
                    <option>Experienced</option>
                    <option>Career change</option>
                    <option>Returning to work</option>
                  </select>
                </label>
                <label className="field">
                  Interview stage
                  <select
                    value={intake.stage}
                    onChange={(e) =>
                      setIntake({ ...intake, stage: e.target.value })
                    }
                  >
                    <option>Not sure yet</option>
                    <option>Screening</option>
                    <option>Technical</option>
                    <option>Portfolio review</option>
                    <option>Panel</option>
                    <option>Final</option>
                  </select>
                </label>
                <label className="field">
                  What would help most?
                  <select
                    value={intake.focus}
                    onChange={(e) =>
                      setIntake({ ...intake, focus: e.target.value })
                    }
                  >
                    <option>Balanced</option>
                    <option>Confidence</option>
                    <option>Tell my story</option>
                    <option>Role skills</option>
                    <option>Concise answers</option>
                  </select>
                </label>
                <label className="field">
                  Time for a little progress
                  <select
                    value={intake.time}
                    onChange={(e) =>
                      setIntake({ ...intake, time: e.target.value })
                    }
                  >
                    <option>15 minutes</option>
                    <option>30 minutes</option>
                    <option>60 minutes</option>
                  </select>
                </label>
              </div>
              <details className="optional-details">
                <summary>Already have an interview? Add the details</summary>
                <div className="form-grid">
                  <label className="field">
                    Interview date <span className="optional">Optional</span>
                    <input
                      type="datetime-local"
                      value={interviewDate}
                      onChange={(e) => setInterviewDate(e.target.value)}
                    />
                  </label>
                  <label className="field">
                    Interviewer’s name{" "}
                    <span className="optional">Optional</span>
                    <input
                      value={interviewerName}
                      maxLength={120}
                      onChange={(e) => setInterviewerName(e.target.value)}
                      placeholder="Who will you be speaking with?"
                    />
                  </label>
                </div>
              </details>
              {error && (
                <p className="field-error" role="alert">
                  {error}
                </p>
              )}
              <div className="callout subtle">
                <Sparkle />
                <p>
                  Your plan uses the job ad and your choices. You can add your
                  résumé and interviewer research at any time.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={() => {
                    setError("");
                    setStep(1);
                  }}
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button className="btn btn-primary" type="submit">
                  Create my plan <ArrowRight size={17} />
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </Modal>
  );
}
function Sparkle() {
  return <span className="tiny-star">✦</span>;
}
