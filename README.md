<div align="center">

# Centro

### AI-powered fair meetup planning

**Find a place that fits the plan without making one person cross the whole city.**

Describe where everyone starts and what the group wants to do. Centro interprets the request, searches around a shared area, compares real route times, and explains the fairest options on a map.

![Next.js](https://img.shields.io/badge/Next.js-15-111827?logo=nextdotjs)
![React](https://img.shields.io/badge/React-19-087EA4?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![LangGraph](https://img.shields.io/badge/LangGraph-Agent-0F766E)
![AMap](https://img.shields.io/badge/AMap-Web%20Service-1677FF)

[Live Demo](https://centro-nine.vercel.app/) · [中文文档](./README.zh-CN.md) · [Try the preset](#zero-cost-showcase) · [Quick start](#quick-start) · [Product design](./docs/superpowers/specs/2026-08-09-public-demo-portfolio-design.md)

</div>

---

## Why Centro

Choosing a restaurant for people in different neighborhoods looks simple until the group starts comparing routes.

- **Coordination is repetitive.** Someone searches venues, everyone checks a route, and the discussion starts again when the cuisine changes.
- **A geometric midpoint is not necessarily fair.** Rivers, road networks, metro transfers, and congestion can turn equal straight-line distances into very different journeys.
- **Travel fairness competes with venue preference.** The closest area may not contain the food or activity the group actually wants.
- **Most recommendations hide the trade-off.** A useful answer should show who travels how far and why one option ranks above another.

Centro converts that group-chat problem into one auditable flow.

## How it works

```text
Natural-language request
  → infer participants, addresses, city, and venue preference
  → geocode each starting point
  → compute a shared search area
  → discover nearby venues
  → plan every participant-to-venue route
  → rank by the slowest arrival time
  → render the map, route breakdown, and explanation
```

The ranking objective is deliberately easy to explain:

```text
fairness score = max(route time for every participant)
```

Minimizing the maximum route time avoids a result that looks efficient on average while placing most of the burden on one person. Total travel time remains visible as supporting context.

## Features

| Capability | What it does |
|---|---|
| Natural-language intake | Extracts people, locations, city, and preferences from conversational Chinese input |
| Multi-turn clarification | Asks for missing information instead of failing an incomplete request |
| Constraint iteration | Understands follow-ups such as “switch to Japanese food” without re-entering every address |
| Real route comparison | Uses AMap geocoding, POI search, and route planning rather than straight-line distance alone |
| Fairness-first ranking | Sorts venues by the slowest participant's arrival time |
| Agent progress streaming | Streams geocoding, searching, planning, and ranking states through SSE |
| Explainable map results | Shows participants, the search center, ranked venues, and per-person route details |
| Responsive results | Exposes both conversation and map/results views on mobile |

## Zero-cost showcase

The first screen includes a **Suzhou hotpot** preset labeled “No API · sample data.” It populates the normal map, message, and recommendation state without calling an LLM or AMap Web Service.

This gives portfolio visitors a reliable way to understand the full result experience even when live API capacity is disabled. The preset is clearly labeled and is never presented as a live recommendation.

For live search, try:

```text
我住观前街，小明住阳澄湖，想吃火锅
```

Then refine it conversationally:

```text
换成日料
```

## Architecture

| Layer | Responsibility | Technology |
|---|---|---|
| Interface | Chat, map, recommendation cards, responsive views | Next.js 15, React 19, Tailwind CSS, Leaflet |
| API | Request validation, durable quotas, SSE transport | Next.js Route Handler + Upstash Redis |
| Agent | Intent parsing, clarification, state transitions, ranking | LangGraph.js |
| Intelligence | Structured intent extraction | DeepSeek through an OpenAI-compatible API |
| Location | Geocoding, nearby POIs, public-transit/driving routes | AMap Web Service |

The main Agent graph is:

```text
START → parseInput
  ├─ missing information → ask user → END
  ├─ preference iteration → searchPoi
  └─ new/clarified request → geocode → computeCenter

searchPoi → planRoutes → rankResults → END
```

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
DEMO_DAILY_PER_IP=3
DEMO_DAILY_GLOBAL=30
DEMO_BURST_PER_IP=2
DEMO_BURST_WINDOW_SECONDS=600
```

Start the development server:

```bash
npm run dev
```

Open `http://localhost:3000`. The sample preset works without credentials; custom live search requires both API keys.

## Verification

```bash
npm test
npm run build
```

The test suite covers public request validation, atomic daily and burst quotas, Beijing-day rollover, failure protection, mobile layout, and Agent cost boundaries.

## Deployment and API keys

Forks should configure their own keys in the deployment provider. Real credentials must remain in `.env.local` or provider-managed environment variables; never add them to Git.

For Vercel:

1. Import the forked GitHub repository.
2. Add `LLM_API_KEY`, `LLM_BASE_URL`, `LLM_MODEL`, and `AMAP_API_KEY` under Project Settings → Environment Variables.
3. Connect an Upstash Redis database from Vercel Marketplace. Keep the generated `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` server-only.
4. Keep the demo quota variables enabled with the values shown above.
5. Deploy the `main` branch.

The application also applies these cost boundaries:

- 300 characters per request;
- 20 retained chat messages;
- 4 participants;
- 5 routed venue candidates;
- 3 accepted live searches per client IP per Beijing calendar day;
- 30 accepted live searches across the deployment per Beijing calendar day;
- 2 accepted live searches per client IP per 10-minute fixed window.

All three counters are checked and incremented atomically in shared Upstash Redis before any LLM or AMap call. Daily limits reset at Beijing midnight. If credentials, Redis, or live capacity are unavailable, the endpoint fails closed while the zero-cost preset remains unlimited.

## Current limitations

- The product currently optimizes one city's local meetup scenario; inter-city recommendations require a different transport model.
- Route planning is bounded for public-demo cost control and is not an exhaustive venue search.
- Venue availability, reservations, dietary constraints, and live congestion are not yet modeled.
- IP-based anonymous quotas are not user accounts: shared networks share a quota, while changing networks may produce a new quota.
- Location text is sent to the configured LLM and map providers during live search; deployments should publish an appropriate privacy notice before collecting real user data.

## Roadmap

- Weighted preferences for cost, rating, cuisine, and accessibility
- Shareable meetup plans and participant voting
- Arrival-time windows and opening-hours checks
- Authenticated usage tiers and privacy-preserving usage analytics
- Evaluation fixtures for intent extraction and ranking quality

## License

[MIT](./LICENSE)
