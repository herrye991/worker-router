import { Hono } from "hono";
import type { AppEnv } from "../../types";
import { AppError } from "../../lib/errors";
import { adminLoginSchema, adminChangePasswordSchema } from "../../lib/validation";
import { hashPassword, verifyPassword, sha256Hex } from "../../lib/crypto";
import { newId } from "../../lib/id";
import { adminAuthMiddleware } from "../../middleware/admin-auth";

export const authRoute = new Hono<AppEnv>();

const DEFAULT_PASSWORD = "123456";

async function getAdminUser(env: AppEnv["Bindings"]) {
  return env.DB.prepare(`SELECT * FROM admin_users LIMIT 1`).bind().first().catch(() => null) as Promise<any>;
}

async function ensureBootstrap(env: AppEnv["Bindings"]) {
  const existing = await getAdminUser(env);
  if (existing) return;
  // Password-only login like 9Router. Default password is 123456.
  const password = env.ADMIN_PASSWORD ?? env.ADMIN_BOOTSTRAP_PASSWORD ?? DEFAULT_PASSWORD;
  const id = `user_${newId()}`;
  await env.DB.prepare(`INSERT INTO admin_users (id, password_hash, role, created_at) VALUES (?, ?, 'admin', ?)`)
    .bind(id, await hashPassword(password), Math.floor(Date.now() / 1000)).run();
}

function sessionCookie(token: string, secure: boolean) {
  return `wr_session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=86400${secure ? "; Secure" : ""}`;
}

authRoute.post("/login", async (c) => {
  await ensureBootstrap(c.env);
  const body = await c.req.json().catch(() => null);
  const parsed = adminLoginSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, "validation_error", "password required", "validation_error", false);
  // Login rate limit: max 10 attempts/min (D1-backed).
  const bucket = Math.floor(Date.now() / 60000);
  const rlId = `login:admin:${bucket}`;
  const cnt: any = await c.env.DB.prepare(`SELECT value FROM application_settings WHERE key = ?`).bind(rlId).first().catch(() => null);
  if (Number(cnt?.value ?? 0) >= 10) throw new AppError(429, "rate_limit_exceeded", "Too many login attempts", "rate_limit_exceeded", false);

  const user: any = await getAdminUser(c.env);
  const ok = user ? await verifyPassword(parsed.data.password, user.password_hash) : false;
  if (!ok) {
    const n = Number(cnt?.value ?? 0) + 1;
    await c.env.DB.prepare(`INSERT INTO application_settings (key, value, updated_at) VALUES (?, ?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`).bind(rlId, String(n), Math.floor(Date.now() / 1000)).run().catch(() => {});
    throw new AppError(401, "authentication_error", "Invalid password", "authentication_error", false);
  }
  const tokenBytes = crypto.getRandomValues(new Uint8Array(32));
  const token = [...tokenBytes].map((b) => b.toString(16).padStart(2, "0")).join("");
  const hash = await sha256Hex(token);
  await c.env.DB.prepare(`INSERT INTO admin_sessions (id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)`)
    .bind(`sess_${newId()}`, user.id, hash, Math.floor(Date.now() / 1000) + 86400, Math.floor(Date.now() / 1000)).run();
  const secure = new URL(c.req.url).protocol === "https:";
  c.header("Set-Cookie", sessionCookie(token, secure));
  return c.json({ ok: true, role: user.role, token });
});

authRoute.post("/logout", adminAuthMiddleware, async (c) => {
  const cookie = c.req.header("Cookie") ?? "";
  const m = cookie.match(/wr_session=([^;]+)/);
  if (m) {
    const hash = await sha256Hex(decodeURIComponent(m[1]));
    await c.env.DB.prepare(`DELETE FROM admin_sessions WHERE token_hash = ?`).bind(hash).run().catch(() => {});
  }
  c.header("Set-Cookie", `wr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return c.json({ ok: true });
});

authRoute.get("/me", adminAuthMiddleware, async (c) => {
  return c.json({ user: c.get("adminUser") });
});

authRoute.post("/password", adminAuthMiddleware, async (c) => {
  if ((c.env.DEMO_MODE ?? "").toLowerCase() === "true") {
    throw new AppError(403, "permission_error", "Password change is disabled on the public demo", "permission_error", false);
  }
  const body = await c.req.json().catch(() => null);
  const parsed = adminChangePasswordSchema.safeParse(body);
  if (!parsed.success) throw new AppError(400, "validation_error", "current and new password required", "validation_error", false);
  const user: any = await getAdminUser(c.env);
  if (!user) throw new AppError(404, "model_not_found", "Admin not found", "model_not_found", false);
  const ok = await verifyPassword(parsed.data.currentPassword, user.password_hash);
  if (!ok) throw new AppError(401, "authentication_error", "Current password is wrong", "authentication_error", false);
  await c.env.DB.prepare(`UPDATE admin_users SET password_hash = ? WHERE id = ?`)
    .bind(await hashPassword(parsed.data.newPassword), user.id).run();
  // Revoke all sessions after password change.
  await c.env.DB.prepare(`DELETE FROM admin_sessions WHERE user_id = ?`).bind(user.id).run().catch(() => {});
  c.header("Set-Cookie", `wr_session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
  return c.json({ ok: true });
});
