import assert from "node:assert/strict";
import { createServer } from "node:http";
import test from "node:test";

import {
  DEFAULT_QUOTA_LIMITS,
  checkPublicDemoQuota,
  getBeijingWindow,
  type QuotaRedis,
} from "../lib/demo/quota";

const baseEnv: NodeJS.ProcessEnv = {
  UPSTASH_REDIS_REST_URL: "https://example.upstash.io",
  UPSTASH_REDIS_REST_TOKEN: "test-token-that-never-leaves-the-test",
};

class CounterRedis implements QuotaRedis {
  readonly counts = new Map<string, number>();
  readonly calls: Array<{ script: string; keys: string[]; args: unknown[] }> = [];

  async eval<TData>(
    script: string,
    keys: string[],
    args: unknown[]
  ): Promise<TData> {
    this.calls.push({ script, keys, args });
    const [clientDailyLimit, globalDailyLimit, burstLimit] = args.map(Number);
    const [globalKey, clientKey, burstKey] = keys;
    const globalCount = this.counts.get(globalKey) || 0;
    const clientCount = this.counts.get(clientKey) || 0;
    const burstCount = this.counts.get(burstKey) || 0;

    if (burstCount >= burstLimit) {
      return [0, 1, 0, clientDailyLimit - clientCount, globalDailyLimit - globalCount, 600] as TData;
    }
    if (clientCount >= clientDailyLimit) {
      return [0, 2, burstLimit - burstCount, 0, globalDailyLimit - globalCount, 3600] as TData;
    }
    if (globalCount >= globalDailyLimit) {
      return [0, 3, burstLimit - burstCount, clientDailyLimit - clientCount, 0, 3600] as TData;
    }

    this.counts.set(globalKey, globalCount + 1);
    this.counts.set(clientKey, clientCount + 1);
    this.counts.set(burstKey, burstCount + 1);
    return [
      1,
      0,
      burstLimit - burstCount - 1,
      clientDailyLimit - clientCount - 1,
      globalDailyLimit - globalCount - 1,
      0,
    ] as TData;
  }
}

test("uses the Beijing calendar day and next-midnight reset", () => {
  const before = getBeijingWindow(new Date("2026-08-09T15:59:59.000Z"));
  const after = getBeijingWindow(new Date("2026-08-09T16:00:00.000Z"));

  assert.equal(before.day, "2026-08-09");
  assert.equal(before.retryAfterSeconds, 1);
  assert.equal(after.day, "2026-08-10");
  assert.equal(after.retryAfterSeconds, 86_400);
});

test("uses the approved production defaults", () => {
  assert.deepEqual(DEFAULT_QUOTA_LIMITS, {
    clientDaily: 3,
    globalDaily: 30,
    burst: 2,
    burstWindowSeconds: 600,
  });
});

test("accepts three daily requests and rejects the fourth for one client", async () => {
  const redis = new CounterRedis();
  const env = { ...baseEnv, DEMO_BURST_PER_IP: "100" };
  const options = {
    env,
    redis,
    now: new Date("2026-08-09T12:00:00.000Z"),
  };

  for (let index = 0; index < 3; index += 1) {
    assert.equal((await checkPublicDemoQuota("203.0.113.8", options)).allowed, true);
  }
  const blocked = await checkPublicDemoQuota("203.0.113.8", options);

  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.code, "CLIENT_DAILY_LIMIT");
});

test("rejects the thirty-first accepted request across independent clients", async () => {
  const redis = new CounterRedis();
  const env = { ...baseEnv, DEMO_BURST_PER_IP: "100" };
  const now = new Date("2026-08-09T12:00:00.000Z");

  for (let index = 0; index < 30; index += 1) {
    const result = await checkPublicDemoQuota(`198.51.100.${index}`, {
      env,
      redis,
      now,
    });
    assert.equal(result.allowed, true);
  }
  const blocked = await checkPublicDemoQuota("198.51.100.31", {
    env,
    redis,
    now,
  });

  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) assert.equal(blocked.code, "GLOBAL_DAILY_LIMIT");
});

