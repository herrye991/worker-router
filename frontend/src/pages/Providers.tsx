import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const TYPES = ["openai-compatible", "anthropic", "google", "cloudflare-ai"];

export function ProvidersPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({ queryKey: ["providers"], queryFn: () => api<any>("/api/admin/providers") });
  const [form, setForm] = React.useState({ name: "", type: "openai-compatible", baseUrl: "https://api.openai.com/v1", credential: "" });
  const [testing, setTesting] = React.useState<Record<string, any>>({});
  const [fetched, setFetched] = React.useState<Record<string, any[]>>({});
  const [fetching, setFetching] = React.useState<Record<string, boolean>>({});
  const [registering, setRegistering] = React.useState<Record<string, boolean>>({});
  const [openMenu, setOpenMenu] = React.useState<string | null>(null);
  React.useEffect(() => {
    function close() { setOpenMenu(null); }
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const create = useMutation({
    mutationFn: () => api("/api/admin/providers", { method: "POST", body: JSON.stringify({ ...form, authType: "bearer" }) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["providers"] }); setForm({ name: "", type: "openai-compatible", baseUrl: "https://api.openai.com/v1", credential: "" }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/admin/providers/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["providers"] }),
  });
  async function fetchModels(id: string) {
    setFetching({ ...fetching, [id]: true });
    try {
      const r = await api<any>(`/api/admin/providers/${id}/models`);
      setFetched({ ...fetched, [id]: r.data ?? [] });
    } catch (e: any) {
      setFetched({ ...fetched, [id]: [] });
      setTesting({ ...testing, [id]: `FETCH FAIL · ${e.message}` });
    } finally {
      setFetching({ ...fetching, [id]: false });
    }
  }
  async function registerModel(providerId: string, upstreamId: string) {
    const key = `${providerId}:${upstreamId}`;
    setRegistering({ ...registering, [key]: true });
    try {
      await api("/api/admin/models", { method: "POST", body: JSON.stringify({ publicName: upstreamId, providerId, providerModelId: upstreamId }) });
      qc.invalidateQueries({ queryKey: ["admin-models"] });
    } catch (e: any) {
      setTesting({ ...testing, [providerId]: `REGISTER FAIL · ${e.message}` });
    } finally {
      setRegistering({ ...registering, [key]: false });
    }
  }
  async function test(id: string) {
    setTesting({ ...testing, [id]: "testing…" });
    try {
      const r = await api<any>(`/api/admin/providers/${id}/test`, { method: "POST" });
      setTesting({ ...testing, [id]: r.ok ? `OK · ${r.latencyMs}ms` : `FAIL · ${r.error ?? r.note}` });
    } catch (e: any) {
      setTesting({ ...testing, [id]: `FAIL · ${e.message}` });
    }
  }

  return (
    <div>
      <div className="topbar"><div><h2>Providers</h2><p>Upstream AI connections (credentials never displayed)</p></div></div>
      <div className="card">
        <h3>Add provider</h3>
        <div className="form-grid">
          <label className="field">Name<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="My OpenAI" /></label>
          <label className="field">Type<select className="select" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>{TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></label>
          <label className="field">Base URL<input className="input" value={form.baseUrl} onChange={(e) => setForm({ ...form, baseUrl: e.target.value })} /></label>
          <label className="field">API key / credential<input className="input" type="password" value={form.credential} onChange={(e) => setForm({ ...form, credential: e.target.value })} placeholder="Stored encrypted" /></label>
          <div><button className="btn" onClick={() => create.mutate()}>Add provider</button> {create.isError && <span className="muted"> {(create.error as Error).message}</span>}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>Configured providers</h3>
        {isLoading && <div className="muted">Loading…</div>}
        <table className="table">
          <thead><tr><th>Name</th><th>Type</th><th>Base URL</th><th>Status</th><th style={{ width: 64 }}></th></tr></thead>
          <tbody>
            {data?.data?.map((p: any) => (
              <tr key={p.id}>
                <td>{p.name}</td><td><code>{p.type}</code></td><td className="muted">{p.base_url}</td>
                <td><span className={`badge ${p.enabled ? "green" : "red"}`}>{p.enabled ? "enabled" : "disabled"}</span></td>
                <td>
                  <div className="dropdown" onClick={(e) => e.stopPropagation()}>
                    <button className="btn secondary icon-btn" title="Actions" aria-label="Provider actions" onClick={() => setOpenMenu(openMenu === p.id ? null : p.id)}>⋯</button>
                    {openMenu === p.id && (
                      <div className="dropdown-menu">
                        <button className="dropdown-item" onClick={() => { setOpenMenu(null); test(p.id); }}>Test connection</button>
                        <button className="dropdown-item" onClick={() => { setOpenMenu(null); fetchModels(p.id); }} disabled={!!fetching[p.id]}>{fetching[p.id] ? "Fetching…" : "Fetch models"}</button>
                        <button className="dropdown-item danger" onClick={() => { setOpenMenu(null); if (confirm(`Delete provider ${p.name}?`)) remove.mutate(p.id); }}>Delete</button>
                      </div>
                    )}
                  </div>
                  <span className="muted">{testing[p.id] ?? ""}</span>
                  {fetched[p.id] && (
                    <div style={{ marginTop: 6 }}>
                      {fetched[p.id].length === 0 && <span className="muted">No models returned</span>}
                      {fetched[p.id].map((m: any) => {
                        const key = `${p.id}:${m.id}`;
                        return (
                          <div key={key} className="row" style={{ marginTop: 4 }}>
                            <code>{m.id}</code>
                            <button className="btn secondary" disabled={!!registering[key]} onClick={() => registerModel(p.id, m.id)}>{registering[key] ? "Adding…" : "Add as model"}</button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data?.length === 0 && <div className="empty">No providers yet — add one above</div>}
      </div>
    </div>
  );
}
