import type { Env, RoutingStrategy } from "../../types";
import { AppError } from "../../lib/errors";
import { getAdapter } from "../../providers";
import type { ChatCompletionRequest, ProviderCallContext } from "../../providers/provider-adapter";
import { pickSingle, orderByPriority, type EligibleMember } from "./strategies/single";
import { nextRoundRobinIndex, pickRoundRobin } from "./strategies/round-robin";
import { pickWeighted } from "./strategies/weighted";
import { fallbackOrder, type FallbackPolicy } from "./strategies/fallback";
import { jitteredDelay, sleep } from "./retry";
import { isCoolingDown, recordFailure, recordSuccess } from "./provider-health";
import { decryptCredential } from "../../lib/crypto";

export interface ResolvedTarget {
  strategy: RoutingStrategy;
  groupId: string | null;
  members: EligibleMember[];
  policy: FallbackPolicy;
}

async function loadMembers(env: Env, modelIds: string[]): Promise<EligibleMember[]> {
  if (!modelIds.length) return [];
  const placeholders = modelIds.map(() => "?").join(",");
  const rows: any[] = await (env.DB as any).prepare(
    `SELECT m.id as modelId, m.public_name as publicName, m.provider_model_id as upstreamModel,
            m.weight as modelWeight, m.priority as modelPriority,
            p.id as providerId, p.name as providerName, p.type as providerType,
            p.base_url as baseUrl, p.enabled as providerEnabled, p.timeout_ms as timeoutMs,
            gm.weight as memberWeight, gm.priority as memberPriority, gm.order_index as orderIndex
     FROM models m JOIN providers p ON p.id = m.provider_id
     LEFT JOIN routing_group_members gm ON gm.model_id = m.id
     WHERE m.id IN (${placeholders}) AND m.enabled = 1 AND p.enabled = 1`
  ).bind(...modelIds).all().then((r: any) => r.results ?? r ?? []);
  return rows.map((r: any) => ({
    modelId: r.modelId,
    publicName: r.publicName,
    providerId: r.providerId,
    providerName: r.providerName,
    providerType: r.providerType,
    baseUrl: r.baseUrl,
    upstreamModel: r.upstreamModel,
    weight: Number(r.memberWeight ?? r.modelWeight ?? 1),
    priority: Number(r.memberPriority ?? r.modelPriority ?? 0),
    orderIndex: Number(r.orderIndex ?? 0),
    timeoutMs: Number(r.timeoutMs ?? 60000),
  }));
}

async function getCredential(env: Env, providerId: string): Promise<string | null> {
  const row: any = await (env.DB as any).prepare(`SELECT encrypted_credential FROM providers WHERE id = ?`).bind(providerId).first();
  const enc = row?.encrypted_credential as string | null;
  if (!enc) return null;
  const master = env.ENCRYPTION_MASTER_KEY;
  if (!master) return null;
  try {
    return await decryptCredential(enc, master);
  } catch {
    return null;
  }
}

export async function resolveTarget(env: Env, publicModel: string): Promise<ResolvedTarget> {
  // 1. Routing group by alias?
  const group: any = await (env.DB as any).prepare(`SELECT * FROM routing_groups WHERE public_alias = ? AND enabled = 1`).bind(publicModel).first();
  if (group) {
    const memberRows: any[] = await (env.DB as any).prepare(`SELECT model_id FROM routing_group_members WHERE group_id = ? ORDER BY order_index ASC`).bind(group.id).all().then((r: any) => r.results ?? []);
    const members = (await loadMembers(env, memberRows.map((m: any) => m.model_id))).filter((m) => !isCoolingDown(m.providerId));
    const eligible = members.length ? members : await loadMembers(env, memberRows.map((m: any) => m.model_id));
    if (!eligible.length) throw new AppError(404, "model_not_found", `No eligible members for group '${publicModel}'`, "model_not_found", false);
    let policy: FallbackPolicy = { maxAttempts: 3, retryableStatuses: [429, 500, 502, 503, 504], baseDelayMs: 300, deadlineMs: 120000 };
    try { policy = { ...policy, ...JSON.parse(group.fallback_policy ?? "{}") }; } catch { /* keep default */ }
    return { strategy: group.strategy as RoutingStrategy, groupId: group.id, members: eligible, policy };
  }
  // 2. Direct model alias?
  const model: any = await (env.DB as any).prepare(`SELECT id FROM models WHERE public_name = ? AND enabled = 1`).bind(publicModel).first();
  if (!model) throw new AppError(404, "model_not_found", `Model '${publicModel}' not found`, "model_not_found", false);
  const members = await loadMembers(env, [model.id]);
  if (!members.length) throw new AppError(503, "provider_unavailable", `No enabled provider for model '${publicModel}'`, "provider_unavailable", true);
  return { strategy: "single", groupId: null, members, policy: { maxAttempts: 1, retryableStatuses: [], baseDelayMs: 0, deadlineMs: 120000 } };
}

