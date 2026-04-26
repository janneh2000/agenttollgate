# AgentTollgate

> **The 60-second paywall for the agentic economy.**
> Wrap any HTTP API behind a CheckoutWithLocus toll. AI agents preflight, pay in USDC,
> and consume — with policy enforcement, reputation-aware pricing, and live revenue
> analytics from the first call.

Built for **[Locus' Paygentic Hackathon — Week 3 (CheckoutWithLocus track)](https://paygentic-week3.devfolio.co)**.

[![Locus](https://img.shields.io/badge/Powered%20by-Locus-21e5b5)](https://paywithlocus.com)
[![USDC on Base](https://img.shields.io/badge/USDC-Base-7c5cff)](https://www.base.org)
[![License: MIT](https://img.shields.io/badge/license-MIT-555)](LICENSE)

---

## What it is

AI agents are starting to call APIs the way humans call shops — *programmatically and
constantly*. Stripe-style payments don't fit, because the buyer isn't a card-holding
human in a browser; it's a script with a USDC wallet and a budget.

**AgentTollgate** is a drop-in paywall layer that lets developers monetise *any* HTTP
endpoint for those buyers in under a minute:

1. Paste an upstream URL + a price.
2. Get back a proxy URL.
3. Agents call it. Pay-or-refuse happens via **CheckoutWithLocus**.

Behind the scenes we add the things merchants actually need but can't be bothered to
build themselves:

- **402-style payment-required protocol** every Locus-aware agent already understands.
- **Policy DSL** — per-agent caps, rate limits, geo blocks, anomaly detection.
- **Reputation-aware pricing** — high-trust agents get a discount, sketchy ones surge.
- **MCP discovery** — your tollgates auto-appear in Claude / Cursor / ChatGPT.
- **Real-time analytics** — revenue/min, p95 latency, top agents, payment heatmaps.
- **Webhook receiver** — HMAC-SHA256 verified Locus events, idempotent.

> **Why "tollgate"?** A tollgate doesn't care who's driving — only that they paid.
> That's the right mental model for paywalls in the agentic economy.

---

## Architecture (one screen)

```
                     ┌──────────────────────────────────────────┐
                     │              AgentTollgate               │
  AI Agent ─────────▶│  /api/proxy/[slug]   policy   pricing    │
   (Claude,          │   ┌─────────────────────────────────┐    │
    GPT,             │   │ 402 Payment Required            │    │
    Cursor)          │   │  → mint Locus session           │    │
                     │   │  → return pay_url               │    │
                     │   └─────────────────────────────────┘    │
                     │   ↑          paid?         ↓            │
                     │   │                                       │
                     │   │     ┌──────────────────┐              │
                     │   │     │ /api/checkout/   │              │
                     │   │     │   webhook (HMAC) │◀── Locus     │
                     │   │     └──────────────────┘              │
                     │   ▼                                       │
                     │  forward → upstream → record usage        │
                     │  bump revenue, score the agent            │
                     └──────────────────────────────────────────┘
                                    │
                                    ▼
                           Merchant dashboard
                       (live revenue, agents, p95)
```

Stack: **Next.js 15** (App Router) · **TypeScript** · **Tailwind** · **better-sqlite3**
(swap for Postgres in prod) · **recharts** for live analytics · pure-Node MCP server.

---

## Quickstart

```bash
git clone <this-repo>
cd agenttollgate
npm install
cp .env.example .env       # works as-is in mock mode
npm run seed               # load demo catalog + 24h of synthetic traffic
npm run dev                # → http://localhost:3000
```

Then:

- **Landing page** → `http://localhost:3000`
- **Dashboard** → `http://localhost:3000/dashboard`
- **Public catalog** → `http://localhost:3000/catalog`
- **Docs** → `http://localhost:3000/docs`

### Try the paywall (curl)

```bash
# 1. Hit a tollgate without payment.
curl -i http://localhost:3000/api/proxy/image-gen-pro-XXXXX \
    -H "x-agent-id: agent_acme_42" \
    -H "content-type: application/json" \
    -d '{ "prompt": "tollbooth on an interstellar highway" }'
# → HTTP/1.1 402 Payment Required, includes session_id + pay_url

# 2. Auto-settle in mock mode.
curl -X POST http://localhost:3000/api/checkout/pay/cs_test_xyz

# 3. Retry with the receipt.
curl -i http://localhost:3000/api/proxy/image-gen-pro-XXXXX \
    -H "x-agent-id: agent_acme_42" \
    -H "x-locus-receipt: cs_test_xyz" \
    -d '{ "prompt": "tollbooth on an interstellar highway" }'
```

### Try the agent SDK (TypeScript)

```ts
import { Tollgate } from "agenttollgate";

const tg = new Tollgate({ baseUrl: "http://localhost:3000" });

const out = await tg.call({
  slug: "image-gen-pro-XXXXX",
  agentId: "agent_acme_42",
  body: { prompt: "tollbooth on an interstellar highway" },
});

console.log(out.body, out.paidMicros, out.latencyMs);
```

### Try the MCP server (Claude Desktop / Cursor)

```bash
# In one terminal:
npm run dev

# In another, register the MCP server:
AGENTTOLLGATE_BASE=http://localhost:3000 npx tsx scripts/mcp-server.ts
```

Then add this to your MCP host config (Claude Desktop `claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "agenttollgate": {
      "command": "npx",
      "args": ["tsx", "/absolute/path/to/scripts/mcp-server.ts"],
      "env": { "AGENTTOLLGATE_BASE": "http://localhost:3000" }
    }
  }
}
```

Now ask Claude "find an image generation tollgate cheaper than 0.02 USDC and run it
with prompt 'a tollbooth in space'". The MCP server discovers, pays, and returns.

---

## Going live with a real Locus key

Drop your Locus credentials into `.env`:

```
LOCUS_API_KEY=sk_live_…
LOCUS_API_BASE=https://beta-api.paywithlocus.com
LOCUS_MERCHANT_ID=mer_…
LOCUS_WEBHOOK_SECRET=whsec_…
```

That's it. The mock-mode pay endpoint switches off (`410 Gone`), the SDK starts hitting
Locus's real `pay_url`, and webhooks get HMAC-verified before mutating state. Nothing
else changes.

> **Note:** the Locus API surface used in `src/lib/locus.ts` is modelled on the
> documented CheckoutWithLocus shape. It's intentionally encapsulated in a thin
> client (`preflight`, `confirm`, `verifyWebhookSignature`) so when Locus ships its
> final spec the only file that changes is that one.

---

## Project layout

```
agenttollgate/
├── src/
│   ├── app/
│   │   ├── page.tsx                       # landing
│   │   ├── docs/page.tsx                  # docs + agent SDK examples
│   │   ├── catalog/page.tsx               # public catalog (humans + MCP)
│   │   ├── dashboard/                     # merchant dashboard
│   │   │   ├── page.tsx
│   │   │   ├── new/page.tsx               # tollgate creation wizard
│   │   │   └── tollgate/[slug]/page.tsx   # detail + recent calls
│   │   └── api/
│   │       ├── proxy/[slug]/route.ts      # the paywalled proxy itself
│   │       ├── tollgates/route.ts         # CRUD
│   │       ├── tollgates/[id]/route.ts
│   │       ├── usage/route.ts             # analytics
│   │       ├── catalog/route.ts           # public discovery
│   │       └── checkout/
│   │           ├── webhook/route.ts       # Locus webhook receiver (HMAC)
│   │           └── pay/[id]/route.ts      # mock-mode pay (410 in real-mode)
│   ├── components/                        # nav, footer, charts, code-block, ui/
│   └── lib/
│       ├── db.ts                          # better-sqlite3 + migrations
│       ├── locus.ts                       # CheckoutWithLocus client (real + mock)
│       ├── policy.ts                      # spend-policy evaluator
│       ├── reputation.ts                  # agent reputation scorer
│       ├── pricing.ts                     # flat / reputation / tiered
│       └── types.ts
├── packages/
│   └── sdk/                               # publishable agent SDK
│       ├── index.ts                       #   TypeScript client
│       └── agenttollgate.py               #   Python client
├── scripts/
│   ├── mcp-server.ts                      # bundled MCP server
│   └── seed.ts                            # demo data + 24h traffic
└── data/                                  # SQLite db (auto-created)
```

---

## What's unique vs. existing solutions

| Concern                | Stripe + custom code  | Crossmint / Coinbase Commerce | **AgentTollgate**                          |
|------------------------|-----------------------|--------------------------------|--------------------------------------------|
| Designed for AI agents | ✗                     | partial (web checkout)         | **yes — 402-pattern, headless first**       |
| USDC settlement        | ✗                     | yes                            | **yes (Locus, USDC on Base)**               |
| Per-agent spend caps   | DIY                   | ✗                              | **built-in DSL**                            |
| Reputation pricing     | ✗                     | ✗                              | **on-chain audit trail → discounts**        |
| MCP discovery          | ✗                     | ✗                              | **first-class**                             |
| Sub-cent price points  | impractical (fees)    | possible                       | **trivial — settled in micros**             |

---

## Devfolio submission copy

```
Tagline:
The 60-second paywall for the agentic economy. Drop in CheckoutWithLocus on any HTTP API.

Description:
AgentTollgate lets any developer wrap any HTTP endpoint behind a CheckoutWithLocus paywall
in under a minute. AI agents discover via MCP, preflight, pay in USDC on Base, and consume —
with built-in policy enforcement, reputation-aware pricing, and live analytics. We extend
the Locus suite with three new primitives merchants can't easily build themselves:
(1) a declarative spend-policy DSL, (2) reputation-aware pricing computed from the on-chain
audit trail Locus already gives us, and (3) automatic MCP catalog publication so any LLM
client can discover and pay-and-call tollgated endpoints natively.

How it uses CheckoutWithLocus:
We mint a Locus checkout session for every paywalled call (preflight), wait for the
HMAC-signed paid webhook, and replay the captured upstream request. The whole loop is
encapsulated in src/lib/locus.ts so production keys swap in without touching anything else.
A built-in mock mode lets reviewers run the full demo with no Locus key.

Track:
Week 3 — CheckoutWithLocus
```

---

## License

MIT.
