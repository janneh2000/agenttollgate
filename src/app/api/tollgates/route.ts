import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";
import { shortId, longId, safeJSON, usdcToMicros } from "@/lib/utils";
import { PolicyConfigSchema, DEFAULT_POLICY } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CreateSchema = z.object({
  merchant_id: z.string().default("m_demo"),
  name: z.string().min(2).max(80),
  description: z.string().max(280).default(""),
  upstream_url: z.string().url(),
  upstream_method: z.enum(["GET", "POST", "PUT", "DELETE", "PATCH"]).default("POST"),
  forward_headers: z.array(z.string()).default([]),
  base_price_usdc: z.number().nonnegative(),
  pricing_strategy: z.enum(["flat", "reputation", "tiered"]).default("flat"),
  category: z.string().default("general"),
  policy: PolicyConfigSchema.partial().default({}),
  public: z.boolean().default(true),
});

export async function GET(req: NextRequest) {
  const merchant = req.nextUrl.searchParams.get("merchant_id") ?? "m_demo";
  const rows = db()
    .prepare("SELECT * FROM tollgates WHERE merchant_id = ? ORDER BY created_at DESC")
    .all(merchant);
  return NextResponse.json({ items: rows.map(hydrate) });
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "invalid_input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const i = parsed.data;
  const id = `tg_${longId()}`;
  // make slug from name + short suffix
  const slug = `${slugify(i.name)}-${shortId().slice(0, 5)}`;
  const policy = { ...DEFAULT_POLICY, ...i.policy };
  db().prepare(
    `INSERT INTO tollgates (id, slug, merchant_id, name, description, upstream_url, upstream_method,
       forward_headers, base_price_micros, currency, policy, pricing_strategy, status, category, public)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'USDC', ?, ?, 'live', ?, ?)`,
  ).run(
    id,
    slug,
    i.merchant_id,
    i.name,
    i.description,
    i.upstream_url,
    i.upstream_method,
    JSON.stringify(i.forward_headers),
    usdcToMicros(i.base_price_usdc),
    JSON.stringify(policy),
    i.pricing_strategy,
    i.category,
    i.public ? 1 : 0,
  );
  const row = db().prepare("SELECT * FROM tollgates WHERE id = ?").get(id);
  return NextResponse.json({ tollgate: hydrate(row), proxy_url: proxyUrl(slug) }, { status: 201 });
}

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 28);
}

function proxyUrl(slug: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/api/proxy/${slug}`;
}

function hydrate(row: any) {
  if (!row) return null;
  return {
    ...row,
    policy: safeJSON(row.policy, DEFAULT_POLICY),
    forward_headers: safeJSON(row.forward_headers, []),
    proxy_url: proxyUrl(row.slug),
  };
}
