// Authenticated encryption for provider credentials using AES-GCM.
// Master key comes from Worker secret ENCRYPTION_MASTER_KEY (base64, 32 bytes).
// Format: base64(iv).base64(ciphertext)

function b64encode(buf: ArrayBuffer | Uint8Array<ArrayBuffer>): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}
function b64decode(s: string): Uint8Array<ArrayBuffer> {
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function importMasterKey(base64Key: string): Promise<CryptoKey> {
  const raw = b64decode(base64Key);
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

export async function encryptCredential(plaintext: string, base64MasterKey: string): Promise<string> {
  const key = await importMasterKey(base64MasterKey);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, new TextEncoder().encode(plaintext));
  return `${b64encode(iv)}.${b64encode(ct)}`;
}

export async function decryptCredential(payload: string, base64MasterKey: string): Promise<string> {
  const [ivB64, ctB64] = payload.split(".");
  if (!ivB64 || !ctB64) throw new Error("Invalid encrypted payload");
  const key = await importMasterKey(base64MasterKey);
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64decode(ivB64) }, key, b64decode(ctB64));
  return new TextDecoder().decode(pt);
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Password hashing via PBKDF2-SHA256 (Workers SubtleCrypto compatible).
export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations: 100_000, hash: "SHA-256" }, key, 256);
  return `pbkdf2$100000$${b64encode(salt)}$${b64encode(bits)}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  try {
    const [, iterStr, saltB64, hashB64] = stored.split("$");
    const iterations = parseInt(iterStr, 10);
    const salt = b64decode(saltB64);
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", salt, iterations, hash: "SHA-256" }, key, 256);
    return b64encode(bits) === hashB64;
  } catch {
    return false;
  }
}

export function generateClientKey(): { key: string; prefix: string } {
  const bytes = crypto.getRandomValues(new Uint8Array(32) as Uint8Array<ArrayBuffer>);
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  const b64url = btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const key = `wr-${b64url}`;
  return { key, prefix: key.slice(0, 11) };
}
