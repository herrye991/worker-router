import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { clientAuthMiddleware } from "../../middleware/client-auth";

export const modelsRoute = new Hono<AppEnv>();

modelsRoute.get("/", clientAuthMiddleware, async (c) => {
  const apiKey = c.get("apiKey") as any;
  const allowed: string[] = apiKey?.allowedModels ?? [];
  let rows: any[];
  if (allowed.length) {
    const ph = allowed.map(() => "?").join(",");
    rows = await c.env.DB.prepare(
      `SELECT public_name FROM models WHERE enabled = 1 AND public_name IN (${ph})
       UNION SELECT public_alias as public_name FROM routing_groups WHERE enabled = 1 AND public_alias IN (${ph})`
    ).bind(...allowed, ...allowed).all().then((r: any) => r.results ?? []);
  } else {
    const m = await c.env.DB.prepare(`SELECT public_name FROM models WHERE enabled = 1`).bind().all().then((r: any) => r.results ?? []);
    const g = await c.env.DB.prepare(`SELECT public_alias as public_name FROM routing_groups WHERE enabled = 1`).bind().all().then((r: any) => r.results ?? []);
    rows = [...m, ...g];
  }
  const data = rows.map((r: any) => ({ id: r.public_name, object: "model", created: Math.floor(Date.now() / 1000), owned_by: "worker-router" }));
  return c.json({ object: "list", data });
});
