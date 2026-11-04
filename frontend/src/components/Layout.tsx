import React from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { api } from "../lib/api";

const links = [
  { to: "/", label: "Overview", icon: "◉" },
  { to: "/endpoint", label: "Endpoint & Key", icon: "⌁" },
  { to: "/providers", label: "Providers", icon: "▦" },
  { to: "/combos", label: "Combos & Routing", icon: "⧉" },
  { to: "/models", label: "Models", icon: "◇" },
  { to: "/usage", label: "Usage", icon: "▤" },
  { to: "/logs", label: "Request Logs", icon: "☰" },
  { to: "/settings", label: "Settings", icon: "⚙" },
];

export function Layout() {
  const nav = useNavigate();
  const [theme, setTheme] = React.useState(localStorage.getItem("wr-theme") ?? "dark");
  React.useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem("wr-theme", theme);
  }, [theme]);

  async function logout() {
    await api("/api/admin/auth/logout", { method: "POST" }).catch(() => {});
    nav("/login");
  }

  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">W</div>
          <div>
            <h1>WorkerRouter</h1>
            <small>v0.1.0 · gateway</small>
          </div>
        </div>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.to === "/"} className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
            <span>{l.icon}</span> {l.label}
          </NavLink>
        ))}
        <div className="nav-section">Session</div>
        <button className="btn secondary" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>
          {theme === "dark" ? "☀ Light mode" : "☾ Dark mode"}
        </button>
        <button className="btn secondary" onClick={logout}>Logout</button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  );
}
