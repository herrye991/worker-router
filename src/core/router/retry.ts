export async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

export function jitteredDelay(baseMs: number, attempt: number): number {
  const exp = baseMs * Math.pow(2, attempt);
  const jitter = Math.random() * baseMs;
  return Math.min(exp + jitter, 10000);
}
