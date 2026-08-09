import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { getQuotaHttpError } from "../lib/demo/quota-http";

test("maps burst limits to a helpful 429 response", () => {
  assert.deepEqual(
    getQuotaHttpError({
      allowed: false,
      code: "BURST_LIMIT",
      retryAfterSeconds: 420,
    }),
    {
      status: 429,
      code: "BURST_LIMIT",
      error: "操作太频繁，请稍后再试，或体验示例场景。",
      retryAfterSeconds: 420,
    }
  );
});

test("maps client daily limits to a helpful 429 response", () => {
  assert.deepEqual(
    getQuotaHttpError({
      allowed: false,
      code: "CLIENT_DAILY_LIMIT",
      retryAfterSeconds: 3600,
    }),
    {
      status: 429,
      code: "CLIENT_DAILY_LIMIT",
      error: "你今天的 3 次在线体验已用完，请体验示例场景，明天再来试试。",
      retryAfterSeconds: 3600,
    }
  );
});

test("maps global daily limits to a helpful 429 response", () => {
  assert.deepEqual(
    getQuotaHttpError({
      allowed: false,
      code: "GLOBAL_DAILY_LIMIT",
      retryAfterSeconds: 3600,
    }),
    {
      status: 429,
      code: "GLOBAL_DAILY_LIMIT",
      error: "今天的在线体验额度已用完，请体验示例场景，明天再来试试。",
      retryAfterSeconds: 3600,
    }
  );
});

test("fails closed with 503 when the quota store is unavailable", () => {
  assert.deepEqual(
    getQuotaHttpError({
      allowed: false,
      code: "QUOTA_UNAVAILABLE",
      retryAfterSeconds: 60,
    }),
    {
      status: 503,
      code: "QUOTA_UNAVAILABLE",
      error: "在线体验保护服务暂时不可用，请先体验示例场景。",
      retryAfterSeconds: 60,
    }
  );
});

test("the Agent route awaits the durable quota before streaming", () => {
  const routeSource = readFileSync("app/api/agent/route.ts", "utf8");
  const guardSource = readFileSync("lib/demo/guard.ts", "utf8");

  assert.match(routeSource, /await checkPublicDemoQuota/);
  assert.doesNotMatch(routeSource, /checkRateLimit/);
  assert.doesNotMatch(guardSource, /new Map/);
});
