export interface EligibleMember {
  modelId: string;
  publicName: string;
  providerId: string;
  providerName: string;
  providerType: string;
  baseUrl: string;
  upstreamModel: string;
  weight: number;
  priority: number;
  orderIndex: number;
  timeoutMs: number;
}

export function pickSingle(members: EligibleMember[]): EligibleMember | null {
  const sorted = [...members].sort((a, b) => b.priority - a.priority || a.orderIndex - b.orderIndex);
  return sorted[0] ?? null;
}

export function orderByPriority(members: EligibleMember[]): EligibleMember[] {
  return [...members].sort((a, b) => b.priority - a.priority || a.orderIndex - b.orderIndex);
}
