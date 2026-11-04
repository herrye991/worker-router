import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { AppError } from "../../lib/errors";
import { modelCreateSchema } from "../../lib/validation";
import { adminAuthMiddleware } from "../../middleware/admin-auth";
import { newId } from "../../lib/id";

export const modelsAdminRoute = new Hono<AppEnv>();
modelsAdminRoute.use("*", adminAuthMiddleware);

modelsAdminRoute.get("/", async (c) => {
  const rows: any[] = await c.env.DB.prepare(
    `SELECT m.*, p.name as provider_name, p.type as provider_type FROM models m JOIN providers p ON p.id = m.provider_id ORDER BY m.created_at DESC`
  ).bind().all().then((r: any) => r.results ?? []);
  return c.json({ data: rows.map((r) => ({ ...r, enabled: !!r.enabled, capabilities: safeJson(r.capabilities), cost: safeJson(r.cost) })) });
});

modelsAdminRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = modelCreateSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "validation_error", false);
  const prov: any = await c.env.DB.prepare(`SELECT id FROM providers WHERE id = ? AND enabled = 1`).bind(parsed.data.providerId).first();
  if (!prov) throw new AppError(400, "validation_error", "Referenced provider does not exist or is disabled", "validation_error", false);
  const id = `model_${newId()}`;
  const now = Math.floor(Date.now() / 1000);
  try {
    await c.env.DB.prepare(
      `INSERT INTO models (id, public_name, provider_id, provider_model_id, enabled, context_window, capabilities, cost, weight, priority, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).bind(id, parsed.data.publicName, parsed.data.providerId, parsed.data.providerModelId, parsed.data.enabled ? 1 : 0, parsed.data.contextWindow ?? null, JSON.stringify(parsed.data.capabilities), JSON.stringify(parsed.data.cost), parsed.data.weight, parsed.data.priority, now, now).run();
  } catch (e: any) {
    throw new AppError(400, "validation_error", "publicName must be unique", "validation_error", false);
  }
  return c.json({ id }, 201);
});

modelsAdminRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body: any = await c.req.json().catch(() => ({}));
  const existing: any = await c.env.DB.prepare(`SELECT * FROM models WHERE id = ?`).bind(id).first();
  if (!existing) throw new AppError(404, "model_not_found", "Model not found", "model_not_found", false);
  await c.env.DB.prepare(
    `UPDATE models SET public_name = ?, provider_model_id = ?, enabled = ?, context_window = ?, capabilities = ?, cost = ?, weight = ?, priority = ?, updated_at = ? WHERE id = ?`
  ).bind(
    body.publicName ?? existing.public_name,
    body.providerModelId ?? existing.provider_model_id,
    body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled,
    body.contextWindow ?? existing.context_window,
    body.capabilities ? JSON.stringify(body.capabilities) : existing.capabilities,
    body.cost ? JSON.stringify(body.cost) : existing.cost,
    body.weight ?? existing.weight,
    body.priority ?? existing.priority,
    Math.floor(Date.now() / 1000), id
  ).run().catch(() => { throw new AppError(400, "validation_error", "publicName must be unique", "validation_error", false); });
  return c.json({ ok: true });
});

modelsAdminRoute.delete("/:id", async (c) => {
  await c.env.DB.prepare(`DELETE FROM models WHERE id = ?`).bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
