# Centro Public Demo and Portfolio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a safe, portfolio-ready Centro demo with zero-cost presets, bounded custom Agent requests, mobile results, and bilingual documentation.

**Architecture:** Static preset data feeds the same page state as live Agent responses. A focused server guard validates and throttles custom requests before LangGraph, while the graph caps participant and routing fan-out. The repository presents English and Chinese portfolio narratives without committing credentials.

**Tech Stack:** Next.js 15, React 19, TypeScript, LangGraph.js, Leaflet, Node test runner through `tsx`.

## Global Constraints

- Never commit or expose `LLM_API_KEY` or `AMAP_API_KEY`.
- Live custom requests accept at most 300 characters, 20 history messages, 4 participants, and 5 routed candidates.
- Preset scenarios must work without LLM or AMap Web Service credentials.
- Application rate limiting is documented as best-effort; production also requires platform-level protection.
- Existing SSE behavior remains backward-compatible with the frontend event parser.
- Do not add an account system, database, or paid infrastructure dependency.

---

### Task 1: Preserve the Existing SSE Feature

**Files:**
- Modify: `app/api/agent/route.ts`
- Modify: `app/components/ChatPanel.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: SSE events shaped as `{ type: "state" | "done" | "error", ...payload }`.

- [ ] **Step 1: Run the production build against the existing SSE diff**

Run: `npm run build`
Expected: Next.js compilation and type checking succeed.

- [ ] **Step 2: Check patch whitespace**

Run: `git diff --check`
Expected: no output.

- [ ] **Step 3: Commit the coherent SSE change**

```bash
git add app/api/agent/route.ts app/components/ChatPanel.tsx app/page.tsx
git commit -m "feat: stream agent progress to the interface"
```

### Task 2: Validate and Throttle Public Requests

**Files:**
- Create: `lib/demo/guard.ts`
- Create: `tests/demo-guard.test.ts`
- Modify: `app/api/agent/route.ts`
- Modify: `package.json`
- Modify: `.env.local.example`

**Interfaces:**
- Produces: `validateAgentRequest(input: unknown): ValidationResult`.
- Produces: `checkRateLimit(clientId: string, now?: number): RateLimitResult`.
- Produces: `getClientIdentifier(headers: Headers): string`.

- [ ] **Step 1: Add failing validation tests**

Cover a valid request, empty message, message over 300 characters, history over 20 entries, and malformed JSON shapes in `tests/demo-guard.test.ts`.

- [ ] **Step 2: Run tests and verify the new module is missing**

Run: `npx tsx --test tests/demo-guard.test.ts`
Expected: FAIL because `@/lib/demo/guard` or the relative guard module cannot be resolved.

- [ ] **Step 3: Implement validation and a fixed-window limiter**

Implement constants `MAX_MESSAGE_LENGTH = 300`, `MAX_HISTORY_MESSAGES = 20`, default limit `5`, and default window `600_000`. Return discriminated unions with public messages and retry seconds.

- [ ] **Step 4: Integrate the guard before `graph.stream`**

Return JSON 400 for validation errors, JSON 429 with `Retry-After` for throttling, and JSON 503 when live credentials are absent. Do not return raw exception messages.

- [ ] **Step 5: Add and run the test script**

Add `"test": "tsx --test tests/**/*.test.ts"` to `package.json`.

Run: `npm test`
Expected: all guard tests pass.

- [ ] **Step 6: Commit request protection**

```bash
git add lib/demo/guard.ts tests/demo-guard.test.ts app/api/agent/route.ts package.json .env.local.example
git commit -m "feat: bound public agent requests"
```

### Task 3: Bound Agent Cost and Latency

**Files:**
- Create: `lib/agent/limits.ts`
- Create: `tests/agent-limits.test.ts`
- Modify: `lib/agent/graph.ts`

**Interfaces:**
- Produces: `limitParticipants<T>(items: T[]): T[]` with a maximum of 4.
- Produces: `limitCandidates<T>(items: T[]): T[]` with a maximum of 5.

- [ ] **Step 1: Add failing boundary tests**

Assert that lists below the maximum are unchanged and lists above the maximum are truncated to 4 participants or 5 candidates.

- [ ] **Step 2: Run the focused tests**

Run: `npx tsx --test tests/agent-limits.test.ts`
Expected: FAIL because `lib/agent/limits.ts` does not exist.

- [ ] **Step 3: Implement pure limit helpers**

Export `MAX_PARTICIPANTS`, `MAX_CANDIDATES`, `limitParticipants`, and `limitCandidates` from `lib/agent/limits.ts`.

- [ ] **Step 4: Apply limits inside the graph**

Reject newly parsed requests above 4 participants with a collecting-state explanation. Request only 5 POIs and route only the limited candidate list.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: guard and limit suites pass.

- [ ] **Step 6: Commit cost bounds**

```bash
git add lib/agent/limits.ts tests/agent-limits.test.ts lib/agent/graph.ts
git commit -m "perf: cap demo routing fan-out"
```

### Task 4: Add a Zero-Cost Preset Experience

**Files:**
- Create: `lib/demo/presets.ts`
- Modify: `app/components/ChatPanel.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: `DemoPreset` and `DEMO_PRESETS`.
- `ChatPanel` consumes `presets: Array<{ id: string; label: string }>` and `onSelectPreset(id: string): void`.

