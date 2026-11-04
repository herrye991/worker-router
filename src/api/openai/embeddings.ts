import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { AppError } from "../../lib/errors";
import { clientAuthMiddleware } from "../../middleware/client-auth";

export const embeddingsRoute = new Hono<AppEnv>();

embeddingsRoute.post("/", clientAuthMiddleware, async (c) => {
  const apiKey = c.get("apiKey") as any;
  if (!apiKey?.permissions?.embeddings) throw new AppError(403, "permission_error", "Embeddings not enabled for this key", "permission_error", false);
  const body: any = await c.req.json().catch(() => null);
  if (!body?.model || body?.input == null) throw new AppError(400, "validation_error", "model and input are required", "validation_error", false);
  throw new AppError(400, "unsupported_capability", "Embeddings passthrough not configured for this deployment", "unsupported_capability", false);
});
