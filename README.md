<div align="center">

# Centro

### An AI Agent for fair meetup planning

**Not another midpoint calculator. Centro finds the place where nobody has to absorb an unfair share of the journey.**

Tell Centro where everyone starts and what the group wants. It turns that conversation into a shared search area, compares real routes to every candidate, and explains the fairest choices on a map.

![Next.js](https://img.shields.io/badge/Next.js-15-111827?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-087EA4?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-Agent-0F766E)
![AMap](https://img.shields.io/badge/AMap-Web%20Service-1677FF)
![Upstash](https://img.shields.io/badge/Upstash-Redis-00E9A3?logo=redis&logoColor=white)
![Vercel](https://img.shields.io/badge/Vercel-Live-000000?logo=vercel)

[🚀 Live Demo](https://centro-nine.vercel.app/) · [📖 中文文档](./README.zh-CN.md) · [Try without an API key](#try-it-in-30-seconds) · [Architecture](#how-the-agent-works) · [Quick start](#quick-start)

</div>

---

## The product idea

Meetup planning is a small decision with surprisingly bad coordination costs. One person searches for venues, everyone checks a different route, and the entire conversation restarts when someone changes the cuisine or their starting point.

Centro treats this as a constrained group decision—not a map lookup:

- **A geographic midpoint can be misleading.** Rivers, road networks, metro transfers, and congestion make equal straight-line distances very unequal journeys.
- **The best area is useless without the right venue.** Travel fairness has to be balanced with what the group actually wants to eat or do.
- **An average can hide one terrible trip.** Centro minimizes the slowest participant's route instead of optimizing a number that looks good while one person carries the cost.
- **A recommendation should be inspectable.** The map and cards show every participant's route, so the ranking can be understood rather than merely trusted.

The result is a recommendation the whole group can discuss, refine, and verify.

## Try it in 30 seconds

Open the [live demo](https://centro-nine.vercel.app/) and choose the **Suzhou hotpot** preset labeled “No API · sample data.” It renders the complete map, chat, and recommendation experience without calling the LLM or AMap.

For a live request, try this conversational flow:

```text
我住深圳坪山，小明住深圳坪洲，想吃烧烤
```

Centro geocodes both starting points, computes a new shared search area, finds nearby venues, compares every participant-to-venue route, and ranks the results.

```text
换成水煮肉
```

Only the preference changed, so the Agent reuses the participants and center instead of paying to recompute the same location state.

```text
我地址改到深圳南山
```

The starting point changed, so stale coordinates and recommendations are cleared before Centro geocodes and recomputes the plan.

That distinction—**reuse valid state, invalidate derived state**—is what makes the experience a stateful Agent rather than a sequence of unrelated prompts.

## What visitors can experience

| Capability | What happens |
|---|---|
| Natural-language planning | Chinese conversation is parsed into participants, locations, city, and venue preference |
| Multi-turn clarification | Missing details trigger a focused follow-up instead of a generic failure |
| Stateful refinement | Cuisine-only changes reuse location state; address or city changes recompute it |
| Real route comparison | AMap geocoding, POI discovery, and transit/driving routes replace straight-line guesses |
| Fairness-first ranking | Candidates are sorted by the slowest participant's arrival time |
| Explainable results | The map and cards expose participants, center, venues, distance, duration, and travel mode |
| Visible Agent progress | SSE streams geocoding, searching, route planning, and ranking states |
| Responsive interaction | Mobile visitors can switch between the conversation and map/results views |
| Always-available showcase | A deterministic preset demonstrates the result even when live API capacity is unavailable |

## Why it is more than a map demo

Centro is designed as a portfolio project with mechanisms that can be inspected in code.

### 1. Explicit Agent state transitions

The LangGraph workflow distinguishes three kinds of turns:

```text
new request         → geocode → compute center → search → route → rank
missing information → ask a focused question → wait for clarification
preference change   → reuse locations and center → search → route → rank
address/city change → invalidate stale derived state → geocode again
```

This prevents a new Shenzhen request from accidentally inheriting an earlier Suzhou center while keeping preference-only follow-ups fast and inexpensive.

### 2. An explainable fairness objective

For every candidate venue, Centro calculates:

```text
fairness score = max(route time for every participant)
```

The candidate with the smallest maximum arrival time ranks first. This minimax objective is intentionally simple: it reduces the burden on the worst-off traveler, while total and average journey time remain visible as supporting context.

Candidates without a complete route for every active participant are excluded instead of being ranked with fabricated values. The UI also guards malformed route data so visitors never see `Infinity` or `NaN` as a travel estimate.

### 3. Paid-call protection before the expensive work begins

The public endpoint applies input, workload, burst, per-client daily, and deployment-wide daily boundaries before any LLM or AMap call. Shared counters are checked and incremented atomically in Upstash Redis, so multiple Vercel instances observe the same quota.

If Redis or credentials are unavailable, live search fails closed while the zero-cost preset remains usable. This protects API keys without turning the portfolio into a dead landing page.

### 4. Reproducible evidence

The repository includes regression coverage for Agent state reuse/recomputation, incomplete routes, quota behavior, request validation, Beijing-day rollover, mobile viewport behavior, and Vercel-generated Upstash environment names.

## How the Agent works

```text
Natural-language request
  → extract participants, addresses, city, and venue preference
  → geocode each starting point
  → compute a shared search area
  → discover nearby venues
  → plan every participant-to-venue route
  → rank by the slowest arrival time
  → stream the map, route breakdown, and explanation
```

The main LangGraph topology is:

```text
START → parseInput
  ├─ missing information → ask user → END
  ├─ preference-only iteration → searchPoi
  └─ new/address-changing request → geocode → computeCenter

searchPoi → planRoutes → rankResults → END
```

| Layer | Responsibility | Technology |
|---|---|---|
| Interface | Chat, map, recommendation cards, responsive views | Next.js 15, React 19, Tailwind CSS, Leaflet |
| API | Validation, durable quotas, SSE transport | Next.js Route Handler, Upstash Redis |
| Agent | Intent parsing, clarification, state transitions, ranking | LangGraph.js |
| Intelligence | Structured intent extraction | DeepSeek via an OpenAI-compatible API |
| Location | Geocoding, nearby POIs, transit/driving routes | AMap Web Service |
| Delivery | Serverless deployment and environment management | Vercel |

Important modules:

```text
app/api/agent/route.ts       request guard + SSE Agent endpoint
lib/agent/graph.ts           LangGraph workflow and fairness ranking
lib/agent/limits.ts          participant and candidate cost boundaries
lib/demo/guard.ts            input validation and client identification
lib/demo/quota.ts            atomic Upstash public-demo quotas
lib/demo/presets.ts          credential-free showcase scenarios
lib/tools/amap.ts            AMap geocoding, POI, and route adapters
app/components/MapView.tsx   map visualization
```

## Supported scope

Centro reliably targets **same-city, multi-location meetup planning**, including participants in different neighborhoods and districts. Full addresses that include the city produce the most reliable result.

The current workflow can recognize some long-distance inputs and display distance-based driving or high-speed-rail-oriented hints. That is not the same as complete inter-city planning: Centro does not currently model railway timetables, station transfers, or a multimodal network across cities. True inter-city meetup optimization is listed in the roadmap rather than presented as an implemented capability.

## Quick start

Requirements: Node.js 20 or later, a DeepSeek-compatible API key, and an AMap Web Service key.

```bash
git clone https://github.com/Dewenkings/centro.git
cd centro
npm install
cp .env.local.example .env.local
```

Configure `.env.local`:

```dotenv
LLM_API_KEY=your_deepseek_api_key
LLM_BASE_URL=https://api.deepseek.com/v1
LLM_MODEL=deepseek-chat

AMAP_API_KEY=your_amap_web_service_key

UPSTASH_REDIS_REST_URL=your_upstash_rest_url
UPSTASH_REDIS_REST_TOKEN=your_upstash_rest_token

DEMO_RATE_LIMIT_ENABLED=true
DEMO_DAILY_PER_IP=5
DEMO_DAILY_GLOBAL=30
DEMO_BURST_PER_IP=3
DEMO_BURST_WINDOW_SECONDS=600
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`. The preset works without credentials; custom live search requires both API keys and Redis when demo rate limiting is enabled.

## Verification

```bash
npm test
npm run build
```

The suite covers public request validation, atomic daily and burst quotas, Beijing-day rollover, fail-closed behavior, Agent location state transitions, route integrity, and mobile layout.

## Deployment and API keys

Forks should configure their own keys in the deployment provider. Real credentials belong in `.env.local` or provider-managed environment variables and must never be committed to Git.

For Vercel:

1. Import the forked GitHub repository.
2. Add `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, and `AMAP_API_KEY` under Project Settings → Environment Variables.
3. Connect an Upstash Redis database from Vercel Marketplace. The application accepts both canonical Upstash names and the prefixed names generated by the integration.
4. Keep the demo quota variables enabled with the values shown above.
5. Deploy the `main` branch.

Public-demo cost boundaries:

- 300 characters per request;
- 20 retained chat messages;
- 4 participants per plan;
- 5 routed venue candidates;
- 5 accepted live searches per client IP per Beijing calendar day;
- 30 accepted live searches across the deployment per Beijing calendar day;
- 3 accepted live searches per client IP per 10-minute fixed window.

All three Redis counters are checked atomically before paid services are called. Daily limits reset at Beijing midnight. IP-based anonymous quotas are intentionally simple: shared networks share a quota, while changing networks can produce a new quota.

## Current limitations

- Search is bounded for public-demo cost control and is not an exhaustive venue crawl.
- Venue availability, reservations, dietary constraints, opening hours, and live congestion are not modeled.
- Complete inter-city railway schedules, station transfers, and multimodal routing are not implemented.
- Location text is sent to the configured LLM and map providers during live search; public deployments should publish an appropriate privacy notice before collecting real user data.

## Roadmap

- Timetable-aware inter-city and multimodal meetup planning
- Weighted preferences for cost, rating, cuisine, and accessibility
- Arrival-time windows and opening-hours checks
- Shareable meetup plans, participant voting, and authenticated usage tiers
- Privacy-preserving analytics and evaluation fixtures for ranking quality

## License

[MIT](./LICENSE)
