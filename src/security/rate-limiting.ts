// D1-backed fixed-window rate limiter.
// Notes: one write per request per key; contention is acceptable at gateway scale.
// For high-throughput deployments, front with Cloudflare Rate Limiting rules.
export async function checkRateLimit(db: D1Database, key: string, limit: number, windowSec: number): Promise<{ allowed: boolean; remaining: number }> {
  const now = Math.floor(Date.now() / 1000);
  const windowStart = now - (now % windowSec);
  const id = `rl:${key}:${windowStart}`;
  await db.prepare(
    `INSERT INTO application_settings (key, value, updated_at) VALUES (?, '1', ?) ON CONFLICT(key) DO NOTHING`
  ).bind(id, now).run().catch(() => {});
  // Use request_logs-independent counter via settings table to avoid extra tables.
  const row: any = await db.prepare(`SELECT value FROM application_settings WHERE key = ?`).bind(id).first().catch(() => null);
  const count = Number(row?.value ?? 1);
  if (count > limit) return { allowed: false, remaining: 0 };
  await db.prepare(`UPDATE application_settings SET value = ?, updated_at = ? WHERE key = ?`).bind(String(count + 1), now, id).run().catch(() => {});
  return { allowed: true, remaining: Math.max(0, limit - count) };
}
