# Agent Location State Reset Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recompute geocoding and the meeting center whenever a city or member address changes, reuse the center for keyword-only iterations, and reject incomplete route matrices without rendering invalid numbers.

**Architecture:** Add an explicit `locationStrategy` transition to the LangGraph state so routing no longer infers intent from a stale center point. Keep ranking strict by producing recommendations only when every active participant has a real route to a candidate, with a frontend display guard as defense in depth.

**Tech Stack:** TypeScript, LangGraph.js, Node test runner through `tsx`, React 19 server rendering for component verification, Next.js 15.

## Global Constraints

- Keyword-only `iterate` requests preserve participants, participant coordinates, city, and center point.
- `new` requests and location-changing `clarify` requests recompute location and clear candidates, routes, and recommendations.
- A new request never inherits a previous city merely because the new city was omitted.
- Candidates without a route for every active participant are excluded.
- Empty or incomplete routes never render `Infinity`, `-Infinity`, or `NaN`.
- Redis quota behavior, API keys, and public request limits remain unchanged.

---

### Task 1: Explicit Location State Transitions

**Files:**
- Create: `tests/agent-location-state.test.ts`
- Modify: `lib/agent/graph.ts`

**Interfaces:**
- Consumes: compiled `graph`, existing `GatherAnnotation`, parsed intents `new | iterate | clarify`, and existing participant/city/center state.
- Produces: internal `locationStrategy: "recompute" | "reuse"`; the conditional edge routes `recompute` through `geocode` and `computeCenter`, while `reuse` goes directly to `searchPoi`.

- [x] **Step 1: Write failing full-graph tests**

Create a deterministic fake `fetch` for geocoding, POI search, and route planning, then invoke the real compiled graph with:

```ts
{
  participants: [
    { name: "我", address: "苏州观前街", location: "120.623550,31.314130" },
    { name: "小明", address: "苏州阳澄湖", location: "120.837000,31.430000" },
  ],
  centerPoint: "120.730275,31.372065",
  city: "苏州",
  keywords: "火锅",
  conversationHistory: [
    { role: "user", content: "我住深圳坪山，小明住深圳坪洲，想吃烧烤" },
  ],
}
```

Assert that the final city is `深圳`, both addresses are geocoded, the center differs from the Suzhou center, and returned POIs are the fake Shenzhen POIs. Add a second invocation with `换成水煮肉` and assert that geocoding is not called and the existing center remains unchanged.

- [x] **Step 2: Run the state test and verify RED**

Run: `npx tsx --test tests/agent-location-state.test.ts`

Expected: the Shenzhen test fails because the existing center causes the graph to skip geocoding and recomputation.

- [x] **Step 3: Implement explicit location transitions**

Update `GatherAnnotation` with:

```ts
locationStrategy: Annotation<"recompute" | "reuse">({
  reducer: (_a, b) => b ?? "recompute",
  default: () => "recompute",
}),
```

Set `reuse` only for keyword iterations. For new requests, set `recompute`, replace participants/city, set `centerPoint` to an explicit empty value, and clear candidates/routes/recommendations. For clarification, compare supplied city and member addresses with saved values; any location change chooses `recompute` and clears derived state. Replace the conditional edge’s old center-presence inference with `locationStrategy`.

- [x] **Step 4: Run the state test and verify GREEN**

Run: `npx tsx --test tests/agent-location-state.test.ts`

Expected: both Shenzhen recomputation and keyword reuse tests pass.

---

### Task 2: Complete Route Ranking and Safe Rendering

**Files:**
- Modify: `tests/agent-location-state.test.ts`
- Create: `tests/recommendation-cards.test.ts`
- Modify: `lib/agent/graph.ts`
- Modify: `app/components/RecommendationCards.tsx`

**Interfaces:**
- Consumes: active geocoded participants, candidate POIs, and route results.
- Produces: recommendations whose `routes.length` equals the active participant count; otherwise returns an empty recommendation list with a route-planning failure message.

- [x] **Step 1: Write failing route and rendering tests**

Make the fake transit and driving endpoints return no routes, invoke the graph, and assert `recommendations` is empty and the assistant response explains that complete routes could not be calculated. Render `RecommendationCards` with a deliberately malformed recommendation containing `routes: []`, `maxDuration: -Infinity`, and assert the output contains `路线暂不可用` but contains neither `Infinity` nor `NaN`.

- [x] **Step 2: Run focused tests and verify RED**

Run: `npx tsx --test tests/agent-location-state.test.ts tests/recommendation-cards.test.ts`

Expected: current ranking creates `999` fallback routes and the component renders invalid numeric text.

- [x] **Step 3: Enforce complete routes and guard the component**

In `rankResultsNode`, return a recommendation only when a real route exists for every participant. If no recommendation remains, emit:

```text
暂时无法计算所有成员到候选地点的完整路线，请稍后重试或更换更具体的地址。
```

In `RecommendationCards`, branch on `rec.routes.length > 0` before rendering wait/average metrics and travel advice; render `路线暂不可用` for malformed data.

- [x] **Step 4: Run focused tests and verify GREEN**

Run: `npx tsx --test tests/agent-location-state.test.ts tests/recommendation-cards.test.ts`

Expected: all focused tests pass and rendered markup contains no invalid numeric values.

---

### Task 3: Regression Verification and Publication

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-agent-location-state-reset.md` to mark completed steps.

**Interfaces:**
- Consumes: the completed state transition, ranking, and rendering changes.
- Produces: a verified commit on `main` and a GitHub push that triggers Vercel Production.

- [x] **Step 1: Run all tests**

Run: `npm test`

Expected: zero failures; the dedicated real-Upstash test may skip without isolated test credentials.

- [x] **Step 2: Run the production build**

Run: `npm run build`

Expected: compilation, lint/type checking, static generation, and route collection succeed.

- [ ] **Step 3: Inspect and commit only intended files**

```bash
git diff --check
git status -sb
git add lib/agent/graph.ts app/components/RecommendationCards.tsx tests/agent-location-state.test.ts tests/recommendation-cards.test.ts docs/superpowers/plans/2026-08-10-agent-location-state-reset.md
git commit -m "fix: recompute location when addresses change"
```

Do not add the unrelated `.codex/` directory.

- [ ] **Step 4: Push Production source**

Run: `git push origin main`

Expected: `origin/main` advances to the new fix commit and Vercel starts a new deployment.
