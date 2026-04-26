import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { evaluatePolicy } from "@/lib/policy";
import { priceFor } from "@/lib/pricing";
import { recordSuccess, recordFailure } from "@/lib/reputation";
import { preflight, confirm } from "@/lib/locus";
import { longId, safeJSON } from "@/lib/utils";
import { DEFAULT_POLICY } from "@/lib/types";
import type { Tollgate, PolicyConfig } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * 402-style paywalled proxy.
 *
 * The AI agent makes its normal call. If they haven't paid yet, we return
 * HTTP 402 Payment Required with a Locus checkout URL. After payment the
 * agent retries with `x-locus-receipt: <session_id>` and we replay the
 * captured payload upstream.
 *
 * This matches the x402 / Locus convention so agents work the same way
 * across any tollgated endpoint.
 */
export async function POST(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  return handle(req, ctx);
}
export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  return handle(req, ctx);
}

async function handle(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params;
  const tg = db().prepare("SELECT * FROM tollgates WHERE slug = ?").get(slug) as
    | (Tollgate & { policy: string; forward_headers: string })
    | undefined;
  if (!tg) {
    return json(404, { error: "tollgate_not_found", slug });
  }
  if (tg.status !== "live") {
    return json(503, { error: "tollgate_paused" });
  }

  const tollgate: Tollgate = {
    ...tg,
    policy: safeJSON<PolicyConfig>(tg.policy, DEFAULT_POLICY),
    forward_headers: safeJSON<string[]>(tg.forward_headers, []),
  };

  const agentId = req.headers.get("x-agent-id");
  const receipt = req.headers.get("x-locus-receipt");
  const geo = req.headers.get("x-vercel-ip-country");

  // Capture the payload up front so we can replay it after payment.
  const rawBody = req.method === "GET" ? null : await req.text();

  // Compute the price for this specific agent
  const price = priceFor(tollgate, agentId);

  // If the agent already paid, verify and replay.
  if (receipt) {
    const session = db()
      .prepare("SELECT * FROM sessions WHERE id = ?")
      .get(receipt) as
      | { id: string; status: string; tollgate_id: string; request_payload: string | null; amount_micros: number; agent_id: string | null }
      | undefined;
    if (!session || session.tollgate_id !== tollgate.id) {
      return json(402, errPayload(tollgate, agentId, price, "receipt_invalid"));
    }
    // Re-confirm with Locus to make sure it's still paid (not refunded etc.)
    const conf = await confirm(session.id);
    if (conf.status !== "paid") {
      db().prepare("UPDATE sessions SET status = ? WHERE id = ?").run(conf.status, session.id);
      return json(402, errPayload(tollgate, agentId, price, `payment_${conf.status}`));
    }
    if (session.status !== "paid") {
      db().prepare("UPDATE sessions SET status = 'paid', paid_at = datetime('now') WHERE id = ?").run(session.id);
    }
    return await forwardUpstream(tollgate, req, rawBody ?? session.request_payload, {
      sessionId: session.id,
      agentId,
      amount_micros: session.amount_micros,
    });
  }

  // No receipt → policy check + open a checkout session.
  const decision = evaluatePolicy({
    tollgate,
    policy: tollgate.policy,
    agentId,
    amount_micros: price.amount_micros,
    geo,
  });
  if (!decision.ok) {
    return json(429, {
      error: decision.code,
      reason: decision.reason,
      retry_after_seconds: decision.retry_after_seconds,
    });
  }

  const clientRef = `s_${longId()}`;
  const lp = await preflight({
    client_reference_id: clientRef,
    amount_micros: price.amount_micros,
    agent_id: agentId,
    description: `${tollgate.name} — 1 call`,
    metadata: {
      tollgate_id: tollgate.id,
      tollgate_slug: tollgate.slug,
      pricing: price.reason,
    },
  });

  // We key sessions by the Locus session id directly so webhook lookups
  // and `x-locus-receipt` header lookups are O(1).
  db().prepare(
    `INSERT INTO sessions (id, tollgate_id, agent_id, amount_micros, status, locus_session_id, request_payload)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    lp.session_id,
    tollgate.id,
    agentId,
    price.amount_micros,
    lp.status === "paid" ? "paid" : "pending",
    lp.session_id,
    rawBody,
  );

  return json(402, errPayload(tollgate, agentId, price, "payment_required", {
    session_id: lp.session_id,
    pay_url: lp.pay_url,
    approval_url: lp.approval_url,
    expires_at: lp.expires_at,
  }));
}

/* ------------------------------- helpers ------------------------------- */
function errPayload(
  tg: Tollgate,
  agentId: string | null,
  price: ReturnType<typeof priceFor>,
  reason: string,
  extra: Record<string, unknown> = {},
) {
  return {
    error: "payment_required",
    reason,
    tollgate: { id: tg.id, slug: tg.slug, name: tg.name },
    price: {
      amount_micros: price.amount_micros,
      amount_usdc: (price.amount_micros / 1_000_000).toFixed(6),
      currency: "USDC",
      multiplier: price.multiplier,
      strategy: tg.pricing_strategy,
      explanation: price.reason,
    },
    agent_id: agentId,
    network: "base",
    docs: "https://agenttollgate.dev/docs#paying",
    ...extra,
  };
}

async function forwardUpstream(
  tg: Tollgate,
  req: NextRequest,
  body: string | null,
  ctx: { sessionId: string; agentId: string | null; amount_micros: number },
) {
  const start = Date.now();
  const url = new URL(tg.upstream_url);
  // Forward the original querystring (sans our framework headers).
  const incoming = new URL(req.url);
  for (const [k, v] of incoming.searchParams.entries()) url.searchParams.set(k, v);

  const headers = new Headers();
  headers.set("content-type", req.headers.get("content-type") ?? "application/json");
  for (const h of tg.forward_headers ?? []) {
    const v = req.headers.get(h);
    if (v) headers.set(h, v);
  }

  let res: Response;
  try {
    res = await fetch(url.toString(), {
      method: tg.upstream_method,
      headers,
      body: tg.upstream_method === "GET" ? undefined : body ?? undefined,
    });
  } catch (err) {
    db().prepare("UPDATE sessions SET status = 'failed' WHERE id = ?").run(ctx.sessionId);
    if (ctx.agentId) recordFailure(ctx.agentId);
    return json(502, { error: "upstream_unreachable", detail: String(err) });
  }

  const text = await res.text();
  const latency = Date.now() - start;

  // Record usage + bump merchant counters.
  db().prepare(
    `INSERT INTO usage (id, tollgate_id, agent_id, session_id, status_code, latency_ms, amount_micros)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(`u_${longId()}`, tg.id, ctx.agentId, ctx.sessionId, res.status, latency, ctx.amount_micros);

  db().prepare(
    `UPDATE tollgates
       SET total_calls = total_calls + 1,
           total_revenue_micros = total_revenue_micros + ?
     WHERE id = ?`,
  ).run(ctx.amount_micros, tg.id);

  db().prepare("UPDATE sessions SET redeemed_at = datetime('now') WHERE id = ?").run(ctx.sessionId);

  if (res.status < 400 && ctx.agentId) recordSuccess(ctx.agentId, ctx.amount_micros);
  if (res.status >= 500 && ctx.agentId) recordFailure(ctx.agentId);

  const out = new NextResponse(text, { status: res.status });
  // Echo a minimal subset of upstream headers (json/text only) so agents
  // can parse responses without surprises.
  const ct = res.headers.get("content-type");
  if (ct) out.headers.set("content-type", ct);
  out.headers.set("x-tollgate-latency-ms", String(latency));
  out.headers.set("x-tollgate-amount-micros", String(ctx.amount_micros));
  out.headers.set("x-tollgate-session", ctx.sessionId);
  out.headers.set("x-tollgate-redeem", "ok");
  return out;
}

function json(status: number, payload: unknown) {
  return NextResponse.json(payload, { status, headers: { "x-tollgate": "agenttollgate" } });
}
