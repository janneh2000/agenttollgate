import { z } from "zod";

/** A merchant — the dev who owns one or more tollgates. */
export interface Merchant {
  id: string;
  email: string;
  display_name: string;
  locus_wallet: string | null;
  created_at: string;
}

/** A "tollgate" wraps an upstream HTTP endpoint behind a CheckoutWithLocus paywall. */
export interface Tollgate {
  id: string;
  slug: string;
  merchant_id: string;
  name: string;
  description: string;
  upstream_url: string;
  upstream_method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH";
  /** Forward these headers from the upstream verbatim (e.g. "x-openai-key"). */
  forward_headers: string[];
  /** Default price per call, in USDC micro-units (1_000_000 = 1 USDC). */
  base_price_micros: number;
  currency: "USDC";
  policy: PolicyConfig;
  pricing_strategy: "flat" | "reputation" | "tiered";
  status: "live" | "paused" | "draft";
  category: string;
  /** Public catalog visibility. */
  public: 0 | 1;
  total_calls: number;
  total_revenue_micros: number;
  created_at: string;
}

export interface CheckoutSession {
  id: string;
  tollgate_id: string;
  agent_id: string | null;
  amount_micros: number;
  status: "pending" | "paid" | "expired" | "failed" | "refunded";
  locus_session_id: string | null;
  /** The upstream request payload captured at preflight; replayed on redeem. */
  request_payload: string | null;
  receipt_id: string | null;
  created_at: string;
  paid_at: string | null;
  redeemed_at: string | null;
}

export interface UsageRecord {
  id: string;
  tollgate_id: string;
  agent_id: string | null;
  session_id: string;
  status_code: number;
  latency_ms: number;
  amount_micros: number;
  created_at: string;
}

export interface AgentReputation {
  agent_id: string;
  successful_calls: number;
  failed_calls: number;
  total_spent_micros: number;
  /** Score in [0, 1000]. Higher = more trusted = cheaper pricing. */
  score: number;
  last_seen: string;
}

/* ----------------------------- POLICY DSL ----------------------------- */
/**
 * AgentTollgate's spend-policy DSL — JSON-friendly, evaluated server-side
 * before a checkout session is opened. Inspired by Cloudflare WAF rules
 * but optimized for agent-payment surfaces.
 */
export const PolicyConfigSchema = z.object({
  // Spend caps
  max_per_call_usdc: z.number().nonnegative().optional(),
  max_per_agent_per_day_usdc: z.number().nonnegative().optional(),
  max_per_tollgate_per_day_usdc: z.number().nonnegative().optional(),
  // Rate limits
  rate_limit_per_minute: z.number().int().positive().optional(),
  // Identity gates
  require_min_reputation: z.number().int().min(0).max(1000).optional(),
  block_unknown_agents: z.boolean().optional(),
  // Anomaly heuristics
  block_burst: z.boolean().optional(),
  block_geos: z.array(z.string().length(2)).optional(),
  // Receipts
  emit_receipts: z.boolean().default(true),
});
export type PolicyConfig = z.infer<typeof PolicyConfigSchema>;

export const DEFAULT_POLICY: PolicyConfig = {
  max_per_call_usdc: 5,
  max_per_agent_per_day_usdc: 50,
  rate_limit_per_minute: 60,
  require_min_reputation: 0,
  block_unknown_agents: false,
  block_burst: true,
  emit_receipts: true,
};
