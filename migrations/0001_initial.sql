CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'admin',
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_admin_sessions_user ON admin_sessions(user_id);

CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  base_url TEXT NOT NULL,
  auth_type TEXT NOT NULL DEFAULT 'bearer',
  encrypted_credential TEXT,
  enabled INTEGER NOT NULL DEFAULT 1,
  timeout_ms INTEGER NOT NULL DEFAULT 60000,
  retry_config TEXT NOT NULL DEFAULT '{}',
  concurrency_limit INTEGER NOT NULL DEFAULT 10,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS models (
  id TEXT PRIMARY KEY,
  public_name TEXT NOT NULL UNIQUE,
  provider_id TEXT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
  provider_model_id TEXT NOT NULL,
  enabled INTEGER NOT NULL DEFAULT 1,
  context_window INTEGER,
  capabilities TEXT NOT NULL DEFAULT '{"chat":true}',
  cost TEXT NOT NULL DEFAULT '{}',
  weight INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_models_provider ON models(provider_id);

CREATE TABLE IF NOT EXISTS routing_groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  public_alias TEXT NOT NULL UNIQUE,
  strategy TEXT NOT NULL DEFAULT 'fallback',
  enabled INTEGER NOT NULL DEFAULT 1,
  fallback_policy TEXT NOT NULL DEFAULT '{}',
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routing_group_members (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL REFERENCES routing_groups(id) ON DELETE CASCADE,
  model_id TEXT NOT NULL REFERENCES models(id) ON DELETE CASCADE,
  weight INTEGER NOT NULL DEFAULT 1,
  priority INTEGER NOT NULL DEFAULT 0,
  order_index INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_rgm_group ON routing_group_members(group_id);

CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  permissions TEXT NOT NULL DEFAULT '{"chat":true}',
  allowed_models TEXT NOT NULL DEFAULT '[]',
  expires_at INTEGER,
  usage_limit INTEGER,
  usage_count INTEGER NOT NULL DEFAULT 0,
  enabled INTEGER NOT NULL DEFAULT 1,
  last_used_at INTEGER,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS routing_state (
  group_id TEXT PRIMARY KEY,
  counter INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS request_logs (
  id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  timestamp INTEGER NOT NULL,
  api_key_id TEXT,
  requested_model TEXT,
  selected_provider TEXT,
  selected_upstream_model TEXT,
  routing_strategy TEXT,
  duration_ms INTEGER,
  ttfb_ms INTEGER,
  status INTEGER,
  input_tokens INTEGER,
  output_tokens INTEGER,
  retry_count INTEGER NOT NULL DEFAULT 0,
  error_category TEXT,
  estimated_cost REAL
);
CREATE INDEX IF NOT EXISTS idx_logs_time ON request_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_model ON request_logs(requested_model);
CREATE INDEX IF NOT EXISTS idx_logs_provider ON request_logs(selected_provider);
CREATE INDEX IF NOT EXISTS idx_logs_status ON request_logs(status);

CREATE TABLE IF NOT EXISTS application_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
