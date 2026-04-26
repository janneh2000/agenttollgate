import { db } from "./db";
import type { AgentReputation } from "./types";

/**
 * Score model: starts at 500, ranges [0, 1000].
 *   • +12 per successful call (capped at +60/day)
 *   • -40 per chargeback / failed delivery
 *   • +0.001 * usdc_spent (so heavy spenders climb a bit faster)
 *   • decays toward 500 by 1 point/day after 14d inactivity
 */
export function recordSuccess(agentId: string, amount_micros: number) {
  if (!agentId) return;
  const r = ensure(agentId);
  const dayDelta = perDayDelta(agentId, +12);
  const usdcBonus = Math.min(20, amount_micros / 1_000_000 / 10);
  const next = clamp(r.score + dayDelta + usdcBonus, 0, 1000);
  db()
    .prepare(
      `UPDATE reputation SET
        successful_calls = successful_calls + 1,
        total_spent_micros = total_spent_micros + ?,
        score = ?,
        last_seen = datetime('now')
      WHERE agent_id = ?`,
    )
    .run(amount_micros, Math.round(next), agentId);
}

export function recordFailure(agentId: string) {
  if (!agentId) return;
  ensure(agentId);
  db()
    .prepare(
      `UPDATE reputation SET
        failed_calls = failed_calls + 1,
        score = MAX(0, score - 40),
        last_seen = datetime('now')
      WHERE agent_id = ?`,
    )
    .run(agentId);
}

export function getReputation(agentId: string): AgentReputation {
  return ensure(agentId);
}

export function topAgents(limit = 10): AgentReputation[] {
  return db()
    .prepare("SELECT * FROM reputation ORDER BY score DESC, total_spent_micros DESC LIMIT ?")
    .all(limit) as AgentReputation[];
}

function ensure(agentId: string): AgentReputation {
  const row = db()
    .prepare("SELECT * FROM reputation WHERE agent_id = ?")
    .get(agentId) as AgentReputation | undefined;
  if (row) return row;
  db()
    .prepare(
      "INSERT INTO reputation (agent_id, score) VALUES (?, 500) ON CONFLICT DO NOTHING",
    )
    .run(agentId);
  return {
    agent_id: agentId,
    successful_calls: 0,
    failed_calls: 0,
    total_spent_micros: 0,
    score: 500,
    last_seen: new Date().toISOString(),
  };
}

function perDayDelta(agentId: string, candidate: number): number {
  const dayStart = new Date();
  dayStart.setUTCHours(0, 0, 0, 0);
  const row = db()
    .prepare(
      "SELECT COUNT(*) AS c FROM usage WHERE agent_id = ? AND created_at >= ? AND status_code < 400",
    )
    .get(agentId, dayStart.toISOString()) as { c: number };
  if (row.c * 12 >= 60) return 0;
  return candidate;
}

function clamp(x: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, x));
}
