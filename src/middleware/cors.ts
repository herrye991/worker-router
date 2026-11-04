import type { Context, Next } from "hono";

export async function corsMiddleware(c: Context, next: Next) {
  const origin = c.req.header("Origin") ?? "*";
  c.header("Access-Control-Allow-Origin", origin);
  c.header("Vary", "Origin");
  c.header("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
  c.header("Access-Control-Allow-Headers", "Content-Type,Authorization,X-Request-Id");
  c.header("Access-Control-Allow-Credentials", "true");
  if (c.req.method === "OPTIONS") return c.text("", 200);
  await next();
}
