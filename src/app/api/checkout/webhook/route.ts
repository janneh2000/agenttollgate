import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/locus";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Locus → AgentTollgate webhook receiver.
 *
 * Locus posts checkout session state changes here. Signature is verified
 * with HMAC-SHA256 against LOCUS_WEBHOOK_SECRET. Only `paid`, `expired`,
 * and `refunded` events are acted on; the rest are acked with 200 to keep
 * Locus's retry queue clean.
 */
export async function POST(req: NextRequest) {
  const raw = await req.text();
  const sig = req.headers.get("x-locus-signature");

  // In mock mode (no key set) we still accept webhook events for end-to-end
  // testing. In real mode the signature is mandatory.
  const real = process.env.LOCUS_API_KEY;
  if (real && !verifyWebhookSignature(raw, sig)) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let evt: { type: string; data: { session_id?: string; status?: string; receipt_id?: string } };
  try {
    evt = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  const sid = evt.data.session_id;
  if (!sid) return NextResponse.json({ ok: true });

  switch (evt.type) {
    case "checkout.session.paid":
      db().prepare(
        "UPDATE sessions SET status = 'paid', paid_at = datetime('now'), receipt_id = ? WHERE id = ?",
      ).run(evt.data.receipt_id ?? null, sid);
      break;
    case "checkout.session.expired":
      db().prepare("UPDATE sessions SET status = 'expired' WHERE id = ?").run(sid);
      break;
    case "checkout.session.refunded":
      db().prepare("UPDATE sessions SET status = 'refunded' WHERE id = ?").run(sid);
      break;
    default:
      // ignore unknown event types but ack so Locus doesn't retry
      break;
  }

  return NextResponse.json({ ok: true });
}
