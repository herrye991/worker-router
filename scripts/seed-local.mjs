// Generates scripts/seed-local.sql with a known dev API key hash.
// Run: npm run seed:local
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";

const DEV_KEY = "wr-local-dev-key-0123456789abcdef";
const hash = createHash("sha256").update(DEV_KEY).digest("hex");
const now = Math.floor(Date.now() / 1000);

const sql = `-- Local seed (deterministic, dev only)
INSERT OR REPLACE INTO providers (id, name, type, base_url, auth_type, encrypted_credential, enabled, timeout_ms, retry_config, concurrency_limit, created_at, updated_at)
VALUES ('prov_mock', 'Local Mock', 'openai-compatible', 'http://localhost:8787/mock-upstream', 'bearer', NULL, 1, 15000, '{"maxAttempts":3,"retryableStatuses":[429,500,502,503,504],"baseDelayMs":100}', 10, ${now}, ${now});

INSERT OR REPLACE INTO models (id, public_name, provider_id, provider_model_id, enabled, context_window, capabilities, cost, weight, priority, created_at, updated_at)
VALUES ('model_mock', 'mock-chat', 'prov_mock', 'mock-chat-v1', 1, 8192, '{"chat":true,"streaming":true,"tools":false,"vision":false,"embeddings":false}', '{"inputPer1k":0,"outputPer1k":0}', 1, 0, ${now}, ${now});

INSERT OR REPLACE INTO routing_groups (id, name, public_alias, strategy, enabled, fallback_policy, created_at, updated_at)
VALUES ('grp_fast', 'Fast Chat', 'fast-chat', 'fallback', 1, '{"maxAttempts":3,"retryableStatuses":[429,500,502,503,504],"baseDelayMs":100,"deadlineMs":60000}', ${now}, ${now});

DELETE FROM routing_group_members WHERE group_id = 'grp_fast';
INSERT INTO routing_group_members (id, group_id, model_id, weight, priority, order_index)
VALUES ('grm_fast_1', 'grp_fast', 'model_mock', 1, 0, 0);

INSERT OR REPLACE INTO api_keys (id, name, prefix, key_hash, permissions, allowed_models, expires_at, usage_limit, usage_count, enabled, last_used_at, created_at)
VALUES ('key_local', 'Local Dev Key', 'wr-local-de', '${hash}', '{"chat":true,"embeddings":false}', '[]', NULL, NULL, 0, 1, NULL, ${now});
`;

writeFileSync(new URL("./seed-local.sql", import.meta.url), sql);
console.log("Wrote scripts/seed-local.sql");
console.log(`DEV API KEY (use as Bearer): ${DEV_KEY}`);
console.log("Dashboard password: 123456 (auto-created on first login)");