export interface AttemptInfo {
  member: EligibleMember;
  attempt: number;
}

export function planAttempts(target: ResolvedTarget, counter: number): EligibleMember[] {
  const { strategy, members } = target;
  switch (strategy) {
    case "single": {
      const m = pickSingle(members);
      return m ? [m] : [];
    }
    case "round-robin": {
      const m = pickRoundRobin(members, counter);
      return m ? [m, ...fallbackOrder(members).filter((x) => x.modelId !== m.modelId)] : [];
    }
    case "weighted": {
      const m = pickWeighted(members, counter);
      return m ? [m, ...fallbackOrder(members).filter((x) => x.modelId !== m.modelId)] : [];
    }
    case "fallback":
    default: {
      return fallbackOrder(members);
    }
  }
}

export async function getRotationCounter(env: Env, groupId: string | null, size: number): Promise<number> {
  if (!groupId) return 0;
  const db = {
    run: async (sql: string, params: any[]) => { await (env.DB as any).prepare(sql).bind(...params).run(); },
    query: async (sql: string, params: any[]) => (env.DB as any).prepare(sql).bind(...params).first(),
  };
  return nextRoundRobinIndex(db, groupId, size);
}

export async function executeWithFallback(
  env: Env,
  target: ResolvedTarget,
  req: ChatCompletionRequest,
  opts: { stream: boolean; signal?: AbortSignal; deadlineMs?: number }
): Promise<{ response: Response | any; member: EligibleMember; attempts: number; isStream: boolean }> {
  const counter = await getRotationCounter(env, target.groupId, target.members.length || 1);
  const ordered = planAttempts(target, counter);
  const policy = target.policy;
  const deadline = Date.now() + (opts.deadlineMs ?? policy.deadlineMs ?? 120000);
  const maxAttempts = Math.min(policy.maxAttempts, ordered.length, 10);
  let lastError: any = null;

  for (let attempt = 0; attempt < Math.max(maxAttempts, 1); attempt++) {
    const member = ordered[attempt % ordered.length];
    if (!member) break;
    if (Date.now() > deadline) break;
    const credential = await getCredential(env, member.providerId);
    const adapter = getAdapter(member.providerType);
    const ctx: ProviderCallContext = {
      providerId: member.providerId,
      providerName: member.providerName,
      providerType: member.providerType,
      baseUrl: member.baseUrl,
      credential,
      upstreamModel: member.upstreamModel,
      timeoutMs: member.timeoutMs,
      signal: opts.signal,
      env,
    };
    try {
      if (opts.stream) {
        if (!adapter.capabilities().streaming) {
          lastError = new AppError(400, "unsupported_capability", `Provider '${member.providerName}' does not support streaming`, "unsupported_capability", false);
          continue;
        }
        const res = await adapter.chatCompletionStream(req, ctx);
        recordSuccess(member.providerId);
        return { response: res, member, attempts: attempt + 1, isStream: true };
      } else {
        const out = await adapter.chatCompletion(req, ctx);
        recordSuccess(member.providerId);
        return { response: out, member, attempts: attempt + 1, isStream: false };
      }
    } catch (e: any) {
      lastError = e;
      const status = e instanceof AppError ? e.status : 502;
      const retryable = e instanceof AppError ? e.retryable : true;
      recordFailure(member.providerId);
      const canRetry = attempt + 1 < maxAttempts && retryable && policy.retryableStatuses.includes(status);
      // Do not fallback after stream started — handled by caller (stream path returns immediately).
      if (!canRetry) break;
      if (Date.now() > deadline) break;
      await sleep(jitteredDelay(policy.baseDelayMs ?? 300, attempt));
    }
  }
  throw lastError ?? new AppError(502, "upstream_error", "All providers failed", "upstream_error", false);
}
