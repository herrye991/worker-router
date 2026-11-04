export interface OverviewStats {
  totalRequests: number;
  errorRate: number;
  avgLatencyMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  estimatedCost: number;
  byProvider: Array<{ provider: string; requests: number; inputTokens: number; outputTokens: number }>;
  byModel: Array<{ model: string; requests: number; inputTokens: number; outputTokens: number }>;
}

export async function getOverview(db: D1Database, sinceSec: number): Promise<OverviewStats> {
  const total: any = await db.prepare(
    `SELECT COUNT(*) as n, AVG(duration_ms) as avgMs,
            SUM(input_tokens) as inp, SUM(output_tokens) as outp, SUM(estimated_cost) as cost,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errs
     FROM request_logs WHERE timestamp >= ?`
  ).bind(sinceSec).first().catch(() => null);
  const byProvider: any = await db.prepare(
    `SELECT selected_provider as provider, COUNT(*) as requests, SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens
     FROM request_logs WHERE timestamp >= ? GROUP BY selected_provider ORDER BY requests DESC LIMIT 20`
  ).bind(sinceSec).all().then((r: any) => r.results ?? []).catch(() => []);
  const byModel: any = await db.prepare(
    `SELECT requested_model as model, COUNT(*) as requests, SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens
     FROM request_logs WHERE timestamp >= ? GROUP BY requested_model ORDER BY requests DESC LIMIT 20`
  ).bind(sinceSec).all().then((r: any) => r.results ?? []).catch(() => []);
  const n = Number(total?.n ?? 0);
  return {
    totalRequests: n,
    errorRate: n ? Number(total?.errs ?? 0) / n : 0,
    avgLatencyMs: Number(total?.avgMs ?? 0),
    totalInputTokens: Number(total?.inp ?? 0),
    totalOutputTokens: Number(total?.outp ?? 0),
    estimatedCost: Number(total?.cost ?? 0),
    byProvider: (byProvider as any[]).map((r) => ({ provider: r.provider ?? "unknown", requests: Number(r.requests ?? 0), inputTokens: Number(r.inputTokens ?? 0), outputTokens: Number(r.outputTokens ?? 0) })),
    byModel: (byModel as any[]).map((r) => ({ model: r.model ?? "unknown", requests: Number(r.requests ?? 0), inputTokens: Number(r.inputTokens ?? 0), outputTokens: Number(r.outputTokens ?? 0) })),
  };
}
