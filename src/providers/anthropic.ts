import type { ChatCompletionRequest, NormalizedChatResponse, ProviderAdapter, ProviderCallContext, ProviderCapabilities } from "./provider-adapter";
import { AppError } from "../lib/errors";

function toAnthropicMessages(req: ChatCompletionRequest) {
  const system: string[] = [];
  const messages: any[] = [];
  for (const m of req.messages) {
    if (m.role === "system") {
      system.push(typeof m.content === "string" ? m.content : JSON.stringify(m.content));
    } else if (m.role === "tool") {
      messages.push({ role: "user", content: [{ type: "tool_result", tool_use_id: (m as any).tool_call_id, content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) }] });
    } else if (m.role === "assistant" && (m as any).tool_calls) {
      const blocks: any[] = [];
      if (m.content) blocks.push({ type: "text", text: String(m.content) });
      for (const tc of (m as any).tool_calls) {
        blocks.push({ type: "tool_use", id: tc.id, name: tc.function?.name ?? tc.name, input: (() => { try { return JSON.parse(tc.function?.arguments ?? "{}"); } catch { return {}; } })() });
      }
      messages.push({ role: "assistant", content: blocks });
    } else {
      messages.push({ role: m.role === "assistant" ? "assistant" : "user", content: typeof m.content === "string" ? m.content : JSON.stringify(m.content) });
    }
  }
  return { system: system.join("\n\n") || undefined, messages };
}

export class AnthropicAdapter implements ProviderAdapter {
  readonly type = "anthropic";
  capabilities(): ProviderCapabilities {
    return { chat: true, streaming: true, tools: true, vision: true, embeddings: false, modelsList: true };
  }
  normalizeError(status: number, body: any) {
    const msg = body?.error?.message ?? `Anthropic error (${status})`;
    return { retryable: status === 429 || status >= 500, category: status === 429 ? "rate_limit_exceeded" : "upstream_error", message: String(msg) };
  }
  async chatCompletion(req: ChatCompletionRequest, ctx: ProviderCallContext): Promise<NormalizedChatResponse> {
    const { system, messages } = toAnthropicMessages(req);
    const url = `${ctx.baseUrl.replace(/\/$/, "")}/messages`;
    const body: any = {
      model: ctx.upstreamModel,
      messages,
      max_tokens: req.max_tokens ?? req.max_completion_tokens ?? 1024,
    };
    if (system) body.system = system;
    if (req.temperature !== undefined) body.temperature = req.temperature;
    if (req.top_p !== undefined) body.top_p = req.top_p;
    if (req.stop) body.stop_sequences = Array.isArray(req.stop) ? req.stop : [req.stop];
    if (req.tools) {
      body.tools = req.tools.map((t: any) => t.function ? { name: t.function.name, description: t.function.description, input_schema: t.function.parameters ?? { type: "object" } } : t);
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ctx.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": ctx.credential ?? "",
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify(body),
        signal: ctx.signal ?? ctrl.signal,
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        const n = this.normalizeError(res.status, j);
        throw new AppError(res.status, n.category, n.message, n.category as any, n.retryable);
      }
      const j: any = await res.json();
      const text = (j.content ?? []).filter((b: any) => b.type === "text").map((b: any) => b.text).join("");
      const toolCalls = (j.content ?? []).filter((b: any) => b.type === "tool_use").map((b: any, i: number) => ({
        id: b.id ?? `call_${i}`, type: "function", function: { name: b.name, arguments: JSON.stringify(b.input ?? {}) },
      }));
      return {
        id: j.id ?? `chatcmpl-${crypto.randomUUID()}`,
        model: req.model,
        choices: [{ index: 0, message: { role: "assistant", content: text || null, ...(toolCalls.length ? { tool_calls: toolCalls } : {}) }, finish_reason: j.stop_reason === "end_turn" ? "stop" : (j.stop_reason ?? "stop") }],
        usage: j.usage ? { prompt_tokens: j.usage.input_tokens ?? 0, completion_tokens: j.usage.output_tokens ?? 0, total_tokens: (j.usage.input_tokens ?? 0) + (j.usage.output_tokens ?? 0) } : undefined,
      };
    } finally {
      clearTimeout(t);
    }
  }
  async chatCompletionStream(req: ChatCompletionRequest, ctx: ProviderCallContext): Promise<Response> {
    // Normalize by requesting non-streaming then re-emitting as SSE (Anthropic SSE differs).
    // For true passthrough fidelity, providers that need native SSE can extend here.
    const full = await this.chatCompletion(req, ctx);
    const content = full.choices[0]?.message?.content ?? "";
    const id = full.id;
    const enc = new TextEncoder();
    const stream = new ReadableStream({
      start(controller) {
        const words = String(content).split(/(?<=\s)/);
        let i = 0;
        const tick = () => {
          if (i < words.length) {
            const chunk = { id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: req.model, choices: [{ index: 0, delta: { role: i === 0 ? "assistant" : undefined, content: words[i] }, finish_reason: null }] };
            controller.enqueue(enc.encode(`data: ${JSON.stringify(chunk)}\n\n`));
            i++;
            setTimeout(tick, 1);
          } else {
            const done = { id, object: "chat.completion.chunk", created: Math.floor(Date.now() / 1000), model: req.model, choices: [{ index: 0, delta: {}, finish_reason: "stop" }], usage: full.usage };
            controller.enqueue(enc.encode(`data: ${JSON.stringify(done)}\n\ndata: [DONE]\n\n`));
            controller.close();
          }
        };
        tick();
      },
    });
    return new Response(stream, { headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", Connection: "keep-alive" } });
  }
}
