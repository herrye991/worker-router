import type { Context, Next } from "hono";
import { newId } from "../lib/id";

export async function requestIdMiddleware(c: Context, next: Next) {
  const id = c.req.header("x-request-id") ?? `req_${newId()}`;
  c.set("requestId", id);
  c.header("x-request-id", id);
  await next();
}
