import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeJSON } from "@/lib/utils";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Public catalog — open, unauthenticated, MCP-friendly.
 * Any AI agent can query this to discover tollgates that match a query.
 *
 *   GET /api/catalog?q=image+generation&max_usdc=0.05
 *
 * The same shape is what the bundled MCP server returns to its client.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().toLowerCase();
  const maxUsdc = req.nextUrl.searchParams.get("max_usdc");
  const category = req.nextUrl.searchParams.get("category");

  let sql = `SELECT id, slug, name, description, base_price_micros, category, pricing_strategy, total_calls
             FROM tollgates WHERE public = 1 AND status = 'live'`;
  const params: unknown[] = [];
  if (q) {
    sql += " AND (lower(name) LIKE ? OR lower(description) LIKE ? OR lower(category) LIKE ?)";
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (category) {
    sql += " AND category = ?";
    params.push(category);
  }
  if (maxUsdc) {
    sql += " AND base_price_micros <= ?";
    params.push(Math.round(parseFloat(maxUsdc) * 1_000_000));
  }
  sql += " ORDER BY total_calls DESC LIMIT 50";

  const rows = db().prepare(sql).all(...params) as any[];
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const items = rows.map((r) => ({
    id: r.id,
    slug: r.slug,
    name: r.name,
    description: r.description,
    category: r.category,
    pricing: {
      base_price_usdc: r.base_price_micros / 1_000_000,
      strategy: r.pricing_strategy,
      currency: "USDC",
      network: "base",
    },
    invoke_url: `${base}/api/proxy/${r.slug}`,
    docs_url: `${base}/t/${r.slug}`,
    popularity: r.total_calls,
  }));

  return NextResponse.json({ count: items.length, items });
}
