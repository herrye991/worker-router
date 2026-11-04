import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

const STRATEGIES = ["single", "round-robin", "weighted", "fallback"];

export function CombosPage() {
  const qc = useQueryClient();
  const groups = useQuery({ queryKey: ["groups"], queryFn: () => api<any>("/api/admin/routing") });
  const models = useQuery({ queryKey: ["admin-models"], queryFn: () => api<any>("/api/admin/models") });
  const [form, setForm] = React.useState({ name: "", publicAlias: "", strategy: "fallback", modelIds: [] as string[] });

  const create = useMutation({
    mutationFn: () => api("/api/admin/routing", {
      method: "POST",
      body: JSON.stringify({
        name: form.name, publicAlias: form.publicAlias, strategy: form.strategy,
        members: form.modelIds.map((id, i) => ({ modelId: id, weight: 1, priority: 0, orderIndex: i })),
      }),
    }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["groups"] }); setForm({ name: "", publicAlias: "", strategy: "fallback", modelIds: [] }); },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api(`/api/admin/routing/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["groups"] }),
  });

  function toggle(id: string) {
    setForm({ ...form, modelIds: form.modelIds.includes(id) ? form.modelIds.filter((x) => x !== id) : [...form.modelIds, id] });
  }

  return (
    <div>
      <div className="topbar"><div><h2>Combos & Routing</h2><p>Group models under one alias, pick a strategy per combo</p></div></div>
      <div className="card">
        <p className="muted">Fallback — tries models in order · Round Robin — rotates across requests · Weighted — distributes by weight · Single — one fixed model</p>
        <div className="form-grid">
          <label className="field">Combo name<input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Fast chat" /></label>
          <label className="field">Public alias<input className="input" value={form.publicAlias} onChange={(e) => setForm({ ...form, publicAlias: e.target.value })} placeholder="fast-chat" /></label>
          <label className="field">Strategy<select className="select" value={form.strategy} onChange={(e) => setForm({ ...form, strategy: e.target.value })}>{STRATEGIES.map((s) => <option key={s} value={s}>{s}</option>)}</select></label>
          <div>
            <div className="muted">Members (click to toggle, order = selection order)</div>
            <div className="row" style={{ marginTop: 6 }}>
              {models.data?.data?.map((m: any) => (
                <button key={m.id} className={`btn${form.modelIds.includes(m.id) ? "" : " secondary"}`} onClick={() => toggle(m.id)}>{m.public_name}</button>
              ))}
            </div>
          </div>
          <div><button className="btn" onClick={() => create.mutate()}>Create combo</button> {create.isError && <span className="muted"> {(create.error as Error).message}</span>}</div>
        </div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>Combos</h3>
        {groups.data?.data?.length === 0 && <div className="empty">No combos yet — create one above</div>}
        {groups.data?.data?.map((g: any) => (
          <div key={g.id} className="card" style={{ marginBottom: 10 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div><b>{g.name}</b> <code>{g.public_alias}</code> <span className="badge">{g.strategy}</span></div>
              <button className="btn danger" onClick={() => remove.mutate(g.id)}>Delete</button>
            </div>
            <div className="muted" style={{ marginTop: 6 }}>Members: {g.members.map((m: any) => m.public_name).join(" → ") || "—"}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
