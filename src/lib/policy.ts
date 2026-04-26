/**
 * Policy evaluation engine.
 *
 * Pulls the SolGuard "guardian-as-code" pattern into the AgentTollgate stack:
 * before a checkout session is opened, every prospective call is run through
 * a stack of declarative rules. Anything that fails returns a 402 with a
 * machine-readable reason — agents can self-correct (e.g. wait for the rate
 * window, or upgrade their reputation tier) without human intervention.
 */
import { db } from "./db";
import type { PolicyConfig, Tollgate, AgentReputation } from "./types";

export type PolicyDecision =
  | { ok: true }
  | { ok: false; code: PolicyDenyCode; reason: string; retry_after_seconds?: number };

export type PolicyDenyCode =
  | "policy/over_per_call_cap"
  | "policy/over_daily_cap"
  | "policy/over_rate_limit"
  | "policy/insufficient_reputation"
  | "policy/unknown_agent_blocked"
  | "policy/burst_blocked"
  | "policy/geo_blocked";

export function evaluatePolicy(args: {
  tollgate: Tollgate;
  policy: PolicyConfig;
  agentId: string | null;
  amount_micros: number;
  geo?: string | null;
}): PolicyDecision {
  const { tollgate, policy, agentId, amount_micros } = args;
  const usdc = amount_micros / 1_000_000;

  // Identity gates
  if (policy.block_unknown_agents && !agentId) {
    return {
      ok: false,
      code: "policy/unknown_agent_blocked",
      reason: "This tollgate requires an x-agent-id header.",
    };
  }
  if (policy.block_geos && args.geo && policy.block_geos.includes(args.geo.toUpperCase())) {
    return {
      ok: false,
      code: "policy/geo_blocked",
      reason: `Calls from ${args.geo} are blocked by the merchant policy.`,
    };
  }

  // Spend caps
  if (policy.max_per_call_usdc !== undefined && usdc > policy.max_per_call_usdc) {
    return {
      ok: false,
      code: "policy/over_per_call_cap",
      reason: `Computed price ${usdc.toFixed(4)} USDC exceeds per-call cap ${policy.max_per_call_usdc} USDC.`,
    };
  }

  if (policy.max_per_agent_per_day_usdc !== undefined && agentId) {
    const spent = todaySpentMicros({ agentId });
    const wouldBe = (spent + amount_micros) / 1_000_000;
    if (wouldBe > policy.max_per_agent_per_day_usdc) {
      return {
        ok: false,
        code: "policy/over_daily_cap",
        reason: `Daily cap exceeded for agent ${agentId} (${wouldBe.toFixed(2)} > ${policy.max_per_agent_per_day_usdc} USDC).`,
      };
    }
  }

  if (policy.max_per_tollgate_per_day_usdc !== undefined) {
    const spent = todaySpentMicros({ tollgateId: tollgate.id });
    const wouldBe = (spent + amount_micros) / 1_000_000;
    if (wouldBe > policy.max_per_tollgate_per_day_usdc) {
      return {
        ok: false,
        code: "policy/over_daily_cap",
        reason: `Tollgate daily cap exceeded (${wouldBe.toFixed(2)} > ${policy.max_per_tollgate_per_day_usdc} USDC).`,
      };
    }
  }

  // Reputation
  if (policy.require_min_reputation !== undefined && agentId) {
    const rep = getReputation(agentId);
    if (rep.score < policy.require_min_reputation) {
      return {
        ok: false,
        code: "policy/insufficient_reputation",
        reason: `Agent reputation ${rep.score} below required ${policy.require_min_reputation}. Make a few low-value successful calls to climb.`,
      };
    }
  }

  // Rate limit (sliding minute window)
  if (policy.rate_limit_per_minute !== undefined) {
    const key = agentId ? `agent:${agentId}` : `ip:${tollgate.id}`;
    const minute = new Date().toISOString().slice(0, 16); // YYYY-MM-DDTHH:MM
    const row = db()
      .prepare("SELECT count FROM rate_window WHERE key = ? AND bucket = ?")
      .get(key, minute) as { count: number } | undefined;
    const current = row?.count ?? 0;
    if (current >= policy.rate_limit_per_minute) {
      return {
        ok: false,
        code: "policy/over_rate_limit",
        reason: `Rate limit ${policy.rate_limit_per_minute}/min reached for this minute.`,
        retry_after_seconds: 60,
      };
    }
    db().prepare(
      `INSERT INTO rate_window (key, bucket, count) VALUES (?, ?, 1)
       ON CONFLICT(key, bucket) DO UPDATE SET count = count + 1`,
    ).run(key, minute);
  }

  // Burst heuristic — > 5 calls in the past 2 seconds from the same agent.
  if (policy.block_burst && agentId) {
    const windowMs = 2_000;
    const since = new Date(Date.now() - windowMs).toISOString();
    const row = db()
      .prepare(
        "SELECT COUNT(*) as c FROM usage WHERE agent_id = ? AND tollgate_id = ? AND created_at >= ?",
      )
      .get(agentId, tollgate.id, since) as { c: number };
    if (row.c >= 5) {
      return {
        ok: false,
        code: "policy/burst_blocked",
        reason: "Burst detector tripped — back off for ~2s and retry.",
        retry_after_seconds: 2,
      };
    }
  }

  return { ok: true };
}

/* ----------------- helpers ----------------- */
function todaySpentMicros(opts: { agentId?: string; tollgateId?: string }): number {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  if (opts.agentId) {
    const row = db()
      .prepare(
        "SELECT COALESCE(SUM(amount_micros), 0) AS s FROM usage WHERE agent_id = ? AND created_at >= ?",
      )
      .get(opts.agentId, dayStart.toISOString()) as { s: number };
    return row.s ?? 0;
  }
  if (opts.tollgateId) {
    const row = db()
      .prepare(
        "SELECT COALESCE(SUM(amount_micros), 0) AS s FROM usage WHERE tollgate_id = ? AND created_at >= ?",
      )
      .get(opts.tollgateId, dayStart.toISOString()) as { s: number };
    return row.s ?? 0;
  }
  return 0;
}

function getReputation(agentId: string): AgentReputation {
  const row = db()
    .prepare("SELECT * FROM reputation WHERE agent_id = ?")
    .get(agentId) as AgentReputation | undefined;
  if (row) return row;
  return {
    agent_id: agentId,
    successful_calls: 0,
    failed_calls: 0,
    total_spent_micros: 0,
    score: 500, // neutral starting reputation
    last_seen: new Date().toISOString(),
  };
}
