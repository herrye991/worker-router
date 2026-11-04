import { describe, it, expect, vi } from "vitest";
import { OpenAICompatibleAdapter } from "../src/providers/openai-compatible";
import { AppError } from "../src/lib/errors";

function ctx(overrides: any = {}) {
  return {
    providerId: "p1", providerName: "P1", providerType: "openai-compatible",
    baseUrl: "https://upstream.test/v1", credential: "sk-test",
    upstreamModel: "gpt-test", timeoutMs: 5000, env: {}, ...overrides,
  };
}

describe("openai-compatible adapter with mock provider", () => {
  it("normalizes chat completion", async () => {
    const adapter = new OpenAICompatibleAdapter();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({
      id: "chatcmpl-1", choices: [{ index: 0, message: { role: "assistant", content: "hi" }, finish_reason: "stop" }],
      usage: { prompt_tokens: 5, completion_tokens: 2, total_tokens: 7 },
    }), { status: 200, headers: { "Content-Type": "application/json" } }));
    const out = await adapter.chatCompletion({ model: "alias", messages: [{ role: "user", content: "hi" }] }, ctx());
    expect(out.model).toBe("alias");
    expect(out.choices[0].message.content).toBe("hi");
    vi.unstubAllGlobals();
  });

  it("throws retryable AppError on 502", async () => {
    const adapter = new OpenAICompatibleAdapter();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "bad gateway" } }), { status: 502 }));
    try {
      await adapter.chatCompletion({ model: "alias", messages: [{ role: "user", content: "hi" }] }, ctx());
      expect.unreachable();
    } catch (e: any) {
      expect(e).toBeInstanceOf(AppError);
      expect(e.retryable).toBe(true);
    }
    vi.unstubAllGlobals();
  });

  it("throws non-retryable on 401", async () => {
    const adapter = new OpenAICompatibleAdapter();
    vi.stubGlobal("fetch", async () => new Response(JSON.stringify({ error: { message: "unauthorized" } }), { status: 401 }));
    try {
      await adapter.chatCompletion({ model: "alias", messages: [{ role: "user", content: "hi" }] }, ctx());
      expect.unreachable();
    } catch (e: any) {
      expect(e.retryable).toBe(false);
    }
    vi.unstubAllGlobals();
  });

  it("streams SSE with public model name", async () => {
    const adapter = new OpenAICompatibleAdapter();
    const sse = `data: {"id":"1","model":"gpt-test","choices":[{"index":0,"delta":{"content":"he"}}]}\n\ndata: [DONE]\n\n`;
    vi.stubGlobal("fetch", async () => new Response(sse, { status: 200, headers: { "Content-Type": "text/event-stream" } }));
    const res = await adapter.chatCompletionStream({ model: "alias", messages: [{ role: "user", content: "hi" }], stream: true }, ctx());
    expect(res.headers.get("Content-Type")).toContain("text/event-stream");
    const text = await res.text();
    expect(text).toContain("alias");
    vi.unstubAllGlobals();
  });
});
