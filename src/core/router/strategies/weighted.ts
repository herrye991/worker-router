import type { EligibleMember } from "./single";

// Smooth weighted round-robin using D1 counter (same atomicity notes as round-robin).
// Over N requests distribution ~= weight_i / total. Not exact over small samples.
export function pickWeighted(members: EligibleMember[], counter: number): EligibleMember | null {
  const eligible = members.filter((m) => m.weight > 0);
  if (!eligible.length) return null;
  const total = eligible.reduce((s, m) => s + m.weight, 0);
  let slot = ((counter % total) + total) % total;
  const sorted = [...eligible].sort((a, b) => a.orderIndex - b.orderIndex);
  for (const m of sorted) {
    if (slot < m.weight) return m;
    slot -= m.weight;
  }
  return sorted[0] ?? null;
}
