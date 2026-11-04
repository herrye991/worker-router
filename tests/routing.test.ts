import { describe, it, expect, vi } from "vitest";
import { pickSingle, orderByPriority } from "../src/core/router/strategies/single";
import { pickRoundRobin } from "../src/core/router/strategies/round-robin";
import { pickWeighted } from "../src/core/router/strategies/weighted";
import { fallbackOrder, isRetryable } from "../src/core/router/strategies/fallback";
import { planTargetsForTest } from "./helpers";

function member(id: string, weight = 1, priority = 0, order = 0) {
  return {
    modelId: id, publicName: id, providerId: `p_${id}`, providerName: id,
    providerType: "openai-compatible", baseUrl: "https://x.test", upstreamModel: id,
    weight, priority, orderIndex: order, timeoutMs: 5000,
  };
}

describe("single routing", () => {
  it("picks highest priority", () => {
    const m = [member("a", 1, 0, 1), member("b", 1, 5, 0)];
    expect(pickSingle(m)?.modelId).toBe("b");
  });
  it("returns null when empty", () => {
    expect(pickSingle([])).toBeNull();
  });
});

describe("round-robin", () => {
  it("rotates across members", () => {
    const m = [member("a", 1, 0, 0), member("b", 1, 0, 1), member("c", 1, 0, 2)];
    expect(pickRoundRobin(m, 0)?.modelId).toBe("a");
    expect(pickRoundRobin(m, 1)?.modelId).toBe("b");
    expect(pickRoundRobin(m, 2)?.modelId).toBe("c");
    expect(pickRoundRobin(m, 3)?.modelId).toBe("a");
  });
});

describe("weighted", () => {
  it("distributes ~50/30/20 over 100 requests", () => {
    const m = [member("a", 5, 0, 0), member("b", 3, 0, 1), member("c", 2, 0, 2)];
    const counts: Record<string, number> = { a: 0, b: 0, c: 0 };
    for (let i = 0; i < 100; i++) counts[pickWeighted(m, i)!.modelId]++;
    expect(counts.a).toBe(50);
    expect(counts.b).toBe(30);
    expect(counts.c).toBe(20);
  });
  it("ignores zero-weight members", () => {
    const m = [member("a", 0), member("b", 1)];
    expect(pickWeighted(m, 0)?.modelId).toBe("b");
  });
});

describe("fallback", () => {
  it("orders by priority then order", () => {
    const m = [member("a", 1, 0, 1), member("b", 1, 1, 5)];
    expect(fallbackOrder(m).map((x) => x.modelId)).toEqual(["b", "a"]);
  });
  it("retryable statuses respected", () => {
    const policy = { maxAttempts: 3, retryableStatuses: [429, 502], baseDelayMs: 1, deadlineMs: 1000 };
    expect(isRetryable(429, policy)).toBe(true);
    expect(isRetryable(400, policy)).toBe(false);
  });
  it("no fallback after non-retryable", () => {
    expect(planTargetsForTest("non-retryable")).toBe("stop");
  });
  it("fallback after retryable", () => {
    expect(planTargetsForTest("retryable")).toBe("continue");
  });
});
