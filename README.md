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

## For hackathon judges — run the demo in 60 seconds

You don't need a Locus API key. The repo ships with a **mock-mode** that simulates the full CheckoutWithLocus loop end-to-end.

```bash
git clone https://github.com/janneh2000/agenttollgate
cd agenttollgate
npm install --legacy-peer-deps
cp .env.example .env
npm run seed     # loads 8 demo tollgates + 24h of synthetic agent traffic
npm run dev      # → http://localhost:3000
```

> **If `npm install` complains about better-sqlite3 bindings**, run `npm rebuild better-sqlite3 --build-from-source` once and `npm run dev` again.

Then open these in order to see the full system:

| URL | What you'll see |
|-----|-----------------|
| `http://localhost:3000` | Landing page — pitch + live demo CTA |
| `http://localhost:3000/dashboard` | Merchant dashboard — live revenue, p95 latency, top agents, recent 402→paid sessions |
| `http://localhost:3000/catalog` | Public catalog of tollgates (the same surface MCP clients see) |
| `http://localhost:3000/dashboard/new` | The "wrap any URL in 60 seconds" wizard |
| `http://localhost:3000/docs` | Agent SDK docs + curl examples |

### See the 402 → pay → replay loop with curl

Pick any tollgate slug from `/catalog` (e.g. `image-gen-pro-XXXXX`) and run:

```bash
SLUG=<paste-slug-here>

# 1. First call — no payment → 402 Payment Required + Locus pay_url + session_id
curl -i http://localhost:3000/api/proxy/$SLUG \
  -H "x-agent-id: agent_judge_demo" \
  -H "content-type: application/json" \
  -d '{"prompt":"a tollbooth in space"}'

# 2. Settle the mock Locus session (in real mode this is the agent paying via Locus)
SESSION=<paste session_id from step 1>
curl -X POST http://localhost:3000/api/checkout/pay/$SESSION

# 3. Retry with the receipt — proxy replays upstream + returns the real response
curl -i http://localhost:3000/api/proxy/$SLUG \
  -H "x-agent-id: agent_judge_demo" \
  -H "x-locus-receipt: $SESSION" \
  -d '{"prompt":"a tollbooth in space"}'
```

Refresh `/dashboard` after step 3 — you'll see revenue tick up, the new agent appear, and the 402→paid session in the recent-calls list.

### Where to look in the code

| File | What to verify |
|------|----------------|
| `src/lib/locus.ts` | The CheckoutWithLocus client — `preflight`, `confirm`, `verifyWebhookSignature`. The whole integration is in one file. |
| `src/app/api/proxy/[slug]/route.ts` | The 402 protocol — mints session, returns `pay_url`, replays upstream after `confirm`. |
| `src/app/api/checkout/webhook/route.ts` | HMAC-SHA256 webhook verification. |
| `src/lib/policy.ts` | Declarative spend-policy DSL. |
| `src/lib/reputation.ts` | Reputation scoring (0–1000) + price-multiplier formula. |
| `scripts/mcp-server.ts` | The MCP server that exposes tollgates to Claude/Cursor/ChatGPT. |

### Switching to a real Locus key

Drop real keys into `.env` (`LOCUS_API_KEY`, `LOCUS_API_BASE`, `LOCUS_MERCHANT_ID`, `LOCUS_WEBHOOK_SECRET`) — mock mode auto-disables, real `pay_url`s are issued, webhooks get HMAC-verified. Nothing else changes.

📄 Full pitch deck: [`PitchDeck.pdf`](PitchDeck.pdf) · 📐 Architecture write-up: [`ARCHITECTURE.md`](ARCHITECTURE.md) · 🎬 Demo script: [`DEMO_SCRIPT.md`](DEMO_SCRIPT.md)

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

## License

MIT.