import type { ChatCompletionRequest, NormalizedChatResponse, ProviderAdapter, ProviderCallContext, ProviderCapabilities } from "./provider-adapter";
import { AppError } from "../lib/errors";

function toGeminiContents(req: ChatCompletionRequest) {
  const contents: any[] = [];
  for (const m of req.messages) {
    if (m.role === "system") continue;
    const role = m.role === "assistant" ? "model" : "user";
    const text = typeof m.content === "string" ? m.content : JSON.stringify(m.content);
    contents.push({ role, parts: [{ text }] });
  }
  const systemText = req.messages.filter((m) => m.role === "system").map((m) => typeof m.content === "string" ? m.content : JSON.stringify(m.content)).join("\n\n");
  return { contents, systemText };
}

export class GoogleAdapter implements ProviderAdapter {
  readonly type = "google";
  capabilities(): ProviderCapabilities {
    return { chat: true, streaming: true, tools: true, vision: true, embeddings: true, modelsList: true };
  }
  normalizeError(status: number, body: any) {
    const msg = body?.error?.message ?? `Google error (${status})`;
    return { retryable: status === 429 || status >= 500, category: status === 429 ? "rate_limit_exceeded" : "upstream_error", message: String(msg) };
  }
  async chatCompletion(req: ChatCompletionRequest, ctx: ProviderCallContext): Promise<NormalizedChatResponse> {
    const { contents, systemText } = toGeminiContents(req);
    const url = `${ctx.baseUrl.replace(/\/$/, "")}/models/${ctx.upstreamModel}:generateContent?key=${encodeURIComponent(ctx.credential ?? "")}`;
    const body: any = { contents, generationConfig: {} as any };
    if (systemText) body.systemInstruction = { parts: [{ text: systemText }] };
    if (req.temperature !== undefined) body.generationConfig.temperature = req.temperature;
    if (req.top_p !== undefined) body.generationConfig.topP = req.top_p;
    if (req.max_tokens ?? req.max_completion_tokens) body.generationConfig.maxOutputTokens = req.max_tokens ?? req.max_completion_tokens;
    if (req.stop) body.generationConfig.stopSequences = Array.isArray(req.stop) ? req.stop : [req.stop];
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ctx.timeoutMs);
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctx.signal ?? ctrl.signal });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const n = this.normalizeError(res.status, j);
        throw new AppError(res.status, n.category, n.message, n.category as any, n.retryable);
      }
      const j: any = await res.json();
      const text = (j.candidates?.[0]?.content?.parts ?? []).map((p: any) => p.text ?? "").join("");
      const usage = j.usageMetadata ? { prompt_tokens: j.usageMetadata.promptTokenCount ?? 0, completion_tokens: j.usageMetadata.candidatesTokenCount ?? 0, total_tokens: j.usageMetadata.totalTokenCount ?? 0 } : undefined;
      return {
        id: `chatcmpl-${crypto.randomUUID()}`,
        model: req.model,
        choices: [{ index: 0, message: { role: "assistant", content: text || null }, finish_reason: "stop" }],
        usage,
      };
    } finally {
      clearTimeout(t);
    }
  }
  async chatCompletionStream(req: ChatCompletionRequest, ctx: ProviderCallContext): Promise<Response> {
    const full = await this.chatCompletion(req, ctx);
    const content = full.choices[0]?.message?.content ?? "";
    const enc = new TextEncoder();
    const id = full.id;
    const stream = new ReadableStream({
      start(controller) {
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: req.model, choices: [{ index: 0, delta: { role: "assistant", content }, finish_reason: null }] })}\n\n`));
        controller.enqueue(enc.encode(`data: ${JSON.stringify({ id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: req.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }] })}\n\ndata: [DONE]\n\n`));
        controller.close();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
  }
}
