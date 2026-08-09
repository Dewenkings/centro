# Centro Upstash Public Demo Rate Limit Design

## Goal

Protect the public live-search endpoint from accidental overuse and basic abuse while keeping the zero-cost preset available to every visitor.

The production defaults are:

- 5 accepted live searches per client IP per Beijing calendar day.
- 30 accepted live searches across the whole site per Beijing calendar day.
- 3 accepted live searches per client IP in a 10-minute fixed window that starts with the first accepted request.
- The static preset does not call `/api/agent` and never consumes quota.

An anonymous visitor is identified by IP, not by a durable user account. Shared networks may therefore share a quota, while changing networks may produce a new quota.

## Architecture

`POST /api/agent` performs request validation first, then checks the quota before invoking the LLM, AMap geocoding, POI search, or route planning.

The quota implementation lives behind an asynchronous module in `lib/demo/`. It uses the Upstash REST connection injected by Vercel through:

- `UPSTASH_REDIS_REST_URL`
- `UPSTASH_REDIS_REST_TOKEN`

The existing process-local `Map` limiter is replaced for live requests because Vercel instances do not share memory and may be destroyed at any time.

## Counter Model

One atomic Redis script checks and increments three expiring counters:

1. Daily global counter.
2. Daily hashed-IP counter.
3. Ten-minute hashed-IP burst counter.

All counters increment only when every limit permits the request. Rejected requests therefore do not consume an accepted global slot.

Daily keys include the Beijing date (`Asia/Shanghai`) and expire shortly after the following Beijing midnight. Burst keys expire after ten minutes. The raw IP is never written to Redis; the identifier is an HMAC digest derived with a domain-separated form of the server-only Upstash token. Rotating the token safely resets anonymous per-IP counters.

Defaults can be tuned without code changes:

```text
DEMO_DAILY_PER_IP=5
DEMO_DAILY_GLOBAL=30
DEMO_BURST_PER_IP=3
DEMO_BURST_WINDOW_SECONDS=600
```

`DEMO_RATE_LIMIT_ENABLED=false` remains a deliberate local-development escape hatch. Production documentation will recommend leaving it enabled.

## Responses and Failure Behavior

When a limit is reached, the endpoint returns HTTP `429` with:

- A stable machine-readable code distinguishing client daily, global daily, and burst limits.
- A concise Chinese message suitable for the existing chat UI.
- `Retry-After` and remaining/reset metadata where applicable.

The UI continues to display the API error and points visitors toward the unlimited preset when live capacity is unavailable.

If Upstash credentials are missing or Redis cannot confirm the quota, the live-search endpoint fails closed with HTTP `503`. It does not call the LLM or AMap. This prioritizes cost protection; the preset remains usable. Logs include a request ID but never credentials, raw IP addresses, or Redis keys.

## Security and Cost Boundaries

- Redis credentials remain in Vercel environment variables and are never exposed through `NEXT_PUBLIC_*` variables.
- Quota checks run server-side before every paid or limited dependency call.
- Input, history, participant, candidate, and routing fan-out limits remain in force.
- Fixed-window counters are intentionally used because daily demo quotas value predictable ceilings and low Redis command counts over perfectly smooth traffic.
- Vercel Firewall can later add coarse pre-Redis bot protection, but it is not required for this implementation.

## Testing

Automated tests cover:

- Atomic acceptance below all limits.
- Per-IP daily rejection at the sixth request.
- Global daily rejection at the thirty-first accepted request.
- Burst rejection at the fourth request inside ten minutes.
- Independent IP counters sharing one global counter.
- Beijing-date rollover and key expiry calculations.
- Missing credentials and Redis failures fail closed without calling the Agent graph.
- Existing validation and cost-bound tests continue to pass.

Production verification checks that Vercel exposes both Upstash variables, deploys the new commit, returns `429` for exhausted quotas, and still serves the static preset.
