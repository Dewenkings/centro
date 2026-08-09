# Upstash Public Demo Rate Limit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Centro's process-local demo throttle with reliable atomic Upstash quotas of 3 accepted requests per IP per Beijing day, 30 accepted requests globally per Beijing day, and 2 accepted requests per IP per 10-minute fixed window.

**Architecture:** A focused `lib/demo/quota.ts` module owns configuration, Beijing-day calculations, anonymized client keys, the atomic Redis script, and typed results. `POST /api/agent` validates input and checks this quota before invoking the Agent graph. Upstash failures fail closed for live search while the client-side static preset remains independent.

**Tech Stack:** Next.js 15 Route Handlers, TypeScript, Node crypto, `@upstash/redis`, Node test runner through `tsx`.

## Global Constraints

- Default limits are exactly 3 per IP per Beijing calendar day, 30 globally per Beijing calendar day, and 2 per IP per 600-second fixed window.
- Only accepted live searches increment counters; all three counters update atomically.
- Raw IP addresses and credentials must never be stored or logged.
- Missing credentials and Redis errors must prevent LLM and AMap calls with HTTP 503.
- The static preset remains unlimited and does not call `/api/agent`.
- `DEMO_RATE_LIMIT_ENABLED=false` remains an explicit development-only bypass.
- `.codex/`, `.env.local`, and all secret values remain outside Git.

---

### Task 1: Atomic quota module

**Files:**
- Create: `lib/demo/quota.ts`
- Create: `tests/demo-quota.test.ts`
- Modify: `package.json`
- Modify: `package-lock.json`

**Interfaces:**
- Consumes: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`, and optional numeric `DEMO_*` environment variables.
- Produces: `checkPublicDemoQuota(clientId: string, options?: QuotaCheckOptions): Promise<QuotaResult>` and `getBeijingWindow(now: Date): BeijingWindow`.

- [ ] **Step 1: Install the server-only Redis client**

Run:

```bash
npm install @upstash/redis
```

Expected: `package.json` and `package-lock.json` add `@upstash/redis`; no credentials are created locally.

- [ ] **Step 2: Write failing quota tests**

Create `tests/demo-quota.test.ts` with a fake Redis adapter whose `eval` method records keys and returns controlled Redis-script tuples. Cover:

```ts
test("uses the Beijing calendar day and next-midnight reset", () => {
  const before = getBeijingWindow(new Date("2026-08-09T15:59:59.000Z"));
  const after = getBeijingWindow(new Date("2026-08-09T16:00:00.000Z"));
  assert.equal(before.day, "2026-08-09");
  assert.equal(before.retryAfterSeconds, 1);
  assert.equal(after.day, "2026-08-10");
});

test("maps Redis rejection reasons to stable quota codes", async () => {
  const result = await checkPublicDemoQuota("203.0.113.8", {
    env: testEnv,
    redis: fakeRedisReturning([0, 2, 0, 27, 0, 3600]),
    now: new Date("2026-08-09T12:00:00.000Z"),
  });
  assert.equal(result.allowed, false);
  if (!result.allowed) assert.equal(result.code, "CLIENT_DAILY_LIMIT");
});
```

Also assert defaults `3`, `30`, `2`, and `600`; accepted tuples expose remaining counts; global and burst reasons map correctly; generated keys never include the raw IP; missing credentials and thrown Redis calls return `QUOTA_UNAVAILABLE`.

- [ ] **Step 3: Run the focused tests and verify RED**

Run:

```bash
npx tsx --test tests/demo-quota.test.ts
```

Expected: FAIL because `lib/demo/quota.ts` does not exist.

- [ ] **Step 4: Implement the minimal quota module**

Create `lib/demo/quota.ts` with:

```ts
export type QuotaLimitCode =
  | "BURST_LIMIT"
  | "CLIENT_DAILY_LIMIT"
  | "GLOBAL_DAILY_LIMIT";

export type QuotaResult =
  | { allowed: true; remaining: { burst: number; clientDaily: number; globalDaily: number }; resetAt: number }
  | { allowed: false; code: QuotaLimitCode | "QUOTA_UNAVAILABLE"; retryAfterSeconds: number };

export interface BeijingWindow {
  day: string;
  retryAfterSeconds: number;
  keyTtlSeconds: number;
  resetAt: number;
}

export interface QuotaCheckOptions {
  now?: Date;
  env?: NodeJS.ProcessEnv;
  redis?: Pick<Redis, "eval">;
}
```

Implement Beijing time using the fixed UTC+8 offset, HMAC-SHA256 the client ID with the Redis token plus the domain string `centro-public-demo-ip`, and generate keys under `centro:quota:<day>`. Use one Lua `EVAL` call to read all three counters, reject before incrementing when any limit is exhausted, otherwise `INCR` and set TTLs on first creation. Return numeric reason `1=burst`, `2=client daily`, `3=global daily` so TypeScript can map stable codes.

Use environment defaults:

```ts
const clientDailyLimit = readPositiveInteger(env.DEMO_DAILY_PER_IP, 3);
const globalDailyLimit = readPositiveInteger(env.DEMO_DAILY_GLOBAL, 30);
const burstLimit = readPositiveInteger(env.DEMO_BURST_PER_IP, 2);
const burstWindowSeconds = readPositiveInteger(env.DEMO_BURST_WINDOW_SECONDS, 600);
```

Catch Redis/configuration failures, log only a generic quota error, and return `QUOTA_UNAVAILABLE` with retry-after `60`.

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
npx tsx --test tests/demo-quota.test.ts
```

Expected: all quota tests pass with no network access.

- [ ] **Step 6: Commit the quota core**

