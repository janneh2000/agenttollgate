"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles } from "lucide-react";

export default function NewTollgatePage() {
  const router = useRouter();
  const [name, setName] = useState("Image Generation");
  const [description, setDescription] = useState("Pay-per-image generation, USDC settled.");
  const [upstream, setUpstream] = useState("https://api.openai.com/v1/images/generations");
  const [method, setMethod] = useState<"GET" | "POST" | "PUT" | "DELETE" | "PATCH">("POST");
  const [forwardHeaders, setForwardHeaders] = useState("authorization");
  const [price, setPrice] = useState(0.012);
  const [strategy, setStrategy] = useState<"flat" | "reputation" | "tiered">("reputation");
  const [category, setCategory] = useState("ai");
  const [maxPerCall, setMaxPerCall] = useState(5);
  const [maxPerDay, setMaxPerDay] = useState(50);
  const [rateLimit, setRateLimit] = useState(60);
  const [isPublic, setIsPublic] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/tollgates", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          merchant_id: "m_demo",
          name,
          description,
          upstream_url: upstream,
          upstream_method: method,
          forward_headers: forwardHeaders.split(",").map((s) => s.trim()).filter(Boolean),
          base_price_usdc: Number(price),
          pricing_strategy: strategy,
          category,
          public: isPublic,
          policy: {
            max_per_call_usdc: Number(maxPerCall),
            max_per_agent_per_day_usdc: Number(maxPerDay),
            rate_limit_per_minute: Number(rateLimit),
            block_burst: true,
            emit_receipts: true,
          },
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error ?? "create failed");
      router.push(`/dashboard/tollgate/${j.tollgate.slug}`);
    } catch (err) {
      setError(String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Badge tone="accent" className="mb-3">Step 1 of 1</Badge>
      <h1 className="text-3xl font-semibold tracking-tight">
        Tollgate <span className="gradient-text">an API</span>
      </h1>
      <p className="text-muted mt-1">Paste an upstream URL, set a price, ship it.</p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <Card>
          <div className="grid md:grid-cols-2 gap-4">
            <Field label="Display name">
              <Input value={name} onChange={(e) => setName(e.target.value)} required />
            </Field>
            <Field label="Category">
              <Select value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="ai">AI</option>
                <option value="search">Search & Web</option>
                <option value="data">Data & Indexing</option>
                <option value="compute">Compute</option>
                <option value="general">General</option>
              </Select>
            </Field>
            <Field label="Description" className="md:col-span-2">
              <Textarea value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Upstream URL" className="md:col-span-2">
              <Input value={upstream} onChange={(e) => setUpstream(e.target.value)} required />
            </Field>
            <Field label="Method">
              <Select value={method} onChange={(e) => setMethod(e.target.value as typeof method)}>
                {(["GET", "POST", "PUT", "DELETE", "PATCH"] as const).map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </Select>
            </Field>
            <Field label="Headers to forward (comma-separated)" className="md:col-span-3">
              <Input value={forwardHeaders} onChange={(e) => setForwardHeaders(e.target.value)} placeholder="authorization, x-openai-key" />
            </Field>
          </div>
        </Card>

        <Card>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Base price (USDC)">
              <Input type="number" step="0.001" min={0} value={price} onChange={(e) => setPrice(parseFloat(e.target.value))} />
            </Field>
            <Field label="Pricing strategy">
              <Select value={strategy} onChange={(e) => setStrategy(e.target.value as typeof strategy)}>
                <option value="flat">flat</option>
                <option value="reputation">reputation-aware</option>
                <option value="tiered">tiered (bulk discount)</option>
              </Select>
            </Field>
            <Field label="Visibility">
              <Select value={isPublic ? "public" : "private"} onChange={(e) => setIsPublic(e.target.value === "public")}>
                <option value="public">public (in catalog + MCP)</option>
                <option value="private">private (URL-only)</option>
              </Select>
            </Field>
          </div>
        </Card>

        <Card>
          <div className="font-semibold mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-accent" /> Policy guardrails
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <Field label="Max per call (USDC)">
              <Input type="number" step="0.01" value={maxPerCall} onChange={(e) => setMaxPerCall(parseFloat(e.target.value))} />
            </Field>
            <Field label="Max per agent / day (USDC)">
              <Input type="number" step="1" value={maxPerDay} onChange={(e) => setMaxPerDay(parseFloat(e.target.value))} />
            </Field>
            <Field label="Rate limit (calls/min/agent)">
              <Input type="number" step="1" value={rateLimit} onChange={(e) => setRateLimit(parseInt(e.target.value, 10))} />
            </Field>
          </div>
          <p className="text-xs text-muted mt-3">
            Burst detection is on by default — &gt;5 calls in 2s from the same agent gets a soft 429 with a retry-after.
          </p>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={busy}>
            {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Creating…</> : "Create tollgate"}
          </Button>
          {error ? <span className="text-sm text-danger">{error}</span> : null}
        </div>
      </form>
    </div>
  );
}

function Field({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="block mb-1.5">{label}</Label>
      {children}
    </div>
  );
}
