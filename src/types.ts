export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  AI?: any;
  ENCRYPTION_MASTER_KEY?: string;
  SESSION_SECRET?: string;
  ADMIN_PASSWORD?: string;
  ADMIN_BOOTSTRAP_PASSWORD?: string;
  APP_NAME?: string;
  ENVIRONMENT?: string;
  DEMO_MODE?: string;
}

export interface AppVariables {
  requestId: string;
  apiKey?: { id: string; name: string; allowedModels: string[]; permissions: { chat: boolean; embeddings: boolean } };
  apiKeyRow?: any;
  adminUser?: { id: string; role: string };
}

export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

export type ProviderType = "openai-compatible" | "anthropic" | "google" | "cloudflare-ai";
export type RoutingStrategy = "single" | "round-robin" | "weighted" | "fallback" | "fusion" | "smart";
export type ErrorCategory =
  | "authentication_error"
  | "permission_error"
  | "validation_error"
  | "model_not_found"
  | "provider_unavailable"
  | "provider_timeout"
  | "rate_limit_exceeded"
  | "upstream_error"
  | "unsupported_capability"
  | "internal_error";
