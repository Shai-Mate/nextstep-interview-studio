import { useState } from "react";
import {
  Sparkles,
  ArrowRight,
  LoaderCircle,
  ShieldCheck,
  Check,
  X,
  ExternalLink,
  Clipboard,
  Download,
} from "lucide-react";
import Modal from "./Modal.jsx";
import { requestAPI, copyText, safeURL } from "../lib/api.js";
import { shareDocument } from "../lib/native.js";
export default function AiCoach({
  action,
  job,
  profile,
  question,
  answer,
  context,
  capabilities,
  notify,
  label = "Get another perspective",
  onSave,
}) {
  const [webResearch, setWebResearch] = useState(false),
    [sources, setSources] = useState([]);
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false),
    [result, setResult] = useState(null),
    [error, setError] = useState(""),
    [consent, setConsent] = useState(false);
  if (!capabilities?.aiCoach) return null;
  const resultText = () =>
    [
      result?.title,
      result?.summary,
      ...(result?.sections || []).map((s) =>
        [s.title, s.body, ...(s.bullets || []).map((b) => "• " + b)].join("\n"),
      ),
      ...(result?.nextSteps || []).map((s) => "Next: " + s),
      sources.length
        ? "SOURCES\n" + sources.map((s) => s.title + "\n" + s.url).join("\n\n")
        : "",
    ]
      .filter(Boolean)
      .join("\n\n");
  async function copyResult() {
    try {
      await copyText(resultText());
      notify("Suggestions copied. Review the details before using them.");
    } catch (e) {
      notify(e.message);
    }
  }
  async function exportResult() {
    try {
      await shareDocument({
        filename: "momentum-coaching-notes.txt",
        text: resultText(),
        mimeType: "text/plain",
      });
    } catch (e) {
      notify(e.message);
    }
  }
  async function generate() {
    setBusy(true);
    setError("");
    try {
      const data = await requestAPI("coach", {
        action,
        job: job
          ? { role: job.role, company: job.company, text: job.job }
          : undefined,
        profile,
        question,
        answer,
        context,
        consent: true,
        webResearch: action === "research" && webResearch,
      });
      setResult(data.result);
      setSources(data.sources || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <button className="btn btn-secondary" onClick={() => setOpen(true)}>
        <Sparkles size={16} />
        {label}
      </button>
      {open && (
        <Modal
          title="An extra perspective"
          onClose={() => {
            if (!busy) setOpen(false);
          }}
          wide
        >
          <div className="modal-content">
            {!result ? (
              <>
                <span className="eyebrow">OPTIONAL AI COACHING</span>
                <h3>A thoughtful second pass.</h3>
                <p>
                  With your permission, Momentum sends the details below to
                  OpenAI to provide tailored suggestions. AI can make mistakes;
                  review its advice against your own experience.
                </p>
                <div className="callout">
                  <ShieldCheck size={20} />
                  <div>
                    <strong>What will be shared</strong>
                    <ul>
                      {job && (
                        <li>
                          The job title, company and full job description.
                        </li>
                      )}
                      {profile && !webResearch && (
                        <li>
                          Your candidate profile, including résumé and
                          achievements.
                        </li>
                      )}
                      {question && !webResearch && (
                        <li>The practice question.</li>
                      )}
                      {answer && !webResearch && <li>The answer you wrote.</li>}
                      {context && (
                        <li>
                          The research notes or context included for this
                          action.
                        </li>
                      )}
                    </ul>
                    <p>
                      OpenAI processes this data under its{" "}
                      <a
                        href="https://openai.com/policies/privacy-policy/"
                        target="_blank"
                        rel="noreferrer"
                      >
                        privacy policy
                      </a>
                      . Momentum’s service does not save the request. Avoid
                      including passwords, identity documents or information you
                      don’t want shared.
                    </p>
                  </div>
                </div>
                {action === "research" && capabilities.webResearch && (
                  <div className="research-consent">
                    <label className="consent-check">
                      <input
                        type="checkbox"
                        checked={webResearch}
                        onChange={(e) => {
                          setWebResearch(e.target.checked);
                          setConsent(false);
                        }}
                        disabled={busy}
                      />
                      <span>
                        Research public professional sources on the web.
                      </span>
                    </label>
                    <p className="muted small-text">
                      OpenAI may use the company name, interviewer’s name, and
                      professional context in search queries shared with search
                      providers. Your candidate profile and practice answers are
                      not included in this research request. Sources will be
                      linked for you to check.
                    </p>
                  </div>
                )}
                <label className="consent-check">
                  <input
                    type="checkbox"
                    checked={consent}
                    onChange={(e) => setConsent(e.target.checked)}
                    disabled={busy}
                  />
                  <span>
                    I agree to send these details to OpenAI for this request.
                  </span>
                </label>
                {error && (
                  <p className="field-error" role="alert">
                    {error}
                  </p>
                )}
                <div className="modal-footer">
                  <button
                    className="btn btn-ghost"
                    onClick={() => setOpen(false)}
                    disabled={busy}
                  >
                    Keep working on my device
                  </button>
                  <button
                    className="btn btn-primary"
                    disabled={!consent || busy}
                    onClick={generate}
                  >
                    {busy ? (
                      <LoaderCircle className="spin" size={17} />
                    ) : (
                      <Sparkles size={17} />
                    )}{" "}
                    {busy ? "Considering your details…" : "Get suggestions"}
                  </button>
                </div>
              </>
            ) : (
              <div className="ai-result">
                <span className="badge">
                  <Sparkles size={14} /> AI suggestions · review before using
                </span>
                <h3>{result.title}</h3>
                <p>{result.summary}</p>
                {result.sections?.map((section, i) => (
                  <section key={i}>
                    <h4>{section.title}</h4>
                    <p className="preline">{section.body}</p>
                    {section.bullets?.length > 0 && (
                      <ul>
                        {section.bullets.map((item, j) => (
                          <li key={j}>{item}</li>
                        ))}
                      </ul>
                    )}
                  </section>
                ))}
                {result.nextSteps?.length > 0 && (
                  <div className="callout">
                    <div>
                      <strong>Your next steps</strong>
                      <ul>
                        {result.nextSteps.map((item, i) => (
                          <li key={i}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
                {sources.length > 0 && (
                  <section className="research-sources">
                    <h4>Sources to review</h4>
                    <ul>
                      {sources.map((source, i) => (
                        <li key={i}>
                          {safeURL(source.url) && (
                            <a
                              href={safeURL(source.url)}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {source.title || source.url}{" "}
                              <ExternalLink size={13} />
                            </a>
                          )}
                        </li>
                      ))}
                    </ul>
                  </section>
                )}
                <div className="inline-actions ai-result-actions">
                  {onSave && (
                    <button
                      className="btn btn-primary"
                      onClick={() => {
                        if (onSave(resultText()) === false) return;
                        notify("Research brief saved with your notes.");
                        setOpen(false);
                      }}
                    >
                      Save to my notes <Check size={16} />
                    </button>
                  )}
                  <button className="btn btn-secondary" onClick={copyResult}>
                    <Clipboard size={16} /> Copy suggestions
                  </button>
                  <button className="btn btn-ghost" onClick={exportResult}>
                    <Download size={16} /> Export
                  </button>
                </div>
                <p className="muted small-text">
                  Keep any useful suggestions before closing this window. Check
                  facts and make the words your own.
                </p>
              </div>
            )}
          </div>
        </Modal>
      )}
    </>
  );
}
