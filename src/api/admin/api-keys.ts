import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { AppError } from "../../lib/errors";
import { apiKeyCreateSchema } from "../../lib/validation";
import { adminAuthMiddleware } from "../../middleware/admin-auth";
import { generateClientKey, sha256Hex } from "../../lib/crypto";
import { newId } from "../../lib/id";

export const apiKeysRoute = new Hono<AppEnv>();
apiKeysRoute.use("*", adminAuthMiddleware);

apiKeysRoute.get("/", async (c) => {
  const rows: any[] = await c.env.DB.prepare(
    `SELECT id, name, prefix, permissions, allowed_models, expires_at, usage_limit, usage_count, enabled, last_used_at, created_at FROM api_keys ORDER BY created_at DESC`
  ).bind().all().then((r: any) => r.results ?? []);
  return c.json({ data: rows.map((r) => ({ ...r, enabled: !!r.enabled, allowedModels: safeJson(r.allowed_models), permissions: safeJson(r.permissions) })) });
});

apiKeysRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = apiKeyCreateSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "validation_error", false);
  const { key, prefix } = generateClientKey();
  const hash = await sha256Hex(key);
  const id = `key_${newId()}`;
  await c.env.DB.prepare(
    `INSERT INTO api_keys (id, name, prefix, key_hash, permissions, allowed_models, expires_at, usage_limit, usage_count, enabled, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?)`
  ).bind(id, parsed.data.name, prefix, hash, JSON.stringify(parsed.data.permissions), JSON.stringify(parsed.data.allowedModels), parsed.data.expiresAt ?? null, parsed.data.usageLimit ?? null, Math.floor(Date.now() / 1000)).run();
  // Full key shown only once.
  return c.json({ id, key, prefix }, 201);
});

apiKeysRoute.delete("/:id", async (c) => {
  await c.env.DB.prepare(`DELETE FROM api_keys WHERE id = ?`).bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

apiKeysRoute.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const body: any = await c.req.json().catch(() => ({}));
  const existing: any = await c.env.DB.prepare(`SELECT * FROM api_keys WHERE id = ?`).bind(id).first();
  if (!existing) throw new AppError(404, "model_not_found", "API key not found", "model_not_found", false);
  await c.env.DB.prepare(`UPDATE api_keys SET name = ?, enabled = ?, allowed_models = ?, permissions = ? WHERE id = ?`)
    .bind(body.name ?? existing.name, body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled,
      body.allowedModels ? JSON.stringify(body.allowedModels) : existing.allowed_models,
      body.permissions ? JSON.stringify(body.permissions) : existing.permissions, id).run();
  return c.json({ ok: true });
});

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return s?.startsWith("[") ? [] : {}; }
}