- [ ] **Step 1: Create typed static showcase data**

Add a Suzhou hotpot scenario containing two participants, a center point, three recommendations, route durations, and a short assistant explanation. Include a visible `sample` label.

- [ ] **Step 2: Render preset chips in the empty chat state**

Pass preset metadata into `ChatPanel`; selecting a chip invokes `onSelectPreset` and does not call `/api/agent`.

- [ ] **Step 3: Populate normal page state from the selected preset**

Set messages, participants, center point, and recommendations from the selected preset. Reset live Agent state so a later custom query starts cleanly.

- [ ] **Step 4: Verify the build**

Run: `npm run build`
Expected: compilation and type checking succeed.

- [ ] **Step 5: Commit the preset experience**

```bash
git add lib/demo/presets.ts app/components/ChatPanel.tsx app/page.tsx
git commit -m "feat: add a zero-cost showcase scenario"
```

### Task 5: Restore Mobile Map and Results Access

**Files:**
- Modify: `app/page.tsx`

**Interfaces:**
- Produces: mobile view state `"chat" | "results"` and two accessible toggle buttons.

- [ ] **Step 1: Add a mobile chat/results switcher**

Render chat in the chat view and a vertically stacked map plus recommendation cards in the results view. Keep the existing desktop layout unchanged.

- [ ] **Step 2: Auto-open results after preset or live recommendations arrive**

Set the mobile view to `results` whenever a preset is selected or a successful live stream produces recommendations.

- [ ] **Step 3: Verify responsive compilation**

Run: `npm run build`
Expected: compilation and type checking succeed.

- [ ] **Step 4: Commit mobile results**

```bash
git add app/page.tsx
git commit -m "feat: expose map results on mobile"
```

### Task 6: Publish the Bilingual Portfolio Documentation

**Files:**
- Modify: `README.md`
- Create: `README.zh-CN.md`

**Interfaces:**
- Produces: English default documentation with a Chinese language link, and equivalent Chinese documentation with an English link.

- [ ] **Step 1: Rewrite the English root README**

Include positioning, pain points, feature table, fairness ranking, workflow, architecture, quick start, environment variables, demo safety, limitations, roadmap, and MIT license.

- [ ] **Step 2: Add equivalent Chinese documentation**

Keep commands and environment names identical to the English version. Describe presets as sample data, not live recommendations.

- [ ] **Step 3: Scan documentation for placeholders and secrets**

Run: `rg -n 'TBD|TODO|<repo-url>|LLM_API_KEY=[^你<[:space:]]|AMAP_API_KEY=[^你<[:space:]]' README.md README.zh-CN.md .env.local.example`
Expected: no unresolved placeholder or real credential match.

- [ ] **Step 4: Commit documentation**

```bash
git add README.md README.zh-CN.md
git commit -m "docs: present Centro as a bilingual portfolio project"
```

### Task 7: Final Verification and Push

**Files:**
- Verify all tracked implementation and documentation files.

**Interfaces:**
- Consumes: all deliverables from Tasks 1-6.

- [ ] **Step 1: Run automated verification**

Run: `npm test`
Expected: all tests pass.

Run: `npm run build`
Expected: Next.js production build succeeds.

Run: `git diff --check`
Expected: no output.

- [ ] **Step 2: Inspect final repository scope**

Run: `git status -sb`
Expected: only intentionally untracked local `.codex/` remains; source and docs are committed.

- [ ] **Step 3: Verify no credential is tracked**

Run: `git grep -n -E 'LLM_API_KEY=|AMAP_API_KEY=' -- ':!README*'`
Expected: only placeholder values in `.env.local.example`.

- [ ] **Step 4: Push verified commits**

Run: `git push origin main`
Expected: `main` is synchronized with `origin/main`.
