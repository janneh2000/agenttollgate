import Link from "next/link";
import { db } from "@/lib/db";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { microsToUsdc } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default function CatalogPage() {
  const items = db()
    .prepare(
      `SELECT id, slug, name, description, base_price_micros, category, pricing_strategy,
              total_calls, total_revenue_micros
         FROM tollgates
        WHERE public = 1 AND status = 'live'
        ORDER BY total_calls DESC LIMIT 100`,
    )
    .all() as Array<{
    id: string;
    slug: string;
    name: string;
    description: string;
    base_price_micros: number;
    category: string;
    pricing_strategy: string;
    total_calls: number;
    total_revenue_micros: number;
  }>;

  const byCategory = items.reduce<Record<string, typeof items>>((acc, i) => {
    const k = i.category ?? "general";
    (acc[k] ||= []).push(i);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <Badge tone="accent" className="mb-3">Public catalog</Badge>
      <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
        Every paywalled API, <span className="gradient-text">in one feed.</span>
      </h1>
      <p className="text-muted mt-2 max-w-2xl">
        AI agents can query <code className="kbd">/api/catalog?q=…</code> or use the bundled MCP server
        to discover any of these endpoints. Pricing is settled in USDC on Base via CheckoutWithLocus.
      </p>

      {items.length === 0 ? (
        <Card className="mt-10">
          <div className="text-center py-8">
            <div className="font-semibold mb-1">The catalog is empty</div>
            <p className="text-sm text-muted">
              Run <code className="kbd">npm run seed</code> in the project root to load demo tollgates.
            </p>
          </div>
        </Card>
      ) : (
        <div className="mt-8 space-y-10">
          {Object.entries(byCategory).map(([cat, list]) => (
            <section key={cat}>
              <h2 className="text-sm uppercase tracking-wider text-muted mb-3">{cat}</h2>
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                {list.map((t) => (
                  <Card key={t.id} className="hover:border-accent/40 transition-colors">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <Link href={`/dashboard/tollgate/${t.slug}`} className="font-semibold hover:text-accent">
                        {t.name}
                      </Link>
                      <Badge tone="accent">{microsToUsdc(t.base_price_micros)} USDC</Badge>
                    </div>
                    <p className="text-sm text-muted line-clamp-2">{t.description}</p>
                    <div className="mt-3 flex items-center justify-between text-xs text-muted">
                      <span>
                        Strategy <code className="font-mono">{t.pricing_strategy}</code>
                      </span>
                      <span>{t.total_calls.toLocaleString()} calls</span>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
