import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Mock-mode pay endpoint.
 *
 * In production the agent never hits this — Locus owns the pay surface and
 * settles on Base. We expose it locally so demos work end-to-end without a
 * real Locus key. The endpoint is a no-op in real mode (returns 410).
 */
export async function POST(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  if (process.env.LOCUS_API_KEY) {
    return NextResponse.json(
      { error: "use_real_locus", detail: "When LOCUS_API_KEY is set, agents pay via the real Locus pay URL." },
      { status: 410 },
    );
  }

  const { id } = await ctx.params;
  const row = db().prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
    | { status: string }
    | undefined;
  if (!row) return NextResponse.json({ error: "session_not_found" }, { status: 404 });
  if (row.status === "paid") {
    return NextResponse.json({ session_id: id, status: "paid" });
  }
  db().prepare(
    "UPDATE sessions SET status = 'paid', paid_at = datetime('now'), receipt_id = 'rcpt_mock_' || lower(hex(randomblob(8))) WHERE id = ?",
  ).run(id);
  return NextResponse.json({ session_id: id, status: "paid", mode: "mock" });
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  return POST(req, ctx);
}
