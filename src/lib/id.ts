export function newId(prefix = ""): string {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  const hex = [...arr].map((b) => b.toString(16).padStart(2, "0")).join("");
  return prefix ? `${prefix}_${hex}` : hex;
}

export function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}
export function nowMs(): number {
  return Date.now();
}
