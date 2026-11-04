import { Hono } from "hono";
import type { AppEnv } from "./types";
import { requestIdMiddleware } from "./middleware/request-id";
import { corsMiddleware } from "./middleware/cors";
import { chatCompletionsRoute } from "./api/openai/chat-completions";
import { modelsRoute } from "./api/openai/models";
import { embeddingsRoute } from "./api/openai/embeddings";
import { authRoute } from "./api/admin/auth";
import { providersRoute } from "./api/admin/providers";
import { modelsAdminRoute } from "./api/admin/models";
import { routingRoute } from "./api/admin/routing";
import { apiKeysRoute } from "./api/admin/api-keys";
import { analyticsRoute } from "./api/admin/analytics";
import { settingsRoute } from "./api/admin/settings";
import { healthRoute } from "./api/admin/health";
import { mockUpstreamRoute } from "./api/mock-upstream";
import { toOpenAIError } from "./lib/errors";

const app = new Hono<AppEnv>();

app.use("*", requestIdMiddleware);
app.use("*", corsMiddleware);

app.onError((err, c) => {
  const { status, body } = toOpenAIError(err, c.get("requestId") as string | undefined);
  return c.json(body, status as any);
});

app.route("/health", healthRoute);
app.route("/mock-upstream", mockUpstreamRoute);
app.route("/v1/chat/completions", chatCompletionsRoute);
app.route("/v1/models", modelsRoute);
app.route("/v1/embeddings", embeddingsRoute);

app.route("/api/admin/auth", authRoute);
app.route("/api/admin/providers", providersRoute);
app.route("/api/admin/models", modelsAdminRoute);
app.route("/api/admin/routing", routingRoute);
app.route("/api/admin/keys", apiKeysRoute);
app.route("/api/admin/analytics", analyticsRoute);
app.route("/api/admin/settings", settingsRoute);

app.get("/api/info", (c) => {
  return c.json({
    name: "WorkerRouter",
    version: "0.1.0",
    openaiCompatible: true,
    endpoints: ["/v1/chat/completions", "/v1/models", "/v1/embeddings"],
  });
});

// Monorepo single-port: static frontend is served by Wrangler ASSETS binding.
// `not_found_handling: single-page-application` handles SPA fallback on deploy.
// Explicit dashboard routes for `wrangler dev` (no wildcard — avoids shadowing /assets/*).
for (const spaPath of ["/login", "/endpoint", "/providers", "/models", "/combos", "/usage", "/logs", "/settings"]) {
  app.get(spaPath, async (c) => {
    return c.env.ASSETS.fetch(new Request(new URL("/", c.req.url).toString()));
  });
}

export default app;