test("rejects the third request inside the burst window", async () => {
  const redis = new CounterRedis();
  const options = {
    env: baseEnv,
    redis,
    now: new Date("2026-08-09T12:00:00.000Z"),
  };

  assert.equal((await checkPublicDemoQuota("192.0.2.10", options)).allowed, true);
  assert.equal((await checkPublicDemoQuota("192.0.2.10", options)).allowed, true);
  const blocked = await checkPublicDemoQuota("192.0.2.10", options);

  assert.equal(blocked.allowed, false);
  if (!blocked.allowed) {
    assert.equal(blocked.code, "BURST_LIMIT");
    assert.equal(blocked.retryAfterSeconds, 600);
  }
});

test("never sends the raw client IP to Redis", async () => {
  const redis = new CounterRedis();
  const rawIp = "203.0.113.99";

  await checkPublicDemoQuota(rawIp, {
    env: baseEnv,
    redis,
    now: new Date("2026-08-09T12:00:00.000Z"),
  });

  const serializedCall = JSON.stringify(redis.calls[0]);
  assert.equal(serializedCall.includes(rawIp), false);
});

test("uses an isolated namespace when one is provided", async () => {
  const redis = new CounterRedis();

  await checkPublicDemoQuota("203.0.113.8", {
    env: baseEnv,
    redis,
    namespace: "centro:test:isolated",
    now: new Date("2026-08-09T12:00:00.000Z"),
  });

  assert.match(redis.calls[0].keys[0], /^centro:test:isolated:/);
});

test("rejects malformed integer settings instead of partially parsing them", async () => {
  const redis = new CounterRedis();
  const originalError = console.error;
  console.error = () => undefined;
  try {
    await checkPublicDemoQuota("203.0.113.8", {
      env: { ...baseEnv, DEMO_DAILY_PER_IP: "10junk" },
      redis,
      now: new Date("2026-08-09T12:00:00.000Z"),
    });
  } finally {
    console.error = originalError;
  }

  assert.equal(redis.calls[0].args[0], DEFAULT_QUOTA_LIMITS.clientDaily);
});

test("fails closed when credentials are missing", async () => {
  const redis = new CounterRedis();
  const result = await checkPublicDemoQuota("203.0.113.8", {
    env: {},
    redis,
  });

  assert.deepEqual(result, {
    allowed: false,
    code: "QUOTA_UNAVAILABLE",
    retryAfterSeconds: 60,
  });
  assert.equal(redis.calls.length, 0);
});

test("fails closed when Redis cannot confirm the quota", async () => {
  const redis: QuotaRedis = {
    async eval<TData>(): Promise<TData> {
      throw new Error("network unavailable");
    },
  };
  const originalError = console.error;
  let loggedMessage = "";
  console.error = (message?: unknown) => {
    loggedMessage = String(message);
  };
  try {
    const result = await checkPublicDemoQuota("203.0.113.8", {
      env: baseEnv,
      redis,
      requestId: "request-123",
    });
    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, "QUOTA_UNAVAILABLE");
    assert.match(loggedMessage, /request-123/);
  } finally {
    console.error = originalError;
  }
});

test("fails closed within the configured timeout when Upstash stalls", async () => {
  const server = createServer((_request, response) => {
    setTimeout(() => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("{}");
    }, 500);
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.notEqual(address, null);
  assert.equal(typeof address, "object");
  const port = typeof address === "object" && address ? address.port : 0;
  const originalError = console.error;
  console.error = () => undefined;

  try {
    const startedAt = Date.now();
    const result = await checkPublicDemoQuota("203.0.113.8", {
      env: {
        ...baseEnv,
        UPSTASH_REDIS_REST_URL: `http://127.0.0.1:${port}`,
        DEMO_RATE_LIMIT_TIMEOUT_MS: "50",
      },
    });
    const elapsed = Date.now() - startedAt;

    assert.equal(result.allowed, false);
    if (!result.allowed) assert.equal(result.code, "QUOTA_UNAVAILABLE");
    assert.ok(elapsed < 300, `quota check took ${elapsed}ms`);
  } finally {
    console.error = originalError;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
});
