import assert from "node:assert/strict";
import test from "node:test";

import { graph } from "../lib/agent/graph";

interface FakeAmapOptions {
  routeSuccess?: boolean;
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

function createFakeAmapFetch(options: FakeAmapOptions = {}) {
  const calls: string[] = [];
  const routeSuccess = options.routeSuccess ?? true;

  const fakeFetch = async (input: string | URL | Request): Promise<Response> => {
    const rawUrl =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : input.url;
    const url = new URL(rawUrl);
    calls.push(url.toString());

    if (url.pathname.endsWith("/geocode/geo")) {
      const address = url.searchParams.get("address") || "";
      const location = address.includes("坪山")
        ? "114.346000,22.691000"
        : "113.883000,22.567000";
      return jsonResponse({
        status: "1",
        geocodes: [
          {
            location,
            formatted_address: `广东省深圳市${address}`,
            city: "深圳市",
            district: address.includes("坪山") ? "坪山区" : "宝安区",
          },
        ],
      });
    }

    if (url.pathname.endsWith("/place/around")) {
      return jsonResponse({
        status: "1",
        pois: [
          {
            name: "深圳测试烧烤店",
            address: "深圳市测试路 1 号",
            location: "114.100000,22.620000",
            distance: "1200",
            type: "餐饮服务;中餐厅",
            business: { rating: "4.8", tel: "0755-12345678" },
          },
        ],
      });
    }

    if (url.pathname.includes("/direction/transit/integrated")) {
      if (!routeSuccess) {
        return jsonResponse({ status: "1", route: { transits: [] } });
      }
      return jsonResponse({
        status: "1",
        route: { distance: "12000", transits: [{ duration: "1800" }] },
      });
    }

    if (url.pathname.includes("/direction/driving")) {
      if (!routeSuccess) {
        return jsonResponse({ status: "1", route: { paths: [] } });
      }
      return jsonResponse({
        status: "1",
        route: { paths: [{ distance: "9000", duration: "1200" }] },
      });
    }

    throw new Error(`Unexpected AMap request: ${url.toString()}`);
  };

  return { calls, fakeFetch };
}

const suzhouState = {
  participants: [
    {
      name: "我",
      address: "苏州观前街",
      location: "120.623550,31.314130",
    },
    {
      name: "小明",
      address: "苏州阳澄湖",
      location: "120.837000,31.430000",
    },
  ],
  centerPoint: "120.730275,31.372065",
  city: "苏州",
  keywords: "火锅",
};

async function invokeWithFakeAmap(
  content: string,
  options: FakeAmapOptions = {}
) {
  const previousFetch = globalThis.fetch;
  const previousMockLlm = process.env.MOCK_LLM;
  const previousAmapKey = process.env.AMAP_API_KEY;
  const fake = createFakeAmapFetch(options);

  globalThis.fetch = fake.fakeFetch as typeof fetch;
  process.env.MOCK_LLM = "true";
  process.env.AMAP_API_KEY = "test-amap-key";

  try {
    const result = await graph.invoke({
      ...suzhouState,
      conversationHistory: [{ role: "user" as const, content }],
    });
    return { result, calls: fake.calls };
  } finally {
    globalThis.fetch = previousFetch;
    if (previousMockLlm === undefined) delete process.env.MOCK_LLM;
    else process.env.MOCK_LLM = previousMockLlm;
    if (previousAmapKey === undefined) delete process.env.AMAP_API_KEY;
    else process.env.AMAP_API_KEY = previousAmapKey;
  }
}

test("a complete Shenzhen request recomputes a stale Suzhou center", async () => {
  const { result, calls } = await invokeWithFakeAmap(
    "我住深圳坪山，小明住深圳坪洲，想吃烧烤"
  );

  assert.equal(result.city, "深圳");
  assert.notEqual(result.centerPoint, suzhouState.centerPoint);
  assert.deepEqual(
    result.participants.map((participant) => participant.location),
    ["114.346000,22.691000", "113.883000,22.567000"]
  );
  assert.equal(result.recommendations[0]?.poi.name, "深圳测试烧烤店");
  assert.equal(
    calls.filter((url) => url.includes("/geocode/geo")).length,
    2
  );
});

test("a keyword-only iteration reuses the existing center", async () => {
  const { result, calls } = await invokeWithFakeAmap("换成水煮肉");

  assert.equal(result.centerPoint, suzhouState.centerPoint);
  assert.equal(result.keywords, "水煮肉");
  assert.equal(
    calls.filter((url) => url.includes("/geocode/geo")).length,
    0
  );
});

test("an address-changing clarification recomputes the center", async () => {
  const { result, calls } = await invokeWithFakeAmap(
    "我地址改为深圳坪山，小明地址改为深圳坪洲"
  );

  assert.equal(result.city, "深圳");
  assert.notEqual(result.centerPoint, suzhouState.centerPoint);
  assert.deepEqual(
    result.participants.map((participant) => participant.address),
    ["深圳坪山", "深圳坪洲"]
  );
  assert.equal(
    calls.filter((url) => url.includes("/geocode/geo")).length,
    2
  );
});

test("candidates without complete participant routes are not recommended", async () => {
  const { result } = await invokeWithFakeAmap(
    "我住深圳坪山，小明住深圳坪洲，想吃烧烤",
    { routeSuccess: false }
  );

  assert.deepEqual(result.recommendations, []);
  const reply = [...result.conversationHistory]
    .reverse()
    .find((message) => message.role === "assistant")?.content;
  assert.match(reply || "", /完整路线/);
});
