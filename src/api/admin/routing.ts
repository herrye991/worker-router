import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { AppError } from "../../lib/errors";
import { routingGroupCreateSchema } from "../../lib/validation";
import { adminAuthMiddleware } from "../../middleware/admin-auth";
import { newId } from "../../lib/id";

export const routingRoute = new Hono<AppEnv>();
routingRoute.use("*", adminAuthMiddleware);

routingRoute.get("/", async (c) => {
  const groups: any[] = await c.env.DB.prepare(`SELECT * FROM routing_groups ORDER BY created_at DESC`).bind().all().then((r: any) => r.results ?? []);
  const out = [];
  for (const g of groups) {
    const members: any[] = await c.env.DB.prepare(
      `SELECT gm.*, m.public_name, m.provider_model_id, p.name as provider_name FROM routing_group_members gm
       JOIN models m ON m.id = gm.model_id JOIN providers p ON p.id = m.provider_id WHERE gm.group_id = ? ORDER BY gm.order_index ASC`
    ).bind(g.id).all().then((r: any) => r.results ?? []);
    out.push({ ...g, enabled: !!g.enabled, fallbackPolicy: safeJson(g.fallback_policy), members });
  }
  return c.json({ data: out });
});

routingRoute.post("/", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = routingGroupCreateSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, "validation_error", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "), "validation_error", false);
  // Validate all member models exist.
  for (const m of parsed.data.members) {
    const row: any = await c.env.DB.prepare(`SELECT id FROM models WHERE id = ?`).bind(m.modelId).first();
    if (!row) throw new AppError(400, "validation_error", `Model ${m.modelId} does not exist`, "validation_error", false);
  }
  const id = `grp_${newId()}`;
  const now = Math.floor(Date.now() / 1000);
  try {
    await c.env.DB.prepare(`INSERT INTO routing_groups (id, name, public_alias, strategy, enabled, fallback_policy, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, parsed.data.name, parsed.data.publicAlias, parsed.data.strategy, parsed.data.enabled ? 1 : 0, JSON.stringify(parsed.data.fallbackPolicy), now, now).run();
    for (const m of parsed.data.members) {
      await c.env.DB.prepare(`INSERT INTO routing_group_members (id, group_id, model_id, weight, priority, order_index) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(`grm_${newId()}`, id, m.modelId, m.weight, m.priority, m.orderIndex).run();
    }
  } catch {
    throw new AppError(400, "validation_error", "publicAlias must be unique", "validation_error", false);
  }
  return c.json({ id }, 201);
});

routingRoute.put("/:id", async (c) => {
  const id = c.req.param("id");
  const body: any = await c.req.json().catch(() => ({}));
  const existing: any = await c.env.DB.prepare(`SELECT * FROM routing_groups WHERE id = ?`).bind(id).first();
  if (!existing) throw new AppError(404, "model_not_found", "Routing group not found", "model_not_found", false);
  await c.env.DB.prepare(`UPDATE routing_groups SET name = ?, strategy = ?, enabled = ?, fallback_policy = ?, updated_at = ? WHERE id = ?`)
    .bind(body.name ?? existing.name, body.strategy ?? existing.strategy, body.enabled !== undefined ? (body.enabled ? 1 : 0) : existing.enabled,
      body.fallbackPolicy ? JSON.stringify(body.fallbackPolicy) : existing.fallback_policy, Math.floor(Date.now() / 1000), id).run();
  if (Array.isArray(body.members)) {
    await c.env.DB.prepare(`DELETE FROM routing_group_members WHERE group_id = ?`).bind(id).run();
    for (const [i, m] of body.members.entries()) {
      await c.env.DB.prepare(`INSERT INTO routing_group_members (id, group_id, model_id, weight, priority, order_index) VALUES (?, ?, ?, ?, ?, ?)`)
        .bind(`grm_${newId()}`, id, m.modelId, m.weight ?? 1, m.priority ?? 0, m.orderIndex ?? i).run();
    }
  }
  return c.json({ ok: true });
});

routingRoute.delete("/:id", async (c) => {
  await c.env.DB.prepare(`DELETE FROM routing_groups WHERE id = ?`).bind(c.req.param("id")).run();
  return c.json({ ok: true });
});

function safeJson(s: string) {
  try { return JSON.parse(s); } catch { return {}; }
}
