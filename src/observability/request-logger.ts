import { newId } from "../lib/id";

export interface LogEntry {
  requestId: string;
  apiKeyId?: string | null;
  requestedModel?: string;
  selectedProvider?: string;
  selectedUpstreamModel?: string;
  routingStrategy?: string;
  durationMs?: number;
  ttfbMs?: number;
  status?: number;
  inputTokens?: number;
  outputTokens?: number;
  retryCount?: number;
  errorCategory?: string;
  estimatedCost?: number;
}

export async function writeRequestLog(db: D1Database, entry: LogEntry) {
  const id = `log_${newId()}`;
  await db.prepare(
    `INSERT INTO request_logs (id, request_id, timestamp, api_key_id, requested_model, selected_provider, selected_upstream_model, routing_strategy, duration_ms, ttfb_ms, status, input_tokens, output_tokens, retry_count, error_category, estimated_cost)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(
    id, entry.requestId, Math.floor(Date.now() / 1000), entry.apiKeyId ?? null,
    entry.requestedModel ?? null, entry.selectedProvider ?? null, entry.selectedUpstreamModel ?? null,
    entry.routingStrategy ?? null, entry.durationMs ?? null, entry.ttfbMs ?? null, entry.status ?? null,
    entry.inputTokens ?? null, entry.outputTokens ?? null, entry.retryCount ?? 0,
    entry.errorCategory ?? null, entry.estimatedCost ?? null
  ).run().catch(() => {});
}

export function estimateCost(inputTokens?: number, outputTokens?: number, cost?: { inputPer1k?: number; outputPer1k?: number }): number | undefined {
  if (inputTokens == null && outputTokens == null) return undefined;
  if (!cost) return undefined;
  const c = (inputTokens ?? 0) / 1000 * (cost.inputPer1k ?? 0) + (outputTokens ?? 0) / 1000 * (cost.outputPer1k ?? 0);
  return Math.round(c * 1e6) / 1e6;
}
