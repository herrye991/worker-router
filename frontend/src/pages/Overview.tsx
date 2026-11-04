import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

export function OverviewPage() {
  const [range, setRange] = React.useState("7d");
  const { data, isLoading, error } = useQuery({
    queryKey: ["overview", range],
    queryFn: () => api<any>(`/api/admin/analytics/overview?range=${range}`),
  });
  return (
    <div>
      <div className="topbar">
        <div>
          <h2>Overview</h2>
          <p>Gateway health, traffic and cost at a glance</p>
        </div>
        <div className="row">
          {["24h", "7d", "30d", "60d"].map((r) => (
            <button key={r} className={`btn${range === r ? "" : " secondary"}`} onClick={() => setRange(r)}>{r}</button>
          ))}
        </div>
      </div>
      {isLoading && <div className="card">Loading…</div>}
      {error && <div className="card">Failed to load: {(error as Error).message}</div>}
      {data && (
        <>
          <div className="grid cols-4">
            <div className="card"><div className="stat-label">Total requests</div><div className="stat-value">{data.totalRequests}</div></div>
            <div className="card"><div className="stat-label">Error rate</div><div className="stat-value">{(data.errorRate * 100).toFixed(1)}%</div></div>
            <div className="card"><div className="stat-label">Avg latency</div><div className="stat-value">{Math.round(data.avgLatencyMs)}ms</div></div>
            <div className="card"><div className="stat-label">Est. cost</div><div className="stat-value">${Number(data.estimatedCost).toFixed(4)}</div><div className="muted">Estimated, not billed</div></div>
          </div>
          <div className="grid cols-2" style={{ marginTop: 14 }}>
            <div className="card">
              <h3>By provider</h3>
              {data.byProvider.length === 0 && <div className="muted">No provider usage yet</div>}
              <table className="table"><tbody>{data.byProvider.map((r: any) => (<tr key={r.provider}><td>{r.provider}</td><td>{r.requests}</td><td className="muted">{r.inputTokens + r.outputTokens} tokens</td></tr>))}</tbody></table>
            </div>
            <div className="card">
              <h3>Top models</h3>
              {data.byModel.length === 0 && <div className="muted">No model usage yet</div>}
              <table className="table"><tbody>{data.byModel.map((r: any) => (<tr key={r.model}><td>{r.model}</td><td>{r.requests}</td><td className="muted">{r.inputTokens + r.outputTokens} tokens</td></tr>))}</tbody></table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
