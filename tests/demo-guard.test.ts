import assert from "node:assert/strict";
import test from "node:test";

import {
  checkRateLimit,
  getClientIdentifier,
  resetRateLimits,
  validateAgentRequest,
} from "../lib/demo/guard";

test("accepts a valid agent request and trims the message", () => {
  const result = validateAgentRequest({
    message: "  我住观前街，小明住阳澄湖，想吃火锅  ",
    history: [{ role: "user", content: "你好" }],
    prevState: { city: "苏州" },
  });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.message, "我住观前街，小明住阳澄湖，想吃火锅");
    assert.equal(result.value.history.length, 1);
  }
});

test("rejects an empty message", () => {
  const result = validateAgentRequest({ message: "   " });

  assert.deepEqual(result, {
    ok: false,
    status: 400,
    code: "INVALID_MESSAGE",
    error: "请输入聚会信息后再发送。",
  });
});

test("rejects a message longer than 300 characters", () => {
  const result = validateAgentRequest({ message: "a".repeat(301) });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.status, 400);
    assert.equal(result.code, "MESSAGE_TOO_LONG");
  }
});

test("rejects history longer than 20 messages", () => {
  const result = validateAgentRequest({
    message: "找火锅",
    history: Array.from({ length: 21 }, () => ({
      role: "user",
      content: "继续",
    })),
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "HISTORY_TOO_LONG");
});

test("rejects malformed request fields", () => {
  const result = validateAgentRequest({
    message: "找火锅",
    history: "not-an-array",
  });

  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.code, "INVALID_REQUEST");
});

test("uses the first forwarded address as the client identifier", () => {
  const headers = new Headers({
    "x-forwarded-for": "203.0.113.8, 10.0.0.2",
  });

  assert.equal(getClientIdentifier(headers), "203.0.113.8");
});

test("limits a client to five requests in ten minutes", () => {
  resetRateLimits();
  const now = 1_000_000;

  for (let index = 0; index < 5; index += 1) {
    assert.equal(checkRateLimit("client-a", now).allowed, true);
  }

  const blocked = checkRateLimit("client-a", now);
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.retryAfterSeconds, 600);

  const afterWindow = checkRateLimit("client-a", now + 600_000);
  assert.equal(afterWindow.allowed, true);
});
