import type { Tollgate } from "./types";
import { getReputation } from "./reputation";

/**
 * Reputation-aware pricing.
 *
 * Most paywalled APIs charge a flat fee per call. AgentTollgate adds two
 * extra strategies that exploit the on-chain audit trail Locus gives us:
 *
 *   • "reputation"  — high-trust agents get a discount, sketchy ones pay
 *                     a surge. Cuts down on abuse without a captcha and
 *                     lets benevolent agents stay cheap as they scale.
 *
 *   • "tiered"      — first 100 calls/day at base, then a cliff to 0.5x.
 *                     Encourages heavy integrations.
 */
export function priceFor(tollgate: Tollgate, agentId: string | null): {
  amount_micros: number;
  multiplier: number;
  reason: string;
} {
  const base = tollgate.base_price_micros;

  if (tollgate.pricing_strategy === "flat" || !agentId) {
    return { amount_micros: base, multiplier: 1, reason: "flat" };
  }

  if (tollgate.pricing_strategy === "reputation") {
    const rep = getReputation(agentId);
    // 1000 → 0.6x ; 500 → 1.0x ; 0 → 1.6x
    const mult = 1.6 - rep.score / 1000;
    return {
      amount_micros: Math.round(base * mult),
      multiplier: round2(mult),
      reason: `rep(${rep.score})→${mult.toFixed(2)}x`,
    };
  }

  if (tollgate.pricing_strategy === "tiered") {
    // Charge 0.5x after the agent's 100th paid call today
    const callsToday = countTodayCalls(tollgate.id, agentId);
    const mult = callsToday >= 100 ? 0.5 : 1;
    return {
      amount_micros: Math.round(base * mult),
      multiplier: mult,
      reason: callsToday >= 100 ? "tier:bulk" : "tier:base",
    };
  }

  return { amount_micros: base, multiplier: 1, reason: "flat" };
}

function countTodayCalls(tollgateId: string, agentId: string): number {
  // Lazy-imported so this file stays cheap when called from edge contexts.
  const { db } = require("./db") as typeof import("./db");
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const row = db()
    .prepare(
      "SELECT COUNT(*) AS c FROM usage WHERE tollgate_id = ? AND agent_id = ? AND created_at >= ? AND status_code < 400",
    )
    .get(tollgateId, agentId, dayStart.toISOString()) as { c: number };
  return row.c ?? 0;
}

function round2(x: number) {
  return Math.round(x * 100) / 100;
}
