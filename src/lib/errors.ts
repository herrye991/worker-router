import type { ErrorCategory } from "../types";

export class AppError extends Error {
  status: number;
  code: string;
  category: ErrorCategory;
  retryable: boolean;
  constructor(status: number, code: string, message: string, category: ErrorCategory, retryable = false) {
    super(message);
    this.status = status;
    this.code = code;
    this.category = category;
    this.retryable = retryable;
  }
}

export function toOpenAIError(e: unknown, requestId?: string) {
  if (e instanceof AppError) {
    return {
      status: e.status,
      body: { error: { message: e.message, type: e.code, code: e.code, request_id: requestId } },
    };
  }
  const msg = e instanceof Error ? e.message : "Internal server error";
  return {
    status: 500,
    body: { error: { message: msg, type: "internal_error", code: "internal_error", request_id: requestId } },
  };
}

export function isRetryableStatus(status: number) {
  return status === 429 || status === 500 || status === 502 || status === 503 || status === 504;
}
