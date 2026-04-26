"use client";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

export function RevenueChart({
  data,
}: {
  data: { bucket: string; revenue: number; calls: number }[];
}) {
  const points = data.map((d) => ({
    label: d.bucket.slice(11),
    revenue: (d.revenue ?? 0) / 1_000_000,
    calls: d.calls,
  }));

  if (points.length === 0) {
    return (
      <div className="h-48 grid place-items-center text-sm text-muted">
        No traffic in the past 24h. Send a test call from the docs page.
      </div>
    );
  }

  return (
    <div className="h-56">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ left: 8, right: 16, top: 12, bottom: 0 }}>
          <defs>
            <linearGradient id="r" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(168 76% 52%)" stopOpacity={0.45} />
              <stop offset="95%" stopColor="hsl(168 76% 52%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="label" stroke="hsl(220 12% 60%)" fontSize={11} tickLine={false} axisLine={false} />
          <YAxis stroke="hsl(220 12% 60%)" fontSize={11} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            contentStyle={{
              background: "hsl(222 40% 9%)",
              border: "1px solid hsl(220 24% 16%)",
              borderRadius: 10,
              fontSize: 12,
            }}
            labelStyle={{ color: "hsl(210 30% 96%)" }}
            formatter={(value: number, key: string) =>
              key === "revenue" ? [`${value.toFixed(4)} USDC`, "revenue"] : [value, key]
            }
          />
          <Area type="monotone" dataKey="revenue" stroke="hsl(168 76% 52%)" fill="url(#r)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
