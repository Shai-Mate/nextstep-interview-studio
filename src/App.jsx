import { useState, useEffect, useRef } from "react";
import {
  ArrowUpRight,
  ArrowRight,
  Plus,
  LayoutDashboard,
  BriefcaseBusiness,
  BookOpen,
  FileText,
  Handshake,
  UserRound,
  Settings as SettingsIcon,
  ChevronDown,
  Menu,
  X,
  Check,
  CloudOff,
  ShieldCheck,
  Sparkles,
  Search,
  CheckCircle2,
  Clock,
  Compass,
} from "lucide-react";
import { createPreparation } from "../engine.js";
import {
  loadWorkspace,
  emptyWorkspace,
  validateWorkspace,
  STORAGE_KEY,
  MAX_RECORDS,
} from "./lib/storage.js";
import { requestAPI } from "./lib/api.js";
import { sampleJob } from "./lib/sample.js";
import { lightHaptic } from "./lib/native.js";
import { BrandMark, MomentumArt } from "./components/Brand.jsx";
import AddOpportunity from "./components/AddOpportunity.jsx";
import Opportunities from "./components/Opportunities.jsx";
import Preparation from "./components/Preparation.jsx";
import ApplicationKit from "./components/ApplicationKit.jsx";
import Profile from "./components/Profile.jsx";
import OfferCoach from "./components/OfferCoach.jsx";
import Settings from "./components/Settings.jsx";
const navigation = [
  { id: "home", label: "Overview", icon: LayoutDashboard },
  { id: "opportunities", label: "My opportunities", icon: BriefcaseBusiness },
  { id: "applications", label: "Application kit", icon: FileText },
  { id: "prepare", label: "Interview studio", icon: BookOpen },
  { id: "offers", label: "Offer coach", icon: Handshake },
];
const validRoutes = [...navigation.map((n) => n.id), "profile", "settings"];
export function CompanyMark({ name, size = "" }) {
  const tone = [...name].reduce((s, c) => s + c.charCodeAt(0), 0) % 4;
  return (
    <div className={`company-mark tone-${tone} ${size}`} aria-hidden="true">
      {name.trim().slice(0, 1).toUpperCase() || "↗"}
    </div>
  );
}
export function EmptyWorkspace({
  title = "Every next chapter starts somewhere.",
  description = "Add a job you’re interested in. We’ll turn it into a clear plan, one step at a time.",
  onAdd,
  onSample,
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Compass size={32} />
      </span>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className="btn btn-primary" onClick={onAdd}>
        <Plus size={17} /> Add an opportunity
      </button>
      {onSample && (
        <button className="text-link" onClick={onSample}>
          Explore a sample first <ArrowRight size={15} />
        </button>
      )}
    </div>
  );
}
function initialWorkspaceSnapshot() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    const legacy = raw
      ? null
      : localStorage.getItem("nextstep.preparations.v1");
    const loaded = loadWorkspace({
      getItem: (key) =>
        key === STORAGE_KEY
          ? raw
          : key === "nextstep.preparations.v1"
            ? legacy
            : null,
    });
    return { ...loaded, raw };
  } catch {
    return {
      ...loadWorkspace({
        getItem() {
          throw new Error("Storage unavailable");
        },
      }),
      raw: null,
    };
  }
}

