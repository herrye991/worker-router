export function planTargetsForTest(kind: "retryable" | "non-retryable"): "continue" | "stop" {
  // Mirrors executeWithFallback decision: retry only on retryable statuses.
  const retryableStatuses = [429, 500, 502, 503, 504];
  const status = kind === "retryable" ? 502 : 400;
  return retryableStatuses.includes(status) ? "continue" : "stop";
}
