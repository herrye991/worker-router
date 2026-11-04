export interface ProviderBreakdown {
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  errors: number;
  avgMs: number;
  lastUsed: number;
}

export interface ModelBreakdown {
  model: string;
  provider: string;
  requests: number;
  inputTokens: number;
  outputTokens: number;
  cost: number;
  errors: number;
  lastUsed: number;
}

export interface OverviewStats {
  totalRequests: number;
  successRate: number;
  errorRate: number;
  avgLatencyMs: number;
  avgTtfbMs: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalTokens: number;
  estimatedCost: number;
  inputCost: number;
  outputCost: number;
  byProvider: ProviderBreakdown[];
  byModel: ModelBreakdown[];
}

export async function getOverview(db: D1Database, sinceSec: number): Promise<OverviewStats> {
  const total: any = await db.prepare(
    `SELECT COUNT(*) as n, AVG(duration_ms) as avgMs, AVG(ttfb_ms) as avgTtfb,
            SUM(input_tokens) as inp, SUM(output_tokens) as outp, SUM(estimated_cost) as cost,
            SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errs
     FROM request_logs WHERE timestamp >= ?`
  ).bind(sinceSec).first().catch(() => null);
  const byProvider: any = await db.prepare(
    `SELECT selected_provider as provider, COUNT(*) as requests,
            SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens,
            SUM(estimated_cost) as cost, SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors,
            AVG(duration_ms) as avgMs, MAX(timestamp) as lastUsed
     FROM request_logs WHERE timestamp >= ? GROUP BY selected_provider ORDER BY requests DESC LIMIT 20`
  ).bind(sinceSec).all().then((r: any) => r.results ?? []).catch(() => []);
  const byModel: any = await db.prepare(
    `SELECT requested_model as model, selected_provider as provider, COUNT(*) as requests,
            SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens,
            SUM(estimated_cost) as cost, SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors,
            MAX(timestamp) as lastUsed
     FROM request_logs WHERE timestamp >= ? GROUP BY requested_model, selected_provider ORDER BY requests DESC LIMIT 30`
  ).bind(sinceSec).all().then((r: any) => r.results ?? []).catch(() => []);
  const n = Number(total?.n ?? 0);
  const errs = Number(total?.errs ?? 0);
  const inp = Number(total?.inp ?? 0);
  const outp = Number(total?.outp ?? 0);
  const cost = Number(total?.cost ?? 0);
  return {
    totalRequests: n,
    successRate: n ? (n - errs) / n : 1,
    errorRate: n ? errs / n : 0,
    avgLatencyMs: Number(total?.avgMs ?? 0),
    avgTtfbMs: Number(total?.avgTtfb ?? 0),
    totalInputTokens: inp,
    totalOutputTokens: outp,
    totalTokens: inp + outp,
    estimatedCost: cost,
    inputCost: cost,
    outputCost: 0,
    byProvider: (byProvider as any[]).map((r) => ({
      provider: r.provider ?? "unknown", requests: Number(r.requests ?? 0),
      inputTokens: Number(r.inputTokens ?? 0), outputTokens: Number(r.outputTokens ?? 0),
      cost: Number(r.cost ?? 0), errors: Number(r.errors ?? 0),
      avgMs: Number(r.avgMs ?? 0), lastUsed: Number(r.lastUsed ?? 0),
    })),
    byModel: (byModel as any[]).map((r) => ({
      model: r.model ?? "unknown", provider: r.provider ?? "unknown",
      requests: Number(r.requests ?? 0),
      inputTokens: Number(r.inputTokens ?? 0), outputTokens: Number(r.outputTokens ?? 0),
      cost: Number(r.cost ?? 0), errors: Number(r.errors ?? 0),
      lastUsed: Number(r.lastUsed ?? 0),
    })),
  };
}
