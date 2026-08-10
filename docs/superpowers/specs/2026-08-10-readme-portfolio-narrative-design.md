# Centro README Portfolio Narrative Design

**Date:** 2026-08-10  
**Scope:** `README.md` and `README.zh-CN.md`

## Objective

Reframe Centro so the repository works for two audiences at once:

1. A visitor should understand the product in seconds and feel motivated to try it.
2. A recruiter or interviewer should see concrete product judgment, Agent architecture, algorithmic reasoning, reliability controls, and deployment maturity.

The documentation must remain accurate. It may make the demonstrated engineering feel ambitious, but it must not present incomplete inter-city routing as a production-ready capability.

## Positioning

Centro is not a geographic midpoint calculator. It is an AI meetup-planning Agent that turns conversational group constraints into explainable, fairness-first venue recommendations based on route time.

The primary promise is:

> Find the place where nobody has to absorb an unfair share of the journey.

The Chinese version should use natural product language rather than literal translation. Its central line should communicate:

> 不是简单找一个地理中点，而是找到一个谁都不用太委屈的见面地点。

## Audience Structure

The README should reveal information in this order:

1. **Product hook:** what Centro solves and why the result is different.
2. **Fast proof:** live demo, zero-cost preset, and a copyable conversation example.
3. **User value:** common coordination pain points and the observable experience.
4. **Engineering depth:** stateful Agent flow, route-based fairness objective, SSE, quotas, and cost boundaries.
5. **Reproducibility:** setup, environment variables, tests, deployment, and limitations.

This lets non-technical visitors stop after the product story while allowing technical reviewers to continue into implementation evidence.

## Core Claims and Evidence

| Claim | Evidence in the repository |
|---|---|
| Conversational planning | Structured intent extraction and clarification in `lib/agent/graph.ts` |
| Stateful follow-up | Keyword-only changes reuse locations; address/city changes recompute geocoding and center state |
| Fairness-first ranking | Candidates are ordered by the maximum participant route duration |
| Real route comparison | AMap geocoding, POI discovery, and transit/driving adapters |
| Explainable output | Map markers, ranked cards, per-participant route duration and distance |
| Resilient public demo | Credential-free preset, Redis quotas, request limits, and fail-closed API behavior |
| Mobile usability | Responsive conversation/map switching and safe-area-aware input |

## Capability Boundary

The reliable supported scenario is multiple participants at different locations within the same city, including different neighborhoods and districts.

Centro can recognize some long-distance inputs and may display driving or high-speed-rail-oriented guidance based on route distance. However, the current workflow uses one city context for transit planning and searches within a bounded radius around one computed center. It does not model railway schedules, station transfers, or a true inter-city multimodal network.

Therefore:

- Do not headline Centro as fully supporting inter-city meetup planning.
- Describe same-city, multi-location planning as the production-ready capability.
- Describe complete inter-city multimodal planning as a roadmap extension.
- Explain the distinction explicitly enough to withstand an engineering interview.

## README Content Design

### Hero

- Strong one-line product promise.
- One short paragraph explaining natural-language input, real route comparison, and fairness ranking.
- Live Demo, language switch, preset, quick-start, and architecture links.
- Existing technology badges remain, with Upstash Redis added if the layout stays readable.

### Product Proof

Add a compact section that shows the complete conversational lifecycle:

```text
我住深圳坪山，小明住深圳坪洲，想吃烧烤
→ geocode + recompute center + search + compare routes

换成水煮肉
→ reuse participants and center + search again

我地址改到深圳南山
→ clear stale location state + geocode and recompute
```

The English README will explain the same state transitions in idiomatic English while retaining Chinese example prompts because the current intake experience targets conversational Chinese.

### Why It Matters

Focus on four pains:

- group-chat coordination loops;
- misleading geographic midpoints;
- conflict between venue preference and travel fairness;
- opaque recommendations that hide who bears the cost.

### Engineering Highlights

Surface the repository's strongest portfolio signals:

- explicit LangGraph state transitions;
- minimax fairness objective;
- real map-service adapters;
- streamed Agent progress;
- atomic distributed quotas before paid calls;
- bounded participants, candidates, history, and input size;
- deterministic zero-cost demo and regression coverage.

Avoid generic claims such as “enterprise-grade,” “production-ready AI,” or “intelligent algorithm” unless the surrounding text names the mechanism that justifies the claim.

### Limitations and Roadmap

Keep limitations visible and precise. Presenting them is part of the engineering credibility, not a disclaimer to hide.

The roadmap should separate valuable next steps from implemented behavior, especially:

- true inter-city multimodal routing;
- arrival-time and opening-hours constraints;
- voting and shareable plans;
- preference weighting and evaluation fixtures.

## Language Strategy

### Chinese

- Lead with relatable coordination pain and confident product language.
- Prefer short, concrete sentences.
- Explain technical mechanisms in Chinese while preserving standard terms such as Agent, SSE, Redis, and minimax where useful.
- Avoid exaggerated internet-marketing phrases.

### English

- Lead with the product thesis and decision model.
- Use concise portfolio language familiar to engineering and product reviewers.
- Avoid word-for-word translation from Chinese.
- Keep implementation claims directly traceable to repository modules or tests.

## Validation

Before publication:

- verify every internal link and heading anchor;
- verify live-demo and repository URLs;
- confirm quota values match source defaults;
- confirm all cross-city wording respects the capability boundary;
- run the existing test suite and production build even though the changes are documentation-only;
- inspect the staged diff to exclude `.codex/` and secrets.

## Out of Scope

- No product UI changes.
- No new presets or screenshots.
- No routing algorithm changes.
- No claim that live availability, reservations, real-time congestion, or railway schedules are modeled.
