# Agent Location State Reset Design

## Goal

Prevent a new or updated location request from reusing a previous meeting center, while preserving the convenient behavior of reusing unchanged locations for keyword-only recommendation changes.

## User Behavior

1. On the first request, the user supplies member addresses and a desired food or venue type. Centro geocodes the addresses, computes a meeting center, searches nearby places, plans routes, and ranks complete recommendations.
2. On a keyword-only follow-up such as “换成火锅” or “想吃水煮肉”, Centro reuses the saved participants, city, and center point, then reruns only place search, route planning, and ranking.
3. When the user supplies a new city or changes any member address, Centro invalidates all location-derived state, geocodes the new addresses, computes a new center, and searches in the new location.

## State Transition Design

The Agent state will carry an explicit location-processing decision instead of inferring it from the mere presence of `participants` and `centerPoint`.

- `iterate` requests set the decision to reuse the existing location. They clear candidates, routes, and recommendations but preserve participant coordinates and the center point.
- `new` requests set the decision to recompute location. They replace participants and city, clear the center point and every downstream result, and do not inherit a previous city when the new request omitted one.
- `clarify` requests compare supplied city and member addresses with saved values. If either changes, they clear affected coordinates, center point, candidates, routes, and recommendations and choose recomputation. If only non-location information changes, they may reuse the existing location.
- Graph routing uses the explicit decision: recomputation goes through `geocode → computeCenter`; reuse goes directly to `searchPoi`.

## Route and Ranking Safety

Fairness scores are valid only when every active participant has a route to a candidate.

- A candidate missing any participant route is excluded from ranking.
- If no candidate has complete route coverage, the Agent returns no recommendations and a clear route-planning failure message.
- Ranking never substitutes fabricated `999` values for missing routes and never calls `Math.max` on an empty collection.
- The recommendation card renders averages only for non-empty route arrays as defense in depth.

## Frontend Behavior

When a new request begins, the current results may remain visible until the Agent classifies the request. Once the Agent emits a recomputation transition, the streamed empty candidates and recommendations replace the previous results. Keyword-only iterations retain the map center while refreshing place results.

## Compatibility and Security

- Redis quota behavior and limits are unchanged. An accepted request still consumes one quota unit before Agent execution.
- The public request size and participant/candidate limits are unchanged.
- No API keys, Redis tokens, or user IP values are added to logs or client state.

## Verification

Automated tests will cover:

1. A full Shenzhen request following a Suzhou state chooses recomputation and cannot reuse the Suzhou center.
2. A keyword-only follow-up keeps the existing participants and center while clearing old search results.
3. An address-changing clarification chooses recomputation.
4. Ranking excludes candidates without complete participant route coverage.
5. Zero valid routes produce a clear failure result rather than `Infinity`, `-Infinity`, or `NaN`.
6. The full test suite and Next.js production build pass before publishing.
