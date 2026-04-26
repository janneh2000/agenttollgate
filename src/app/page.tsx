import Link from "next/link";
import { ArrowRight, Shield, Zap, Coins, Activity, Bot, Workflow, Sparkles, GaugeCircle, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/code-block";

const AGENT_SNIPPET = `import { tollgate } from "agenttollgate";

const out = await tollgate.call({
  slug: "image-gen-pro",
  agentId: "agent_acme_42",
  body: { prompt: "tollbooth on an interstellar highway" },
});
// → { image_url: "https://...", x-tollgate-amount-micros: 12000 }`;

const MERCHANT_SNIPPET = `// 1. Paste the URL of the API you want to monetise.
// 2. Set a price in USDC. (Yes, sub-cent works.)
// 3. We hand you back a paywalled proxy URL.
const tg = await fetch("https://agenttollgate.dev/api/tollgates", {
  method: "POST",
  body: JSON.stringify({
    name: "Image Gen Pro",
    upstream_url: "https://api.openai.com/v1/images/generations",
    forward_headers: ["authorization"],
    base_price_usdc: 0.012,
    pricing_strategy: "reputation",
  }),
}).then(r => r.json());

console.log(tg.proxy_url); // → /api/proxy/image-gen-pro-h73lk`;

export default function HomePage() {
  return (
    <div className="relative">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid -z-10" />
        <div className="mx-auto max-w-7xl px-6 pt-20 pb-16 text-center">
          <div className="inline-flex items-center gap-2 mb-6">
            <Badge tone="accent">Paygentic Week 3 · Locus</Badge>
            <Badge tone="muted">USDC · Base</Badge>
            <Badge tone="muted">Drop-in SDK</Badge>
          </div>
          <h1 className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05]">
            The 60-second paywall<br />
            <span className="gradient-text">for the agentic economy.</span>
          </h1>
          <p className="mt-6 text-lg md:text-xl text-muted max-w-2xl mx-auto">
            Wrap any HTTP API behind a CheckoutWithLocus toll. AI agents preflight, pay
            in USDC, and consume — with policy enforcement, reputation-aware pricing,
            and live revenue analytics from the first call.
          </p>
          <div className="mt-10 flex items-center justify-center gap-3 flex-wrap">
            <Link href="/dashboard/new">
              <Button size="lg">
                Tollgate an API <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
            <Link href="/catalog">
              <Button size="lg" variant="outline">Browse the catalog</Button>
            </Link>
            <Link href="/docs">
              <Button size="lg" variant="ghost">Read the docs →</Button>
            </Link>
          </div>

          {/* Live demo strip */}
          <div className="mt-14 grid md:grid-cols-2 gap-4 text-left max-w-5xl mx-auto">
            <CodeBlock caption="merchant.ts" code={MERCHANT_SNIPPET} />
            <CodeBlock caption="agent.ts" code={AGENT_SNIPPET} />
          </div>
        </div>
      </section>

      {/* Differentiators */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="text-center mb-12">
          <Badge tone="accent" className="mb-3">Why AgentTollgate</Badge>
          <h2 className="text-3xl md:text-5xl font-semibold tracking-tight">
            Stripe for AI was a nice idea.<br />
            <span className="gradient-text">This is the real one.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <FeatureCard
            icon={<Zap className="h-5 w-5" />}
            title="One-click paywall"
            body="Paste a URL, pick a USDC price. Get back a proxy URL that speaks the 402-payment-required protocol Locus agents already understand. No SDK gymnastics."
          />
          <FeatureCard
            icon={<Shield className="h-5 w-5" />}
            title="Policy-as-code"
            body="Per-agent daily caps, rate limits, geo blocks, anomaly detectors. Declarative JSON enforced before a checkout session opens. Cuts abuse without captchas."
          />
          <FeatureCard
            icon={<GaugeCircle className="h-5 w-5" />}
            title="Reputation-aware pricing"
            body="High-trust agents get a discount; sketchy ones pay surge. We compute scores from the on-chain audit trail Locus already gives us. Free moat."
          />
          <FeatureCard
            icon={<Bot className="h-5 w-5" />}
            title="MCP discoverable"
            body="Every public tollgate is automatically indexed by our MCP server. Any LLM client (Claude, ChatGPT, Cursor) can discover and pay for your endpoints."
          />
          <FeatureCard
            icon={<Activity className="h-5 w-5" />}
            title="Real-time analytics"
            body="Revenue per minute, top agents, p95 latency, payment failure heatmap. Dashboards built for the cadence agents transact at — not the cadence humans do."
          />
          <FeatureCard
            icon={<Lock className="h-5 w-5" />}
            title="Escrow-ready"
            body="Locus handles wallet, identity, and spend-controls. We add merchant-side dispute hooks: auto-refund on upstream 5xx, pro-rata refunds on long-running tasks."
          />
        </div>
      </section>

      {/* The flow */}
      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="text-center mb-10">
          <Badge tone="accent" className="mb-3">The flow</Badge>
          <h2 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Three calls. <span className="gradient-text">Sub-cent settlement.</span>
          </h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          <FlowStep
            num={1}
            title="Agent calls the proxy"
            body="POST /api/proxy/image-gen-pro with x-agent-id. Body captured for replay; policy evaluated."
          />
          <FlowStep
            num={2}
            title="402 → CheckoutWithLocus"
            body="If payment is needed we mint a Locus session and return its pay_url. Mock mode auto-settles for demos."
          />
          <FlowStep
            num={3}
            title="Retry with receipt"
            body="Agent retries with x-locus-receipt. We confirm with Locus, replay upstream, and bill the merchant's wallet."
          />
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-5xl px-6 my-20">
        <Card className="relative shimmer-border p-10 text-center overflow-hidden">
          <Sparkles className="absolute -top-6 -left-6 h-24 w-24 text-accent/20" />
          <Sparkles className="absolute -bottom-6 -right-6 h-24 w-24 text-accent2/20" />
          <h3 className="text-3xl md:text-4xl font-semibold tracking-tight">
            Your API has a price.<br />
            <span className="gradient-text">Let agents discover it.</span>
          </h3>
          <p className="mt-4 text-muted max-w-xl mx-auto">
            Spin up a tollgate in 60 seconds, ship it to the catalog, and start earning from
            every Claude/ChatGPT/Cursor agent that wires it into their workflow.
          </p>
          <div className="mt-8 flex items-center justify-center gap-3 flex-wrap">
            <Link href="/dashboard/new">
              <Button size="lg">Create your first tollgate</Button>
            </Link>
            <Link href="/catalog">
              <Button size="lg" variant="outline">Browse the catalog</Button>
            </Link>
          </div>
          <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted">
            <Coins className="h-3.5 w-3.5" />
            <span>Open-source · MIT · Built for the Locus Paygentic Hackathon Week 3</span>
          </div>
        </Card>
      </section>
    </div>
  );
}

function FeatureCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <Card className="hover:border-accent/40 transition-colors">
      <div className="flex items-center gap-2 mb-3">
        <div className="h-8 w-8 rounded-lg bg-accent/15 text-accent flex items-center justify-center">
          {icon}
        </div>
        <div className="font-semibold">{title}</div>
      </div>
      <p className="text-sm text-muted leading-relaxed">{body}</p>
    </Card>
  );
}

function FlowStep({ num, title, body }: { num: number; title: string; body: string }) {
  return (
    <Card>
      <div className="flex items-center gap-3 mb-2">
        <div className="h-7 w-7 rounded-md bg-gradient-to-br from-accent to-accent2 text-bg font-semibold flex items-center justify-center text-sm">
          {num}
        </div>
        <div className="font-semibold">{title}</div>
      </div>
      <p className="text-sm text-muted">{body}</p>
    </Card>
  );
}
