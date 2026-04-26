import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Aggregated analytics for the merchant dashboard.
 * Returns:
 *   - rolling 24h call/revenue series (15m buckets)
 *   - top agents by spend
 *   - top tollgates by revenue
 *   - global counters
 */
export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant_id") ?? "m_demo";

  const totals = db().prepare(
    `SELECT
       COALESCE(SUM(total_calls), 0)            AS calls,
       COALESCE(SUM(total_revenue_micros), 0)   AS revenue_micros,
       COUNT(*)                                  AS tollgates
     FROM tollgates WHERE merchant_id = ?`,
  ).get(merchant);

  const series = db().prepare(
    `SELECT
        substr(created_at, 1, 16) || ':00' AS bucket,
        SUM(amount_micros)                  AS revenue,
        COUNT(*)                            AS calls
     FROM usage
     WHERE created_at >= datetime('now', '-1 day')
       AND tollgate_id IN (SELECT id FROM tollgates WHERE merchant_id = ?)
     GROUP BY bucket
     ORDER BY bucket ASC`,
  ).all(merchant);

  const topAgents = db().prepare(
    `SELECT u.agent_id, SUM(u.amount_micros) AS spent, COUNT(*) AS calls,
            r.score
     FROM usage u
     LEFT JOIN reputation r ON r.agent_id = u.agent_id
     WHERE u.agent_id IS NOT NULL
       AND u.tollgate_id IN (SELECT id FROM tollgates WHERE merchant_id = ?)
     GROUP BY u.agent_id
     ORDER BY spent DESC LIMIT 10`,
  ).all(merchant);

  const topTollgates = db().prepare(
    `SELECT id, slug, name, total_calls, total_revenue_micros
     FROM tollgates WHERE merchant_id = ?
     ORDER BY total_revenue_micros DESC LIMIT 5`,
  ).all(merchant);

  return NextResponse.json({ totals, series, topAgents, topTollgates });
}
