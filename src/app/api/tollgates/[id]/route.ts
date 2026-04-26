import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { safeJSON } from "@/lib/utils";
import { DEFAULT_POLICY } from "@/lib/types";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const row = db().prepare("SELECT * FROM tollgates WHERE id = ? OR slug = ?").get(id, id);
  if (!row) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json(hydrate(row));
}

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const fields: string[] = [];
  const values: unknown[] = [];
  for (const k of ["name", "description", "status", "pricing_strategy", "category"]) {
    if (k in body) {
      fields.push(`${k} = ?`);
      values.push(body[k]);
    }
  }
  if ("base_price_usdc" in body) {
    fields.push("base_price_micros = ?");
    values.push(Math.round(Number(body.base_price_usdc) * 1_000_000));
  }
  if ("policy" in body) {
    fields.push("policy = ?");
    values.push(JSON.stringify(body.policy));
  }
  if (!fields.length) return NextResponse.json({ error: "nothing_to_update" }, { status: 400 });
  values.push(id);
  db().prepare(`UPDATE tollgates SET ${fields.join(", ")} WHERE id = ?`).run(...values);
  const row = db().prepare("SELECT * FROM tollgates WHERE id = ?").get(id);
  return NextResponse.json(hydrate(row));
}

export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  db().prepare("DELETE FROM tollgates WHERE id = ?").run(id);
  return NextResponse.json({ ok: true });
}

function hydrate(row: any) {
  if (!row) return null;
  return {
    ...row,
    policy: safeJSON(row.policy, DEFAULT_POLICY),
    forward_headers: safeJSON(row.forward_headers, []),
  };
}
