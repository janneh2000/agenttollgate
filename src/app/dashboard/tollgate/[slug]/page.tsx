import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CodeBlock } from "@/components/code-block";
import { microsToUsdc, fmtRelative, safeJSON } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function TollgateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const t = db().prepare("SELECT * FROM tollgates WHERE slug = ?").get(slug) as
    | {
        id: string;
        slug: string;
        name: string;
        description: string;
        upstream_url: string;
        upstream_method: string;
        base_price_micros: number;
        pricing_strategy: string;
        status: string;
        category: string;
        policy: string;
        forward_headers: string;
        total_calls: number;
        total_revenue_micros: number;
        created_at: string;
      }
    | undefined;
  if (!t) notFound();

  const recent = db()
    .prepare(
      `SELECT u.*, s.agent_id AS sess_agent
       FROM usage u LEFT JOIN sessions s ON s.id = u.session_id
       WHERE u.tollgate_id = ?
       ORDER BY u.created_at DESC LIMIT 30`,
    )
    .all(t.id) as Array<{
    id: string;
    agent_id: string | null;
    status_code: number;
    latency_ms: number;
    amount_micros: number;
    created_at: string;
  }>;

  const policy = safeJSON<Record<string, unknown>>(t.policy, {});
  const headers = safeJSON<string[]>(t.forward_headers, []);

  const proxyUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/api/proxy/${t.slug}`;
  const curl = `curl -sS -X ${t.upstream_method} ${proxyUrl} \\
  -H "x-agent-id: agent_demo_001" \\
  -H "content-type: application/json" \\
  -d '{ "prompt": "hello" }'`;

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/dashboard" className="inline-flex items-center gap-1 text-sm text-muted hover:text-fg mb-3">
        <ChevronLeft className="h-4 w-4" /> Dashboard
      </Link>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h1 className="text-3xl font-semibold tracking-tight">{t.name}</h1>
            <Badge tone={t.status === "live" ? "success" : "muted"}>{t.status}</Badge>
            <Badge tone="muted">{t.pricing_strategy}</Badge>
            <Badge tone="muted">{t.category}</Badge>
          </div>
          <p className="text-muted text-sm">{t.description}</p>
        </div>
        <div className="text-right">
          <div className="text-xs text-muted">Lifetime</div>
          <div className="text-2xl font-semibold tabular-nums">
            {microsToUsdc(t.total_revenue_micros)} USDC
          </div>
          <div className="text-xs text-muted">{t.total_calls.toLocaleString()} calls</div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <div className="font-semibold mb-2">Proxy URL</div>
            <code className="block text-sm text-accent font-mono break-all">{proxyUrl}</code>
            <div className="text-xs text-muted mt-2">
              Forwarding {t.upstream_method} to <code className="font-mono">{t.upstream_url}</code>.
              Forwarded headers: {headers.length ? headers.map((h) => <code key={h} className="font-mono mx-1">{h}</code>) : <span className="text-muted">none</span>}
            </div>
          </Card>

          <CodeBlock caption="Send a test call" code={curl} lang="bash" />

          <Card>
            <div className="flex items-center justify-between mb-3">
              <div className="font-semibold">Recent calls</div>
              <Badge tone="muted">{recent.length} shown</Badge>
            </div>
            {recent.length === 0 ? (
              <p className="text-sm text-muted">No calls yet — try the curl above.</p>
            ) : (
              <div className="text-xs">
                <div className="grid grid-cols-12 gap-2 text-muted py-2 border-b border-border">
                  <div className="col-span-3">When</div>
                  <div className="col-span-3">Agent</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-2">Latency</div>
                  <div className="col-span-2 text-right">Amount</div>
                </div>
                {recent.map((u) => (
                  <div key={u.id} className="grid grid-cols-12 gap-2 py-2 border-b border-border/50 hover:bg-bg/40">
                    <div className="col-span-3 text-muted">{fmtRelative(u.created_at)}</div>
                    <div className="col-span-3 font-mono">{u.agent_id ?? "—"}</div>
                    <div className="col-span-2">
                      <Badge tone={u.status_code < 400 ? "success" : "danger"}>{u.status_code}</Badge>
                    </div>
                    <div className="col-span-2 tabular-nums">{u.latency_ms}ms</div>
                    <div className="col-span-2 text-right tabular-nums">{microsToUsdc(u.amount_micros)}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <div className="font-semibold mb-3">Pricing</div>
            <div className="text-3xl font-semibold tabular-nums">
              {microsToUsdc(t.base_price_micros)}
              <span className="text-sm text-muted ml-2">USDC / call</span>
            </div>
            <div className="text-xs text-muted mt-1">
              Strategy: <code className="font-mono">{t.pricing_strategy}</code>
            </div>
            <div className="mt-4 flex gap-2">
              <Button variant="outline" size="sm">Edit</Button>
              <Button variant="ghost" size="sm">Pause</Button>
            </div>
          </Card>

          <Card>
            <div className="font-semibold mb-3">Policy</div>
            <pre className="text-xs text-muted bg-bg/40 p-3 rounded-md overflow-auto">
              {JSON.stringify(policy, null, 2)}
            </pre>
          </Card>

          <Card>
            <div className="font-semibold mb-2">Webhook</div>
            <p className="text-xs text-muted mb-2">
              Locus posts checkout events to <code className="font-mono">/api/checkout/webhook</code>,
              signed with HMAC-SHA256 (header <code className="font-mono">x-locus-signature</code>).
            </p>
            <Badge tone="success">Active</Badge>
          </Card>
        </div>
      </div>
    </div>
  );
}
