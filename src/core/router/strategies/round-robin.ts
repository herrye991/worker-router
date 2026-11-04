import type { EligibleMember } from "./single";

// D1-backed round-robin: counter stored per group in routing_state.
// UPDATE ... SET counter = counter + 1 is atomic per statement in SQLite/D1.
// Consistency: best-effort rotation under concurrency; two concurrent
// requests may read adjacent counters but ordering is not strictly guaranteed.
// Throughput: one extra write per routed request; suitable for gateway scale,
// avoid per-chunk writes (only per request).
export async function nextRoundRobinIndex(db: any, groupId: string, size: number): Promise<number> {
  if (size <= 0) return 0;
  const now = Date.now();
  await db.run(`INSERT INTO routing_state (group_id, counter, updated_at) VALUES (?, 0, ?) ON CONFLICT(group_id) DO NOTHING`, [groupId, now]);
  await db.run(`UPDATE routing_state SET counter = counter + 1, updated_at = ? WHERE group_id = ?`, [now, groupId]);
  const row: any = await db.query(`SELECT counter FROM routing_state WHERE group_id = ?`, [groupId]);
  const counter = Number(row?.counter ?? row?.[0]?.counter ?? 0);
  return counter % size;
}

export function pickRoundRobin(members: EligibleMember[], counter: number): EligibleMember | null {
  if (!members.length) return null;
  const sorted = [...members].sort((a, b) => a.orderIndex - b.orderIndex);
  return sorted[counter % sorted.length] ?? null;
}
