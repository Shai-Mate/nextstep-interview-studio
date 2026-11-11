import { useState } from "react";
import {
  Plus,
  Search,
  ArrowUpRight,
  MoreHorizontal,
  Trash2,
  CalendarDays,
  BookOpen,
  FileText,
  ExternalLink,
  X,
} from "lucide-react";
import { CompanyMark, EmptyWorkspace } from "../App.jsx";
import { stages } from "../lib/sample.js";
import { safeURL } from "../lib/api.js";
import Modal from "./Modal.jsx";
export default function Opportunities({
  opportunities,
  onAdd,
  onSelect,
  onUpdate,
  onDelete,
  onSample,
  notify,
}) {
  const [filter, setFilter] = useState("All"),
    [search, setSearch] = useState(""),
    [deleting, setDeleting] = useState(null);
  const shown = opportunities.filter(
    (p) =>
      (filter === "All" ? p.status !== "Archived" : p.status === filter) &&
      `${p.company} ${p.role}`.toLowerCase().includes(search.toLowerCase()),
  );
  return (
    <>
      <header className="page-heading">
        <div>
          <span className="eyebrow">GOOD THINGS IN MOTION</span>
          <h1>Your opportunities.</h1>
          <p>
            Keep the possibilities together. Take the next step with a plan.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onAdd}>
          <Plus size={17} /> Add opportunity
        </button>
      </header>
      {opportunities.length ? (
        <>
          <div className="list-toolbar">
            <div
              className="tabs compact-tabs"
              aria-label="Filter opportunities"
            >
              {["All", ...stages].map((stage) => (
                <button
                  key={stage}
                  className={filter === stage ? "active" : ""}
                  onClick={() => setFilter(stage)}
                  aria-pressed={filter === stage}
                >
                  {stage}
                  {stage === "All" && (
                    <span>
                      {
                        opportunities.filter((p) => p.status !== "Archived")
                          .length
                      }
                    </span>
                  )}
                </button>
              ))}
            </div>
            <label className="search-field">
              <Search size={17} />
              <span className="sr-only">Search opportunities</span>
              <input
                type="search"
                placeholder="Find a role…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </label>
          </div>
          {shown.length ? (
            <div className="opportunities-grid">
              {shown.map((p) => {
                const done = p.course.filter((c) => c.done).length;
                return (
                  <article className="opportunity-card card" key={p.id}>
                    <div className="opportunity-card-top">
                      <CompanyMark name={p.company} />
                      <button
                        className="icon-button muted"
                        aria-label={`Delete ${p.role} at ${p.company}`}
                        onClick={() => setDeleting(p)}
                      >
                        <Trash2 size={17} />
                      </button>
                    </div>
                    <div className="opportunity-title">
                      <span className="eyebrow">
                        {p.company}
                        {p.sample ? " · SAMPLE" : ""}
                      </span>
                      <h2>{p.role}</h2>
                    </div>
                    <label className="stage-select-label">
                      <span className="sr-only">
                        Stage for {p.role} at {p.company}
                      </span>
                      <select
                        className={`stage-select stage-${p.status.toLowerCase()}`}
                        value={p.status}
                        onChange={(e) => {
                          onUpdate({ ...p, status: e.target.value });
                          notify("Opportunity stage updated.");
                        }}
                      >
                        {stages.map((s) => (
                          <option key={s}>{s}</option>
                        ))}
                      </select>
                    </label>
                    {p.interviewDate && (
                      <p className="interview-date">
                        <CalendarDays size={15} />
                        {new Date(p.interviewDate).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                    )}
                    <div className="role-progress">
                      <div>
                        <span>Preparation progress</span>
                        <strong>
                          {done}/{p.course.length}
                        </strong>
                      </div>
                      <progress
                        max={p.course.length}
                        value={done}
                        aria-label={`${done} of ${p.course.length} lessons complete`}
                      />
                    </div>
                    <div className="opportunity-actions">
                      <button
                        className="btn btn-primary"
                        onClick={() => onSelect(p.id)}
                      >
                        <BookOpen size={16} /> Prepare{" "}
                        <ArrowUpRight size={16} />
                      </button>
                      <button
                        className="btn btn-secondary"
                        onClick={() => onSelect(p.id, "applications")}
                        aria-label={`Application kit for ${p.role}`}
                      >
                        <FileText size={17} />
                      </button>
                      {safeURL(p.url) && (
                        <a
                          className="btn btn-ghost"
                          href={safeURL(p.url)}
                          target="_blank"
                          rel="noreferrer"
                          aria-label="Open original job ad"
                        >
                          <ExternalLink size={17} />
                        </a>
                      )}
                    </div>
                  </article>
                );
              })}
              <button className="add-role-card" onClick={onAdd}>
                <span>
                  <Plus size={24} />
                </span>
                <strong>Make room for what’s next.</strong>
                <span>Add another opportunity</span>
              </button>
            </div>
          ) : (
            <div className="empty-search">
              <Search size={26} />
              <h3>No roles here yet.</h3>
              <p>
                {search
                  ? "Try a different search."
                  : "Change the stage on a role to move it here."}
              </p>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setFilter("All");
                  setSearch("");
                }}
              >
                Show all opportunities
              </button>
            </div>
          )}
        </>
      ) : (
        <EmptyWorkspace onAdd={onAdd} onSample={onSample} />
      )}{" "}
      {deleting && (
        <Modal
          title="Remove this opportunity?"
          onClose={() => setDeleting(null)}
        >
          <div className="modal-content">
            <p>
              <strong>
                {deleting.role} at {deleting.company}
              </strong>{" "}
              and its course notes, practice answers, and application drafts
              will be removed from this device.
            </p>
            <p className="muted">You can export a backup in Settings first.</p>
            <div className="modal-footer">
              <button
                className="btn btn-secondary"
                onClick={() => setDeleting(null)}
              >
                Keep opportunity
              </button>
              <button
                className="btn btn-danger"
                onClick={() => {
                  onDelete(deleting.id);
                  setDeleting(null);
                }}
              >
                Remove opportunity
              </button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
