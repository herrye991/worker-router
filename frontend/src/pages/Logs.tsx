import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function LogsPage() {
  const [status, setStatus] = React.useState("");
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["logs", status],
    queryFn: () => api<any>(`/api/admin/analytics/requests?limit=100${status ? `&status=${status}` : ""}`),
  });
  return (
    <div>
      <div className="topbar">
        <div><h2>Request Logs</h2><p>Recent gateway requests (no prompts stored)</p></div>
        <div className="row">
          <select className="select" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">All</option><option value="ok">OK</option><option value="error">Errors</option>
          </select>
          <button className="btn secondary" onClick={() => refetch()}>Refresh</button>
        </div>
      </div>
      <div className="card">
        {isLoading && <div className="muted">Loading…</div>}
        <table className="table">
          <thead><tr><th>Time</th><th>Model</th><th>Provider</th><th>Status</th><th>Latency</th><th>Tokens</th><th>Strategy</th></tr></thead>
          <tbody>
            {data?.data?.map((r: any) => (
              <tr key={r.id}>
                <td className="muted">{new Date(r.timestamp * 1000).toLocaleString()}</td>
                <td><code>{r.requested_model}</code></td>
                <td>{r.selected_provider ?? "—"}</td>
                <td><span className={`badge ${r.status < 400 ? "green" : "red"}`}>{r.status}</span></td>
                <td>{r.duration_ms}ms</td>
                <td className="muted">{(r.input_tokens ?? 0) + (r.output_tokens ?? 0)}</td>
                <td className="muted">{r.routing_strategy ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {data?.data?.length === 0 && <div className="empty">No requests yet</div>}
      </div>
    </div>
  );
}
