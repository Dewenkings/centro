# Product README Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the English and Chinese READMEs into concise open-source product documentation focused on the problem, product behavior, architecture, reproduction, and deployment.

**Architecture:** Keep both languages structurally aligned. Merge repeated Agent explanations into one workflow and one Mermaid diagram, retain verifiable setup and operational details, and remove all portfolio/interview/recruiter/visitor/showcase meta-narrative.

**Tech Stack:** Markdown, Mermaid, Next.js 15, LangGraph.js, AMap Web Service, Upstash Redis, Vercel

## Global Constraints

- Keep “Live Demo” and “Demo rate limits”; remove external-facing portfolio/interview/recruiter/visitor/showcase language.
- Shorten each README by roughly 30%–40% while retaining setup, deployment, project structure, limitations, roadmap, and license.
- Use one conceptual `flowchart LR` Mermaid diagram in each language.
- State same-city multi-location planning as reliable and keep timetable-aware inter-city routing in the roadmap.
- Preserve quota defaults: 5 per client day, 30 global day, 3 per 600-second burst window.
- Do not change application code, API behavior, dependencies, UI, or deployment configuration.

---

### Task 1: Simplify the English Product README

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: product behavior from `lib/agent/graph.ts`, quota defaults from `lib/demo/quota.ts`, and environment names from `.env.local.example`.
- Produces: the canonical English open-source product overview.

- [x] **Step 1: Remove meta-narrative and merge repeated sections**

Delete references to portfolio intent, interviewers, recruiters, visitors, and showcases. Merge repeated state-machine and engineering explanations into “How it works,” “Architecture,” and “Fairness model.”

- [x] **Step 2: Add one Mermaid architecture diagram**

Use `flowchart LR` to connect User, Next.js UI, Agent API, Upstash Redis, LangGraph Agent, LLM, AMap, minimax ranking, and the result UI.

- [x] **Step 3: Preserve reproduction and extension information**

Keep clone/fork, `.env.local.example`, required variables, `npm run dev`, tests, build, Vercel import, Upstash connection, project structure, supported scope, limitations, and roadmap.

- [x] **Step 4: Validate English content**

Run `rg -ni "portfolio|interviewer|recruiter|visitor|showcase" README.md` and expect no matches. Run `rg -n "mermaid|Quick Start|Project Structure|Deployment|DEMO_DAILY_PER_IP=5|DEMO_DAILY_GLOBAL=30|DEMO_BURST_PER_IP=3|DEMO_BURST_WINDOW_SECONDS=600" README.md` and expect every required item.

---

### Task 2: Simplify the Chinese Product README

**Files:**
- Modify: `README.zh-CN.md`

**Interfaces:**
- Consumes: the English information hierarchy and the same source-of-truth modules.
- Produces: an idiomatic Chinese open-source product overview with equivalent facts.

- [x] **Step 1: Remove meta-narrative and merge repeated sections**

Delete “作品集、面试官、招聘方、访客、展示能力” framing. Keep the user problem, conversational refinement, implemented safeguards, and geographic scope.

- [x] **Step 2: Add the localized Mermaid architecture diagram**

Use the same nodes and data flow as English with concise Chinese labels.

- [x] **Step 3: Preserve Fork and deployment instructions**

Explain which values a fork owner must configure, where secrets belong, how to run locally, how to test/build, and how to connect Vercel and Upstash.

- [x] **Step 4: Validate Chinese content**

Run `rg -n "作品集|面试官|招聘方|访客|展示能力" README.zh-CN.md` and expect no matches. Run `rg -n "mermaid|快速开始|项目结构|部署|DEMO_DAILY_PER_IP=5|DEMO_DAILY_GLOBAL=30|DEMO_BURST_PER_IP=3|DEMO_BURST_WINDOW_SECONDS=600" README.zh-CN.md` and expect every required item.

---

### Task 3: Verify and Publish

**Files:**
- Modify: `docs/superpowers/plans/2026-08-10-product-readme-simplification.md` to track completion.

**Interfaces:**
- Consumes: both simplified READMEs.
- Produces: a verified documentation commit pushed to `origin/main`.

- [x] **Step 1: Verify factual consistency and relative links**

Confirm `README.md`, `README.zh-CN.md`, `.env.local.example`, and `LICENSE` exist. Compare all four quota values with `DEFAULT_QUOTA_LIMITS` in `lib/demo/quota.ts`.

- [x] **Step 2: Verify repository hygiene**

Run `git diff --check` and `git status -sb`. Expect no whitespace errors and leave `.codex/` untracked.

- [x] **Step 3: Run regression verification**

Run `npm test` and `npm run build`. Expect zero failures, allowing the dedicated real-Upstash test to skip without isolated credentials.

- [x] **Step 4: Commit only intended documentation**

Run `git add README.md README.zh-CN.md docs/superpowers/plans/2026-08-10-product-readme-simplification.md` and `git commit -m "docs: simplify Centro product README"`.

- [x] **Step 5: Push main**

Run `git push origin main`. Expect `origin/main` to advance to the documentation commit.
