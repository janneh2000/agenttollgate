# AgentTollgate — Architecture

This is the engineering-side companion to the README. It documents the data model,
control flow, and key design decisions so future contributors (and the hackathon
judges) can grok the codebase in 5 minutes.

## Data model (SQLite)

```
merchants ─────┐
               │
               ▼
            tollgates ──────► sessions ──────► usage
                                  │
                                  └──────► reputation (per agent)
                                  └──────► rate_window (per minute)
```

| Table        | Purpose                                                                         |
|--------------|---------------------------------------------------------------------------------|
| merchants    | The dev who owns one or more tollgates. (Single demo merchant for the hackathon.)|
| tollgates    | An upstream URL + price + policy + pricing strategy.                            |
| sessions     | One row per checkout — Locus session id is the primary key.                     |
| usage        | One row per *upstream* call. Powers the analytics dashboard.                    |
| reputation   | Per-agent score in `[0, 1000]`. Drives reputation-based pricing.                |
| rate_window  | Sliding-minute counter, keyed by `agent_id` (or tollgate id if anon).           |

Schema lives in `src/lib/db.ts` — recreated automatically on first boot.

## Request lifecycle

```
1. Agent → POST /api/proxy/[slug]                                     ┐
                                                                       │
2. proxy.ts:                                                           │
     - lookup tollgate by slug                                         │
     - read x-agent-id and x-locus-receipt                             │
     - capture body (for replay after payment)                          │
                                                                       │
3. If x-locus-receipt is set:                                          │
     - lookup session in db                                            │
     - call locus.confirm(session_id) to verify still paid             ├── proxy/[slug]/route.ts
     - replay body to upstream_url                                      │
     - record usage, bump tollgate counters, update agent reputation    │
                                                                       │
4. Else:                                                                │
     - compute price via pricing.priceFor(tollgate, agentId)            │
     - run policy.evaluatePolicy(...) — caps, rate limits, geo, burst  │
     - call locus.preflight(...) → returns Locus session_id + pay_url  │
     - INSERT into sessions table                                       │
     - return HTTP 402 with the Locus pay info                         ┘
```

## CheckoutWithLocus integration boundary

All Locus contact lives in **`src/lib/locus.ts`** behind three function exports:

- `preflight(input)` — opens a checkout session and returns its pay URL.
- `confirm(sessionId)` — refetches state on receipt of a webhook or before replay.
- `verifyWebhookSignature(rawBody, header)` — HMAC-SHA256 against the shared secret.

The same module exposes a **mock mode** (no `LOCUS_API_KEY` set) that runs an
in-memory state machine matching the same shapes. This is what lets the demo run
end-to-end with `npm run dev` and no Locus credentials.

When Locus's final API surface differs from what's in this file, the only thing that
changes is `realPreflight` and `realConfirm`. Everything upstream — the proxy, the
policy engine, the dashboard, the SDKs — keeps working.

## Policy DSL

```ts
{
  max_per_call_usdc: 5,
  max_per_agent_per_day_usdc: 50,
  max_per_tollgate_per_day_usdc: 500,
  rate_limit_per_minute: 60,
  require_min_reputation: 250,
  block_unknown_agents: false,
  block_geos: ["KP", "IR"],
  block_burst: true,
  emit_receipts: true,
}
```

Each rule maps to a single early-return in `policy.ts:evaluatePolicy`. Denials return
HTTP 429 with a typed error code (e.g. `policy/over_rate_limit`,
`policy/insufficient_reputation`) so the agent SDK can self-correct (back off, climb
reputation, etc.) without human intervention.

This is the "guardian-as-code" idea borrowed from the SolGuard playbook: rules
declared as plain JSON, evaluated server-side, returning typed denials. It cuts down
on abuse without captchas — the kind of friction that breaks AI buyers.

## Reputation scoring

Every agent starts at 500. Successful calls add +12 (capped at +60/day). Failed
deliveries (upstream 5xx after payment) deduct -40. Heavy spenders climb a touch
faster (+0.001 per USDC). Inactivity decays toward 500.

The score directly feeds `pricing.priceFor` when `pricing_strategy = "reputation"`:
score 1000 → 0.6× the base price; score 0 → 1.6×. Trusted agents get a discount,
sketchy ones surge.

## MCP

`scripts/mcp-server.ts` is a zero-dependency JSON-RPC 2.0 server over stdio. It
exposes two tools:

- `search_tollgates(q?, max_usdc?, category?)` → catalog query
- `call_tollgate(slug, body, agent_id?, max_usdc?)` → 402-aware paying call

Both are thin wrappers over the same public HTTP endpoints documented in `/docs`,
so the MCP server can be replaced with any other MCP runtime that knows how to make
HTTP calls.

## Why Next.js App Router

- Single deploy: same Vercel/self-host project ships landing page, dashboard, API,
  and webhook receiver.
- Edge-friendly: every API route can be migrated to the edge runtime with one line
  if scale demands it (the SQLite layer would be replaced with Postgres in that
  case, which is what `db.ts`'s indirection is set up for).
- Streaming-friendly for future improvements (tail-the-revenue-chart, etc.).

## Why SQLite

Hackathon-pragmatic. The schema is small (5 tables), the migration is idempotent,
and `better-sqlite3` is faster than network Postgres for the demo's traffic shapes.
For production: swap `src/lib/db.ts` with a Postgres driver (every query is plain
SQL). No changes to anything else.
