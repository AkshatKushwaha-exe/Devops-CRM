import { useCallback, useEffect, useState } from "react";
import {
  Activity as ActivityIcon,
  ArrowUpRight,
  ChartNoAxesCombined,
  CircleHelp,
  Columns3,
  LayoutDashboard,
  Menu,
  Users,
  X,
} from "lucide-react";
import Activity from "./Activity";
import { Toast } from "./components";
import Contacts from "./Contacts";
import DealForm from "./DealForm";
import Overview from "./Overview";
import Pipeline from "./Pipeline";
import type { Deal } from "./types";

const navigation = [
  { id: "overview", label: "Overview", icon: LayoutDashboard },
  { id: "contacts", label: "Contacts", icon: Users },
  { id: "pipeline", label: "Pipeline", icon: Columns3 },
  { id: "activity", label: "Activity", icon: ActivityIcon },
];
function currentPage() {
  const hash = window.location.hash.slice(1);
  return navigation.some((n) => n.id === hash) ? hash : "overview";
}

export default function App() {
  const [page, setPage] = useState(currentPage);
  const [version, setVersion] = useState(0);
  const [toast, setToast] = useState("");
  const [menu, setMenu] = useState(false);
  const [deal, setDeal] = useState<Deal | "new" | null>(null);
  useEffect(() => {
    const update = () => {
      setPage(currentPage());
      setMenu(false);
    };
    window.addEventListener("hashchange", update);
    return () => window.removeEventListener("hashchange", update);
  }, []);
  useEffect(() => {
    document.title = `${navigation.find((n) => n.id === page)?.label} · DevOps CRM`;
  }, [page]);
  const changed = useCallback((message: string) => {
    setVersion((v) => v + 1);
    setToast(message);
  }, []);
  const dismiss = useCallback(() => setToast(""), []);
  function navigate(next: string) {
    window.location.hash = next;
    setMenu(false);
  }
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      {menu && (
        <button
          className="sidebar-scrim"
          aria-label="Close navigation"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={`sidebar ${menu ? "open" : ""}`}>
        <a className="brand" href="#overview">
          <span className="brand-mark">
            <ChartNoAxesCombined size={23} />
          </span>
          <span>
            DevOps<span className="brand-light"> CRM</span>
          </span>
        </a>
        <div className="workspace-label">
          <span className="workspace-avatar">AK</span>
          <div>
            <strong>Akshat’s workspace</strong>
            <small>Personal workspace</small>
          </div>
        </div>
        <p className="nav-label">WORKSPACE</p>
        <nav aria-label="Main navigation">
          {navigation.map((item) => (
            <a
              key={item.id}
              href={`#${item.id}`}
              onClick={() => setMenu(false)}
              className={page === item.id ? "active" : ""}
              aria-current={page === item.id ? "page" : undefined}
            >
              <item.icon size={19} />
              {item.label}
              {page === item.id && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="tiny-spark">✳</span>
          <strong>Built for better connections.</strong>
          <p>
            A little organization.
            <br />A lot of possibility.
          </p>
          <span className="note-line" />
        </div>
        <div className="sidebar-bottom">
          <a href="/api/docs" target="_blank" rel="noreferrer">
            <CircleHelp size={17} />
            API documentation
            <ArrowUpRight size={14} />
          </a>
          <div className="profile">
            <span className="profile-avatar">AK</span>
            <div>
              <strong>Akshat Kushwaha</strong>
              <small>Local workspace</small>
            </div>
            <span className="profile-dot" />
          </div>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div>
            <button
              className="icon-button mobile-menu"
              onClick={() => setMenu((v) => !v)}
              aria-label={menu ? "Close navigation" : "Open navigation"}
              aria-expanded={menu}
            >
              {menu ? <X size={20} /> : <Menu size={20} />}
            </button>
            <span className="breadcrumb">
              Workspace <span>/</span>{" "}
              <strong>{navigation.find((n) => n.id === page)?.label}</strong>
            </span>
          </div>
          <div className="topbar-right">
            <span className="local-badge">
              <i />
              Local workspace
            </span>
            <span className="topbar-divider" />
            <span className="topbar-avatar" aria-label="Akshat Kushwaha">
              AK
            </span>
          </div>
        </header>
        <main id="main-content" tabIndex={-1}>
          {page === "overview" && (
            <Overview
              version={version}
              onNavigate={navigate}
              onAdd={() => setDeal("new")}
              onEdit={setDeal}
            />
          )}
          {page === "contacts" && (
            <Contacts version={version} onChange={changed} />
          )}
          {page === "pipeline" && (
            <Pipeline version={version} onChange={changed} />
          )}
          {page === "activity" && <Activity version={version} />}
          <footer className="workspace-footer">
            <span>DevOps CRM</span>
            <span>Good relationships. Better business.</span>
          </footer>
        </main>
      </div>
      {deal && (
        <DealForm
          deal={deal === "new" ? undefined : deal}
          onClose={() => setDeal(null)}
          onSaved={(message) => {
            setDeal(null);
            changed(message);
          }}
        />
      )}
      {toast && (
        <Toast key={toast + version} message={toast} onClose={dismiss} />
      )}
    </div>
  );
}
