import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function ModelsPage() {
  const qc = useQueryClient();
  const models = useQuery({ queryKey: ["admin-models"], queryFn: () => api<any>("/api/admin/models") });
  const providers = useQuery({ queryKey: ["providers"], queryFn: () => api<any>("/api/admin/providers") });
  const [form, setForm] = React.useState({ publicName: "", providerId: "", providerModelId: "" });

  const create = useMutation({
    mutationFn: () => api("/api/admin/models", { method: "POST", body: JSON.stringify(form) }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["admin-models"] }); setForm({ publicName: "", providerId: "", providerModelId: "" }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/admin/models/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-models"] }),
  });

  return (
    <div>
      <div className="topbar"><div><h2>Models</h2><p>Public aliases mapped to provider models</p></div></div>
      <div className="card">
        <h3>Register model</h3>
        <div className="form-grid">
          <label className="field">Public name / alias<input className="input" value={form.publicName} onChange={(e) => setForm({ ...form, publicName: e.target.value })} placeholder="deepseek-flash" /></label>
          <label className="field">Provider<select className="select" value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })}><option value="">Select…</option>{providers.data?.data?.map((p: any) => <option key={p.id} value={p.id}>{p.name} ({p.type})</option>)}</select></label>
          <label className="field">Provider model ID<input className="input" value={form.providerModelId} onChange={(e) => setForm({ ...form, providerModelId: e.target.value })} placeholder="gpt-4o-mini" /></label>
          <div><button className="btn" onClick={() => create.mutate()}>Add model</button> {create.isError && <span className="muted"> {(create.error as Error).message}</span>}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>Models</h3>
        <table className="table">
          <thead><tr><th>Public name</th><th>Provider</th><th>Upstream ID</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {models.data?.data?.map((m: any) => (
              <tr key={m.id}><td><code>{m.public_name}</code></td><td>{m.provider_name}</td><td className="muted">{m.provider_model_id}</td><td><span className={`badge ${m.enabled ? "green" : "red"}`}>{m.enabled ? "enabled" : "disabled"}</span></td><td><button className="btn danger" onClick={() => remove.mutate(m.id)}>Delete</button></td></tr>
            ))}
          </tbody>
        </table>
        {models.data?.data?.length === 0 && <div className="empty">No models yet</div>}
      </div>
    </div>
  );
}
