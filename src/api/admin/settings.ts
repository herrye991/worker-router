import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { adminAuthMiddleware } from "../../middleware/admin-auth";

export const settingsRoute = new Hono<AppEnv>();
settingsRoute.use("*", adminAuthMiddleware);

settingsRoute.get("/", async (c) => {
  const rows: any[] = await c.env.DB.prepare(`SELECT key, value FROM application_settings WHERE key NOT LIKE 'rl:%' AND key NOT LIKE 'login:%'`).bind().all().then((r: any) => r.results ?? []).catch(() => []);
  const out: Record<string, string> = {};
  for (const r of rows) out[r.key] = r.value;
  return c.json({ data: out });
});

settingsRoute.put("/", async (c) => {
  const body: any = await c.req.json().catch(() => ({}));
  const allowed = ["retention_days", "require_api_key", "default_timeout_ms", "log_prompts"];
  for (const k of allowed) {
    if (body[k] !== undefined) {
      await c.env.DB.prepare(`INSERT INTO application_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`)
        .bind(k, String(body[k]), Math.floor(Date.now() / 1000)).run();
    }
  }
  return c.json({ ok: true });
});
