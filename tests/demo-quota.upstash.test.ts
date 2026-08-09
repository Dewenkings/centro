import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import test from "node:test";
import { Redis } from "@upstash/redis";

import {
  checkPublicDemoQuota,
  getBeijingWindow,
  type QuotaRedis,
} from "../lib/demo/quota";

const url = process.env.UPSTASH_TEST_REDIS_REST_URL;
const token = process.env.UPSTASH_TEST_REDIS_REST_TOKEN;
const hasDedicatedTestRedis = Boolean(url && token);

function hashClient(clientId: string, secret: string): string {
  return createHmac("sha256", secret)
    .update("centro-public-demo-ip\0")
    .update(clientId)
    .digest("hex")
    .slice(0, 32);
}

test(
  "executes the real Lua script atomically against a dedicated Upstash database",
  { skip: !hasDedicatedTestRedis },
  async () => {
    const testUrl = url!;
    const testToken = token!;
    const redis = new Redis({ url: testUrl, token: testToken, retry: false });
    const quotaRedis = redis as unknown as QuotaRedis;
    const namespace = `centro:test:${randomUUID()}`;
    const now = new Date();
    const window = getBeijingWindow(now);
    const env: NodeJS.ProcessEnv = {
      UPSTASH_REDIS_REST_URL: testUrl,
      UPSTASH_REDIS_REST_TOKEN: testToken,
      DEMO_DAILY_PER_IP: "100",
      DEMO_DAILY_GLOBAL: "5",
      DEMO_BURST_PER_IP: "100",
      DEMO_BURST_WINDOW_SECONDS: "600",
    };
    const clients = Array.from(
      { length: 10 },
      (_, index) => `integration-client-${index}`
    );

    try {
      const results = await Promise.all(
        clients.map((clientId) =>
          checkPublicDemoQuota(clientId, {
            env,
            redis: quotaRedis,
            namespace,
            now,
          })
        )
      );

      assert.equal(results.filter((result) => result.allowed).length, 5);
      assert.equal(
        results.filter(
          (result) => !result.allowed && result.code === "GLOBAL_DAILY_LIMIT"
        ).length,
        5
      );

      const globalTtl = await redis.ttl(
        `${namespace}:{${window.day}}:global`
      );
      assert.ok(globalTtl > 0 && globalTtl <= window.keyTtlSeconds);
    } finally {
      const keys = [
        `${namespace}:{${window.day}}:global`,
        ...clients.flatMap((clientId) => {
          const clientHash = hashClient(clientId, testToken);
          return [
            `${namespace}:{${window.day}}:client:${clientHash}`,
            `${namespace}:{${window.day}}:burst:${clientHash}`,
          ];
        }),
      ];
      await Promise.all(keys.map((key) => redis.del(key)));
    }
  }
);
