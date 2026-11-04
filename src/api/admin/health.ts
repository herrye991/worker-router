import { Hono } from "hono";
import type { AppEnv } from "../../types";

export const healthRoute = new Hono<AppEnv>();

healthRoute.get("/", async (c) => {
  // Non-sensitive operational info only.
  return c.json({
    ok: true,
    service: c.env.APP_NAME ?? "WorkerRouter",
    environment: c.env.ENVIRONMENT ?? "development",
    time: new Date().toISOString(),
  });
});
