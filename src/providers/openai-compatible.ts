import type {
  ChatCompletionRequest,
  NormalizedChatResponse,
  ProviderAdapter,
  ProviderCallContext,
  ProviderCapabilities,
} from "./provider-adapter";
import { AppError } from "../lib/errors";

function openAIError(status: number, body: any) {
  const msg = body?.error?.message ?? `Upstream error (${status})`;
  const retryable = status === 429 || status >= 500;
  const category = status === 401 || status === 403 ? "authentication_error" : status === 429 ? "rate_limit_exceeded" : "upstream_error";
  return { retryable, category, message: String(msg) };
}

export class OpenAICompatibleAdapter implements ProviderAdapter {
  readonly type = "openai-compatible";
  capabilities(): ProviderCapabilities {
    return { chat: true, streaming: true, tools: true, vision: true, embeddings: true, modelsList: true };
  }
  private headers(ctx: ProviderCallContext): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (ctx.credential) h["Authorization"] = `Bearer ${ctx.credential}`;
    return h;
  }
  async chatCompletion(req: ChatCompletionRequest, ctx: ProviderCallContext): Promise<NormalizedChatResponse> {
    const url = `${ctx.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const body: any = {
      model: ctx.upstreamModel,
      messages: req.messages,
      stream: false,
    };
    for (const k of ["temperature", "top_p", "max_tokens", "max_completion_tokens", "stop", "tools", "tool_choice", "response_format"] as const) {
      if ((req as any)[k] !== undefined) body[k] = (req as any)[k];
    }
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), ctx.timeoutMs);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: this.headers(ctx),
        body: JSON.stringify(body),
        signal: ctx.signal ?? ctrl.signal,
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        let parsed: any = text;
        try { parsed = JSON.parse(text); } catch { /* keep text */ }
        const n = openAIError(res.status, parsed);
        throw new AppError(res.status, n.category, n.message, n.category as any, n.retryable);
      }
      const json: any = await res.json();
      return {
        id: json.id ?? `chatcmpl-${crypto.randomUUID()}`,
        model: req.model,
        choices: json.choices ?? [],
        usage: json.usage,
      };
    } finally {
      clearTimeout(t);
    }
  }
  async chatCompletionStream(req: ChatCompletionRequest, ctx: ProviderCallContext): Promise<Response> {
    const url = `${ctx.baseUrl.replace(/\/$/, "")}/chat/completions`;
    const body: any = {
      model: ctx.upstreamModel,
      messages: req.messages,
      stream: true,
      stream_options: { include_usage: true },
    };
    for (const k of ["temperature", "top_p", "max_tokens", "max_completion_tokens", "stop", "tools", "tool_choice", "response_format"] as const) {
      if ((req as any)[k] !== undefined) body[k] = (req as any)[k];
    }
    const upstream = await fetch(url, {
      method: "POST",
      headers: { ...this.headers(ctx), Accept: "text/event-stream" },
      body: JSON.stringify(body),
      signal: ctx.signal,
    });
    if (!upstream.ok || !upstream.body) {
      const text = await upstream.text().catch(() => "");
      const n = openAIError(upstream.status, text);
      throw new AppError(upstream.status, n.category, n.message, n.category as any, n.retryable);
    }
    // Pass through SSE, rewriting model field to public alias.
    const publicModel = req.model;
    const transform = new TransformStream({
      transform(chunk, controller) {
        controller.enqueue(chunk);
      },
    });
    // Simple passthrough with model rewrite done lazily: pipe and patch `data:` lines containing "model".
    const reader = upstream.body.getReader();
    const writer = transform.writable.getWriter();
    const enc = new TextEncoder();
    const dec = new TextDecoder();
    (async () => {
      try {
        let buf = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          const lines = buf.split("\n");
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (line.startsWith("data: ") && line !== "data: [DONE]") {
              try {
                const j = JSON.parse(line.slice(6));
                if (j.model) j.model = publicModel;
                writer.write(enc.encode(`data: ${JSON.stringify(j)}\n`));
              } catch {
                writer.write(enc.encode(line + "\n"));
              }
            } else {
              writer.write(enc.encode(line + "\n"));
            }
          }
        }
        if (buf) writer.write(enc.encode(buf));
      } finally {
        try { writer.close(); } catch { /* noop */ }
      }
    })();
    return new Response(transform.readable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  }
  normalizeError(status: number, body: any) {
    return openAIError(status, body);
  }
}
