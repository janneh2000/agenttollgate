/**
 * AgentTollgate — agent SDK (TypeScript)
 *
 * Drop-in client for AI agents that want to call paywalled APIs. Handles
 * the 402 → CheckoutWithLocus → retry round-trip transparently. Uses only
 * the global fetch API so it works in Node 20+, Bun, Deno, and the
 * browser.
 *
 *   const out = await tollgate.call({
 *     slug: "image-gen-pro",
 *     agentId: "agent_acme_42",
 *     body: { prompt: "tollbooth on an interstellar highway" },
 *   });
 */

export interface CallOptions {
  slug: string;
  agentId: string;
  body?: unknown;
  /** Forward arbitrary headers to the upstream (e.g. provider keys). */
  headers?: Record<string, string>;
  /** Override per-call price ceiling — fail-fast if the toll exceeds this. */
  maxUsdc?: number;
  /** When true, throw on a 4xx/5xx upstream. Default: return as-is. */
  throwOnUpstreamError?: boolean;
}

export interface CallResult<T = unknown> {
  ok: boolean;
  status: number;
  body: T;
  paidMicros: number;
  sessionId: string;
  latencyMs: number;
}

export interface PaymentRequiredError {
  error: "payment_required";
  reason: string;
  tollgate: { id: string; slug: string; name: string };
  price: { amount_micros: number; amount_usdc: string; currency: "USDC"; multiplier: number; strategy: string };
  agent_id: string | null;
  network: "base";
  session_id: string;
  pay_url: string;
  approval_url: string;
  expires_at: string;
}

export interface TollgateClientOptions {
  baseUrl?: string; // default: https://agenttollgate.dev
  fetchImpl?: typeof fetch;
  /**
   * Optional payment hook. When in real-mode you pass your own Locus pay
   * implementation here (e.g. via the @withlocus SDK). Default behaviour:
   * POST `${baseUrl}/api/checkout/pay/${session_id}` so the demo runs end-to-end.
   */
  pay?: (info: PaymentRequiredError) => Promise<void>;
}

export class Tollgate {
  private opts: Required<TollgateClientOptions>;
  constructor(opts: TollgateClientOptions = {}) {
    this.opts = {
      baseUrl: opts.baseUrl ?? "https://agenttollgate.dev",
      fetchImpl: opts.fetchImpl ?? fetch,
      pay: opts.pay ?? defaultMockPay,
    };
  }

  async call<T = unknown>(o: CallOptions): Promise<CallResult<T>> {
    const start = Date.now();
    const url = `${this.opts.baseUrl}/api/proxy/${o.slug}`;
    const headers: Record<string, string> = {
      "x-agent-id": o.agentId,
      "content-type": "application/json",
      ...o.headers,
    };

    let res = await this.opts.fetchImpl(url, {
      method: o.body == null ? "GET" : "POST",
      headers,
      body: o.body == null ? undefined : JSON.stringify(o.body),
    });

    if (res.status === 402) {
      const pr = (await res.json()) as PaymentRequiredError;
      if (o.maxUsdc != null && parseFloat(pr.price.amount_usdc) > o.maxUsdc) {
        throw new Error(
          `tollgate price ${pr.price.amount_usdc} USDC exceeds maxUsdc ${o.maxUsdc}`,
        );
      }
      await this.opts.pay(pr);
      res = await this.opts.fetchImpl(url, {
        method: o.body == null ? "GET" : "POST",
        headers: { ...headers, "x-locus-receipt": pr.session_id },
        body: o.body == null ? undefined : JSON.stringify(o.body),
      });
    }

    const ct = res.headers.get("content-type") ?? "";
    const body = ct.includes("application/json") ? await res.json() : await res.text();

    const result: CallResult<T> = {
      ok: res.ok,
      status: res.status,
      body: body as T,
      paidMicros: parseInt(res.headers.get("x-tollgate-amount-micros") ?? "0", 10),
      sessionId: res.headers.get("x-tollgate-session") ?? "",
      latencyMs: Date.now() - start,
    };
    if (!res.ok && o.throwOnUpstreamError) {
      throw Object.assign(new Error(`tollgate ${o.slug} → ${res.status}`), { result });
    }
    return result;
  }

  async catalog(opts: { q?: string; maxUsdc?: number; category?: string } = {}) {
    const url = new URL(`${this.opts.baseUrl}/api/catalog`);
    if (opts.q) url.searchParams.set("q", opts.q);
    if (opts.maxUsdc != null) url.searchParams.set("max_usdc", String(opts.maxUsdc));
    if (opts.category) url.searchParams.set("category", opts.category);
    const r = await this.opts.fetchImpl(url.toString());
    if (!r.ok) throw new Error(`catalog ${r.status}`);
    return (await r.json()) as { count: number; items: CatalogItem[] };
  }
}

export interface CatalogItem {
  id: string;
  slug: string;
  name: string;
  description: string;
  category: string;
  pricing: {
    base_price_usdc: number;
    strategy: "flat" | "reputation" | "tiered";
    currency: "USDC";
    network: "base";
  };
  invoke_url: string;
  docs_url: string;
  popularity: number;
}

/** Default singleton — uses the public hosted preview. */
export const tollgate = new Tollgate();

async function defaultMockPay(pr: PaymentRequiredError): Promise<void> {
  // Mock-mode hosted preview auto-settles via this endpoint. Real-mode
  // users override `pay` with their Locus client.
  await fetch(pr.pay_url, { method: "POST" });
}
