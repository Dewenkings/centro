import type { QuotaLimitCode, QuotaResult } from "@/lib/demo/quota";

export interface QuotaHttpError {
  status: 429 | 503;
  code: QuotaLimitCode | "QUOTA_UNAVAILABLE";
  error: string;
  retryAfterSeconds: number;
}

type RejectedQuota = Extract<QuotaResult, { allowed: false }>;

export function getQuotaHttpError(result: RejectedQuota): QuotaHttpError {
  const base = {
    code: result.code,
    retryAfterSeconds: result.retryAfterSeconds,
  };

  if (result.code === "QUOTA_UNAVAILABLE") {
    return {
      ...base,
      status: 503,
      error: "在线体验保护服务暂时不可用，请先体验示例场景。",
    };
  }

  if (result.code === "BURST_LIMIT") {
    return {
      ...base,
      status: 429,
      error: "操作太频繁，请稍后再试，或体验示例场景。",
    };
  }

  if (result.code === "CLIENT_DAILY_LIMIT") {
    return {
      ...base,
      status: 429,
      error: "你今天的在线体验次数已用完，请体验示例场景，明天再来试试。",
    };
  }

  return {
    ...base,
    status: 429,
    error: "今天的在线体验额度已用完，请体验示例场景，明天再来试试。",
  };
}
