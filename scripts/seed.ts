/**
 * Seed the demo catalog so reviewers see traffic + revenue immediately.
 * Run:  npm run seed
 */
import path from "node:path";
import fs from "node:fs";

// Allow this script to import @/lib/* paths
process.env.DATABASE_PATH ??= path.join(process.cwd(), "data/agenttollgate.db");
fs.mkdirSync(path.dirname(process.env.DATABASE_PATH!), { recursive: true });

import { db } from "../src/lib/db";
import { longId, shortId, usdcToMicros } from "../src/lib/utils";
import { DEFAULT_POLICY } from "../src/lib/types";

const NOW = new Date();

function ago(mins: number) {
  return new Date(NOW.getTime() - mins * 60_000).toISOString().replace("T", " ").slice(0, 19);
}

function ensureMerchant() {
  const id = "m_demo";
  db().prepare(
    `INSERT INTO merchants (id, email, display_name, locus_wallet) VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET display_name = excluded.display_name`,
  ).run(id, "demo@agenttollgate.dev", "Demo Merchant", "0xLOCUS_DEMO_WALLET");
  return id;
}

function seedTollgate(opts: {
  name: string;
  desc: string;
  upstream: string;
  category: string;
  price: number;
  strategy: "flat" | "reputation" | "tiered";
}) {
  const merchantId = ensureMerchant();
  const slug = `${slugify(opts.name)}-${shortId().slice(0, 5)}`;
  const id = `tg_${longId()}`;
  db().prepare(
    `INSERT INTO tollgates (id, slug, merchant_id, name, description, upstream_url, upstream_method,
       forward_headers, base_price_micros, currency, policy, pricing_strategy, status, category, public)
     VALUES (?, ?, ?, ?, ?, ?, 'POST', '["authorization"]', ?, 'USDC', ?, ?, 'live', ?, 1)`,
  ).run(
    id,
    slug,
    merchantId,
    opts.name,
    opts.desc,
    opts.upstream,
    usdcToMicros(opts.price),
    JSON.stringify(DEFAULT_POLICY),
    opts.strategy,
    opts.category,
  );
  return { id, slug };
}

function seedTraffic(tollgateId: string, baseMicros: number) {
  const agents = [
    { id: "agent_acme_42", score: 820 },
    { id: "agent_brick_lab", score: 720 },
    { id: "agent_cursorbot", score: 690 },
    { id: "agent_devops_07", score: 600 },
    { id: "agent_curious", score: 410 },
    { id: "agent_newcomer", score: 510 },
  ];
  for (const a of agents) {
    db().prepare(
      `INSERT INTO reputation (agent_id, successful_calls, failed_calls, total_spent_micros, score, last_seen)
       VALUES (?, 0, 0, 0, ?, datetime('now'))
       ON CONFLICT(agent_id) DO UPDATE SET score = excluded.score`,
    ).run(a.id, a.score);
  }

  let totalCalls = 0;
  let totalRev = 0;
  // 24h of traffic, ~3 calls per 15-min bucket on average
  for (let mins = 24 * 60; mins > 0; mins -= 15) {
    const calls = 1 + Math.floor(Math.random() * 5);
    for (let c = 0; c < calls; c++) {
      const a = agents[Math.floor(Math.random() * agents.length)];
      const mult = 1.6 - a.score / 1000;
      const amount = Math.round(baseMicros * mult);
      const status = Math.random() < 0.93 ? 200 : 502;
      const ts = ago(mins - Math.random() * 14);
      const sid = `cs_seed_${longId()}`;
      db().prepare(
        `INSERT INTO sessions (id, tollgate_id, agent_id, amount_micros, status, locus_session_id, paid_at, redeemed_at, created_at)
         VALUES (?, ?, ?, ?, 'paid', ?, ?, ?, ?)`,
      ).run(sid, tollgateId, a.id, amount, sid, ts, ts, ts);
      db().prepare(
        `INSERT INTO usage (id, tollgate_id, agent_id, session_id, status_code, latency_ms, amount_micros, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      ).run(`u_${longId()}`, tollgateId, a.id, sid, status, 80 + Math.random() * 1200, amount, ts);
      totalCalls++;
      totalRev += amount;
    }
  }
  db().prepare(
    "UPDATE tollgates SET total_calls = ?, total_revenue_micros = ? WHERE id = ?",
  ).run(totalCalls, totalRev, tollgateId);
}

function slugify(s: string) {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "").slice(0, 28);
}

function main() {
  console.log("→ seeding demo catalog…");
  const tg1 = seedTollgate({
    name: "Image Gen Pro",
    desc: "Pay-per-image generation, USDC settled. Reputation-aware pricing rewards trusted agents.",
    upstream: "https://api.openai.com/v1/images/generations",
    category: "ai",
    price: 0.012,
    strategy: "reputation",
  });
  const tg2 = seedTollgate({
    name: "Real-time Web Search",
    desc: "Live SERP results, sub-second latency. Tier discount for >100 calls/day.",
    upstream: "https://api.example-search.com/v1/query",
    category: "search",
    price: 0.0015,
    strategy: "tiered",
  });
  const tg3 = seedTollgate({
    name: "Embeddings (small)",
    desc: "Fast, cheap embeddings. Flat pricing.",
    upstream: "https://api.openai.com/v1/embeddings",
    category: "ai",
    price: 0.0006,
    strategy: "flat",
  });
  const tg4 = seedTollgate({
    name: "On-chain Token Index",
    desc: "Token holders, transfers, prices. Per-call USDC, no API key dance.",
    upstream: "https://api.example-onchain.com/v1/tokens",
    category: "data",
    price: 0.004,
    strategy: "reputation",
  });

  for (const tg of [tg1, tg2, tg3, tg4]) {
    seedTraffic(tg.id, db().prepare("SELECT base_price_micros FROM tollgates WHERE id = ?").get(tg.id) as any);
  }

  // Re-seed traffic now reading the actual base price (the line above was a placeholder)
  for (const tg of [tg1, tg2, tg3, tg4]) {
    const row = db().prepare("SELECT base_price_micros FROM tollgates WHERE id = ?").get(tg.id) as { base_price_micros: number };
    db().prepare("DELETE FROM usage WHERE tollgate_id = ?").run(tg.id);
    db().prepare("DELETE FROM sessions WHERE tollgate_id = ?").run(tg.id);
    seedTraffic(tg.id, row.base_price_micros);
  }

  const totals = db().prepare(
    "SELECT COUNT(*) AS tg, SUM(total_calls) AS calls, SUM(total_revenue_micros) AS rev FROM tollgates",
  ).get() as { tg: number; calls: number; rev: number };

  console.log(
    `✓ seeded ${totals.tg} tollgates, ${totals.calls} usage rows, ${(totals.rev / 1e6).toFixed(4)} USDC revenue`,
  );
}

main();
