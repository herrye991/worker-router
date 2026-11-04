import { Hono } from "hono";
import type { AppEnv } from "../types";

// Local-only mock OpenAI-compatible upstream for deterministic testing.
// Not for production use.
export const mockUpstreamRoute = new Hono<AppEnv>();

mockUpstreamRoute.get("/models", (c) => {
  return c.json({
    object: "list",
    data: [{ id: "mock-chat-v1", object: "model", created: Math.floor(Date.now() / 1000), owned_by: "mock" }],
  });
});

mockUpstreamRoute.post("/chat/completions", async (c) => {
  const body: any = await c.req.json().catch(() => ({}));
  const model = body?.model ?? "mock-chat-v1";
  const lastUser = Array.isArray(body?.messages)
    ? [...body.messages].reverse().find((m: any) => m?.role === "user")
    : null;
  const text = typeof lastUser?.content === "string" ? lastUser.content : "hello";
  const reply = `Mock reply to: ${text}`;
  const id = `chatcmpl-mock-${crypto.randomUUID()}`;
  const created = Math.floor(Date.now() / 1000);

  if (body?.stream === true) {
    const enc = new TextEncoder();
    const parts = ["Mock ", "reply ", `to: ${text}`];
    const stream = new ReadableStream({
      start(controller) {
        for (const p of parts) {
          controller.enqueue(enc.encode(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: { role: "assistant", content: p }, finish_reason: null }] })}\n\n`));
        }
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created, model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(stream, {
      headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" },
    });
  }

  return c.json({
    id,
    object: "chat.completion",
    created,
    model,
    choices: [{ index: 0, message: { role: "assistant", content: reply }, finish_reason: "stop" }],
    usage: { prompt_tokens: 5, completion_tokens: 5, total_tokens: 10 },
  });
});
