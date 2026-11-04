export interface ChatMessage {
  role: string;
  content: any;
  tool_calls?: any;
  tool_call_id?: string;
  name?: string;
}

export interface ChatCompletionRequest {
  model: string;
  messages: ChatMessage[];
  temperature?: number;
  top_p?: number;
  max_tokens?: number;
  max_completion_tokens?: number;
  stream?: boolean;
  stop?: string | string[];
  tools?: any[];
  tool_choice?: any;
  response_format?: any;
  user?: string;
}

export interface ProviderCapabilities {
  chat: boolean;
  streaming: boolean;
  tools: boolean;
  vision: boolean;
  embeddings: boolean;
  modelsList: boolean;
}

export interface NormalizedChatResponse {
  id: string;
  model: string;
  choices: Array<{
    index: number;
    message: { role: string; content: string | null; tool_calls?: any };
    finish_reason: string | null;
  }>;
  usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

export interface ProviderCallContext {
  providerId: string;
  providerName: string;
  providerType: string;
  baseUrl: string;
  credential: string | null;
  upstreamModel: string;
  timeoutMs: number;
  signal?: AbortSignal;
  env: any;
}

export interface ProviderAdapter {
  readonly type: string;
  capabilities(): ProviderCapabilities;
  chatCompletion(req: ChatCompletionRequest, ctx: ProviderCallContext): Promise<NormalizedChatResponse>;
  chatCompletionStream(req: ChatCompletionRequest, ctx: ProviderCallContext): Promise<Response>;
  listModels?(ctx: ProviderCallContext): Promise<Array<{ id: string }>>;
  embeddings?(input: string | string[], model: string, ctx: ProviderCallContext): Promise<any>;
  normalizeError(status: number, body: any): { retryable: boolean; category: string; message: string };
}
