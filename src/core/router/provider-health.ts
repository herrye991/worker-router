// Provider health: lightweight in-memory + D1 error tracking.
// Workers isolates do not share memory; this cache is per-isolate best-effort.
// D1 request_logs remain source of truth for analytics.

interface HealthEntry {
  consecutiveFailures: number;
  lastFailureAt: number;
  cooldownUntil: number;
}

const cache = new Map<string, HealthEntry>();

export function recordFailure(providerId: string, cooldownMs = 30000) {
  const e = cache.get(providerId) ?? { consecutiveFailures: 0, lastFailureAt: 0, cooldownUntil: 0 };
  e.consecutiveFailures++;
  e.lastFailureAt = Date.now();
  if (e.consecutiveFailures >= 3) e.cooldownUntil = Date.now() + cooldownMs;
  cache.set(providerId, e);
}

export function recordSuccess(providerId: string) {
  cache.delete(providerId);
}

export function isCoolingDown(providerId: string): boolean {
  const e = cache.get(providerId);
  if (!e) return false;
  if (Date.now() > e.cooldownUntil) {
    cache.delete(providerId);
    return false;
  }
  return e.cooldownUntil > 0;
}
