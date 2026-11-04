import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { AppError } from "../../lib/errors";
import { chatCompletionSchema } from "../../lib/validation";
import { clientAuthMiddleware, requireModelAccess } from "../../middleware/client-auth";
import { resolveTarget, executeWithFallback } from "../../core/router/router-engine";
import { writeRequestLog, estimateCost } from "../../observability/request-logger";

export const chatCompletionsRoute = new Hono<AppEnv>();

chatCompletionsRoute.post("/", clientAuthMiddleware, async (c) => {
  const requestId = c.get("requestId") as string;
  const started = Date.now();
  let ttfb: number | undefined;
  const raw = await c.req.json().catch(() => null);
  const parsed = chatCompletionSchema.safeParse(raw);
  if (!parsed.success) throw new AppError(400, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "validation_error", false);
  const req = parsed.data;
  requireModelAccess(c, req.model);
  const apiKey = c.get("apiKey") as any;

  if (req.tools?.length || req.response_format) {
    // Capability-aware: tools only if at least one eligible member supports them (checked after resolve).
  }

  const env = c.env;
  const target = await resolveTarget(env, req.model);
  const member0 = target.members[0];
  if (req.tools?.length) {
    const { getAdapter } = await import("../../providers");
    const supports = target.members.some((m) => { try { return getAdapter(m.providerType).capabilities().tools; } catch { return false; } });
    if (!supports) throw new AppError(400, "unsupported_capability", "Tools not supported by any eligible provider for this model", "unsupported_capability", false);
  }

  const logBase = { requestId, apiKeyId: apiKey?.id, requestedModel: req.model, routingStrategy: target.strategy };
  try {
    if (req.stream) {
      const { response, member, attempts } = await executeWithFallback(env, target, req as any, { stream: true });
      ttfb = Date.now() - started;
      c.header("Content-Type", "text/event-stream");
      c.header("Cache-Control", "no-cache");
      c.header("Connection", "keep-alive");
      // Log after stream completes (best-effort, non-blocking per chunk).
      const duration = Date.now() - started;
      c.executionCtx.waitUntil(writeRequestLog(env.DB, {
        ...logBase, selectedProvider: member.providerName, selectedUpstreamModel: member.upstreamModel,
        durationMs: duration, ttfbMs: ttfb, status: 200, retryCount: attempts - 1,
      }));
      c.executionCtx.waitUntil((async () => {
        await env.DB.prepare(`UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?`).bind(Math.floor(Date.now() / 1000), apiKey.id).run().catch(() => {});
      })());
      return response as Response;
    } else {
      const { response, member, attempts } = await executeWithFallback(env, target, req as any, { stream: false });
      ttfb = Date.now() - started;
      const duration = Date.now() - started;
      const usage = (response as any).usage;
      let cost: number | undefined;
      try {
        const mrow: any = await env.DB.prepare(`SELECT cost FROM models WHERE id = ?`).bind(member.modelId).first();
        cost = estimateCost(usage?.prompt_tokens, usage?.completion_tokens, JSON.parse(mrow?.cost ?? "{}"));
      } catch { /* ignore */ }
      c.executionCtx.waitUntil(writeRequestLog(env.DB, {
        ...logBase, selectedProvider: member.providerName, selectedUpstreamModel: member.upstreamModel,
        durationMs: duration, ttfbMs: ttfb, status: 200,
        inputTokens: usage?.prompt_tokens, outputTokens: usage?.completion_tokens,
        retryCount: attempts - 1, estimatedCost: cost,
      }));
      c.executionCtx.waitUntil(env.DB.prepare(`UPDATE api_keys SET usage_count = usage_count + 1, last_used_at = ? WHERE id = ?`).bind(Math.floor(Date.now() / 1000), apiKey.id).run().catch(() => {}));
      return c.json({ id: (response as any).id, object: "chat.completion", created: Math.floor(Date.now() / 1000), model: req.model, choices: (response as any).choices, usage });
    }
  } catch (e: any) {
    const duration = Date.now() - started;
    const status = e instanceof AppError ? e.status : 502;
    c.executionCtx.waitUntil(writeRequestLog(env.DB, {
      ...logBase, durationMs: duration, ttfbMs: ttfb, status, retryCount: 0,
      errorCategory: e instanceof AppError ? e.category : "upstream_error",
    }));
    throw e;
  }
});
