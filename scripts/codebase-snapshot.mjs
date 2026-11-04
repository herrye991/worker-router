// Regenerate .codebase/*.md snapshots (split by area).
// Usage: npm run codebase
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const BASE = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = join(BASE, ".codebase");

const PARTS = {
  "01-config.md": ["wrangler.jsonc", "package.json", "frontend/package.json",
    "tsconfig.json", "frontend/tsconfig.json", "frontend/vite.config.ts",
    "vitest.config.ts", "drizzle.config.ts", ".env.example", ".dev.vars.example",
    ".github/workflows/ci.yml", "migrations/0001_initial.sql"],
  "02-core-types-db.md": ["src/types.ts", "src/index.ts", "src/db/schema.ts", "src/db/index.ts",
    "src/lib/errors.ts", "src/lib/id.ts", "src/lib/crypto.ts", "src/lib/validation.ts"],
  "03-middleware-security.md": ["src/middleware/request-id.ts", "src/middleware/cors.ts",
    "src/middleware/error-handler.ts", "src/middleware/client-auth.ts",
    "src/middleware/admin-auth.ts", "src/security/rate-limiting.ts",
    "src/observability/request-logger.ts", "src/observability/metrics.ts"],
  "04-providers.md": ["src/providers/provider-adapter.ts", "src/providers/index.ts",
    "src/providers/openai-compatible.ts", "src/providers/anthropic.ts",
    "src/providers/google.ts", "src/providers/cloudflare-ai.ts"],
  "05-router.md": ["src/core/router/router-engine.ts", "src/core/router/retry.ts",
    "src/core/router/provider-health.ts", "src/core/router/strategies/single.ts",
    "src/core/router/strategies/round-robin.ts", "src/core/router/strategies/weighted.ts",
    "src/core/router/strategies/fallback.ts"],
  "06-api-openai.md": ["src/api/openai/chat-completions.ts", "src/api/openai/models.ts",
    "src/api/openai/embeddings.ts", "src/api/mock-upstream.ts"],
  "07-api-admin.md": ["src/api/admin/auth.ts", "src/api/admin/providers.ts", "src/api/admin/models.ts",
    "src/api/admin/routing.ts", "src/api/admin/api-keys.ts",
    "src/api/admin/analytics.ts", "src/api/admin/settings.ts", "src/api/admin/health.ts"],
  "08-frontend-shell.md": ["frontend/src/main.tsx", "frontend/src/styles.css", "frontend/src/vite-env.d.ts",
    "frontend/src/components/Layout.tsx", "frontend/src/lib/api.ts",
    "frontend/src/pages/Login.tsx", "frontend/src/pages/Overview.tsx",
    "frontend/src/pages/Endpoint.tsx"],
  "09-frontend-pages.md": ["frontend/src/pages/Providers.tsx", "frontend/src/pages/Models.tsx",
    "frontend/src/pages/Combos.tsx", "frontend/src/pages/Usage.tsx",
    "frontend/src/pages/Logs.tsx", "frontend/src/pages/Settings.tsx"],
  "10-tests-seed.md": ["tests/routing.test.ts", "tests/auth-validation.test.ts",
    "tests/providers.test.ts", "tests/helpers.ts", "scripts/seed-local.mjs"],
};

const langOf = (f) =>
  f.endsWith(".sql") ? "sql" : f.endsWith(".mjs") ? "js" : f.endsWith(".yml") ? "yml"
  : f.endsWith(".jsonc") || f.endsWith(".json") ? "json"
  : f.endsWith(".tsx") ? "tsx" : f.endsWith(".ts") ? "ts" : f.endsWith(".css") ? "css" : "";

mkdirSync(OUT, { recursive: true });
const manifest = ["# WorkerRouter Codebase Snapshot", "",
  "Split by area so an agent can focus on one part without re-scraping.",
  "Generated from working tree. `.codebase/` is git-ignored.", "",
  "| Part | Area | Files |", "| ---- | ---- | ----- |"];
for (const [name, files] of Object.entries(PARTS))
  manifest.push(`| \`${name}\` | ${name.slice(3, -3).replaceAll("-", " ")} | ${files.length} |`);
manifest.push("", "Regenerate: `npm run codebase` (writes `.codebase/*.md`).");
writeFileSync(join(OUT, "00-manifest.md"), manifest.join("\n") + "\n");

for (const [name, files] of Object.entries(PARTS)) {
  const out = [`# ${name} — ${files.length} files`, ""];
  for (const rel of files) {
    let content;
    try { content = readFileSync(join(BASE, rel), "utf8"); }
    catch { content = `<!-- MISSING: ${rel} -->`; }
    out.push(`## \`${rel}\``, "", "```" + langOf(rel), content.trimEnd(), "```", "");
  }
  writeFileSync(join(OUT, name), out.join("\n"));
  console.log(`wrote ${name}: ${files.length} files`);
}
