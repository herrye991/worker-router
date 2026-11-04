import type { Context, Next } from "hono";
import { toOpenAIError } from "../lib/errors";

export async function errorHandlerMiddleware(c: Context, next: Next) {
  try {
    await next();
  } catch (e) {
    const requestId = c.get("requestId") as string | undefined;
    const { status, body } = toOpenAIError(e, requestId);
    return c.json(body, status as any);
  }
}
