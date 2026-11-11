import { useState } from "react";
import {
  Sparkles,
  Clipboard,
  Download,
  Trash2,
  ExternalLink,
} from "lucide-react";
import { copyText, safeURL } from "../lib/api.js";
import { shareDocument } from "../lib/native.js";

const labels = {
  course: "Learning path",
  "interview-feedback": "Interview feedback",
  application: "Application",
  research: "Research",
  negotiation: "Negotiation",
};

export default function CoachingNotes({ notes = [], onChange, notify }) {
  const [removing, setRemoving] = useState(null);
  if (!notes.length) return null;
  async function copy(note) {
    try {
      await copyText(note.text);
      notify("Coaching note copied.");
    } catch (error) {
      notify(error.message);
    }
  }
  async function exportNote(note) {
    try {
      await shareDocument({
        filename: "momentum-coaching-note.txt",
        text: `MOMENTUM · SAVED AI COACHING\nReview suggestions against your own experience.\n\n${note.text}`,
        mimeType: "text/plain",
      });
    } catch (error) {
      notify(error.message);
    }
  }
  return (
    <section
      className="card coaching-library"
      aria-label="Saved coaching notes"
    >
      <div className="coaching-library-heading">
        <Sparkles size={20} aria-hidden="true" />
        <div>
          <h2>Saved coaching notes</h2>
          <p>
            Keep the useful parts close. These AI suggestions are saved on this
            device and available offline.
          </p>
        </div>
        <span className="badge">{notes.length}</span>
      </div>
      {notes.map((note) => (
        <details className="coaching-note" key={note.id}>
          <summary>
            <strong>{note.title}</strong>
            <span>
              {labels[note.action] || "Coaching"} ·{" "}
              {new Date(note.created).toLocaleDateString()}
            </span>
          </summary>
          <p className="muted small-text">
            AI suggestions · check facts and make the words your own.
          </p>
          <p className="preline coaching-note-text">{note.text}</p>
          {note.sources?.length > 0 && (
            <ul className="coaching-note-sources">
              {note.sources.map(
                (source, i) =>
                  safeURL(source.url) && (
                    <li key={i}>
                      <a
                        href={safeURL(source.url)}
                        target="_blank"
                        rel="noreferrer"
                      >
                        {source.title || source.url} <ExternalLink size={13} />
                      </a>
                    </li>
                  ),
              )}
            </ul>
          )}
          <div className="inline-actions">
            <button className="btn btn-secondary" onClick={() => copy(note)}>
              <Clipboard size={15} /> Copy note
            </button>
            <button className="btn btn-ghost" onClick={() => exportNote(note)}>
              <Download size={15} /> Export note
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => setRemoving(note.id)}
            >
              <Trash2 size={15} /> Remove note
            </button>
          </div>
          {removing === note.id && (
            <div
              className="callout coaching-delete"
              role="group"
              aria-label="Confirm removing coaching note"
            >
              <div>
                <strong>Remove this saved note?</strong>
                <p>
                  Export a copy first if you want to keep it. Your course and
                  other notes stay saved.
                </p>
                <div className="inline-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={() => setRemoving(null)}
                  >
                    Keep note
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={() => {
                      onChange(notes.filter((item) => item.id !== note.id));
                      setRemoving(null);
                      notify("Coaching note removed.");
                    }}
                  >
                    Remove saved note
                  </button>
                </div>
              </div>
            </div>
          )}
        </details>
      ))}
    </section>
  );
}
