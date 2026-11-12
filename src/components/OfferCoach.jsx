import { MAX_RECORDS } from "../lib/storage.js";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronRight,
  Clipboard,
  FileCheck2,
  FileDown,
  Handshake,
  HelpCircle,
  Pencil,
  Plus,
  Scale,
  ShieldCheck,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { negotiateOffer } from "../../engine.js";
import { shareDocument } from "../lib/native.js";
import { appendCoachingNote } from "../lib/coaching.js";
import AiCoach from "./AiCoach.jsx";
import CoachingNotes from "./CoachingNotes.jsx";

const CURRENCIES = ["USD", "CAD", "GBP", "EUR", "AUD", "NZD", "SGD", "INR"];
const SIGNING_CHECKS = [
  ["written", "I have the full offer in writing."],
  ["compensation", "Salary, bonus conditions and any equity terms are clear."],
  ["benefits", "I understand benefits, leave and the work arrangement."],
  ["terms", "I have reviewed probation, notice and restrictive terms."],
  ["conditions", "I know the start date and any outstanding conditions."],
  ["questions", "My important questions have been answered."],
  ["copy", "I have saved a copy of the signed agreement."],
];
const amount = (value) => Math.max(0, Number(value) || 0);
const annualBase = (offer) =>
  amount(offer.base) * (offer.payPeriod === "month" ? 12 : 1);
const annualTarget = (offer) =>
  amount(offer.target) * (offer.payPeriod === "month" ? 12 : 1);
const currency = (value, code) => {
  try {
    return new Intl.NumberFormat(undefined, {
      style: "currency",
      currency: code || "USD",
      maximumFractionDigits: 0,
    }).format(amount(value));
  } catch {
    return `${code || "USD"} ${Math.round(amount(value)).toLocaleString()}`;
  }
};
const text = (value) =>
  typeof value === "string"
    ? value
    : String(value?.text || value?.title || value?.question || "");
const newOffer = () => ({
  company: "",
  role: "",
  base: "",
  bonus: "",
  equity: "",
  target: "",
  currency: "USD",
  payPeriod: "year",
  benefits: "",
  priorities: "",
  notes: "",
  deadline: "",
  status: "Reviewing",
  checks: {},
});

async function copyText(value) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch {
      /* Fall back for webviews without clipboard access. */
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
    throw new Error("Select the draft and copy it using your device menu.");
}

