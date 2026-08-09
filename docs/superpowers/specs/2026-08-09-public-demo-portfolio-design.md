# Centro Public Demo and Portfolio Design

## Objective

Turn the existing Centro prototype into a portfolio-ready public demo without publishing API credentials or making the experience entirely dependent on paid third-party calls.

## Product Positioning

Centro is an AI-powered meetup planner that balances every participant's travel time with the group's venue preference. Its differentiator is fairness: candidates are ranked by the slowest participant's real route duration, not only by straight-line distance to a geometric midpoint.

Primary portfolio scenario: friends or colleagues starting from different parts of one city want to choose a restaurant, cafe, or activity that does not unfairly burden one person.

## Public Experience

The landing experience remains the map, recommendation cards, and conversational panel.

- A visitor can launch a curated preset without consuming an LLM or AMap Web Service request.
- A visitor can submit a custom natural-language request when the deployment owner has configured server-side credentials.
- Custom requests show the existing streaming Agent progress.
- Mobile visitors can switch between conversation and map/results instead of losing the visualization entirely.
- Copy clearly distinguishes a sample scenario from live search results.

## Demo Safety Boundary

Credentials remain server-only in Vercel environment variables and are never returned to the browser or committed to Git.

The application applies the following safeguards before invoking the Agent:

- Maximum message length: 300 characters.
- Maximum retained chat history: 20 messages.
- Maximum participants per request: 4.
- Maximum POI candidates routed per request: 5.
- Best-effort per-client application limit: 5 custom requests per 10 minutes, configurable through environment variables.
- Upstream calls keep explicit 10-second timeouts.
- Client responses use safe public errors rather than raw upstream exception text.

The in-process limiter is intentionally described as best-effort because serverless instances do not share memory. Production deployments should also enable a Vercel Firewall or another durable rate limiter. Presets remain available when live API capacity is disabled.

## Architecture

`lib/demo/presets.ts` owns typed, static showcase data and contains no secrets. `lib/demo/guard.ts` owns request validation and best-effort throttling. The API route validates before entering LangGraph and maps failures to stable public error codes. The graph enforces participant and candidate limits so a prompt cannot bypass route-cost bounds.

Frontend state remains in `app/page.tsx`. Selecting a preset populates the same participant, center, recommendation, and chat state used by live responses. `ChatPanel` only renders preset launch controls; it does not know preset data internals.

## Documentation

The root `README.md` becomes the English portfolio entry. `README.zh-CN.md` provides equivalent Chinese documentation. Both include:

- product value proposition and pain points;
- demo and language navigation;
- feature list and fairness explanation;
- Agent workflow and architecture;
- local setup and environment variables;
- public-demo security model and limitations;
- roadmap and license.

No document will contain a real key. If a verified public deployment URL is unavailable, the repository link remains usable and the Live Demo link is added only after deployment succeeds.

## Error Handling

Invalid input returns HTTP 400 with a stable message. Rate limits return HTTP 429 and `Retry-After`. Missing live credentials return HTTP 503 and direct users to a preset or local setup. Unexpected Agent failures return a generic HTTP/SSE error plus an internal request identifier; the server logs the underlying error.

## Verification

- Node tests cover request validation and rate-limit boundaries.
- Production build verifies React, Next.js, and TypeScript integration.
- `git diff --check` verifies patch hygiene.
- A credential scan verifies that only placeholder environment values are tracked.
- Manual smoke tests verify preset loading, desktop layout, mobile switching, and SSE error rendering.

## Commit Strategy

1. Commit the already-built SSE streaming changes as one coherent feature.
2. Commit demo safety, preset experience, and tests.
3. Commit English and Chinese portfolio documentation.
4. Push all commits together to `origin/main` only after verification passes.