```bash
git add package.json package-lock.json lib/demo/quota.ts tests/demo-quota.test.ts
git commit -m "feat: add atomic Upstash demo quotas"
```

---

### Task 2: Protect the Agent route

**Files:**
- Modify: `app/api/agent/route.ts`
- Modify: `lib/demo/guard.ts`
- Modify: `tests/demo-guard.test.ts`
- Create: `tests/agent-route-quota.test.ts`

**Interfaces:**
- Consumes: `checkPublicDemoQuota()` and the existing `getClientIdentifier(headers)`.
- Produces: `getQuotaHttpError(result: Extract<QuotaResult, { allowed: false }>): QuotaHttpError`, HTTP 429 quota responses, and HTTP 503 `QUOTA_UNAVAILABLE` responses before `graph.stream()`.

Define the route-safe mapping type as:

```ts
export interface QuotaHttpError {
  status: 429 | 503;
  code: QuotaLimitCode | "QUOTA_UNAVAILABLE";
  error: string;
  retryAfterSeconds: number;
}
```

- [ ] **Step 1: Write failing route/source contract tests**

Add tests that assert the old synchronous `checkRateLimit` export and process-local `Map` are removed, and that the route awaits `checkPublicDemoQuota` before constructing the stream. Test the response mapping helper with:

```ts
assert.deepEqual(getQuotaHttpError({
  allowed: false,
  code: "GLOBAL_DAILY_LIMIT",
  retryAfterSeconds: 3600,
}), {
  status: 429,
  code: "GLOBAL_DAILY_LIMIT",
  error: "今天的在线体验额度已用完，请体验示例场景，明天再来试试。",
  retryAfterSeconds: 3600,
});
```

Cover all three limit messages and the unavailable 503 message.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
npx tsx --test tests/demo-guard.test.ts tests/agent-route-quota.test.ts
```

Expected: FAIL while the route still imports `checkRateLimit` and the mapping helper is absent.

- [ ] **Step 3: Integrate the asynchronous quota check**

Remove the process-local rate map and its test-only reset function from `lib/demo/guard.ts`, retaining validation and client identification. In `app/api/agent/route.ts`, after validation and API-key availability checks, call:

```ts
const quota = await checkPublicDemoQuota(getClientIdentifier(request.headers));
if (!quota.allowed) {
  const failure = getQuotaHttpError(quota);
  return NextResponse.json(
    { success: false, code: failure.code, error: failure.error },
    { status: failure.status, headers: { "Retry-After": String(failure.retryAfterSeconds) } },
  );
}
```

Keep `DEMO_RATE_LIMIT_ENABLED=false` as the only bypass. Do not include raw identifiers, credentials, or Redis keys in response bodies or logs.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run:

```bash
npx tsx --test tests/demo-guard.test.ts tests/agent-route-quota.test.ts
```

Expected: all validation and quota response tests pass.

- [ ] **Step 5: Commit route protection**

```bash
git add app/api/agent/route.ts lib/demo/guard.ts tests/demo-guard.test.ts tests/agent-route-quota.test.ts
git commit -m "feat: enforce durable live demo limits"
```

---

### Task 3: Document deployment and visitor behavior

**Files:**
- Modify: `README.md`
- Modify: `README.zh-CN.md`

**Interfaces:**
- Consumes: environment names and response behavior implemented in Tasks 1-2.
- Produces: fork/deployment instructions without secret values.

- [ ] **Step 1: Update both deployment guides**

Replace process-local limiter language with the exact production defaults and document:

```text
UPSTASH_REDIS_REST_URL
UPSTASH_REDIS_REST_TOKEN
DEMO_DAILY_PER_IP=3
DEMO_DAILY_GLOBAL=30
DEMO_BURST_PER_IP=2
DEMO_BURST_WINDOW_SECONDS=600
```

State that Vercel Marketplace injects the first two variables, secrets must never enter Git, daily quotas reset at Beijing midnight, and the preset remains unlimited.

- [ ] **Step 2: Verify documentation consistency**

Run:

```bash
rg -n "process-local|进程内|5 custom|最多提交 5|Upstash|DEMO_DAILY_GLOBAL" README.md README.zh-CN.md
```

Expected: no stale claim that production relies on five process-local requests per ten minutes; both documents contain Upstash and `DEMO_DAILY_GLOBAL`.

- [ ] **Step 3: Commit documentation**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: explain Upstash demo quotas"
```

---

### Task 4: Full verification and publication

**Files:**
- Verify only: all files changed by Tasks 1-3

**Interfaces:**
- Consumes: completed quota core, route integration, tests, and documentation.
- Produces: a verified commit series pushed to `origin/main` for Vercel deployment.

- [ ] **Step 1: Run the complete automated suite**

```bash
npm test
```

Expected: zero failures, including existing validation, mobile layout, Agent limits, and new Upstash quota tests.

- [ ] **Step 2: Run the production build**

```bash
npm run build
```

Expected: Next.js production build completes with type checking and route generation successful.

- [ ] **Step 3: Check repository scope**

```bash
git diff --check
git status -sb
git log -4 --oneline
```

Expected: no unstaged product changes, `.codex/` remains untracked and uncommitted, and no `.env*` or credential files appear.

- [ ] **Step 4: Push the implementation**

```bash
git push origin main
```

Expected: GitHub accepts the commits and Vercel starts a Production deployment with the connected Upstash variables.

- [ ] **Step 5: Verify production safely**

Load `https://centro-nine.vercel.app/`, confirm the preset remains instant and unlimited, then make no more than two controlled live requests from one IP. Confirm successful requests stream normally and Vercel logs contain no raw IP, token, or Redis key. Quota exhaustion tests stay automated rather than spending production API calls.