function OfferForm({ initial, opportunities, onSave, onCancel }) {
  const [form, setForm] = useState({ ...newOffer(), ...initial });
  const [error, setError] = useState("");
  const set = (key, value) => setForm({ ...form, [key]: value });
  const useOpportunity = (id) => {
    const opportunity = opportunities.find((item) => item.id === id);
    if (opportunity)
      setForm({
        ...form,
        role: opportunity.role || "",
        company: opportunity.company || "",
        opportunityId: id,
      });
  };
  const submit = (event) => {
    event.preventDefault();
    if (!form.company.trim() || !form.role.trim()) {
      setError("Add the company and role so you can find this offer later.");
      return;
    }
    if (
      !Number.isFinite(Number(form.base)) ||
      Number(form.base) <= 0 ||
      Number(form.base) > 1000000000
    ) {
      setError("Add a base salary greater than zero. You can update it later.");
      return;
    }
    if (
      ["bonus", "equity", "target"].some(
        (key) =>
          form[key] !== "" &&
          (!Number.isFinite(Number(form[key])) ||
            Number(form[key]) < 0 ||
            Number(form[key]) > 1000000000),
      )
    ) {
      setError(
        "Use a number between 0 and 1,000,000,000 for compensation amounts.",
      );
      return;
    }
    onSave({
      ...form,
      company: form.company.trim(),
      role: form.role.trim(),
      base: Number(form.base),
      bonus: amount(form.bonus),
      equity: amount(form.equity),
      target: amount(form.target),
      updated: new Date().toISOString(),
    });
  };
  return (
    <section className="card offer-form">
      <div className="card-header">
        <div>
          <p className="eyebrow">
            {initial?.id ? "REFINE THE DETAILS" : "A NEW POSSIBILITY"}
          </p>
          <h2>
            {initial?.id ? "Edit your offer" : "Let’s look at your offer."}
          </h2>
          <p className="muted">
            Use the numbers in your written offer. You can fill in the rest as
            you learn more.
          </p>
        </div>
        <button
          className="icon-button"
          type="button"
          onClick={onCancel}
          aria-label="Cancel offer editing"
        >
          <X size={20} />
        </button>
      </div>
      <form onSubmit={submit} className="stack">
        {opportunities.length > 0 && (
          <label className="field">
            Start from a saved opportunity{" "}
            <span className="muted">Optional</span>
            <select
              value={form.opportunityId || ""}
              onChange={(event) => useOpportunity(event.target.value)}
            >
              <option value="">Choose an opportunity</option>
              {opportunities.map((opportunity) => (
                <option key={opportunity.id} value={opportunity.id}>
                  {opportunity.role} · {opportunity.company}
                </option>
              ))}
            </select>
          </label>
        )}
        <div className="form-grid">
          <label className="field">
            Company
            <input
              autoFocus
              value={form.company}
              onChange={(event) => set("company", event.target.value)}
              maxLength={160}
              placeholder="Company name"
              required
            />
          </label>
          <label className="field">
            Role
            <input
              value={form.role}
              onChange={(event) => set("role", event.target.value)}
              maxLength={160}
              placeholder="Your new job title"
              required
            />
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            Currency
            <select
              value={form.currency}
              onChange={(event) => set("currency", event.target.value)}
            >
              {CURRENCIES.map((code) => (
                <option key={code} value={code}>
                  {code}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Base salary is quoted
            <select
              value={form.payPeriod}
              onChange={(event) => set("payPeriod", event.target.value)}
            >
              <option value="year">Per year</option>
              <option value="month">Per month</option>
            </select>
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            Base salary{" "}
            <span className="muted">
              {form.currency} / {form.payPeriod === "month" ? "month" : "year"}
            </span>
            <input
              type="number"
              inputMode="decimal"
              min="0.01"
              max="1000000000"
              step="0.01"
              value={form.base}
              onChange={(event) => set("base", event.target.value)}
              placeholder="e.g. 85000"
              required
            />
          </label>
          <label className="field">
            Your target salary{" "}
            <span className="muted">Optional · same period</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="1000000000"
              step="0.01"
              value={form.target}
              onChange={(event) => set("target", event.target.value)}
              placeholder="What would you like to ask for?"
            />
          </label>
        </div>
        <div className="form-grid">
          <label className="field">
            Target annual bonus{" "}
            <span className="muted">Optional · {form.currency} / year</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="1000000000"
              step="0.01"
              value={form.bonus}
              onChange={(event) => set("bonus", event.target.value)}
              placeholder="0"
            />
          </label>
          <label className="field">
            Estimated annual equity{" "}
            <span className="muted">Optional · {form.currency} / year</span>
            <input
              type="number"
              inputMode="decimal"
              min="0"
              max="1000000000"
              step="0.01"
              value={form.equity}
              onChange={(event) => set("equity", event.target.value)}
              placeholder="0"
            />
          </label>
        </div>
        <p className="muted small-text">
          Bonus can depend on performance. Equity is uncertain and may not be
          liquid. Enter an annual equity estimate only if you can support it; it
          stays separate from cash.
        </p>
        <label className="field">
          Benefits and working arrangements
          <textarea
            rows={3}
            value={form.benefits}
            onChange={(event) => set("benefits", event.target.value)}
            maxLength={8000}
            placeholder="e.g. Health coverage, pension match, annual leave, remote days, development budget."
          />
        </label>
        <label className="field">
          What would make this offer work for you?
          <textarea
            rows={3}
            value={form.priorities}
            onChange={(event) => set("priorities", event.target.value)}
            maxLength={5000}
            placeholder="Choose your real priorities: salary, flexibility, start date, progression, or something else."
          />
        </label>
        <div className="form-grid">
          <label className="field">
            Response deadline <span className="muted">Optional</span>
            <input
              type="date"
              value={form.deadline}
              onChange={(event) => set("deadline", event.target.value)}
            />
          </label>
          <label className="field">
            Offer status
            <select
              value={form.status}
              onChange={(event) => set("status", event.target.value)}
            >
              {["Reviewing", "Negotiating", "Accepted", "Signed"].map(
                (status) => (
                  <option key={status}>{status}</option>
                ),
              )}
            </select>
          </label>
        </div>
        <label className="field">
          Private notes
          <textarea
            rows={3}
            value={form.notes}
            onChange={(event) => set("notes", event.target.value)}
            maxLength={12000}
            placeholder="What feels good? What needs clarification?"
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="inline-actions">
          <button className="btn btn-primary" type="submit">
            {initial?.id ? "Save changes" : "Save offer"}{" "}
            <ArrowRight size={16} />
          </button>
          <button className="btn btn-ghost" type="button" onClick={onCancel}>
            Cancel
          </button>
        </div>
      </form>
    </section>
  );
}

function OfferComparison({ offers }) {
  const currencies = new Set(offers.map((offer) => offer.currency));
  return (
    <section className="card offer-comparison">
      <div className="card-header">
        <div>
          <p className="eyebrow">THE WHOLE PICTURE</p>
          <h2>Compare your possibilities.</h2>
          <p className="muted">
            Every number below is annual. A higher number isn’t the only measure
            of a better fit.
          </p>
        </div>
        <Scale size={22} className="muted" />
      </div>
      {currencies.size > 1 && (
        <div className="callout">
          <HelpCircle size={18} />
          <p>
            These offers use different currencies. Momentum doesn’t convert
            exchange rates, so compare within each currency.
          </p>
        </div>
      )}
      <div className="table-scroll">
        <table className="compare-table">
          <caption className="sr-only">
            Annual compensation comparison. Equity is separate from salary and
            bonus.
          </caption>
          <thead>
            <tr>
              <th scope="col">Offer</th>
              <th scope="col">Base salary</th>
              <th scope="col">Target bonus</th>
              <th scope="col">Salary + target bonus</th>
              <th scope="col">Equity estimate</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {offers.map((offer) => (
              <tr key={offer.id}>
                <th scope="row">
                  <strong>{offer.company}</strong>
                  <span className="muted">{offer.role}</span>
                  <span className="mini-label">{offer.currency}</span>
                </th>
                <td>{currency(annualBase(offer), offer.currency)}</td>
                <td>{currency(offer.bonus, offer.currency)}</td>
                <td>
                  <strong>
                    {currency(
                      annualBase(offer) + amount(offer.bonus),
                      offer.currency,
                    )}
                  </strong>
                </td>
                <td>
                  {amount(offer.equity)
                    ? currency(offer.equity, offer.currency)
                    : "Not entered"}
                </td>
                <td>
                  <span className="badge">{offer.status || "Reviewing"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="muted small-text">
        Before tax. Target bonuses and equity estimates are not guaranteed.
        Benefits, location and working hours also affect the value of an offer.
      </p>
    </section>
  );
}

export default function OfferCoach({
  offers = [],
  opportunities = [],
  onChange,
  notify = () => {},
  capabilities,
}) {
  const [selectedId, setSelectedId] = useState(offers[0]?.id || null);
  const [editing, setEditing] = useState(null);
  const [showComparison, setShowComparison] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const offer = offers.find((item) => item.id === selectedId) || offers[0];
  const advice = useMemo(
    () =>
      offer
        ? negotiateOffer({
            ...offer,
            base: annualBase(offer),
            target: annualTarget(offer),
          })
        : null,
    [offer],
  );
  const updateOffer = (patch) =>
    onChange(
      offers.map((item) =>
        item.id === offer.id
          ? { ...item, ...patch, updated: new Date().toISOString() }
          : item,
      ),
    );
  const saveCoachingNote = (noteDraft) => {
    try {
      updateOffer({ coaching: appendCoachingNote(offer.coaching, noteDraft) });
      return true;
    } catch (error) {
      notify(
        error.message ||
          "These coaching notes could not be saved. Copy or export them before closing.",
      );
      return false;
    }
  };
  const negotiationContext = offer
    ? {
        offer: {
          company: offer.company,
          role: offer.role,
          currency: offer.currency,
          annualBase: annualBase(offer),
          targetAnnualSalary: annualTarget(offer),
          targetAnnualBonus: amount(offer.bonus),
          estimatedAnnualEquity: amount(offer.equity),
          compensationBasis:
            "Annual amounts before tax. Bonus is conditional; equity is uncertain and separate from cash.",
          benefits: offer.benefits || "",
          priorities: offer.priorities || "",
          responseDeadline: offer.deadline || "",
          status: offer.status || "Reviewing",
          decisionNotes: offer.notes || "",
        },
        currentNegotiationDraft:
          offer.counterDraft ?? advice?.counterEmail ?? "",
      }
    : undefined;
  const saveOffer = (values) => {
    if (!values.id && offers.length >= MAX_RECORDS) {
      notify(
        `This device holds up to ${MAX_RECORDS} offers. Export a backup, then remove an older offer before adding another.`,
      );
      return;
    }
    const record = {
      ...values,
      id:
        values.id || globalThis.crypto?.randomUUID?.() || `offer-${Date.now()}`,
      created: values.created || new Date().toISOString(),
    };
    onChange(
      values.id
        ? offers.map((item) => (item.id === values.id ? record : item))
        : [...offers, record],
    );
    setSelectedId(record.id);
    setEditing(null);
    notify(
      values.id ? "Offer updated." : "Offer saved. Let’s make sense of it.",
    );
  };
  const copyDraft = async () => {
    try {
      await copyText(offer.counterDraft ?? advice?.counterEmail ?? "");
      notify("Negotiation draft copied. Review it before sending.");
    } catch (error) {
      notify(error.message);
    }
  };
  const exportOffer = async () => {
    try {
      const document = [
        `OFFER NOTES · ${offer.company}`,
        offer.role,
        `Status: ${offer.status || "Reviewing"}`,
        `Currency: ${offer.currency}`,
        "",
        `Annual base salary: ${currency(annualBase(offer), offer.currency)}`,
        `Target annual bonus (not guaranteed): ${currency(offer.bonus, offer.currency)}`,
        `Estimated annual equity (separate from cash): ${currency(offer.equity, offer.currency)}`,
        annualTarget(offer)
          ? `Target annual salary: ${currency(annualTarget(offer), offer.currency)}`
          : "",
        offer.deadline ? `Response deadline: ${offer.deadline}` : "",
        "",
        "BENEFITS AND ARRANGEMENTS",
        offer.benefits || "Not yet entered",
        "",
        "PRIORITIES",
        offer.priorities || "Not yet entered",
        "",
        "PRIVATE NOTES",
        offer.notes || "None",
        "",
        "NEGOTIATION DRAFT",
        offer.counterDraft ?? advice?.counterEmail ?? "",
        "",
        "BEFORE-YOU-SIGN CHECKLIST",
        ...SIGNING_CHECKS.map(
          ([key, label]) => `${offer.checks?.[key] ? "[x]" : "[ ]"} ${label}`,
        ),
        "",
        "Momentum does not verify market rates or provide legal, tax or investment advice.",
      ].join("\n");
      const result = await shareDocument({
        filename: "momentum-offer-notes.txt",
        mimeType: "text/plain",
        text: document,
      });
      if (!result?.cancelled)
        notify(
          "Offer notes exported. This file contains your private offer details.",
        );
    } catch (error) {
      notify(error.message || "Offer notes could not be exported.");
    }
  };
  const deleteOffer = () => {
    onChange(offers.filter((item) => item.id !== offer.id));
    setSelectedId(null);
    setConfirmDelete(false);
    notify("Offer deleted from this device.");
  };
  const completedChecks = offer
    ? SIGNING_CHECKS.filter(([key]) => offer.checks?.[key]).length
    : 0;
  const questions = Array.isArray(advice?.questions) ? advice.questions : [];

  return (
    <div className="offer-page">
      <header className="page-heading">
        <div>
          <p className="eyebrow">THE NEXT CHAPTER IS CLOSE</p>
          <h1>
            A good offer. <span className="muted">A clear decision.</span>
          </h1>
          <p>
            Understand the details, ask for what matters, and take your next
            step with clarity.
          </p>
        </div>
        {!editing && (
          <button
            className="btn btn-primary"
            type="button"
            onClick={() => setEditing(newOffer())}
          >
            <Plus size={17} /> Add an offer
          </button>
        )}
      </header>
      {editing ? (
        <OfferForm
          key={editing.id || "new"}
          initial={editing}
          opportunities={opportunities}
          onSave={saveOffer}
          onCancel={() => setEditing(null)}
        />
      ) : !offer ? (
        <div className="offer-grid">
          <section className="card empty-state offer-empty">
            <div className="icon-tile">
              <Handshake size={32} />
            </div>
            <p className="eyebrow">WHEN THE OFFER ARRIVES</p>
            <h2>You’ve earned this conversation.</h2>
            <p>
              Bring the offer here. See what it’s worth, prepare a thoughtful
              counteroffer, and check the details before you sign.
            </p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => setEditing(newOffer())}
            >
              Add my first offer <ArrowRight size={16} />
            </button>
            <p className="muted small-text">
              No offer yet? This space will be here when you’re ready.
            </p>
          </section>
          <section className="card">
            <p className="eyebrow">A SIMPLE WAY THROUGH</p>
            <h2>From “yes” to the right yes.</h2>
            <ol className="offer-steps">
              <li>
                <span>01</span>
                <div>
                  <h3>Understand the whole offer</h3>
                  <p className="muted">
                    Base pay, bonus, benefits, equity and the way you’ll work.
                  </p>
                </div>
              </li>
              <li>
                <span>02</span>
                <div>
                  <h3>Choose what matters most</h3>
                  <p className="muted">
                    A focused request is easier to discuss than a wish list.
                  </p>
                </div>
              </li>
              <li>
                <span>03</span>
                <div>
                  <h3>Have the conversation</h3>
                  <p className="muted">
                    Use a calm, editable draft that stays true to your
                    priorities.
                  </p>
                </div>
              </li>
              <li>
                <span>04</span>
                <div>
                  <h3>Check it, then sign</h3>
                  <p className="muted">
                    Get the final terms in writing and keep your own copy.
                  </p>
                </div>
              </li>
            </ol>
          </section>
        </div>
      ) : (
        <div className="stack">
          <div className="offer-selector" aria-label="Your saved offers">
            {offers.map((item) => (
              <button
                type="button"
                className={`offer-chip ${offer.id === item.id ? "active" : ""}`}
                key={item.id}
                aria-pressed={offer.id === item.id}
                onClick={() => {
                  setSelectedId(item.id);
                  setConfirmDelete(false);
                }}
              >
                <span className="company-monogram">
                  {item.company?.charAt(0)?.toUpperCase() || "O"}
                </span>
                <span>
                  <strong>{item.company}</strong>
                  <small>{item.role}</small>
                </span>
                {offer.id === item.id && <Check size={16} />}
              </button>
            ))}
            {offers.length > 1 && (
              <button
                type="button"
                className={`btn ${showComparison ? "btn-primary" : "btn-secondary"}`}
                aria-expanded={showComparison}
                onClick={() => setShowComparison(!showComparison)}
              >
                <Scale size={16} />{" "}
                {showComparison ? "Hide comparison" : "Compare offers"}
              </button>
            )}
          </div>
          {showComparison && offers.length > 1 && (
            <OfferComparison offers={offers} />
          )}
          <section className="card offer-summary">
            <div className="card-header">
              <div>
                <p className="eyebrow">{offer.company}</p>
                <h2>{offer.role}</h2>
                <p className="muted">
                  {offer.deadline
                    ? `Respond by ${new Date(`${offer.deadline}T12:00:00`).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })}`
                    : "Add a response deadline when you know it."}
                </p>
              </div>
              <div className="inline-actions">
                <span
                  className={`badge ${offer.status === "Signed" ? "badge-success" : ""}`}
                >
                  {offer.status === "Signed" && <CheckCircle2 size={14} />}
                  {offer.status || "Reviewing"}
                </span>
                <button
                  className="btn btn-secondary btn-small"
                  type="button"
                  onClick={() => setEditing(offer)}
                >
                  <Pencil size={14} /> Edit offer
                </button>
                <button
                  className="btn btn-ghost btn-small"
                  type="button"
                  onClick={exportOffer}
                >
                  <FileDown size={15} /> Export notes
                </button>
              </div>
            </div>
            <div className="offer-breakdown">
              <div className="offer-total">
                <span className="mini-label">ANNUAL BASE SALARY</span>
                <strong className="currency-value">
                  {currency(annualBase(offer), offer.currency)}
                </strong>
                <span className="muted">
                  {offer.currency} · before tax
                  {offer.payPeriod === "month"
                    ? ` · ${currency(offer.base, offer.currency)} per month`
                    : ""}
                </span>
              </div>
              <div>
                <span className="mini-label">TARGET ANNUAL BONUS</span>
                <strong>{currency(offer.bonus, offer.currency)}</strong>
                <span className="muted">Confirm conditions and timing</span>
              </div>
              <div>
                <span className="mini-label">SALARY + TARGET BONUS</span>
                <strong>
                  {currency(
                    annualBase(offer) + amount(offer.bonus),
                    offer.currency,
                  )}
                </strong>
                <span className="muted">Bonus isn’t guaranteed</span>
              </div>
            </div>
            {amount(offer.equity) > 0 && (
              <p className="callout">
                Estimated annual equity:{" "}
                <strong>{currency(offer.equity, offer.currency)}</strong>. Kept
                separate from cash. Confirm vesting, valuation, exercise costs
                and liquidity.
              </p>
            )}
          </section>
          <div className="offer-grid">
            <section className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">KNOW WHAT YOU WANT</p>
                  <h2>Your priorities, first.</h2>
                </div>
                <Scale size={20} className="muted" />
              </div>
              {annualTarget(offer) > 0 && (
                <div className="target-salary">
                  <span className="muted">Your annual salary target</span>
                  <strong>
                    {currency(annualTarget(offer), offer.currency)}
                  </strong>
                  <span className="muted">
                    {annualTarget(offer) >= annualBase(offer) ? "+" : "−"}
                    {currency(
                      Math.abs(annualTarget(offer) - annualBase(offer)),
                      offer.currency,
                    )}{" "}
                    from the offer
                    {annualBase(offer) > 0
                      ? ` (${Math.abs(((annualTarget(offer) - annualBase(offer)) / annualBase(offer)) * 100).toFixed(1)}%)`
                      : ""}
                  </span>
                </div>
              )}
              <label className="field">
                What matters most to you
                <textarea
                  rows={3}
                  maxLength={5000}
                  value={offer.priorities || ""}
                  placeholder="Salary, flexibility, development, start date… Choose your most important asks."
                  onChange={(event) =>
                    updateOffer({ priorities: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Benefits and work arrangements
                <textarea
                  rows={3}
                  maxLength={8000}
                  value={offer.benefits || ""}
                  placeholder="Capture what’s included and what still needs clarification."
                  onChange={(event) =>
                    updateOffer({ benefits: event.target.value })
                  }
                />
              </label>
              <label className="field">
                Private decision notes
                <textarea
                  rows={3}
                  maxLength={12000}
                  value={offer.notes || ""}
                  placeholder="What makes this right for you? What would you need to feel comfortable?"
                  onChange={(event) =>
                    updateOffer({ notes: event.target.value })
                  }
                />
              </label>
            </section>
            <section className="card">
              <div className="card-header">
                <div>
                  <p className="eyebrow">BEFORE YOU DECIDE</p>
                  <h2>Get the missing details.</h2>
                </div>
                <HelpCircle size={20} className="muted" />
              </div>
              <p className="muted">
                Ask the questions that apply to your offer. A clear answer now
                can prevent a surprise later.
              </p>
              <ul className="offer-questions">
                {questions.slice(0, 8).map((question, index) => (
                  <li key={index}>
                    <ChevronRight size={16} />
                    <span>{text(question)}</span>
                  </li>
                ))}
              </ul>
              <div className="callout">
                <ShieldCheck size={18} />
                <p>
                  Momentum helps you prepare. It doesn’t verify market rates or
                  interpret your contract. Get qualified advice for legal, tax
                  or complex equity questions.
                </p>
              </div>
            </section>
          </div>
          <section className="card">
            <div className="card-header">
              <div>
                <p className="eyebrow">MAKE THE ASK</p>
                <h2>A confident, considerate conversation.</h2>
                <p className="muted">
                  Review the details and make this sound like you. Nothing is
                  sent automatically.
                </p>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-small"
                onClick={copyDraft}
              >
                <Clipboard size={15} /> Copy draft
              </button>
            </div>
            <label className="field">
              <span className="sr-only">Edit your negotiation message</span>
              <textarea
                className="output-paper"
                rows={12}
                maxLength={20000}
                value={offer.counterDraft ?? advice?.counterEmail ?? ""}
                onChange={(event) =>
                  updateOffer({ counterDraft: event.target.value })
                }
              />
            </label>
            <div className="inline-actions">
              <button
                type="button"
                className="text-link"
                onClick={() => {
                  updateOffer({ counterDraft: advice?.counterEmail || "" });
                  notify(
                    "Negotiation draft refreshed from the current offer details.",
                  );
                }}
              >
                <Sparkles size={15} /> Refresh from offer details
              </button>
              <span className="muted small-text">
                Refreshing replaces edits to this draft.
              </span>
            </div>
            <AiCoach
              key={offer.id}
              action="negotiation"
              contextKey="negotiation"
              context={negotiationContext}
              capabilities={capabilities}
              notify={notify}
              label="Prepare my negotiation with AI"
              onSaveNote={saveCoachingNote}
            />
          </section>
          <CoachingNotes
            key={`coaching-${offer.id}`}
            notes={offer.coaching}
            onChange={(notes) => updateOffer({ coaching: notes })}
            notify={notify}
          />
          <section className="card">
            <div className="card-header">
              <div>
                <p className="eyebrow">FINISH WITH CLARITY</p>
                <h2>Your before-you-sign checklist.</h2>
                <p className="muted">
                  {completedChecks} of {SIGNING_CHECKS.length} checked. These
                  are reminders, not legal approval.
                </p>
              </div>
              <FileCheck2 size={22} className="muted" />
            </div>
            <div className="signing-checklist">
              {SIGNING_CHECKS.map(([key, label]) => (
                <label
                  className={`check-item ${offer.checks?.[key] ? "done" : ""}`}
                  key={key}
                >
                  <input
                    type="checkbox"
                    checked={!!offer.checks?.[key]}
                    onChange={(event) =>
                      updateOffer({
                        checks: {
                          ...offer.checks,
                          [key]: event.target.checked,
                        },
                      })
                    }
                  />
                  <span>{label}</span>
                </label>
              ))}
            </div>
            <div className="offer-status-row">
              <label className="field">
                Where does this offer stand?
                <select
                  value={offer.status || "Reviewing"}
                  onChange={(event) =>
                    updateOffer({ status: event.target.value })
                  }
                >
                  {["Reviewing", "Negotiating", "Accepted", "Signed"].map(
                    (status) => (
                      <option key={status}>{status}</option>
                    ),
                  )}
                </select>
              </label>
              {offer.status === "Signed" && (
                <div className="callout">
                  <CheckCircle2 size={22} />
                  <div>
                    <strong>A new chapter starts here.</strong>
                    <p>
                      You’ve marked this agreement as signed. Keep your final
                      copy and confirm the first-day details with your employer.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </section>
          <div className="offer-delete">
            {confirmDelete ? (
              <div className="callout">
                <Trash2 size={18} />
                <div>
                  <strong>Delete the {offer.company} offer?</strong>
                  <p>This removes its notes and checklist from this device.</p>
                  <div className="inline-actions">
                    <button
                      type="button"
                      className="btn btn-danger btn-small"
                      onClick={deleteOffer}
                    >
                      Delete offer
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-small"
                      onClick={() => setConfirmDelete(false)}
                    >
                      Keep it
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="text-link danger-text"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} /> Delete this offer
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
