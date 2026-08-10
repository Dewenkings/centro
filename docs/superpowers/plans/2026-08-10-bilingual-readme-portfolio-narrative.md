# Bilingual README Portfolio Narrative Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rewrite Centro's English and Chinese READMEs so the product story attracts demo users while the technical evidence stands up to engineering interview review.

**Architecture:** Keep the two READMEs structurally aligned but write each in idiomatic language. Lead with product value and a copyable interaction, then expose the state machine, minimax ranking, map integrations, reliability controls, reproducibility, and precise capability limits.

**Tech Stack:** Markdown, Next.js 15, React 19, LangGraph.js, AMap Web Service, Upstash Redis, Vercel

## Global Constraints

- Reliable positioning is same-city, multi-location meetup planning, including different neighborhoods and districts.
- Do not claim complete inter-city multimodal routing; list it as a roadmap extension.
- Every engineering claim must name a mechanism or repository module that supports it.
- Preserve the live demo, language switch, setup, deployment, quota, verification, license, and privacy information.
- Keep quota values aligned with source defaults: 5 per client per Beijing day, 30 globally per Beijing day, and 3 per client per 600 seconds.
- Do not change product code, dependencies, API behavior, or UI in this task.

---

### Task 1: Product-First English README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: the implemented Agent flow in `lib/agent/graph.ts`, cost controls in `lib/demo/quota.ts`, and the approved narrative design.
- Produces: the canonical English project overview linked from GitHub and the Chinese README.

- [x] **Step 1: Rewrite the hero and product proof**

Use the product thesis “not a midpoint calculator” and add a three-turn example that distinguishes a new request, a preference-only iteration, and an address-changing iteration.

- [x] **Step 2: Reorder user value and engineering evidence**

Place a concise “Why it matters” section before a technical “Why it is more than a map demo” section. Name LangGraph state transitions, minimax ranking, AMap route comparison, SSE, atomic Upstash quotas, bounded workload, mobile results, and credential-free showcase data.

- [x] **Step 3: Make capability boundaries explicit**

State that same-city multi-location planning is reliable. Explain that long-distance hints do not equal timetable-aware inter-city routing, then place true multimodal inter-city planning in the roadmap.

- [x] **Step 4: Check English links and factual values**

Run `rg -n "centro-nine|README.zh-CN|DEMO_DAILY_PER_IP|DEMO_DAILY_GLOBAL|DEMO_BURST_PER_IP|inter-city|same-city" README.md`.

Expected: the demo/language links exist, quota values remain 5/30/3, and both supported and unsupported geographic scopes are stated.

---

### Task 2: Product-First Chinese README

**Files:**
- Modify: `README.zh-CN.md`

**Interfaces:**
- Consumes: the completed English information hierarchy and the same implementation evidence.
- Produces: an idiomatic Chinese product narrative with equivalent facts and capability boundaries.

- [x] **Step 1: Rewrite the Chinese hero and scenario hook**

Lead with “不是简单找一个地理中点，而是找到一个谁都不用太委屈的见面地点。” Explain the result in user language before introducing technical terms.

- [x] **Step 2: Add the three-turn conversational proof**

Use these exact intent examples:

```text
我住深圳坪山，小明住深圳坪洲，想吃烧烤
换成水煮肉
我地址改到深圳南山
```

Explain which state is recomputed or reused after each turn.

- [x] **Step 3: Present interview-grade engineering highlights**

Explain the LangGraph state machine, minimax fairness objective, real AMap calls, SSE progress, Redis atomic quotas, workload boundaries, deterministic preset, mobile experience, and regression protection without marketing superlatives.

- [x] **Step 4: Clarify same-city and cross-city scope**

Use “同城多地点/跨城区” for the supported use case. State that complete cross-city railway schedules, station transfers, and multimodal routing are not implemented.

- [x] **Step 5: Check Chinese links and factual values**

Run `rg -n "centro-nine|README.md|DEMO_DAILY_PER_IP|DEMO_DAILY_GLOBAL|DEMO_BURST_PER_IP|同城|跨城" README.zh-CN.md`.

Expected: links exist, quota values remain 5/30/3, and scope language is unambiguous.

---

### Task 3: Cross-Language Verification and Publication

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-bilingual-readme-portfolio-narrative.md` to mark completed steps.

**Interfaces:**
- Consumes: the final English and Chinese READMEs.
- Produces: verified documentation commits on `main` and a push that updates the GitHub project page.

- [x] **Step 1: Scan for unsupported or contradictory claims**

Run `rg -n "fully supports inter-city|完整支持跨城|production-ready AI|企业级 AI|one city's local|只支持同一个城市" README.md README.zh-CN.md`.

Expected: no exaggerated or stale geographic claims.

- [x] **Step 2: Verify Markdown hygiene and repository status**

Run `git diff --check` and `git status -sb`.

Expected: no whitespace errors; `.codex/` remains untracked and unstaged.

- [x] **Step 3: Run regression verification**

Run `npm test` and `npm run build`.

Expected: zero test failures and a successful Next.js production build. The dedicated real-Upstash test may skip without isolated test credentials.

- [x] **Step 4: Commit only intended documentation**

```bash
git add README.md README.zh-CN.md docs/superpowers/plans/2026-08-10-bilingual-readme-portfolio-narrative.md
git commit -m "docs: strengthen Centro portfolio narrative"
```

- [x] **Step 5: Push the completed documentation**

Run `git push origin main`.

Expected: `origin/main` advances to the README documentation commit.
