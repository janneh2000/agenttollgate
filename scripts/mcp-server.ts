/**
 * AgentTollgate MCP server.
 *
 * Exposes two tools to any MCP client (Claude Desktop, Cursor, ChatGPT
 * desktop):
 *
 *   • search_tollgates(q?, max_usdc?, category?)
 *       → returns the public catalog matching the filter
 *   • call_tollgate(slug, body, agent_id?, max_usdc?)
 *       → handles the 402 → CheckoutWithLocus → retry round-trip and
 *         returns the upstream response. Charges flow through the agent's
 *         Locus wallet.
 *
 * This is intentionally framework-light — we speak MCP over stdio with
 * plain JSON-RPC 2.0 so the dependency footprint stays at zero.
 *
 * Run:  AGENTTOLLGATE_BASE=http://localhost:3000 npx tsx scripts/mcp-server.ts
 */
import readline from "node:readline";

const BASE = process.env.AGENTTOLLGATE_BASE ?? "http://localhost:3000";
const AGENT_ID = process.env.AGENTTOLLGATE_AGENT_ID ?? "mcp_default_agent";

const TOOLS = [
  {
    name: "search_tollgates",
    description: "Find paywalled APIs published on AgentTollgate by free-text query, max USDC, and/or category.",
    inputSchema: {
      type: "object",
      properties: {
        q: { type: "string", description: "Free-text search across name/description/category." },
        max_usdc: { type: "number", description: "Max base price (USDC) per call." },
        category: { type: "string", description: "Filter by category, e.g. 'ai', 'search', 'data'." },
      },
    },
  },
  {
    name: "call_tollgate",
    description: "Pay-and-call a public tollgate. The MCP host's agent identity is sent automatically; charge settles in USDC on Base via CheckoutWithLocus.",
    inputSchema: {
      type: "object",
      required: ["slug"],
      properties: {
        slug: { type: "string", description: "Tollgate slug from search_tollgates." },
        body: { type: "object", description: "Request body forwarded upstream as JSON." },
        agent_id: { type: "string", description: "Override the default agent identity." },
        max_usdc: { type: "number", description: "Refuse to pay if the toll exceeds this." },
      },
    },
  },
];

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });

rl.on("line", async (line) => {
  let req: { id?: number | string; method?: string; params?: Record<string, unknown> };
  try {
    req = JSON.parse(line);
  } catch {
    return;
  }
  if (!req || !req.method) return;

  if (req.method === "initialize") {
    return reply(req.id, {
      protocolVersion: "2024-11-05",
      serverInfo: { name: "agenttollgate", version: "0.1.0" },
      capabilities: { tools: {} },
    });
  }
  if (req.method === "tools/list") {
    return reply(req.id, { tools: TOOLS });
  }
  if (req.method === "tools/call") {
    const params = (req.params ?? {}) as { name?: string; arguments?: Record<string, unknown> };
    const args = params.arguments ?? {};
    try {
      if (params.name === "search_tollgates") {
        const url = new URL(`${BASE}/api/catalog`);
        if (typeof args.q === "string") url.searchParams.set("q", args.q);
        if (typeof args.max_usdc === "number") url.searchParams.set("max_usdc", String(args.max_usdc));
        if (typeof args.category === "string") url.searchParams.set("category", args.category);
        const r = await fetch(url);
        const j = await r.json();
        return reply(req.id, {
          content: [{ type: "text", text: JSON.stringify(j, null, 2) }],
        });
      }
      if (params.name === "call_tollgate") {
        const slug = String(args.slug);
        const agent = (args.agent_id as string) ?? AGENT_ID;
        const body = args.body ?? null;
        // 402 round-trip
        let r = await fetch(`${BASE}/api/proxy/${slug}`, {
          method: body ? "POST" : "GET",
          headers: { "x-agent-id": agent, "content-type": "application/json" },
          body: body ? JSON.stringify(body) : undefined,
        });
        if (r.status === 402) {
          const pr = (await r.json()) as { session_id: string; pay_url: string; price: { amount_usdc: string } };
          if (typeof args.max_usdc === "number" && parseFloat(pr.price.amount_usdc) > (args.max_usdc as number)) {
            return reply(req.id, {
              content: [{ type: "text", text: `Refused: ${pr.price.amount_usdc} USDC > max ${args.max_usdc}` }],
            });
          }
          await fetch(pr.pay_url, { method: "POST" });
          r = await fetch(`${BASE}/api/proxy/${slug}`, {
            method: body ? "POST" : "GET",
            headers: {
              "x-agent-id": agent,
              "content-type": "application/json",
              "x-locus-receipt": pr.session_id,
            },
            body: body ? JSON.stringify(body) : undefined,
          });
        }
        const text = await r.text();
        return reply(req.id, {
          content: [
            { type: "text", text: `HTTP ${r.status}\n${text}` },
          ],
        });
      }
      return replyErr(req.id, -32601, `Unknown tool ${params.name}`);
    } catch (err) {
      return replyErr(req.id, -32000, String(err));
    }
  }
});

function reply(id: number | string | undefined, result: unknown) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, result }) + "\n");
}
function replyErr(id: number | string | undefined, code: number, message: string) {
  process.stdout.write(JSON.stringify({ jsonrpc: "2.0", id, error: { code, message } }) + "\n");
}
