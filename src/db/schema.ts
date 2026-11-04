import { sqliteTable, text, integer, real } from "drizzle-orm/sqlite-core";

export const adminUsers = sqliteTable("admin_users", {
  id: text("id").primaryKey(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default("admin"),
  createdAt: integer("created_at").notNull(),
});

export const adminSessions = sqliteTable("admin_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => adminUsers.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  type: text("type").notNull(),
  baseUrl: text("base_url").notNull(),
  authType: text("auth_type").notNull().default("bearer"),
  encryptedCredential: text("encrypted_credential"),
  enabled: integer("enabled").notNull().default(1),
  timeoutMs: integer("timeout_ms").notNull().default(60000),
  retryConfig: text("retry_config").notNull().default("{}"),
  concurrencyLimit: integer("concurrency_limit").notNull().default(10),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const models = sqliteTable("models", {
  id: text("id").primaryKey(),
  publicName: text("public_name").notNull().unique(),
  providerId: text("provider_id").notNull().references(() => providers.id, { onDelete: "cascade" }),
  providerModelId: text("provider_model_id").notNull(),
  enabled: integer("enabled").notNull().default(1),
  contextWindow: integer("context_window"),
  capabilities: text("capabilities").notNull().default('{"chat":true}'),
  cost: text("cost").notNull().default("{}"),
  weight: integer("weight").notNull().default(1),
  priority: integer("priority").notNull().default(0),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const routingGroups = sqliteTable("routing_groups", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  publicAlias: text("public_alias").notNull().unique(),
  strategy: text("strategy").notNull().default("fallback"),
  enabled: integer("enabled").notNull().default(1),
  fallbackPolicy: text("fallback_policy").notNull().default("{}"),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const routingGroupMembers = sqliteTable("routing_group_members", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull().references(() => routingGroups.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull().references(() => models.id, { onDelete: "cascade" }),
  weight: integer("weight").notNull().default(1),
  priority: integer("priority").notNull().default(0),
  orderIndex: integer("order_index").notNull().default(0),
});

export const apiKeys = sqliteTable("api_keys", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  prefix: text("prefix").notNull(),
  keyHash: text("key_hash").notNull().unique(),
  permissions: text("permissions").notNull().default('{"chat":true,"embeddings":false}'),
  allowedModels: text("allowed_models").notNull().default("[]"),
  expiresAt: integer("expires_at"),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").notNull().default(0),
  enabled: integer("enabled").notNull().default(1),
  lastUsedAt: integer("last_used_at"),
  createdAt: integer("created_at").notNull(),
});

export const routingState = sqliteTable("routing_state", {
  groupId: text("group_id").primaryKey(),
  counter: integer("counter").notNull().default(0),
  updatedAt: integer("updated_at").notNull(),
});

export const requestLogs = sqliteTable("request_logs", {
  id: text("id").primaryKey(),
  requestId: text("request_id").notNull(),
  timestamp: integer("timestamp").notNull(),
  apiKeyId: text("api_key_id"),
  requestedModel: text("requested_model"),
  selectedProvider: text("selected_provider"),
  selectedUpstreamModel: text("selected_upstream_model"),
  routingStrategy: text("routing_strategy"),
  durationMs: integer("duration_ms"),
  ttfbMs: integer("ttfb_ms"),
  status: integer("status"),
  inputTokens: integer("input_tokens"),
  outputTokens: integer("output_tokens"),
  retryCount: integer("retry_count").notNull().default(0),
  errorCategory: text("error_category"),
  estimatedCost: real("estimated_cost"),
});

export const applicationSettings = sqliteTable("application_settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
  updatedAt: integer("updated_at").notNull(),
});
