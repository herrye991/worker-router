import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function SettingsPage() {
  const qc = useQueryClient();
  const { data } = useQuery({ queryKey: ["settings"], queryFn: () => api<any>("/api/admin/settings") });
  const [form, setForm] = React.useState({ retention_days: "30", require_api_key: "true", default_timeout_ms: "60000" });
  React.useEffect(() => {
    if (data?.data) setForm({ ...form, ...data.data });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);
  const save = useMutation({
    mutationFn: () => api("/api/admin/settings", { method: "PUT", body: JSON.stringify(form) }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["settings"] }),
  });
  const [pw, setPw] = React.useState({ currentPassword: "", newPassword: "" });
  const [pwMsg, setPwMsg] = React.useState("");
  const info = useQuery({ queryKey: ["info"], queryFn: () => api<any>("/api/info"), staleTime: 60000 });
  const isDemo = !!info.data?.demo;
  async function changePassword() {
    setPwMsg("");
    try {
      await api("/api/admin/auth/password", { method: "POST", body: JSON.stringify(pw) });
      setPwMsg("Password changed — please login again.");
      setTimeout(() => (window.location.href = "/login"), 800);
    } catch (e: any) {
      setPwMsg(e.message);
    }
  }
  return (
    <div>
      <div className="topbar"><div><h2>Settings</h2><p>Gateway configuration</p></div></div>
      <div className="card">
        <h3>Change dashboard password</h3>
        {isDemo && <p className="muted">Password change is disabled on the public demo.</p>}
        <div className="form-grid">
          <label className="field">Current password<input className="input" type="password" value={pw.currentPassword} onChange={(e) => setPw({ ...pw, currentPassword: e.target.value })} /></label>
          <label className="field">New password (min 6 chars)<input className="input" type="password" value={pw.newPassword} onChange={(e) => setPw({ ...pw, newPassword: e.target.value })} /></label>
          <div><button className="btn" onClick={changePassword} disabled={isDemo}>Change password</button> {pwMsg && <span className="muted"> {pwMsg}</span>}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="form-grid">
          <label className="field">Log retention (days)<input className="input" value={form.retention_days} onChange={(e) => setForm({ ...form, retention_days: e.target.value })} /></label>
          <label className="field">Default upstream timeout (ms)<input className="input" value={form.default_timeout_ms} onChange={(e) => setForm({ ...form, default_timeout_ms: e.target.value })} /></label>
          <div><button className="btn" onClick={() => save.mutate()}>Save</button> {save.isSuccess && <span className="muted"> Saved</span>}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>API info</h3>
        <p className="muted">OpenAI-compatible endpoints:</p>
        <ul>
          <li><code>POST /v1/chat/completions</code></li>
          <li><code>GET /v1/models</code></li>
          <li><code>POST /v1/embeddings</code> (capability-gated)</li>
        </ul>
      </div>
    </div>
  );
}
