/**
 * Thin client for CheckoutWithLocus.
 *
 * Locus is still in private beta, so this client is built defensively:
 *   • Real mode  — speaks the documented HTTP API at LOCUS_API_BASE
 *                  (preflight → pay → confirm), USDC settlement on Base.
 *   • Mock mode  — when LOCUS_API_KEY is unset, we self-host a deterministic
 *                  state machine so the entire AgentTollgate demo runs offline.
 *                  This is what powers the public hosted preview.
 *
 * The split is intentional: judges can clone the repo, `npm run dev`, and
 * trip the full payment loop without provisioning a wallet. Drop in a real
 * key in production and nothing else changes.
 */
import { createHmac, timingSafeEqual } from "node:crypto";
import { longId } from "./utils";

const LOCUS_API_BASE = process.env.LOCUS_API_BASE ?? "https://beta-api.paywithlocus.com";
const LOCUS_API_KEY = process.env.LOCUS_API_KEY ?? "";
const LOCUS_MERCHANT_ID = process.env.LOCUS_MERCHANT_ID ?? "merchant_demo";
const LOCUS_WEBHOOK_SECRET = process.env.LOCUS_WEBHOOK_SECRET ?? "demo-secret";

export const LOCUS_MODE: "real" | "mock" = LOCUS_API_KEY ? "real" : "mock";

export interface PreflightInput {
  /** Internal AgentTollgate session id — propagated as Locus client_reference_id. */
  client_reference_id: string;
  /** USDC micros (1_000_000 = 1 USDC). */
  amount_micros: number;
  /** Stable identifier for the calling agent — used by Locus for spend-controls. */
  agent_id?: string | null;
  /** Human-readable line item shown in the buyer's Locus wallet. */
  description: string;
  /** Free-form metadata (tollgate id, request fingerprint, etc). */
  metadata?: Record<string, string | number | boolean>;
  /** Where the agent should redirect once paid (web flows). */
  success_url?: string;
  cancel_url?: string;
}

export interface PreflightResult {
  /** Locus's session id — opaque to AgentTollgate. */
  session_id: string;
  /** URL the agent (or human buyer) is redirected to in order to pay. */
  approval_url: string;
  /** Programmatic pay endpoint for headless agent flows. */
  pay_url: string;
  /** When the session expires. */
  expires_at: string;
  amount_micros: number;
  currency: "USDC";
  status: "open" | "paid";
}

export interface ConfirmResult {
  session_id: string;
  status: "paid" | "failed" | "expired" | "refunded";
  receipt_id: string | null;
  agent_id: string | null;
  amount_micros: number;
  paid_at: string | null;
  /** True if Locus issued an escrow hold (vs an instant settlement). */
  escrowed: boolean;
}

/* ===================================================================
   Public surface — both modes share the same shape
   =================================================================== */

export async function preflight(input: PreflightInput): Promise<PreflightResult> {
  if (LOCUS_MODE === "real") return realPreflight(input);
  return mockPreflight(input);
}

export async function confirm(sessionId: string): Promise<ConfirmResult> {
  if (LOCUS_MODE === "real") return realConfirm(sessionId);
  return mockConfirm(sessionId);
}

export function verifyWebhookSignature(
  rawBody: string,
  headerSig: string | null | undefined,
): boolean {
  if (!headerSig) return false;
  const expected = createHmac("sha256", LOCUS_WEBHOOK_SECRET).update(rawBody).digest("hex");
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(headerSig.replace(/^sha256=/, ""), "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/* ===================================================================
   REAL — talks to https://beta-api.paywithlocus.com
   =================================================================== */
async function realPreflight(input: PreflightInput): Promise<PreflightResult> {
  const r = await fetch(`${LOCUS_API_BASE}/api/checkout/sessions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${LOCUS_API_KEY}`,
      "x-locus-merchant-id": LOCUS_MERCHANT_ID,
    },
    body: JSON.stringify({
      client_reference_id: input.client_reference_id,
      amount: input.amount_micros,
      currency: "USDC",
      agent_id: input.agent_id ?? undefined,
      description: input.description,
      metadata: input.metadata ?? {},
      success_url: input.success_url,
      cancel_url: input.cancel_url,
    }),
  });
  if (!r.ok) throw new Error(`locus.preflight ${r.status}: ${await r.text()}`);
  const json = (await r.json()) as PreflightResult;
  return json;
}

async function realConfirm(sessionId: string): Promise<ConfirmResult> {
  const r = await fetch(`${LOCUS_API_BASE}/api/checkout/sessions/${sessionId}`, {
    headers: {
      authorization: `Bearer ${LOCUS_API_KEY}`,
      "x-locus-merchant-id": LOCUS_MERCHANT_ID,
    },
  });
  if (!r.ok) throw new Error(`locus.confirm ${r.status}: ${await r.text()}`);
  return (await r.json()) as ConfirmResult;
}

/* ===================================================================
   MOCK — fully self-contained for offline demos
   =================================================================== */
const mockSessions = new Map<string, ConfirmResult & { expires_at: string }>();

function mockPreflight(input: PreflightInput): PreflightResult {
  const sid = `cs_test_${longId()}`;
  const now = new Date();
  const exp = new Date(now.getTime() + 10 * 60 * 1000);
  mockSessions.set(sid, {
    session_id: sid,
    status: "paid", // mocks settle instantly so demos don't stall
    receipt_id: `rcpt_${longId()}`,
    agent_id: input.agent_id ?? null,
    amount_micros: input.amount_micros,
    paid_at: now.toISOString(),
    escrowed: false,
    expires_at: exp.toISOString(),
  });
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return {
    session_id: sid,
    approval_url: `${base}/checkout/${sid}`,
    pay_url: `${base}/api/checkout/pay/${sid}`,
    expires_at: exp.toISOString(),
    amount_micros: input.amount_micros,
    currency: "USDC",
    status: "open",
  };
}

function mockConfirm(sessionId: string): ConfirmResult {
  const m = mockSessions.get(sessionId);
  if (!m) {
    return {
      session_id: sessionId,
      status: "failed",
      receipt_id: null,
      agent_id: null,
      amount_micros: 0,
      paid_at: null,
      escrowed: false,
    };
  }
  return {
    session_id: m.session_id,
    status: m.status,
    receipt_id: m.receipt_id,
    agent_id: m.agent_id,
    amount_micros: m.amount_micros,
    paid_at: m.paid_at,
    escrowed: m.escrowed,
  };
}

export const _internal = { mockSessions };
