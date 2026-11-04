import React from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../lib/api";

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export function OverviewPage() {
  const [range, setRange] = React.useState("7d");
  const { data, isLoading, error } = useQuery({
    queryKey: ["overview", range],
    queryFn: () => api<any>(`/api/admin/analytics/overview?range=${range}`),
  });
  const maxProv = Math.max(1, ...(data?.byProvider?.map((r: any) => r.requests) ?? [1]));
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
            <div className="card"><div className="stat-label">Success rate</div><div className="stat-value">{(data.successRate * 100).toFixed(1)}%</div><div className="muted">Error {(data.errorRate * 100).toFixed(1)}%</div></div>
            <div className="card"><div className="stat-label">Avg latency / TTFB</div><div className="stat-value">{Math.round(data.avgLatencyMs)}ms</div><div className="muted">TTFB {Math.round(data.avgTtfbMs ?? 0)}ms</div></div>
            <div className="card"><div className="stat-label">Total tokens</div><div className="stat-value">{fmt(data.totalTokens ?? 0)}</div><div className="muted">In {fmt(data.totalInputTokens)} · Out {fmt(data.totalOutputTokens)}</div></div>
          </div>
          <div className="grid cols-4" style={{ marginTop: 14 }}>
            <div className="card"><div className="stat-label">Input tokens</div><div className="stat-value">{fmt(data.totalInputTokens)}</div></div>
            <div className="card"><div className="stat-label">Output tokens</div><div className="stat-value">{fmt(data.totalOutputTokens)}</div></div>
            <div className="card"><div className="stat-label">Est. cost</div><div className="stat-value">${Number(data.estimatedCost).toFixed(4)}</div><div className="muted">Estimated, not billed</div></div>
            <div className="card"><div className="stat-label">Providers active</div><div className="stat-value">{data.byProvider.length}</div><div className="muted">{data.byModel.length} model entries</div></div>
          </div>
          <div className="grid cols-2" style={{ marginTop: 14 }}>
            <div className="card">
              <h3>By provider</h3>
              {data.byProvider.length === 0 && <div className="muted">No provider usage yet</div>}
              {data.byProvider.map((r: any) => (
                <div key={r.provider} style={{ marginBottom: 8 }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span>{r.provider}</span>
                    <span className="muted">{r.requests} req · {fmt(r.inputTokens + r.outputTokens)} tok · ${Number(r.cost).toFixed(4)}</span>
                  </div>
                  <div className="bar"><div className="bar-fill" style={{ width: `${(r.requests / maxProv) * 100}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="card">
              <h3>Top models</h3>
              {data.byModel.length === 0 && <div className="muted">No model usage yet</div>}
              <table className="table">
                <thead><tr><th>Model</th><th>Provider</th><th>Req</th><th>Tokens</th><th>Cost</th></tr></thead>
                <tbody>{data.byModel.slice(0, 10).map((r: any, i: number) => (
                  <tr key={`${r.model}-${r.provider}-${i}`}><td><code>{r.model}</code></td><td className="muted">{r.provider}</td><td>{r.requests}</td><td className="muted">{fmt(r.inputTokens + r.outputTokens)}</td><td>${Number(r.cost).toFixed(4)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
