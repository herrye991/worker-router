import React from "react";
import { useNavigate } from "react-router-dom";

export function LoginPage() {
  const nav = useNavigate();
  const [password, setPassword] = React.useState("");
  const [error, setError] = React.useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/admin/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ password }),
    });
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j?.error?.message ?? "Login failed");
      return;
    }
    nav("/");
  }

  return (
    <div style={{ display: "grid", placeItems: "center", minHeight: "100vh" }}>
      <form className="card" onSubmit={submit} style={{ width: 360 }}>
        <h2>WorkerRouter</h2>
        <p className="muted">Enter your password to access the dashboard</p>
        <div className="form-grid">
          <label className="field">Password<input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" autoFocus /></label>
          {error && <div style={{ color: "var(--red)" }}>{error}</div>}
          <button className="btn" type="submit">Login</button>
          <p className="muted">Default password is <code>123456</code></p>
        </div>
      </form>
    </div>
  );
}
