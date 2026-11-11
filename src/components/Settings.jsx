import { useState, useRef } from "react";
import {
  Download,
  Upload,
  Trash2,
  ShieldCheck,
  Smartphone,
  CloudOff,
  ArrowUpRight,
  FileText,
  CheckCircle2,
  Info,
  ExternalLink,
} from "lucide-react";
import { parseBackup, STORAGE_KEY } from "../lib/storage.js";
import { shareDocument, clearNativeExportCache } from "../lib/native.js";
import Modal from "./Modal.jsx";
export default function Settings({
  workspace,
  storageError,
  onRestore,
  onClear,
  notify,
  capabilities,
}) {
  const [restore, setRestore] = useState(null),
    [deleting, setDeleting] = useState(false),
    [confirmation, setConfirmation] = useState(""),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const fileInput = useRef(null);
  async function exportBackup() {
    try {
      const result = await shareDocument({
        filename: `momentum-backup-${new Date().toISOString().slice(0, 10)}.json`,
        text: JSON.stringify(workspace, null, 2),
        mimeType: "application/json",
      });
      if (!result.cancelled)
        notify("Backup exported. Keep it somewhere private.");
    } catch (e) {
      setError(e.message);
    }
  }
  async function recovery() {
    try {
      const raw = {
        momentum: localStorage.getItem(STORAGE_KEY),
        previousApp: localStorage.getItem("nextstep.preparations.v1"),
      };
      const result = await shareDocument({
        filename: "momentum-storage-recovery.json",
        text: JSON.stringify(raw, null, 2),
        mimeType: "application/json",
      });
      if (!result.cancelled)
        notify(
          "Original storage exported for recovery. It may contain personal information.",
        );
    } catch (e) {
      setError(e.message);
    }
  }
  async function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;
    setError("");
    try {
      if (file.size > 5000000) throw Error("Use a backup smaller than 5 MB.");
      const state = parseBackup(await file.text());
      setRestore(state);
    } catch (e) {
      setError(
        e instanceof SyntaxError
          ? "This file isn’t valid JSON. Choose a Momentum or Next Step backup."
          : e.message,
      );
    } finally {
      event.target.value = "";
    }
  }
  async function removeAll() {
    setBusy(true);
    setError("");
    try {
      await clearNativeExportCache();
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem("nextstep.preparations.v1");
      onClear();
      setDeleting(false);
    } catch (e) {
      setError(
        "Some data couldn’t be removed. Try again, or clear this app’s website data in your browser settings.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">YOUR SPACE, YOUR CONTROL</span>
          <h1>Keep your story yours.</h1>
          <p>
            Manage your data, keep a backup, and understand how Momentum works.
          </p>
        </div>
      </header>
      <div className="settings-grid">
        <div className="stack">
          <section className="card">
            <div className="card-header">
              <div>
                <span className="eyebrow">SAVED HERE</span>
                <h2>A private workspace on your device.</h2>
              </div>
              <ShieldCheck size={24} />
            </div>
            <p>
              Your profile, job descriptions, course notes, practice answers and
              offers save in this app’s local storage. No account or automatic
              cloud sync is required.
            </p>
            <div className="storage-stats">
              <div>
                <strong>{workspace.opportunities.length}</strong>
                <span>opportunities</span>
              </div>
              <div>
                <strong>{workspace.offers.length}</strong>
                <span>offers</span>
              </div>
              <div>
                <strong>
                  {Math.max(
                    1,
                    Math.round(
                      new Blob([JSON.stringify(workspace)]).size / 1024,
                    ),
                  )}{" "}
                  KB
                </strong>
                <span>workspace size</span>
              </div>
            </div>
            <div className="callout">
              <Info size={19} />
              <p>
                Local storage isn’t encrypted by Momentum. People with access to
                your browser or unlocked device may read it. Clearing app data
                or changing devices can remove your work. Device backups may
                include app data.
              </p>
            </div>
          </section>
          <section className="card">
            <div className="card-header">
              <div>
                <span className="eyebrow">KEEP A COPY</span>
                <h2>Your progress is worth saving.</h2>
                <p className="muted">
                  Export your complete workspace. Keep backups private—they
                  include your résumé, notes and answers.
                </p>
              </div>
              <Download size={22} />
            </div>
            <button className="btn btn-primary" onClick={exportBackup}>
              <Download size={17} /> Export my workspace
            </button>
            {storageError && (
              <div className="callout">
                <div>
                  <strong>Saved data needs attention.</strong>
                  <p>
                    Download the original stored data before resetting or
                    restoring. A recovery file is for troubleshooting and isn’t
                    a normal workspace backup.
                  </p>
                  <button className="btn btn-secondary" onClick={recovery}>
                    <Download size={16} /> Export original data for recovery
                  </button>
                </div>
              </div>
            )}
            <hr />
            <h3>Restore a workspace</h3>
            <p className="muted">
              Choose a Momentum backup or a previous Next Step backup. You’ll
              review the import before replacing what’s here.
            </p>
            <input
              ref={fileInput}
              type="file"
              className="sr-only"
              tabIndex={-1}
              accept=".json,application/json"
              aria-label="Restore workspace backup"
              onChange={importBackup}
            />
            <button
              className="btn btn-secondary"
              onClick={() => fileInput.current.click()}
            >
              <Upload size={17} /> Choose backup file
            </button>
            {error && (
              <p className="field-error" role="alert">
                {error}
              </p>
            )}
          </section>
          <section className="card danger-zone">
            <h2>A clean slate, if you need one.</h2>
            <p className="muted">
              Delete your profile, opportunities, practice history, offers and
              drafts from this device. Export a backup first if you want to keep
              them.
            </p>
            <button
              className="btn btn-danger"
              onClick={() => setDeleting(true)}
            >
              <Trash2 size={16} /> Delete all my data
            </button>
          </section>
        </div>
        <aside className="stack">
          <section className="card">
            <span className="eyebrow">HOW MOMENTUM WORKS</span>
            <h3>Helpful tools. Clear boundaries.</h3>
            <div className="service-item">
              <span className="status-dot" />
              <div>
                <strong>On-device preparation</strong>
                <p>
                  Courses and first drafts use the details you provide and local
                  templates. Practice feedback checks writing structure.
                </p>
              </div>
            </div>
            <div className="service-item">
              <span
                className={`status-dot ${capabilities?.jobImport ? "" : "neutral"}`}
              />
              <div>
                <strong>Public page import</strong>
                <p>
                  {capabilities?.jobImport
                    ? "Connected. A link you choose is sent to the import service to read that page."
                    : "Available when the online service is connected. Pasting text and document import work on your device."}
                </p>
              </div>
            </div>
            <div className="service-item">
              <span
                className={`status-dot ${capabilities?.aiCoach ? "" : "neutral"}`}
              />
              <div>
                <strong>Optional AI coaching</strong>
                <p>
                  {capabilities?.aiCoach
                    ? "Available. Each request asks permission before sharing the listed details with OpenAI."
                    : "Not connected in this installation. Your local preparation tools remain available."}
                </p>
              </div>
            </div>
            <p className="muted small-text">
              Momentum doesn’t submit job applications, sign offers, or update
              external profiles. You stay in control of what gets sent.
            </p>
          </section>
          <section className="card">
            <span className="eyebrow">TAKE IT WITH YOU</span>
            <h3>A home for your next chapter.</h3>
            <p className="muted">
              On iPhone, open this app in Safari, tap Share, then Add to Home
              Screen. On Android, use Chrome’s Install app option.
            </p>
            <p className="muted small-text">
              Install first, then start your workspace. Browser and Home Screen
              storage may be separate; use export and restore to move your work.
            </p>
            <div className="callout subtle">
              <CloudOff size={19} />
              <p>
                Core tools work offline after the app has loaded. Online imports
                and AI need a connection.
              </p>
            </div>
          </section>
          <section className="card about-card">
            <span className="eyebrow">MOMENTUM BY PRISM</span>
            <h3>For what comes next.</h3>
            <p className="muted">Version 1.0.0 · Your career, in focus.</p>
            <a
              className="text-link"
              href="./privacy.html"
              target="_blank"
              rel="noreferrer"
            >
              Privacy policy <ArrowUpRight size={15} />
            </a>
            <a
              className="text-link"
              href="./support.html"
              target="_blank"
              rel="noreferrer"
            >
              Support & help <ArrowUpRight size={15} />
            </a>
            <a
              className="text-link"
              href="./third-party-notices.txt"
              target="_blank"
              rel="noreferrer"
            >
              Open-source licenses <ArrowUpRight size={15} />
            </a>
          </section>
        </aside>
      </div>
      {restore && (
        <Modal title="Restore this workspace?" onClose={() => setRestore(null)}>
          <div className="modal-content">
            <p>
              This backup contains{" "}
              <strong>{restore.opportunities.length} opportunities</strong> and{" "}
              <strong>{restore.offers.length} offers</strong>
              {restore.profile.name ? ` for ${restore.profile.name}` : ""}.
            </p>
            <p>
              Restoring replaces the workspace currently on this device. Export
              your current workspace first if you want to keep it.
            </p>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setRestore(null)}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={() => {
                  onRestore(restore);
                  setRestore(null);
                }}
              >
                Replace & restore
              </button>
            </div>
          </div>
        </Modal>
      )}
      {deleting && (
        <Modal
          title="Delete your Momentum workspace?"
          onClose={() => {
            if (!busy) {
              setDeleting(false);
              setConfirmation("");
            }
          }}
        >
          <div className="modal-content">
            <p>
              This removes your saved profile, opportunities, notes, practice
              answers, offers and temporary native exports from this device.
              Exported backups elsewhere are unaffected.
            </p>
            <label className="field">
              Type DELETE to confirm
              <input
                autoComplete="off"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="DELETE"
              />
            </label>
            {error && (
              <p role="alert" className="field-error">
                {error}
              </p>
            )}
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => {
                  setDeleting(false);
                  setConfirmation("");
                }}
              >
                Keep my workspace
              </button>
              <button
                className="btn btn-danger"
                disabled={confirmation !== "DELETE" || busy}
                onClick={removeAll}
              >
                {busy ? "Deleting…" : "Delete all my data"}
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
