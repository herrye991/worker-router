import type { ChatCompletionRequest, NormalizedChatResponse, ProviderAdapter, ProviderCallContext, ProviderCapabilities } from "./provider-adapter";
import { AppError } from "../lib/errors";

// Cloudflare Workers AI binding (@cf/...) via env.AI.
export class CloudflareAIAdapter implements ProviderAdapter {
  readonly type = "cloudflare-ai";
  capabilities(): ProviderCapabilities {
    return { chat: true, streaming: true, tools: false, vision: false, embeddings: true, modelsList: false };
  }
  normalizeError(status: number, body: any) {
    return { retryable: status === 429 || status >= 500, category: "upstream_error", message: String(body?.error ?? body ?? `Workers AI error (${status})`) };
  }
  async chatCompletion(req: ChatCompletionRequest, ctx: ProviderCallContext): Promise<NormalizedChatResponse> {
    const ai = (ctx.env as any)?.AI;
    if (!ai) throw new AppError(500, "provider_unavailable", "Workers AI binding not configured", "provider_unavailable", false);
    const messages = req.messages.map((m) => ({ role: m.role, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }));
    try {
      const out: any = await ai.run(ctx.upstreamModel, { messages, temperature: req.temperature, max_tokens: req.max_tokens ?? req.max_completion_tokens });
      const text = typeof out?.response === "string" ? out.response : (out?.choices?.[0]?.message?.content ?? JSON.stringify(out));
      return {
        id: `chatcmpl-${crypto.randomUUID()}`,
        model: req.model,
        choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }],
        usage: undefined,
      };
    } catch (e: any) {
      throw new AppError(502, "upstream_error", e?.message ?? "Workers AI failed", "upstream_error", true);
    }
  }
  async chatCompletionStream(req: ChatCompletionRequest, ctx: ProviderCallContext): Promise<Response> {
    const full = await this.chatCompletion(req, ctx);
    const content = full.choices[0]?.message?.content ?? "";
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ id: full.id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: req.model, choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\n`));
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ id: full.id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: req.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
  }
}
