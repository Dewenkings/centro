import { createHmac } from "node:crypto";
import { Redis } from "@upstash/redis";

export const DEFAULT_QUOTA_LIMITS = {
  clientDaily: 5,
  globalDaily: 30,
  burst: 3,
  burstWindowSeconds: 600,
} as const;

export type QuotaLimitCode =
  | "BURST_LIMIT"
  | "CLIENT_DAILY_LIMIT"
  | "GLOBAL_DAILY_LIMIT";

export type QuotaResult =
  | {
      allowed: true;
      remaining: {
        burst: number;
        clientDaily: number;
        globalDaily: number;
      };
      resetAt: number;
    }
  | {
      allowed: false;
      code: QuotaLimitCode | "QUOTA_UNAVAILABLE";
      retryAfterSeconds: number;
    };

export interface BeijingWindow {
  day: string;
  retryAfterSeconds: number;
  keyTtlSeconds: number;
  resetAt: number;
}

export interface QuotaRedis {
  eval<TData = unknown>(
    script: string,
    keys: string[],
    args: unknown[]
  ): Promise<TData>;
}

export interface QuotaCheckOptions {
  now?: Date;
  env?: NodeJS.ProcessEnv;
  redis?: QuotaRedis;
  namespace?: string;
  requestId?: string;
}

type RedisQuotaReply = [
  allowed: number,
  reason: number,
  burstRemaining: number,
  clientDailyRemaining: number,
  globalDailyRemaining: number,
  retryAfterSeconds: number,
];

const BEIJING_OFFSET_MS = 8 * 60 * 60 * 1000;
const DAILY_KEY_GRACE_SECONDS = 60 * 60;
const DEFAULT_REDIS_TIMEOUT_MS = 1_500;

const QUOTA_SCRIPT = `
local globalCount = tonumber(redis.call("GET", KEYS[1]) or "0")
local clientCount = tonumber(redis.call("GET", KEYS[2]) or "0")
local burstCount = tonumber(redis.call("GET", KEYS[3]) or "0")

local clientDailyLimit = tonumber(ARGV[1])
local globalDailyLimit = tonumber(ARGV[2])
local burstLimit = tonumber(ARGV[3])
local dailyTtl = tonumber(ARGV[4])
local burstTtl = tonumber(ARGV[5])
local dailyRetryAfter = tonumber(ARGV[6])

if burstCount >= burstLimit then
  local retryAfter = redis.call("TTL", KEYS[3])
  if retryAfter < 1 then retryAfter = burstTtl end
  return {0, 1, 0, math.max(0, clientDailyLimit - clientCount), math.max(0, globalDailyLimit - globalCount), retryAfter}
end

if clientCount >= clientDailyLimit then
  return {0, 2, math.max(0, burstLimit - burstCount), 0, math.max(0, globalDailyLimit - globalCount), dailyRetryAfter}
end

if globalCount >= globalDailyLimit then
  return {0, 3, math.max(0, burstLimit - burstCount), math.max(0, clientDailyLimit - clientCount), 0, dailyRetryAfter}
end

globalCount = redis.call("INCR", KEYS[1])
clientCount = redis.call("INCR", KEYS[2])
burstCount = redis.call("INCR", KEYS[3])

if globalCount == 1 then redis.call("EXPIRE", KEYS[1], dailyTtl) end
if clientCount == 1 then redis.call("EXPIRE", KEYS[2], dailyTtl) end
if burstCount == 1 then redis.call("EXPIRE", KEYS[3], burstTtl) end

return {
  1,
  0,
  math.max(0, burstLimit - burstCount),
  math.max(0, clientDailyLimit - clientCount),
  math.max(0, globalDailyLimit - globalCount),
  0
}
`;

function readPositiveInteger(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number
): number {
  const value = env[name];
  if (!value) return fallback;
  if (!/^[1-9]\d*$/.test(value)) {
    console.error(`[demo-quota] Invalid ${name}; using default`);
    return fallback;
  }

  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed)) {
    console.error(`[demo-quota] Invalid ${name}; using default`);
    return fallback;
  }
  return parsed;
}

