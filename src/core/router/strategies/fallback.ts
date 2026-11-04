import type { EligibleMember } from "./single";
import { orderByPriority } from "./single";

export interface FallbackPolicy {
  maxAttempts: number;
  retryableStatuses: number[];
  baseDelayMs: number;
  deadlineMs: number;
}

export function fallbackOrder(members: EligibleMember[]): EligibleMember[] {
  return orderByPriority(members);
}

export function isRetryable(status: number, policy: FallbackPolicy): boolean {
  return policy.retryableStatuses.includes(status);
}
