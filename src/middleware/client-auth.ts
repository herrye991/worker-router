import type { Context, Next } from "hono";
import { sha256Hex } from "../lib/crypto";
import { AppError } from "../lib/errors";

export interface ClientKeyInfo {
  id: string;
  name: string;
  allowedModels: string[];
  permissions: { chat: boolean; embeddings: boolean };
}

export async function clientAuthMiddleware(c: Context, next: Next) {
  const auth = c.req.header("Authorization") ?? "";
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) throw new AppError(401, "authentication_error", "Missing Bearer API key", "authentication_error", false);
  const raw = m[1].trim();
  const hash = await sha256Hex(raw);
  const row: any = await (c.env as any).DB.prepare(
    `SELECT * FROM api_keys WHERE key_hash = ? AND enabled = 1`
  ).bind(hash).first();
  if (!row) throw new AppError(401, "authentication_error", "Invalid API key", "authentication_error", false);
  if (row.expires_at && Date.now() / 1000 > Number(row.expires_at)) {
    throw new AppError(401, "authentication_error", "API key expired", "authentication_error", false);
  }
  if (row.usage_limit && Number(row.usage_count ?? 0) >= Number(row.usage_limit)) {
    throw new AppError(429, "rate_limit_exceeded", "API key usage limit exceeded", "rate_limit_exceeded", false);
  }
  let allowedModels: string[] = [];
  try { allowedModels = JSON.parse(row.allowed_models ?? "[]"); } catch { allowedModels = []; }
  let permissions = { chat: true, embeddings: false };
  try { permissions = { ...permissions, ...JSON.parse(row.permissions ?? "{}") }; } catch { /* default */ }
  c.set("apiKey", { id: row.id, name: row.name, allowedModels, permissions } as ClientKeyInfo);
  c.set("apiKeyRow", row);
  await next();
}

export function requireModelAccess(c: Context, requestedModel: string) {
  const info = c.get("apiKey") as ClientKeyInfo | undefined;
  if (!info) return;
  if (!info.allowedModels.length) return; // empty = all models allowed
  if (!info.allowedModels.includes(requestedModel)) {
    throw new AppError(403, "permission_error", `API key not allowed for model '${requestedModel}'`, "permission_error", false);
  }
}
