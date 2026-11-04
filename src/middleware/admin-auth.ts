import type { Context, Next } from "hono";
import { sha256Hex } from "../lib/crypto";
import { AppError } from "../lib/errors";

const CSRF_SAFE = new Set(["GET", "HEAD", "OPTIONS"]);

export async function adminAuthMiddleware(c: Context, next: Next) {
  const token = getSessionToken(c);
  if (!token) throw new AppError(401, "authentication_error", "Admin login required", "authentication_error", false);
  const hash = await sha256Hex(token);
  const row: any = await (c.env as any).DB.prepare(
    `SELECT s.*, u.role FROM admin_sessions s JOIN admin_users u ON u.id = s.user_id WHERE s.token_hash = ?`
  ).bind(hash).first();
  if (!row) throw new AppError(401, "authentication_error", "Invalid session", "authentication_error", false);
  if (Date.now() / 1000 > Number(row.expires_at)) {
    await (c.env as any).DB.prepare(`DELETE FROM admin_sessions WHERE token_hash = ?`).bind(hash).run();
    throw new AppError(401, "authentication_error", "Session expired", "authentication_error", false);
  }
  if (!CSRF_SAFE.has(c.req.method)) {
    const origin = c.req.header("Origin");
    const host = new URL(c.req.url).host;
    if (origin) {
      try {
        if (new URL(origin).host !== host) throw new AppError(403, "permission_error", "CSRF check failed", "permission_error", false);
      } catch (e) {
        if (e instanceof AppError) throw e;
      }
    }
  }
  c.set("adminUser", { id: row.user_id, role: row.role });
  await next();
}

export function getSessionToken(c: Context): string | null {
  const cookie = c.req.header("Cookie") ?? "";
  const m = cookie.match(/(?:^|;\s*)wr_session=([^;]+)/);
  if (m) return decodeURIComponent(m[1]);
  const auth = c.req.header("Authorization") ?? "";
  const b = auth.match(/^Bearer\s+(.+)$/i);
  return b ? b[1].trim() : null;
}
