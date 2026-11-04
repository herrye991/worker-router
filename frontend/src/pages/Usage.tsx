import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function UsagePage() {
  const [range, setRange] = React.useState("7d");
  const { data } = useQuery({ queryKey: ["overview", range], queryFn: () => api<any>(`/api/admin/analytics/overview?range=${range}`) });
  const ts = useQuery({ queryKey: ["ts", range], queryFn: () => api<any>(`/api/admin/analytics/timeseries?range=${range}`) });
  return (
    <div>
      <div className="topbar">
        <div><h2>Usage & Analytics</h2><p>Tokens, requests, cost and provider breakdown</p></div>
        <div className="row">{["24h", "7d", "30d", "60d"].map((r) => (<button key={r} className={`btn${range === r ? "" : " secondary"}`} onClick={() => setRange(r)}>{r}</button>))}</div>
      </div>
      <div className="grid cols-4">
        <div className="card"><div className="stat-label">Total requests</div><div className="stat-value">{data?.totalRequests ?? "—"}</div></div>
        <div className="card"><div className="stat-label">Input tokens</div><div className="stat-value">{data?.totalInputTokens ?? "—"}</div></div>
        <div className="card"><div className="stat-label">Output tokens</div><div className="stat-value">{data?.totalOutputTokens ?? "—"}</div></div>
        <div className="card"><div className="stat-label">Est. cost</div><div className="stat-value">${Number(data?.estimatedCost ?? 0).toFixed(4)}</div></div>
      </div>
      <div className="card" style={{ marginTop: 14 }}>
        <h3>Requests over time</h3>
        {(!ts.data?.data || ts.data.data.length === 0) && <div className="muted">No data for this period</div>}
        <table className="table">
          <tbody>{ts.data?.data?.map((r: any) => (<tr key={r.bucket}><td>{new Date(r.bucket * 1000).toLocaleString()}</td><td>{r.requests} req</td><td className="muted">{(r.inputTokens ?? 0) + (r.outputTokens ?? 0)} tokens</td><td className="muted">{r.errors} errors</td></tr>))}</tbody>
        </table>
      </div>
    </div>
  );
}
