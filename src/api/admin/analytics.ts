import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { adminAuthMiddleware } from "../../middleware/admin-auth";
import { getOverview } from "../../observability/metrics";

export const analyticsRoute = new Hono<AppEnv>();
analyticsRoute.use("*", adminAuthMiddleware);

function rangeSec(range: string): number {
  const now = Math.floor(Date.now() / 1000);
  switch (range) {
    case "24h": return now - 86400;
    case "7d": return now - 7 * 86400;
    case "30d": return now - 30 * 86400;
    case "60d": return now - 60 * 86400;
    default: return 0;
  }
}

analyticsRoute.get("/overview", async (c) => {
  const range = c.req.query("range") ?? "7d";
  return c.json(await getOverview(c.env.DB, rangeSec(range)));
});

analyticsRoute.get("/requests", async (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 200);
  const offset = Number(c.req.query("offset") ?? 0);
  const model = c.req.query("model");
  const provider = c.req.query("provider");
  const status = c.req.query("status");
  const conds: string[] = [];
  const params: any[] = [];
  if (model) { conds.push("requested_model = ?"); params.push(model); }
  if (provider) { conds.push("selected_provider = ?"); params.push(provider); }
  if (status === "error") conds.push("status >= 400");
  if (status === "ok") conds.push("status < 400");
  const where = conds.length ? `WHERE ${conds.join(" AND ")}` : "";
  const rows: any[] = await c.env.DB.prepare(`SELECT * FROM request_logs ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`).bind(...params, limit, offset).all().then((r: any) => r.results ?? []);
  const total: any = await c.env.DB.prepare(`SELECT COUNT(*) as n FROM request_logs ${where}`).bind(...params).first().catch(() => ({ n: rows.length }));
  return c.json({ data: rows, total: Number(total?.n ?? rows.length) });
});

analyticsRoute.get("/timeseries", async (c) => {
  const range = c.req.query("range") ?? "7d";
  const since = rangeSec(range);
  const bucket = range === "24h" ? 3600 : 86400;
  const rows: any[] = await c.env.DB.prepare(
    `SELECT CAST(timestamp / ? AS INTEGER) * ? as bucket, COUNT(*) as requests,
            SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens,
            AVG(duration_ms) as avgMs, SUM(CASE WHEN status >= 400 THEN 1 ELSE 0 END) as errors
     FROM request_logs WHERE timestamp >= ? GROUP BY bucket ORDER BY bucket ASC LIMIT 200`
  ).bind(bucket, bucket, since).all().then((r: any) => r.results ?? []).catch(() => []);
  return c.json({ data: rows });
});
