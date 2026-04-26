import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CodeBlock } from "@/components/code-block";

const FLOW = `# 1. Agent calls the proxy without payment.
$ curl -i https://agenttollgate.dev/api/proxy/image-gen-pro \\
    -H "x-agent-id: agent_acme_42" \\
    -H "content-type: application/json" \\
    -d '{ "prompt": "tollbooth on an interstellar highway" }'

HTTP/1.1 402 Payment Required
{
  "error": "payment_required",
  "tollgate":  { "slug": "image-gen-pro", "name": "Image Gen Pro" },
  "price":     { "amount_usdc": "0.012000", "strategy": "reputation" },
  "session_id":"cs_test_xyz",
  "pay_url":   "https://beta.paywithlocus.com/c/cs_test_xyz",
  "expires_at":"2026-04-26T12:34:56.000Z"
}

# 2. Agent calls the Locus pay_url. Funds settle in USDC on Base.

# 3. Agent retries with the receipt.
$ curl -i https://agenttollgate.dev/api/proxy/image-gen-pro \\
    -H "x-agent-id: agent_acme_42" \\
    -H "x-locus-receipt: cs_test_xyz" \\
    -d '{ "prompt": "tollbooth on an interstellar highway" }'

HTTP/1.1 200 OK
x-tollgate-latency-ms: 814
x-tollgate-amount-micros: 12000
x-tollgate-session: cs_test_xyz
{ "image_url": "https://..." }
`;

const TS_AGENT = `import { tollgate } from "agenttollgate";

const out = await tollgate.call({
  slug: "image-gen-pro",
  agentId: "agent_acme_42",
  body: { prompt: "tollbooth on an interstellar highway" },
});`;

const PY_AGENT = `from agenttollgate import Tollgate

tg = Tollgate(agent_id="agent_acme_42")
out = tg.call("image-gen-pro", body={"prompt": "tollbooth on an interstellar highway"})`;

const POLICY = `{
  "max_per_call_usdc": 5,
  "max_per_agent_per_day_usdc": 50,
  "rate_limit_per_minute": 60,
  "require_min_reputation": 250,
  "block_unknown_agents": false,
  "block_geos": ["KP", "IR"],
  "block_burst": true
}`;

const MCP = `{
  "name": "agenttollgate",
  "tools": [
    {
      "name": "search_tollgates",
      "description": "Find paywalled APIs by query/budget",
      "inputSchema": {
        "type": "object",
        "properties": {
          "q":         { "type": "string" },
          "max_usdc":  { "type": "number" },
          "category":  { "type": "string" }
        }
      }
    },
    {
      "name": "call_tollgate",
      "description": "Pay-and-call a public tollgate. Returns the upstream response.",
      "inputSchema": {
        "type": "object",
        "required": ["slug", "body"],
        "properties": {
          "slug":     { "type": "string" },
          "body":     { "type": "object" },
          "agent_id": { "type": "string" }
        }
      }
    }
  ]
}`;

export default function DocsPage() {
  return (
    <div className="mx-auto max-w-4xl px-6 py-10 space-y-12">
      <header>
        <Badge tone="accent" className="mb-3">Docs</Badge>
        <h1 className="text-3xl md:text-4xl font-semibold tracking-tight">
          Pay an API in <span className="gradient-text">three calls</span>.
        </h1>
        <p className="text-muted mt-2">
          AgentTollgate speaks the 402-payment-required pattern Locus agents already
          understand. The protocol below works for any agent — Claude, GPT, Cursor, or
          a hand-rolled cron job.
        </p>
      </header>

      <Section id="flow" title="The flow" desc="Three HTTP calls. USDC on Base.">
        <CodeBlock caption="402 → CheckoutWithLocus → 200" code={FLOW} lang="bash" />
      </Section>

      <Section id="agent-sdks" title="Agent SDKs" desc="One-liner client libraries (TypeScript + Python).">
        <div className="grid md:grid-cols-2 gap-4">
          <CodeBlock caption="TypeScript" code={TS_AGENT} lang="ts" />
          <CodeBlock caption="Python" code={PY_AGENT} lang="py" />
        </div>
        <Card className="mt-4 text-sm text-muted">
          The clients handle the 402 → pay → retry round-trip transparently. Both ship
          the same headers (<code className="font-mono">x-agent-id</code>,{" "}
          <code className="font-mono">x-locus-receipt</code>) so any custom HTTP client
          works too.
        </Card>
      </Section>

      <Section id="policy" title="Policy DSL" desc="Declarative spend & abuse rules.">
        <CodeBlock caption="policy.json" code={POLICY} lang="json" />
        <p className="text-sm text-muted">
          Policy is evaluated <em>before</em> a checkout session opens, so failed
          gates don't burn settlement fees. Denials return HTTP 429 with a typed
          <code className="font-mono"> error </code>code that the client SDK understands.
        </p>
      </Section>

      <Section id="mcp" title="MCP discovery" desc="Make your tollgates discoverable to any LLM.">
        <p className="text-sm text-muted">
          Public tollgates are exposed via the bundled MCP server. Any client (Claude
          Desktop, ChatGPT custom GPT, Cursor, your own agent) can query the catalog
          and pay-and-call without any merchant-side integration.
        </p>
        <CodeBlock caption="MCP capabilities" code={MCP} lang="json" />
      </Section>

      <Section id="webhooks" title="Webhooks" desc="Locus → AgentTollgate session lifecycle.">
        <p className="text-sm text-muted">
          Configure your Locus dashboard's webhook URL to:
        </p>
        <CodeBlock caption="webhook URL" code="POST https://your-domain.com/api/checkout/webhook" lang="bash" />
        <p className="text-sm text-muted">
          We verify <code className="font-mono">x-locus-signature</code> using HMAC-SHA256
          against <code className="font-mono">LOCUS_WEBHOOK_SECRET</code> and ack with 200.
          Events handled: <code className="font-mono">checkout.session.paid</code>,{" "}
          <code className="font-mono">.expired</code>, <code className="font-mono">.refunded</code>.
        </p>
      </Section>
    </div>
  );
}

function Section({
  id,
  title,
  desc,
  children,
}: {
  id: string;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
        <p className="text-muted text-sm">{desc}</p>
      </div>
      {children}
    </section>
  );
}