export default function App() {
  const initial = useRef(null);
  if (!initial.current) initial.current = initialWorkspaceSnapshot();
  const [workspace, setWorkspaceState] = useState(initial.current.state),
    [storageError, setStorageError] = useState(initial.current.error);
  const [route, setRoute] = useState(
    validRoutes.includes(location.hash.slice(1))
      ? location.hash.slice(1)
      : "home",
  );
  const [compact, setCompact] = useState(
    window.matchMedia("(max-width:760px)").matches,
  );
  const sidebarRef = useRef(null);
  const [menu, setMenu] = useState(false),
    [adding, setAdding] = useState(false),
    [toast, setToast] = useState(""),
    [online, setOnline] = useState(navigator.onLine),
    [capabilities, setCapabilities] = useState({
      jobImport: false,
      aiCoach: false,
    });
  const [saved, setSaved] = useState(!initial.current.error);
  const [storageConflict, setStorageConflict] = useState(false);
  const storedSnapshot = useRef(initial.current.raw);
  const dirty = useRef(false);
  const conflict = useRef(false);
  const saveGeneration = useRef(0);
  const adoptedWorkspace = useRef(null);
  const setWorkspace = (update) => {
    dirty.current = true;
    setSaved(false);
    setWorkspaceState(update);
  };
  const pauseForConflict = () => {
    conflict.current = true;
    saveGeneration.current += 1;
    setStorageConflict(true);
    setSaved(false);
    setStorageError(
      "Another window changed or cleared this workspace. Saving is paused here to protect your work. Finish any open forms, then export a backup in Settings before reloading the latest workspace.",
    );
  };
  const toastTimer = useRef();
  const notify = (message) => {
    setToast(message);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 6500);
  };
  useEffect(() => {
    const generation = ++saveGeneration.current;
    if (initial.current.error || conflict.current) return;
    if (adoptedWorkspace.current === workspace) {
      adoptedWorkspace.current = null;
      return;
    }
    const save = () => {
      if (
        generation !== saveGeneration.current ||
        conflict.current ||
        initial.current.error
      )
        return;
      try {
        if (localStorage.getItem(STORAGE_KEY) !== storedSnapshot.current) {
          pauseForConflict();
          return;
        }
        const serialized = JSON.stringify(workspace);
        localStorage.setItem(STORAGE_KEY, serialized);
        storedSnapshot.current = serialized;
        dirty.current = false;
        setSaved(true);
        setStorageError(null);
      } catch {
        dirty.current = true;
        setSaved(false);
        setStorageError(
          "Your latest changes couldn’t be saved on this device. Export a backup in Settings before leaving.",
        );
      }
    };
    // A lock keeps the snapshot comparison and write together across supported browser windows.
    if (navigator.locks?.request) {
      navigator.locks.request("momentum-workspace-write", save).catch(() => {
        if (generation !== saveGeneration.current) return;
        dirty.current = true;
        setSaved(false);
        setStorageError(
          "Your latest changes couldn’t be saved on this device. Export a backup in Settings before leaving.",
        );
      });
    } else save();
  }, [workspace]);
  useEffect(() => {
    const changedElsewhere = (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      const incoming = event.key === null ? null : event.newValue;
      if (incoming === storedSnapshot.current) return;
      const editing =
        document.activeElement?.matches(
          "input,textarea,select,[contenteditable='true']",
        ) || document.querySelector('[role="dialog"], form');
      if (dirty.current || conflict.current || editing) {
        pauseForConflict();
        return;
      }
      try {
        const next =
          incoming === null
            ? emptyWorkspace()
            : validateWorkspace(JSON.parse(incoming));
        saveGeneration.current += 1;
        storedSnapshot.current = incoming;
        adoptedWorkspace.current = next;
        dirty.current = false;
        initial.current.error = null;
        setStorageError(null);
        setSaved(true);
        setWorkspaceState(next);
        notify(
          incoming === null
            ? "Workspace cleared in another window."
            : "Workspace updated from another window.",
        );
      } catch {
        pauseForConflict();
      }
    };
    window.addEventListener("storage", changedElsewhere);
    return () => window.removeEventListener("storage", changedElsewhere);
  }, []);
  useEffect(() => {
    const change = () => setOnline(navigator.onLine);
    const hash = () => {
      const next = location.hash.slice(1);
      if (validRoutes.includes(next)) setRoute(next);
    };
    window.addEventListener("online", change);
    window.addEventListener("offline", change);
    window.addEventListener("hashchange", hash);
    requestAPI("health")
      .then((data) => setCapabilities(data.capabilities || {}))
      .catch(() => {});
    return () => {
      window.removeEventListener("online", change);
      window.removeEventListener("offline", change);
      window.removeEventListener("hashchange", hash);
      clearTimeout(toastTimer.current);
    };
  }, []);
  useEffect(() => {
    const query = window.matchMedia("(max-width:760px)");
    const change = () => {
      setCompact(query.matches);
      if (!query.matches) setMenu(false);
    };
    query.addEventListener("change", change);
    return () => query.removeEventListener("change", change);
  }, []);
  useEffect(() => {
    if (!menu || !compact) return;
    const previous = document.activeElement;
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const buttons = () => [
      ...sidebarRef.current.querySelectorAll("button,a[href]"),
    ];
    buttons()[0]?.focus();
    const key = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setMenu(false);
      }
      if (event.key === "Tab") {
        const items = buttons(),
          first = items[0],
          last = items[items.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", key);
    return () => {
      document.body.style.overflow = old;
      document.removeEventListener("keydown", key);
      previous?.focus();
    };
  }, [menu, compact]);
  const openAdd = () => {
    setMenu(false);
    setAdding(true);
  };
  const navigate = (id) => {
    setRoute(id);
    location.hash = id;
    setMenu(false);
    window.scrollTo({ top: 0, behavior: "instant" });
    requestAnimationFrame(() =>
      document.getElementById("main-content")?.focus({ preventScroll: true }),
    );
  };
  const active =
    workspace.opportunities.find((p) => p.id === workspace.activeId) ||
    workspace.opportunities[0];
  const updateOpportunity = (updated) =>
    setWorkspace((w) => ({
      ...w,
      opportunities: w.opportunities.map((p) =>
        p.id === updated.id
          ? { ...updated, updated: new Date().toISOString() }
          : p,
      ),
    }));
  const selectOpportunity = (id, destination = "prepare") => {
    setWorkspace((w) => ({ ...w, activeId: id }));
    navigate(destination);
  };
  const addOpportunity = (input) => {
    if (workspace.opportunities.length >= MAX_RECORDS) {
      notify(
        `This device holds up to ${MAX_RECORDS} opportunities. Export a backup, then remove an older opportunity before adding another.`,
      );
      return;
    }
    const prep = {
      ...createPreparation(input),
      status: "Saved",
      sample: input.sample === true,
      interviewDate: input.interviewDate || "",
      interviewer: {
        name: input.interviewerName || "",
        role: "",
        url: "",
        notes: "",
      },
      companyNotes: "",
      applicationNotes: "",
      mockHistory: [],
    };
    setWorkspace((w) => ({
      ...w,
      opportunities: [prep, ...w.opportunities],
      activeId: prep.id,
      settings: { ...w.settings, onboarded: true },
    }));
    setAdding(false);
    navigate("prepare");
    notify(
      input.sample
        ? "Sample workspace opened. All company and role details are fictional."
        : "Your plan is ready. Start with one small step.",
    );
    lightHaptic();
  };
  const loadSample = () => {
    const existing = workspace.opportunities.find((p) => p.sample);
    if (existing) selectOpportunity(existing.id);
    else addOpportunity(sampleJob);
  };
  const removeOpportunity = (id) => {
    setWorkspace((w) => ({
      ...w,
      opportunities: w.opportunities.filter((p) => p.id !== id),
      activeId: w.activeId === id ? null : w.activeId,
    }));
    notify("Opportunity removed from this device.");
  };
  const restore = (newState) => {
    try {
      storedSnapshot.current = localStorage.getItem(STORAGE_KEY);
    } catch {
      setStorageError(
        "Storage is unavailable. Export your current workspace before leaving.",
      );
      return;
    }
    conflict.current = false;
    setStorageConflict(false);
    saveGeneration.current += 1;
    initial.current.error = null;
    setStorageError(null);
    setWorkspace(newState);
    navigate("home");
    notify("Your workspace has been restored.");
  };
  const clear = () => {
    storedSnapshot.current = null;
    conflict.current = false;
    setStorageConflict(false);
    saveGeneration.current += 1;
    initial.current.error = null;
    setStorageError(null);
    setWorkspace({
      schema: 3,
      profile: {
        name: "",
        targetRole: "",
        location: "",
        experience: "",
        resume: "",
        skills: "",
        achievements: "",
        preferences: "",
      },
      opportunities: [],
      offers: [],
      settings: { onboarded: false },
      activeId: null,
    });
    navigate("home");
    notify("Your Momentum data has been deleted from this device.");
  };
  const common = { notify, capabilities };
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside
        ref={sidebarRef}
        inert={compact && !menu}
        role={compact && menu ? "dialog" : undefined}
        aria-modal={compact && menu ? true : undefined}
        className={`sidebar ${menu ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <button
          className="brand"
          onClick={() => navigate("home")}
          aria-label="Momentum home"
        >
          <BrandMark />
          <span>
            momentum<span className="brand-dot">.</span>
          </span>
        </button>
        <div className="nav-label">YOUR WORKSPACE</div>
        <nav>
          {navigation.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={`nav-item ${route === id ? "active" : ""}`}
              aria-current={route === id ? "page" : undefined}
              onClick={() => navigate(id)}
            >
              <Icon size={19} strokeWidth={1.7} />
              <span>{label}</span>
              {id === "opportunities" && workspace.opportunities.length > 0 && (
                <small>{workspace.opportunities.length}</small>
              )}
            </button>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="small-orbit">
            <Sparkles size={19} />
          </span>
          <h3>
            A little progress,
            <br />
            every day.
          </h3>
          <p>Your next chapter is built one small step at a time.</p>
          <button onClick={openAdd}>
            Find your next step <ArrowUpRight size={15} />
          </button>
        </div>
        <div className="sidebar-bottom">
          <button
            className={`nav-item ${route === "profile" ? "active" : ""}`}
            onClick={() => navigate("profile")}
            aria-current={route === "profile" ? "page" : undefined}
          >
            <UserRound size={18} />
            <span>My profile</span>
          </button>
          <button
            className={`nav-item ${route === "settings" ? "active" : ""}`}
            onClick={() => navigate("settings")}
            aria-current={route === "settings" ? "page" : undefined}
          >
            <SettingsIcon size={18} />
            <span>Settings & privacy</span>
          </button>
          <div className="private-note">
            <ShieldCheck size={14} /> Your story stays yours.
          </div>
        </div>
      </aside>
      <div className="workspace" inert={compact && menu}>
        <header className="topbar">
          <div className="mobile-brand">
            <button
              className="icon-button"
              aria-label="Open navigation"
              aria-expanded={menu}
              onClick={() => setMenu(!menu)}
            >
              <Menu size={22} />
            </button>
            <button className="brand" onClick={() => navigate("home")}>
              <BrandMark />
              <span>momentum.</span>
            </button>
          </div>
          <span className="topbar-caption">YOUR CAREER, IN FOCUS.</span>
          <div className="topbar-actions">
            <span className="save-indicator">
              {online ? (
                <span className={saved ? "status-dot" : "status-dot warning"} />
              ) : (
                <CloudOff size={13} />
              )}
              <span>
                {!saved
                  ? "Unsaved changes"
                  : !online
                    ? "Offline · saved here"
                    : "Saved on this device"}
              </span>
            </span>
            <span className="topbar-divider" />
            <button
              className="avatar"
              onClick={() => navigate("profile")}
              aria-label="Open your profile"
            >
              {workspace.profile.name ? (
                workspace.profile.name.trim().charAt(0).toUpperCase()
              ) : (
                <UserRound size={19} />
              )}
            </button>
          </div>
        </header>
        <main
          id="main-content"
          className={`main-content view-${route}`}
          tabIndex="-1"
        >
          {storageError && (
            <div className="alert alert-error" role="alert">
              {storageError}
              <button
                className="text-link"
                onClick={() => navigate("settings")}
              >
                Open Settings
              </button>
              {storageConflict && (
                <button
                  className="text-link"
                  onClick={() => {
                    if (
                      window.confirm(
                        "Reload the latest workspace? Unsaved changes in this window will be discarded. Export a backup in Settings first if you want to keep them.",
                      )
                    )
                      location.reload();
                  }}
                >
                  Reload latest workspace
                </button>
              )}
            </div>
          )}
          {route === "home" && (
            <Dashboard
              workspace={workspace}
              active={active}
              navigate={navigate}
              onAdd={openAdd}
              onSample={loadSample}
              onSelect={selectOpportunity}
            />
          )}
          {route === "opportunities" && (
            <Opportunities
              opportunities={workspace.opportunities}
              onAdd={openAdd}
              onSelect={selectOpportunity}
              onUpdate={updateOpportunity}
              onDelete={removeOpportunity}
              onSample={loadSample}
              notify={notify}
            />
          )}
          {(route === "prepare" || route === "applications") && (
            <>
              {active ? (
                <>
                  <div className="opportunity-switcher">
                    <div>
                      <span className="eyebrow">YOUR OPPORTUNITY</span>
                      <label className="sr-only" htmlFor="active-opportunity">
                        Choose opportunity
                      </label>
                      <select
                        id="active-opportunity"
                        value={active.id}
                        onChange={(e) =>
                          setWorkspace((w) => ({
                            ...w,
                            activeId: e.target.value,
                          }))
                        }
                      >
                        {workspace.opportunities.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.role} · {p.company}
                            {p.sample ? " (sample)" : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                    <button
                      className="btn btn-ghost btn-small"
                      onClick={openAdd}
                    >
                      <Plus size={16} /> New role
                    </button>
                  </div>
                  {route === "prepare" ? (
                    <Preparation
                      key={active.id}
                      prep={active}
                      onChange={updateOpportunity}
                      profile={workspace.profile}
                      {...common}
                    />
                  ) : (
                    <ApplicationKit
                      key={active.id}
                      prep={active}
                      profile={workspace.profile}
                      onChange={updateOpportunity}
                      onProfile={() => navigate("profile")}
                      {...common}
                    />
                  )}
                </>
              ) : (
                <EmptyWorkspace
                  title={
                    route === "prepare"
                      ? "Your next interview, a little less unknown."
                      : "A stronger application starts here."
                  }
                  onAdd={openAdd}
                  onSample={loadSample}
                />
              )}
            </>
          )}
          {route === "profile" && (
            <Profile
              profile={workspace.profile}
              onChange={(profile) => setWorkspace((w) => ({ ...w, profile }))}
              notify={notify}
            />
          )}
          {route === "offers" && (
            <OfferCoach
              offers={workspace.offers}
              opportunities={workspace.opportunities}
              onChange={(offers) => setWorkspace((w) => ({ ...w, offers }))}
              notify={notify}
              capabilities={capabilities}
            />
          )}
          {route === "settings" && (
            <Settings
              workspace={workspace}
              storageError={storageError}
              onRestore={restore}
              onClear={clear}
              {...common}
            />
          )}
        </main>
        <footer className="workspace-footer">
          <span>Made for your next chapter.</span>
          <span>
            By Prism <span className="footer-dot">·</span>{" "}
            <a href="./privacy.html">Privacy</a>{" "}
            <span className="footer-dot">·</span>{" "}
            <a href="./support.html">Help</a>
          </span>
        </footer>
      </div>
      <nav
        inert={compact && menu}
        className="mobile-bottom-nav"
        aria-label="Quick navigation"
      >
        {[
          { id: "home", label: "Home", icon: LayoutDashboard },
          { id: "opportunities", label: "Roles", icon: BriefcaseBusiness },
          { id: "prepare", label: "Prepare", icon: BookOpen },
          { id: "applications", label: "Apply", icon: FileText },
          { id: "profile", label: "Profile", icon: UserRound },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => navigate(id)}
            aria-current={route === id ? "page" : undefined}
            className={route === id ? "active" : ""}
          >
            <Icon size={21} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
      {adding && (
        <AddOpportunity
          onClose={() => setAdding(false)}
          onCreate={addOpportunity}
          capabilities={capabilities}
        />
      )}
      {toast && (
        <div className="toast" role="status">
          <CheckCircle2 size={18} />
          <span>{toast}</span>
          <button
            aria-label="Dismiss notification"
            onClick={() => setToast("")}
          >
            <X size={15} />
          </button>
        </div>
      )}
    </div>
  );
}
function Dashboard({ workspace, active, navigate, onAdd, onSample, onSelect }) {
  const live = workspace.opportunities.filter((p) => p.status !== "Archived");
  const lessons = workspace.opportunities.reduce(
    (sum, p) => sum + p.course.filter((l) => l.done).length,
    0,
  );
  const nextLesson = active?.course.find((l) => !l.done);
  const firstName = workspace.profile.name.trim().split(" ")[0];
  const steps = [
    {
      n: "01",
      label: "Find your story",
      body: "Turn your experience into your strongest asset.",
      icon: UserRound,
      route: "profile",
      done: Boolean(workspace.profile.resume || workspace.profile.achievements),
      cta: "Build your profile",
    },
    {
      n: "02",
      label: "Open the door",
      body: "Make every application feel like the right fit.",
      icon: FileText,
      route: "applications",
      done: workspace.opportunities.some((p) =>
        ["Applying", "Interview", "Offer", "Accepted"].includes(p.status),
      ),
      cta: "Create your application",
    },
    {
      n: "03",
      label: "Show up ready",
      body: "Prepare with purpose. Practise with confidence.",
      icon: BookOpen,
      route: "prepare",
      done: workspace.opportunities.some((p) => p.mock.finished),
      cta: "Enter interview studio",
    },
    {
      n: "04",
      label: "Make your move",
      body: "Know your priorities. Navigate your offer.",
      icon: Handshake,
      route: "offers",
      done: workspace.offers.length > 0,
      cta: "Explore offer coach",
    },
  ];
  return (
    <>
      <div className="greeting-row">
        <p>
          {firstName
            ? `Good to see you, ${firstName}.`
            : "A fresh start looks good on you."}{" "}
          <span className="greeting-spark">✦</span>
        </p>
        <span>
          {new Intl.DateTimeFormat(undefined, {
            month: "long",
            day: "numeric",
          }).format(new Date())}
        </span>
      </div>
      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">
            <span className="tiny-star">✦</span> YOUR NEXT CHAPTER
          </span>
          <h1>
            Big possibilities.
            <br />
            <em>One clear next step.</em>
          </h1>
          <p>
            From “where do I start?” to “I got the job.”
            <br className="desktop-break" /> A little guidance for every part of
            your journey.
          </p>
          <div className="inline-actions">
            <button className="btn btn-primary" onClick={onAdd}>
              <Plus size={18} /> Add an opportunity
            </button>
            {!workspace.opportunities.length && (
              <button className="hero-link" onClick={onSample}>
                Try a sample <ArrowUpRight size={17} />
              </button>
            )}
          </div>
          <div className="hero-trust">
            <ShieldCheck size={14} />
            <span>No account needed. Your progress stays on your device.</span>
          </div>
        </div>
        <div className="hero-visual">
          <MomentumArt />
          <span className="art-label">
            <span /> A NEW PERSPECTIVE
          </span>
          <span className="art-coordinate">01 — ∞</span>
        </div>
      </section>
      <section className="journey-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">THE WAY FORWARD</span>
            <h2>Your journey, made simple.</h2>
          </div>
          <span className="section-caption">
            You don’t have to figure it out alone.
          </span>
        </div>
        <div className="journey-grid">
          {steps.map((step) => (
            <button
              key={step.n}
              className={`journey-card ${step.done ? "journey-done" : ""}`}
              onClick={() => navigate(step.route)}
            >
              <div className="journey-card-top">
                <span className="journey-icon">
                  <step.icon size={21} strokeWidth={1.6} />
                </span>
                <span className="step-number">
                  {step.done ? <Check size={17} /> : step.n}
                </span>
              </div>
              <h3>{step.label}</h3>
              <p>{step.body}</p>
              <span className="journey-cta">
                {step.cta}
                <ArrowUpRight size={17} />
              </span>
            </button>
          ))}
        </div>
      </section>
      <section className="dashboard-lower">
        <div className="opportunity-preview">
          <div className="section-title">
            <div>
              <span className="eyebrow">A WORLD OF WHAT’S NEXT</span>
              <h2>Your opportunities</h2>
            </div>
            {live.length > 0 && (
              <button
                className="text-link"
                onClick={() => navigate("opportunities")}
              >
                View all <ArrowRight size={16} />
              </button>
            )}
          </div>
          {live.length ? (
            <div className="dashboard-role-list">
              {live.slice(0, 3).map((p) => (
                <button
                  key={p.id}
                  className="dashboard-role"
                  onClick={() => onSelect(p.id)}
                >
                  <CompanyMark name={p.company} />
                  <span className="role-summary">
                    <strong>{p.role}</strong>
                    <span>
                      {p.company}
                      {p.sample ? " · Sample role" : ""}
                    </span>
                  </span>
                  <span className={`badge stage-${p.status.toLowerCase()}`}>
                    {p.status}
                  </span>
                  <ArrowUpRight size={18} />
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-role-card">
              <div className="dashed-icon">
                <BriefcaseBusiness size={24} strokeWidth={1.5} />
              </div>
              <div>
                <h3>Something good is ahead.</h3>
                <p>
                  Found a role that feels right? Add the job ad.
                  <br />
                  We’ll help you take it from there.
                </p>
                <button className="text-link" onClick={onAdd}>
                  Add your first opportunity <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
        <aside className="today-card">
          <div className="today-heading">
            <span className="eyebrow">A SMALL STEP FOR TODAY</span>
            <span className="today-icon">
              <Compass size={19} />
            </span>
          </div>
          <h3>
            {active
              ? nextLesson
                ? "Start where you are."
                : "Keep the momentum."
              : "You have more to offer than you think."}
          </h3>
          <p>
            {active
              ? nextLesson
                ? nextLesson.title
                : "Your lessons are complete. Try a practice interview and put your preparation into words."
              : "Think of one thing you did that made a difference. Big or small, that’s the start of your story."}
          </p>
          <button
            className="text-link"
            onClick={() => navigate(active ? "prepare" : "profile")}
          >
            {active ? "Continue your preparation" : "Find your strengths"}
            <ArrowRight size={16} />
          </button>
          <div className="today-footer">
            <Clock size={14} />
            {active
              ? "One focused step at a time"
              : "5 minutes is a great start"}
          </div>
        </aside>
      </section>
      {workspace.opportunities.length > 0 && (
        <div className="progress-strip">
          <span>
            <strong>{live.length}</strong>{" "}
            {live.length === 1 ? "opportunity" : "opportunities"} in motion
          </span>
          <span>
            <strong>{lessons}</strong> lessons completed
          </span>
          <span>
            <strong>
              {workspace.opportunities.filter((p) => p.mock.finished).length}
            </strong>{" "}
            practice interviews finished
          </span>
          <span className="muted">Progress, at your pace.</span>
        </div>
      )}
    </>
  );
}