export function getBeijingWindow(now: Date): BeijingWindow {
  const shifted = new Date(now.getTime() + BEIJING_OFFSET_MS);
  const day = shifted.toISOString().slice(0, 10);
  const [year, month, date] = day.split("-").map(Number);
  const resetAt =
    Date.UTC(year, month - 1, date + 1) - BEIJING_OFFSET_MS;
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil((resetAt - now.getTime()) / 1000)
  );

  return {
    day,
    retryAfterSeconds,
    keyTtlSeconds: retryAfterSeconds + DAILY_KEY_GRACE_SECONDS,
    resetAt,
  };
}

function anonymizeClient(clientId: string, token: string): string {
  return createHmac("sha256", token)
    .update("centro-public-demo-ip\0")
    .update(clientId)
    .digest("hex")
    .slice(0, 32);
}

function parseReply(value: unknown): RedisQuotaReply {
  if (
    !Array.isArray(value) ||
    value.length !== 6 ||
    !value.every((entry) => Number.isFinite(Number(entry)))
  ) {
    throw new Error("Invalid quota response");
  }

  return value.map(Number) as RedisQuotaReply;
}

function mapLimitCode(reason: number): QuotaLimitCode {
  if (reason === 1) return "BURST_LIMIT";
  if (reason === 2) return "CLIENT_DAILY_LIMIT";
  if (reason === 3) return "GLOBAL_DAILY_LIMIT";
  throw new Error("Invalid quota rejection reason");
}

export async function checkPublicDemoQuota(
  clientId: string,
  options: QuotaCheckOptions = {}
): Promise<QuotaResult> {
  const env = options.env ?? process.env;
  const url = env.UPSTASH_REDIS_REST_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    return {
      allowed: false,
      code: "QUOTA_UNAVAILABLE",
      retryAfterSeconds: 60,
    };
  }

  try {
    const now = options.now ?? new Date();
    const window = getBeijingWindow(now);
    const clientHash = anonymizeClient(clientId, token);
    const namespace = options.namespace ?? "centro:quota";
    const keyPrefix = `${namespace}:{${window.day}}`;
    const limits = {
      clientDaily: readPositiveInteger(
        env,
        "DEMO_DAILY_PER_IP",
        DEFAULT_QUOTA_LIMITS.clientDaily
      ),
      globalDaily: readPositiveInteger(
        env,
        "DEMO_DAILY_GLOBAL",
        DEFAULT_QUOTA_LIMITS.globalDaily
      ),
      burst: readPositiveInteger(
        env,
        "DEMO_BURST_PER_IP",
        DEFAULT_QUOTA_LIMITS.burst
      ),
      burstWindowSeconds: readPositiveInteger(
        env,
        "DEMO_BURST_WINDOW_SECONDS",
        DEFAULT_QUOTA_LIMITS.burstWindowSeconds
      ),
    };
    const timeoutMs = readPositiveInteger(
      env,
      "DEMO_RATE_LIMIT_TIMEOUT_MS",
      DEFAULT_REDIS_TIMEOUT_MS
    );
    const redis =
      options.redis ??
      (new Redis({
        url,
        token,
        retry: false,
        signal: () => AbortSignal.timeout(timeoutMs),
      }) as unknown as QuotaRedis);
    const reply = parseReply(
      await redis.eval<RedisQuotaReply>(
        QUOTA_SCRIPT,
        [
          `${keyPrefix}:global`,
          `${keyPrefix}:client:${clientHash}`,
          `${keyPrefix}:burst:${clientHash}`,
        ],
        [
          limits.clientDaily,
          limits.globalDaily,
          limits.burst,
          window.keyTtlSeconds,
          limits.burstWindowSeconds,
          window.retryAfterSeconds,
        ]
      )
    );

    if (reply[0] === 1) {
      return {
        allowed: true,
        remaining: {
          burst: reply[2],
          clientDaily: reply[3],
          globalDaily: reply[4],
        },
        resetAt: window.resetAt,
      };
    }

    return {
      allowed: false,
      code: mapLimitCode(reply[1]),
      retryAfterSeconds: Math.max(1, reply[5]),
    };
  } catch {
    const requestContext = options.requestId
      ? ` (${options.requestId})`
      : "";
    console.error(`[demo-quota] Unable to confirm quota${requestContext}`);
    return {
      allowed: false,
      code: "QUOTA_UNAVAILABLE",
      retryAfterSeconds: 60,
    };
  }
}
