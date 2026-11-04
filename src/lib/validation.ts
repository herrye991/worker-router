import { z } from "zod";

export const providerCreateSchema = z.object({
  name: z.string().min(1).max(100),
  type: z.enum(["openai-compatible", "anthropic", "google", "cloudflare-ai"]),
  baseUrl: z.string().url().or(z.string().min(1)),
  authType: z.enum(["bearer", "api-key", "oauth", "none"]).default("bearer"),
  credential: z.string().optional(),
  enabled: z.boolean().default(true),
  timeoutMs: z.number().int().min(1000).max(300000).default(60000),
  retryConfig: z.object({
    maxAttempts: z.number().int().min(1).max(5).default(3),
    retryableStatuses: z.array(z.number()).default([429, 500, 502, 503, 504]),
    baseDelayMs: z.number().default(300),
  }).default({}),
  concurrencyLimit: z.number().int().min(1).max(100).default(10),
});

export const modelCreateSchema = z.object({
  publicName: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._\-\/:]+$/),
  providerId: z.string().min(1),
  providerModelId: z.string().min(1),
  enabled: z.boolean().default(true),
  contextWindow: z.number().int().positive().optional(),
  capabilities: z.object({
    chat: z.boolean().default(true),
    streaming: z.boolean().default(true),
    tools: z.boolean().default(false),
    vision: z.boolean().default(false),
    embeddings: z.boolean().default(false),
  }).default({}),
  cost: z.object({
    inputPer1k: z.number().default(0),
    outputPer1k: z.number().default(0),
  }).default({}),
  weight: z.number().int().min(1).max(100).default(1),
  priority: z.number().int().min(0).max(100).default(0),
});

export const routingGroupCreateSchema = z.object({
  name: z.string().min(1).max(100),
  publicAlias: z.string().min(1).max(100).regex(/^[a-zA-Z0-9._\-\/:]+$/),
  strategy: z.enum(["single", "round-robin", "weighted", "fallback", "fusion", "smart"]).default("fallback"),
  enabled: z.boolean().default(true),
  members: z.array(z.object({
    modelId: z.string().min(1),
    weight: z.number().int().min(1).max(100).default(1),
    priority: z.number().int().min(0).max(100).default(0),
    orderIndex: z.number().int().min(0).default(0),
  })).min(1),
  fallbackPolicy: z.object({
    maxAttempts: z.number().int().min(1).max(10).default(3),
    retryableStatuses: z.array(z.number()).default([429, 500, 502, 503, 504]),
    baseDelayMs: z.number().default(300),
    deadlineMs: z.number().default(120000),
  }).default({}),
});

export const apiKeyCreateSchema = z.object({
  name: z.string().min(1).max(100),
  allowedModels: z.array(z.string()).default([]),
  expiresAt: z.number().int().positive().optional(),
  usageLimit: z.number().int().positive().optional(),
  permissions: z.object({
    chat: z.boolean().default(true),
    embeddings: z.boolean().default(false),
  }).default({}),
});

export const chatCompletionSchema = z.object({
  model: z.string().min(1),
  messages: z.array(z.object({
    role: z.string(),
    content: z.any(),
    tool_calls: z.any().optional(),
    tool_call_id: z.string().optional(),
    name: z.string().optional(),
  })).min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  max_tokens: z.number().int().positive().optional(),
  max_completion_tokens: z.number().int().positive().optional(),
  stream: z.boolean().default(false),
  stop: z.union([z.string(), z.array(z.string())]).optional(),
  tools: z.array(z.any()).optional(),
  tool_choice: z.any().optional(),
  response_format: z.any().optional(),
  user: z.string().optional(),
});

export const adminLoginSchema = z.object({
  password: z.string().min(1),
});

export const adminChangePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(6).max(200),
});
