import React from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "../lib/api";

export function EndpointPage() {
  const qc = useQueryClient();
  const keys = useQuery({ queryKey: ["keys"], queryFn: () => api<any>("/api/admin/keys") });
  const [name, setName] = React.useState("Default Key");
  const [created, setCreated] = React.useState<string | null>(null);
  const [show, setShow] = React.useState<Record<string, boolean>>({});

  const createKey = useMutation({
    mutationFn: () => api<any>("/api/admin/keys", { method: "POST", body: JSON.stringify({ name, allowedModels: [] }) }),
    onSuccess: (d) => { setCreated(d.key); qc.invalidateQueries({ queryKey: ["keys"] }); },
  });
  const delKey = useMutation({
    mutationFn: (id: string) => api(`/api/admin/keys/${id}`, { method: "DELETE" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["keys"] }),
  });

  const endpoint = `${window.location.origin}/v1`;
  return (
    <div>
      <div className="topbar"><div><h2>Endpoint & Key</h2><p>OpenAI-compatible base URL and client keys</p></div></div>
      <div className="card">
        <h3>API Endpoint</h3>
        <div className="row">
          <code className="key">{endpoint}</code>
          <button className="btn secondary" onClick={() => navigator.clipboard.writeText(endpoint)}>Copy</button>
        </div>
        <p className="muted">Example: <code>POST {endpoint}/chat/completions</code> with <code>Authorization: Bearer YOUR_KEY</code></p>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <h3>API Keys</h3>
          <div className="row">
            <input className="input" style={{ width: 220 }} value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name" />
            <button className="btn" onClick={() => createKey.mutate()}>+ Create Key</button>
          </div>
        </div>
        {created && <div className="card" style={{ marginTop: 10 }}><b>New key (shown once):</b> <code className="key">{created}</code> <button className="btn secondary" onClick={() => navigator.clipboard.writeText(created)}>Copy</button></div>}
        {keys.data?.data?.length === 0 && <div className="empty">No keys yet</div>}
        <table className="table">
          <thead><tr><th>Name</th><th>Prefix</th><th>Usage</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {keys.data?.data?.map((k: any) => (
              <tr key={k.id}>
                <td>{k.name}</td>
                <td><code>{k.prefix}••••</code></td>
                <td>{k.usage_count}{k.usage_limit ? ` / ${k.usage_limit}` : ""}</td>
                <td><span className={`badge ${k.enabled ? "green" : "red"}`}>{k.enabled ? "enabled" : "disabled"}</span></td>
                <td><button className="btn secondary" onClick={() => setShow({ ...show, [k.id]: !show[k.id] })}>Restrict</button> <button className="btn danger" onClick={() => delKey.mutate(k.id)}>Delete</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
