import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { microsToUsdc, fmtRelative } from "@/lib/utils";
import { ArrowRight, Plus } from "lucide-react";
import { RevenueChart } from "@/components/revenue-chart";

export const dynamic = "force-dynamic";

const MERCHANT_ID = "m_demo";

interface UsageRow {
  bucket: string;
  revenue: number;
  calls: number;
}
interface AgentRow {
  agent_id: string;
  spent: number;
  calls: number;
  score: number | null;
}
interface Tg {
  id: string;
  slug: string;
  name: string;
  description: string;
  status: string;
  base_price_micros: number;
  total_calls: number;
  total_revenue_micros: number;
  category: string;
  pricing_strategy: string;
  created_at: string;
}

export default function DashboardPage() {
  const tollgates = db()
    .prepare("SELECT * FROM tollgates WHERE merchant_id = ? ORDER BY created_at DESC")
    .all(MERCHANT_ID) as Tg[];

  const totals = db()
    .prepare(
      `SELECT
         COALESCE(SUM(total_calls), 0) AS calls,
         COALESCE(SUM(total_revenue_micros), 0) AS revenue,
         COUNT(*) AS tollgates
       FROM tollgates WHERE merchant_id = ?`,
    )
    .get(MERCHANT_ID) as { calls: number; revenue: number; tollgates: number };

  const series = db()
    .prepare(
      `SELECT
         substr(created_at, 1, 16) AS bucket,
         SUM(amount_micros) AS revenue,
         COUNT(*) AS calls
       FROM usage
       WHERE created_at >= datetime('now', '-1 day')
         AND tollgate_id IN (SELECT id FROM tollgates WHERE merchant_id = ?)
       GROUP BY bucket ORDER BY bucket ASC`,
    )
    .all(MERCHANT_ID) as UsageRow[];

  const topAgents = db()
    .prepare(
      `SELECT u.agent_id, SUM(u.amount_micros) AS spent, COUNT(*) AS calls, r.score
       FROM usage u LEFT JOIN reputation r ON r.agent_id = u.agent_id
       WHERE u.agent_id IS NOT NULL
         AND u.tollgate_id IN (SELECT id FROM tollgates WHERE merchant_id = ?)
       GROUP BY u.agent_id ORDER BY spent DESC LIMIT 8`,
    )
    .all(MERCHANT_ID) as AgentRow[];

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-8">
        <div>
          <Badge tone="muted" className="mb-2">Demo merchant: m_demo</Badge>
          <h1 className="text-3xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted mt-1">
            Live revenue, top agents, and live tollgates.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/dashboard/new">
            <Button>
              <Plus className="h-4 w-4" /> New tollgate
            </Button>
          </Link>
        </div>
      </div>

      {/* totals */}
      <div className="grid md:grid-cols-3 gap-4">
        <Stat label="Lifetime revenue" value={`${microsToUsdc(totals.revenue)} USDC`} />
        <Stat label="Total agent calls" value={totals.calls.toLocaleString()} />
        <Stat label="Tollgates live" value={String(totals.tollgates)} />
      </div>

      {/* revenue chart */}
      <Card className="mt-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="font-semibold">Revenue · last 24h</div>
            <div className="text-xs text-muted">15-minute buckets · USDC</div>
          </div>
          <Badge tone="success">Live</Badge>
        </div>
        <RevenueChart data={series} />
      </Card>

      {/* tollgates + agents */}
      <div className="grid lg:grid-cols-3 gap-6 mt-6">
        <Card className="lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold">Your tollgates</div>
              <div className="text-xs text-muted">Status, price, lifetime totals</div>
            </div>
            <Link href="/dashboard/new">
              <Button variant="outline" size="sm">+ New</Button>
            </Link>
          </div>
          {tollgates.length === 0 ? (
            <EmptyTollgates />
          ) : (
            <div className="divide-y divide-border">
              {tollgates.map((t) => (
                <div key={t.id} className="py-3 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Link
                        href={`/dashboard/tollgate/${t.slug}`}
                        className="font-medium hover:text-accent truncate"
                      >
                        {t.name}
                      </Link>
                      <Badge tone={t.status === "live" ? "success" : "muted"}>{t.status}</Badge>
                      <Badge tone="muted">{t.pricing_strategy}</Badge>
                    </div>
                    <div className="text-xs text-muted mt-1 font-mono truncate">
                      /api/proxy/{t.slug} · {microsToUsdc(t.base_price_micros)} USDC/call
                    </div>
                  </div>
                  <div className="text-right text-xs">
                    <div className="text-fg font-medium">
                      {microsToUsdc(t.total_revenue_micros)} USDC
                    </div>
                    <div className="text-muted">{t.total_calls.toLocaleString()} calls</div>
                  </div>
                  <Link href={`/dashboard/tollgate/${t.slug}`}>
                    <Button variant="ghost" size="icon"><ArrowRight className="h-4 w-4" /></Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card>
          <div className="flex items-center justify-between mb-4">
            <div>
              <div className="font-semibold">Top agents</div>
              <div className="text-xs text-muted">By spend, with reputation</div>
            </div>
          </div>
          {topAgents.length === 0 ? (
            <p className="text-sm text-muted">No traffic yet — run the demo seed or send a test call.</p>
          ) : (
            <div className="space-y-2">
              {topAgents.map((a, i) => (
                <div key={a.agent_id} className="flex items-center justify-between p-2 rounded-md hover:bg-bg/40">
                  <div className="flex items-center gap-3">
                    <div className="h-7 w-7 rounded-full bg-gradient-to-br from-accent/30 to-accent2/30 text-fg text-xs flex items-center justify-center">
                      {i + 1}
                    </div>
                    <div>
                      <div className="font-mono text-xs">{a.agent_id}</div>
                      <div className="text-[10px] text-muted">
                        {a.calls} calls · score {a.score ?? "—"}
                      </div>
                    </div>
                  </div>
                  <div className="text-xs font-medium">{microsToUsdc(a.spent)}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <div className="text-xs uppercase tracking-wider text-muted">{label}</div>
      <div className="text-3xl font-semibold mt-2 tabular-nums">{value}</div>
    </Card>
  );
}

function EmptyTollgates() {
  return (
    <div className="border border-dashed border-border rounded-lg p-8 text-center">
      <div className="font-semibold mb-1">No tollgates yet</div>
      <p className="text-sm text-muted mb-4">
        Create your first paywalled API in 60 seconds. Or run <code className="kbd">npm run seed</code> to load the demo catalog.
      </p>
      <Link href="/dashboard/new">
        <Button>Create a tollgate <ArrowRight className="h-4 w-4" /></Button>
      </Link>
    </div>
  );
}
