import assert from "node:assert/strict";
import test from "node:test";
import { NextRequest } from "next/server";

import { handleAgentRequest } from "../lib/demo/agent-handler";
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
      error: "你今天的在线体验次数已用完，请体验示例场景，明天再来试试。",
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

test("returns 429 before starting the Agent graph when quota is exhausted", async () => {
  const previousLlmKey = process.env.LLM_API_KEY;
  const previousAmapKey = process.env.AMAP_API_KEY;
  const previousRateLimit = process.env.DEMO_RATE_LIMIT_ENABLED;
  process.env.LLM_API_KEY = "test-llm-key";
  process.env.AMAP_API_KEY = "test-amap-key";
  process.env.DEMO_RATE_LIMIT_ENABLED = "true";
  let graphCalls = 0;
  let quotaRequestId = "";

  try {
    const response = await handleAgentRequest(
      new NextRequest("http://localhost/api/agent", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-forwarded-for": "203.0.113.8",
        },
        body: JSON.stringify({ message: "找一家火锅店" }),
      }),
      {
        checkQuota: async (_clientId, options) => {
          quotaRequestId = options?.requestId || "";
          return {
            allowed: false,
            code: "GLOBAL_DAILY_LIMIT",
            retryAfterSeconds: 3600,
          };
        },
        streamGraph: async () => {
          graphCalls += 1;
          throw new Error("graph must not start");
        },
      }
    );

    assert.equal(response.status, 429);
    assert.equal(response.headers.get("Retry-After"), "3600");
    assert.equal((await response.json()).code, "GLOBAL_DAILY_LIMIT");
    assert.equal(graphCalls, 0);
    assert.match(quotaRequestId, /^[0-9a-f-]{36}$/);
  } finally {
    if (previousLlmKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = previousLlmKey;
    if (previousAmapKey === undefined) delete process.env.AMAP_API_KEY;
    else process.env.AMAP_API_KEY = previousAmapKey;
    if (previousRateLimit === undefined) delete process.env.DEMO_RATE_LIMIT_ENABLED;
    else process.env.DEMO_RATE_LIMIT_ENABLED = previousRateLimit;
  }
});

test("returns 503 before starting the Agent graph when Redis is unavailable", async () => {
  const previousLlmKey = process.env.LLM_API_KEY;
  const previousAmapKey = process.env.AMAP_API_KEY;
  const previousRateLimit = process.env.DEMO_RATE_LIMIT_ENABLED;
  process.env.LLM_API_KEY = "test-llm-key";
  process.env.AMAP_API_KEY = "test-amap-key";
  process.env.DEMO_RATE_LIMIT_ENABLED = "true";
  let graphCalls = 0;

  try {
    const response = await handleAgentRequest(
      new NextRequest("http://localhost/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: "找一家火锅店" }),
      }),
      {
        checkQuota: async () => ({
          allowed: false,
          code: "QUOTA_UNAVAILABLE",
          retryAfterSeconds: 60,
        }),
        streamGraph: async () => {
          graphCalls += 1;
          throw new Error("graph must not start");
        },
      }
    );

    assert.equal(response.status, 503);
    assert.equal(response.headers.get("Retry-After"), "60");
    assert.equal((await response.json()).code, "QUOTA_UNAVAILABLE");
    assert.equal(graphCalls, 0);
  } finally {
    if (previousLlmKey === undefined) delete process.env.LLM_API_KEY;
    else process.env.LLM_API_KEY = previousLlmKey;
    if (previousAmapKey === undefined) delete process.env.AMAP_API_KEY;
    else process.env.AMAP_API_KEY = previousAmapKey;
    if (previousRateLimit === undefined) delete process.env.DEMO_RATE_LIMIT_ENABLED;
    else process.env.DEMO_RATE_LIMIT_ENABLED = previousRateLimit;
  }
});
