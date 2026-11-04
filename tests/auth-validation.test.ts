import { describe, it, expect } from "vitest";
import { chatCompletionSchema, providerCreateSchema, modelCreateSchema, routingGroupCreateSchema, adminLoginSchema } from "../src/lib/validation";
import { AppError, isRetryableStatus } from "../src/lib/errors";
import { sha256Hex, generateClientKey, hashPassword, verifyPassword } from "../src/lib/crypto";

describe("validation", () => {
  it("rejects chat completion without model", () => {
    expect(chatCompletionSchema.safeParse({ messages: [] }).success).toBe(false);
  });
  it("accepts minimal chat completion", () => {
    expect(chatCompletionSchema.safeParse({ model: "x", messages: [{ role: "user", content: "hi" }] }).success).toBe(true);
  });
  it("rejects invalid provider type", () => {
    expect(providerCreateSchema.safeParse({ name: "p", type: "nope", baseUrl: "https://x" }).success).toBe(false);
  });
  it("rejects duplicate-unsafe alias chars", () => {
    expect(modelCreateSchema.safeParse({ publicName: "bad name!", providerId: "p", providerModelId: "m" }).success).toBe(false);
  });
  it("requires routing group members", () => {
    expect(routingGroupCreateSchema.safeParse({ name: "g", publicAlias: "g", members: [] }).success).toBe(false);
  });
  it("admin login is password-only", () => {
    expect(adminLoginSchema.safeParse({ password: "123456" }).success).toBe(true);
    expect(adminLoginSchema.safeParse({}).success).toBe(false);
    expect(adminLoginSchema.safeParse({ password: "" }).success).toBe(false);
  });
});

describe("errors", () => {
  it("marks 429/5xx retryable", () => {
    expect(isRetryableStatus(429)).toBe(true);
    expect(isRetryableStatus(400)).toBe(false);
  });
  it("AppError carries category", () => {
    const e = new AppError(401, "authentication_error", "no", "authentication_error", false);
    expect(e.retryable).toBe(false);
  });
});

describe("crypto", () => {
  it("hashes and verifies password", async () => {
    const h = await hashPassword("secret123");
    expect(await verifyPassword("secret123", h)).toBe(true);
    expect(await verifyPassword("wrong", h)).toBe(false);
  });
  it("generates unique client keys", () => {
    const a = generateClientKey();
    const b = generateClientKey();
    expect(a.key).not.toBe(b.key);
    expect(a.key.startsWith("wr-")).toBe(true);
  });
  it("sha256 stable", async () => {
    expect(await sha256Hex("abc")).toBe(await sha256Hex("abc"));
  });
});
