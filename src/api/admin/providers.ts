import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { AppError } from "../../lib/errors";
import { providerCreateSchema } from "../../lib/validation";
import { adminAuthMiddleware } from "../../middleware/admin-auth";
import { encryptCredential } from "../../lib/crypto";
import { newId } from "../../lib/id";
import { getAdapter } from "../../providers";

export const providersRoute = new Hono<AppEnv>();
providersRoute.use("*", adminAuthMiddleware);

providersRoute.get("/", async (c) => {
  const rows: any[] = await c.env.DB.prepare(`SELECT id, name, type, base_url, auth_type, enabled, timeout_ms, retry_config, concurrency_limit, created_at, updated_at FROM providers ORDER BY created_at DESC`).bind().all().then((r: any) => r.results ?? []);
  return c.json({ data: rows.map((r) => ({ ...r, enabled: !!r.enabled, retryConfig: safeJson(r.retry_config) })) });
});

providersRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = providerCreateSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "validation_error", false);
  getAdapter(parsed.data.type); // validate type
  let encrypted: string | null = null;
  if (parsed.data.credential) {
    const master = c.env.ENCRYPTION_MASTER_KEY;
    if (!master) throw new AppError(500, "internal_error", "ENCRYPTION_MASTER_KEY not configured", "internal_error", false);
    encrypted = await encryptCredential(parsed.data.credential, master);
  }
  const id = `prov_${newId()}`;
  const now = Math.floor(Date.now() / 1000);
  await c.env.DB.prepare(
    `INSERT INTO providers (id, name, type, base_url, auth_type, encrypted_credential, enabled, timeout_ms, retry_config, concurrency_limit, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).bind(id, parsed.data.name, parsed.data.type, parsed.data.baseUrl, parsed.data.authType, encrypted, parsed.data.enabled ? 1 : 0, parsed.data.timeoutMs, JSON.stringify(parsed.data.retryConfig), parsed.data.concurrencyLimit, now, now).run();
  return c.json({ id }, 201);
});

providersRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body: any = await c.req.json().catch(() => ({}));
  const existing: any = await c.env.DB.prepare(`SELECT * FROM providers WHERE id = ?`).bind(id).first();
  if (!existing) throw new AppError(404, "model_not_found", "Provider not found", "model_not_found", false);
  const name = body.name ?? existing.name;
  const baseUrl = body.base_url ?? body.baseUrl ?? existing.base_url;
  const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled;
  const timeoutMs = body.timeout_ms ?? body.timeoutMs ?? existing.timeout_ms;
  let encrypted = existing.encrypted_credential;
  if (body.credential) {
    const master = c.env.ENCRYPTION_MASTER_KEY;
    if (!master) throw new AppError(500, "internal_error", "ENCRYPTION_MASTER_KEY not configured", "internal_error", false);
    encrypted = await encryptCredential(body.credential, master);
  }
  await c.env.DB.prepare(`UPDATE providers SET name = ?, base_url = ?, encrypted_credential = ?, enabled = ?, timeout_ms = ?, updated_at = ? WHERE id = ?`)
    .bind(name, baseUrl, encrypted, enabled, timeoutMs, Math.floor(Date.now() / 1000), id).run();
  return c.json({ ok: true });
});

providersRoute.delete("/:id", async (c) => {
  const id = c.req.param("id");
  await c.env.DB.prepare(`DELETE FROM providers WHERE id = ?`).bind(id).run();
  return c.json({ ok: true });
});

providersRoute.get("/:id/models", async (c) => {
  const id = c.req.param("id");
  const started = Date.now();
  const row: any = await c.env.DB.prepare(`SELECT * FROM providers WHERE id = ?`).bind(id).first();
  if (!row) throw new AppError(404, "model_not_found", "Provider not found", "model_not_found", false);
  const adapter = getAdapter(row.type);
  if (!adapter.capabilities().modelsList) {
    throw new AppError(400, "unsupported_capability", `Provider type '${row.type}' does not support model listing`, "unsupported_capability", false);
  }
  // Decrypt credential for upstream auth.
  let credential: string | null = null;
  if (row.encrypted_credential) {
    const master = c.env.ENCRYPTION_MASTER_KEY;
    if (!master) throw new AppError(500, "internal_error", "ENCRYPTION_MASTER_KEY not configured", "internal_error", false);
    const { decryptCredential } = await import("../../lib/crypto");
    try { credential = await decryptCredential(row.encrypted_credential, master); } catch { credential = null; }
  }
  const ctx = {
    providerId: row.id, providerName: row.name, providerType: row.type,
    baseUrl: row.base_url, credential, upstreamModel: "",
    timeoutMs: Math.min(Number(row.timeout_ms ?? 15000), 30000), env: c.env,
  };
  try {
    const models = adapter.listModels ? await adapter.listModels(ctx) : await fetchUpstreamModels(row, credential);
    return c.json({ data: models, latencyMs: Date.now() - started });
  } catch (e: any) {
    const msg = e instanceof AppError ? e.message : (e?.message ?? "Failed to fetch models");
    return c.json({ error: { message: msg, type: "upstream_error", code: "upstream_error" } }, 502);
  }
});

async function fetchUpstreamModels(row: any, credential: string | null) {
  // Generic OpenAI-compatible GET <baseUrl>/models
  const headers: Record<string, string> = {};
  if (row.type === "anthropic") {
    headers["x-api-key"] = credential ?? "";
    headers["anthropic-version"] = "2023-06-01";
  } else if (credential) {
    headers["Authorization"] = `Bearer ${credential}`;
  }
  const res = await fetch(`${String(row.base_url).replace(/\/$/, "")}/models`, {
    headers, signal: AbortSignal.timeout(Math.min(Number(row.timeout_ms ?? 15000), 30000)),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new AppError(res.status, "upstream_error", `Upstream /models failed (${res.status}): ${t.slice(0, 200)}`, "upstream_error", res.status >= 500 || res.status === 429);
  }
  const j: any = await res.json().catch(() => ({}));
  const list = Array.isArray(j?.data) ? j.data : Array.isArray(j?.models) ? j.models : [];
  return list.map((m: any) => ({ id: String(m?.id ?? m?.name ?? "") })).filter((m: any) => m.id);
}

providersRoute.post("/:id/test", async (c) => {
  const id = c.req.param("id");
  const started = Date.now();
  const row: any = await c.env.DB.prepare(`SELECT * FROM providers WHERE id = ?`).bind(id).first();
  if (!row) throw new AppError(404, "model_not_found", "Provider not found", "model_not_found", false);
  try {
    const adapter = getAdapter(row.type);
    if (adapter.capabilities().modelsList && row.type === "openai-compatible") {
      const res = await fetch(`${row.base_url.replace(/\/$/, "")}/models`, {
        headers: row.encrypted_credential ? {} : {},
        signal: AbortSignal.timeout(row.timeout_ms ?? 15000),
      });
      return c.json({ ok: res.ok, status: res.status, latencyMs: Date.now() - started, note: res.ok ? "Connection OK (models endpoint reachable)" : "Models endpoint returned error" });
    }
    // Lightweight check: base URL reachable (no inference).
    const res = await fetch(row.base_url, { method: "GET", signal: AbortSignal.timeout(Math.min(row.timeout_ms ?? 15000, 15000)) }).catch(() => null);
    return c.json({ ok: true, latencyMs: Date.now() - started, note: "Base URL check only — not a model inference test", httpStatus: (res as any)?.status ?? null });
  } catch (e: any) {
    return c.json({ ok: false, latencyMs: Date.now() - started, error: e?.message ?? "Connection failed" }, 200);
  }
});

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
