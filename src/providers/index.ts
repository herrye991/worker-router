import type { ProviderAdapter } from "./provider-adapter";
import { OpenAICompatibleAdapter } from "./openai-compatible";
import { AnthropicAdapter } from "./anthropic";
import { GoogleAdapter } from "./google";
import { CloudflareAIAdapter } from "./cloudflare-ai";

const registry = new Map<string, ProviderAdapter>([
  ["openai-compatible", new OpenAICompatibleAdapter()],
  ["anthropic", new AnthropicAdapter()],
  ["google", new GoogleAdapter()],
  ["cloudflare-ai", new CloudflareAIAdapter()],
]);

export function getAdapter(type: string): ProviderAdapter {
  const a = registry.get(type);
  if (!a) throw new Error(`Unsupported provider type: ${type}`);
  return a;
}

export function listProviderTypes() {
  return [...registry.keys()];
}
