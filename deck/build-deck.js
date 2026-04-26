// Generates the AgentTollgate pitch deck (PPTX).
// Run: node build-deck.js
//
// Visual language echoes the app:
//   bg     #0b1220   panels  #111a2c   border  #1f2a44
//   mint   #21e5b5   violet  #7c5cff   sand    #f5f5f5
//   muted  #8aa0c2

const pptxgen = require("pptxgenjs");
const path = require("path");

const COLORS = {
  bg: "0b1220",
  panel: "111a2c",
  border: "1f2a44",
  mint: "21e5b5",
  violet: "7c5cff",
  sand: "f5f5f5",
  muted: "8aa0c2",
  white: "ffffff",
  rose: "f96167",
};

const FONT_HEAD = "Calibri";
const FONT_BODY = "Calibri";
const FONT_MONO = "Courier New"; // Liberation Mono fallback in LibreOffice renders cleanly.

const pres = new pptxgen();
pres.layout = "LAYOUT_WIDE"; // 13.333 x 7.5
pres.title = "AgentTollgate — Pitch Deck";
pres.author = "AgentTollgate";
pres.company = "AgentTollgate";
pres.subject = "Locus Paygentic Hackathon — Week 3 (CheckoutWithLocus)";

const W = 13.333;
const H = 7.5;

// ----- helpers ---------------------------------------------------------------

function darkBg(slide) {
  slide.background = { color: COLORS.bg };
}

function gradientBar(slide, x, y, w, h) {
  // Two-segment bar: mint -> violet
  slide.addShape("rect", { x, y, w: w / 2, h, fill: { color: COLORS.mint }, line: { color: COLORS.mint } });
  slide.addShape("rect", { x: x + w / 2, y, w: w / 2, h, fill: { color: COLORS.violet }, line: { color: COLORS.violet } });
}

function footer(slide, n, total) {
  slide.addText("AgentTollgate", {
    x: 0.5, y: H - 0.45, w: 4, h: 0.3,
    fontSize: 10, color: COLORS.muted, fontFace: FONT_BODY, align: "left",
  });
  slide.addText("Built on CheckoutWithLocus · USDC on Base", {
    x: W - 5.5, y: H - 0.45, w: 4.5, h: 0.3,
    fontSize: 10, color: COLORS.muted, fontFace: FONT_BODY, align: "right",
  });
  slide.addText(`${n} / ${total}`, {
    x: W - 1, y: H - 0.45, w: 0.6, h: 0.3,
    fontSize: 10, color: COLORS.muted, fontFace: FONT_BODY, align: "right", bold: true,
  });
}

function slideHeader(slide, kicker, title) {
  // top accent dot
  slide.addShape("ellipse", {
    x: 0.5, y: 0.55, w: 0.18, h: 0.18,
    fill: { color: COLORS.mint }, line: { color: COLORS.mint },
  });
  slide.addText(kicker.toUpperCase(), {
    x: 0.78, y: 0.45, w: 8, h: 0.4,
    fontSize: 12, color: COLORS.mint, fontFace: FONT_HEAD,
    bold: true, charSpacing: 6,
  });
  slide.addText(title, {
    x: 0.5, y: 0.85, w: W - 1, h: 0.9,
    fontSize: 36, bold: true, color: COLORS.white, fontFace: FONT_HEAD,
    margin: 0,
  });
}

function pill(slide, x, y, label) {
  const w = 1.6, h = 0.35;
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.18,
    fill: { color: COLORS.panel }, line: { color: COLORS.border, width: 0.75 },
  });
  slide.addText(label, {
    x, y, w, h, fontSize: 10, color: COLORS.mint,
    fontFace: FONT_BODY, align: "center", valign: "middle", bold: true, margin: 0,
  });
}

function statCard(slide, x, y, w, h, big, label, accent = COLORS.mint) {
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.12,
    fill: { color: COLORS.panel }, line: { color: COLORS.border, width: 1 },
  });
  slide.addText(big, {
    x: x + 0.25, y: y + 0.25, w: w - 0.5, h: h * 0.55,
    fontSize: 44, bold: true, color: accent, fontFace: FONT_HEAD, align: "left", valign: "top", margin: 0,
  });
  slide.addText(label, {
    x: x + 0.25, y: y + h * 0.6, w: w - 0.5, h: h * 0.4,
    fontSize: 12, color: COLORS.muted, fontFace: FONT_BODY, align: "left", valign: "top", margin: 0,
  });
}

function featureCard(slide, x, y, w, h, glyph, title, body, accent = COLORS.mint) {
  slide.addShape("roundRect", {
    x, y, w, h, rectRadius: 0.12,
    fill: { color: COLORS.panel }, line: { color: COLORS.border, width: 1 },
  });
  // glyph circle
  slide.addShape("ellipse", {
    x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55,
    fill: { color: accent }, line: { color: accent },
  });
  slide.addText(glyph, {
    x: x + 0.25, y: y + 0.25, w: 0.55, h: 0.55,
    fontSize: 18, bold: true, color: COLORS.bg, fontFace: FONT_HEAD,
    align: "center", valign: "middle", margin: 0,
  });
  slide.addText(title, {
    x: x + 0.95, y: y + 0.25, w: w - 1.1, h: 0.45,
    fontSize: 16, bold: true, color: COLORS.white, fontFace: FONT_HEAD, valign: "middle", margin: 0,
  });
  slide.addText(body, {
    x: x + 0.25, y: y + 0.95, w: w - 0.5, h: h - 1.1,
    fontSize: 12, color: COLORS.muted, fontFace: FONT_BODY, valign: "top", margin: 0, paraSpaceAfter: 4,
  });
}

const TOTAL = 11;

// ============================================================================
// Slide 1 — Title
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);

  // backdrop pattern: faint vertical bars echoing the favicon tollgate posts
  for (let i = 0; i < 6; i++) {
    const x = 0.4 + i * 2.1;
    s.addShape("roundRect", {
      x, y: 0.3, w: 0.07, h: H - 0.6, rectRadius: 0.04,
      fill: { color: COLORS.border }, line: { color: COLORS.border }, transparency: 70,
    });
  }

  // Big monogram block — drawn tollgate icon (matches favicon)
  s.addShape("roundRect", {
    x: 0.85, y: 1.8, w: 1.1, h: 1.1, rectRadius: 0.18,
    fill: { color: COLORS.panel }, line: { color: COLORS.mint, width: 1.2 },
  });
  // left post
  s.addShape("rect", {
    x: 0.99, y: 2.0, w: 0.1, h: 0.7,
    fill: { color: COLORS.mint }, line: { color: COLORS.mint },
  });
  // right post
  s.addShape("rect", {
    x: 1.71, y: 2.0, w: 0.1, h: 0.7,
    fill: { color: COLORS.mint }, line: { color: COLORS.mint },
  });
  // top crossbar
  s.addShape("rect", {
    x: 1.05, y: 2.05, w: 0.7, h: 0.11,
    fill: { color: COLORS.violet }, line: { color: COLORS.violet },
  });
  // bottom plate
  s.addShape("rect", {
    x: 0.95, y: 2.74, w: 0.9, h: 0.1,
    fill: { color: COLORS.mint }, line: { color: COLORS.mint },
  });
  // center coin
  s.addShape("ellipse", {
    x: 1.3, y: 2.3, w: 0.2, h: 0.2,
    fill: { color: COLORS.panel }, line: { color: COLORS.mint, width: 1 },
  });

  s.addText("AgentTollgate", {
    x: 2.15, y: 1.8, w: 9, h: 1.1,
    fontSize: 60, bold: true, color: COLORS.white, fontFace: FONT_HEAD, valign: "middle", margin: 0,
  });

  s.addText("The 60-second paywall for the agentic economy.", {
    x: 0.85, y: 3.05, w: 11, h: 0.6,
    fontSize: 24, color: COLORS.sand, fontFace: FONT_HEAD, valign: "top", margin: 0,
  });

  s.addText("Drop CheckoutWithLocus on any HTTP API. AI agents preflight, pay in USDC, and consume — with policy enforcement, reputation-aware pricing, and live revenue analytics.", {
    x: 0.85, y: 3.75, w: 11, h: 1.2,
    fontSize: 16, color: COLORS.muted, fontFace: FONT_BODY, valign: "top", margin: 0, paraSpaceAfter: 6,
  });

  // pills
  pill(s, 0.85, 5.1, "402-style flow");
  pill(s, 2.55, 5.1, "USDC on Base");
  pill(s, 4.25, 5.1, "MCP-native");
  pill(s, 5.95, 5.1, "Policy-as-code");

  // bottom hairline + signature
  gradientBar(s, 0.85, 6.1, W - 1.7, 0.04);
  s.addText("Locus · Paygentic Hackathon · Week 3 — CheckoutWithLocus track", {
    x: 0.85, y: 6.25, w: 11, h: 0.4,
    fontSize: 12, color: COLORS.mint, fontFace: FONT_BODY, bold: true, charSpacing: 4,
  });
  s.addText("Open-source · MIT", {
    x: 0.85, y: 6.65, w: 11, h: 0.3,
    fontSize: 11, color: COLORS.muted, fontFace: FONT_BODY,
  });
}

// ============================================================================
// Slide 2 — Problem
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);
  slideHeader(s, "the problem", "Stripe doesn't fit the next buyer.");
  footer(s, 2, TOTAL);

  // big stat row
  statCard(s, 0.5, 2.1, 4.0, 1.5, "10×", "agent traffic vs. human traffic on top APIs by 2027 (a16z)", COLORS.mint);
  statCard(s, 4.7, 2.1, 4.0, 1.5, "0", "card-based checkouts an LLM agent can complete unattended", COLORS.violet);
  statCard(s, 8.9, 2.1, 4.0, 1.5, "$0.001", "the price point Stripe simply can't profitably settle", COLORS.rose);

  // narrative panel
  s.addShape("roundRect", {
    x: 0.5, y: 3.95, w: W - 1, h: 2.5, rectRadius: 0.15,
    fill: { color: COLORS.panel }, line: { color: COLORS.border, width: 1 },
  });

  s.addText("AI agents are about to call APIs the way humans called websites — programmatically and constantly.", {
    x: 0.85, y: 4.1, w: W - 1.7, h: 0.6,
    fontSize: 18, bold: true, color: COLORS.white, fontFace: FONT_HEAD, valign: "top", margin: 0,
  });

  s.addText([
    { text: "But the buyer isn't a card-holding human in a browser. ", options: { color: COLORS.sand } },
    { text: "It's a script with a USDC wallet, a budget, and no patience for redirects.", options: { color: COLORS.sand } },
  ], {
    x: 0.85, y: 4.75, w: W - 1.7, h: 0.6,
    fontSize: 14, fontFace: FONT_BODY, valign: "top", margin: 0,
  });

  s.addText([
    { text: "•  Stripe Checkout: ", options: { color: COLORS.mint, bold: true } },
    { text: "designed for humans + cards. No spend caps. No reputation. No 402.", options: { color: COLORS.muted } },
  ], { x: 0.85, y: 5.4, w: W - 1.7, h: 0.35, fontSize: 13, fontFace: FONT_BODY, valign: "top", margin: 0 });
  s.addText([
    { text: "•  Crossmint / Coinbase Commerce: ", options: { color: COLORS.mint, bold: true } },
    { text: "USDC settlement, but web-first. Fees and UX kill sub-cent calls.", options: { color: COLORS.muted } },
  ], { x: 0.85, y: 5.75, w: W - 1.7, h: 0.35, fontSize: 13, fontFace: FONT_BODY, valign: "top", margin: 0 });
  s.addText([
    { text: "•  DIY rolling-your-own: ", options: { color: COLORS.mint, bold: true } },
    { text: "every merchant rebuilds caps, rate limits, reputation, MCP. Wasted weeks.", options: { color: COLORS.muted } },
  ], { x: 0.85, y: 6.1, w: W - 1.7, h: 0.35, fontSize: 13, fontFace: FONT_BODY, valign: "top", margin: 0 });
}

// ============================================================================
// Slide 3 — Solution
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);
  slideHeader(s, "the solution", "A drop-in toll for any HTTP endpoint.");
  footer(s, 3, TOTAL);

  // 3-step flow
  const startY = 2.2;
  const steps = [
    { n: "1", title: "Paste an upstream URL + a price", body: "Anywhere from 0.001 to 100 USDC. Pricing strategy: flat, reputation-aware, or tiered." },
    { n: "2", title: "Get back a proxy URL", body: "Public, slug-based. Drop it into your Claude / Cursor / agent tool config in 10 seconds." },
    { n: "3", title: "Agents call it. They pay or refuse.", body: "402 Payment Required → Locus session → USDC on Base → upstream replay. We handle the loop." },
  ];

  steps.forEach((step, i) => {
    const x = 0.5 + i * 4.28;
    const w = 4.05, h = 2.1;

    s.addShape("roundRect", {
      x, y: startY, w, h, rectRadius: 0.15,
      fill: { color: COLORS.panel }, line: { color: COLORS.border, width: 1 },
    });

    // big numeral
    s.addText(step.n, {
      x: x + 0.25, y: startY + 0.2, w: 0.8, h: 0.8,
      fontSize: 36, bold: true, color: COLORS.violet, fontFace: FONT_HEAD, valign: "top", margin: 0,
    });

    s.addText(step.title, {
      x: x + 0.25, y: startY + 0.95, w: w - 0.5, h: 0.5,
      fontSize: 15, bold: true, color: COLORS.white, fontFace: FONT_HEAD, valign: "top", margin: 0,
    });

    s.addText(step.body, {
      x: x + 0.25, y: startY + 1.4, w: w - 0.5, h: 0.7,
      fontSize: 11, color: COLORS.muted, fontFace: FONT_BODY, valign: "top", margin: 0,
    });
  });

  // big result panel
  s.addShape("roundRect", {
    x: 0.5, y: 4.7, w: W - 1, h: 2, rectRadius: 0.15,
    fill: { color: COLORS.bg }, line: { color: COLORS.mint, width: 1.5 },
  });

  s.addText("Result", {
    x: 0.85, y: 4.85, w: 3, h: 0.4,
    fontSize: 11, color: COLORS.mint, fontFace: FONT_BODY, bold: true, charSpacing: 4,
  });

  s.addText("Any developer ships a paywalled API in under 60 seconds. Any agent can pay it without merchant-side integration.", {
    x: 0.85, y: 5.2, w: W - 1.7, h: 0.6,
    fontSize: 18, bold: true, color: COLORS.white, fontFace: FONT_HEAD, valign: "top", margin: 0,
  });

  s.addText("And every public tollgate auto-appears in our MCP catalog — so Claude, Cursor and ChatGPT can discover, pay, and consume natively.", {
    x: 0.85, y: 5.85, w: W - 1.7, h: 0.7,
    fontSize: 13, color: COLORS.sand, fontFace: FONT_BODY, valign: "top", margin: 0,
  });
}

// ============================================================================
// Slide 4 — 402 Flow Diagram (sequence-diagram style)
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);
  slideHeader(s, "how it works", "The 402 → Pay → Replay loop.");
  footer(s, 4, TOTAL);

  // Three actor headers with vertical lifelines.
  const headerY = 2.0, headerH = 0.6;
  const actors = [
    { x: 1.4, w: 2.6, label: "AI Agent", accent: COLORS.mint },
    { x: 5.35, w: 2.6, label: "AgentTollgate", accent: COLORS.violet },
    { x: 9.3, w: 2.6, label: "Upstream API", accent: COLORS.rose },
  ];
  // Lifeline x = center of each actor card
  const lifeX = actors.map((a) => a.x + a.w / 2);

  actors.forEach((a) => {
    s.addShape("roundRect", {
      x: a.x, y: headerY, w: a.w, h: headerH, rectRadius: 0.12,
      fill: { color: COLORS.panel }, line: { color: a.accent, width: 1.2 },
    });
    s.addText(a.label, {
      x: a.x, y: headerY, w: a.w, h: headerH,
      fontSize: 14, bold: true, color: COLORS.white, fontFace: FONT_HEAD,
      align: "center", valign: "middle", margin: 0,
    });
  });

  // Lifelines: dashed-style vertical lines below each header.
  const lineTop = headerY + headerH + 0.05;
  const lineBottom = 6.55;
  actors.forEach((a, i) => {
    s.addShape("line", {
      x: lifeX[i], y: lineTop, w: 0, h: lineBottom - lineTop,
      line: { color: COLORS.border, width: 1, dashType: "dash" },
    });
  });

  // Generously-spaced rows. y is absolute on slide.
  const rows = [
    { y: 3.05, from: 0, to: 1, color: COLORS.mint,   label: "1.  POST /api/proxy/[slug]",         sub: "x-agent-id · request body" },
    { y: 3.70, from: 1, to: 0, color: COLORS.violet, label: "2.  402 Payment Required",           sub: "session_id · pay_url (Locus)" },
    { y: 4.35, from: 0, to: 1, color: COLORS.mint,   label: "3.  pay via Locus checkout",         sub: "USDC on Base · settled in micros" },
    { y: 5.00, from: 1, to: 2, color: COLORS.violet, label: "4.  replay upstream request",        sub: "after locus.confirm()" },
    { y: 5.65, from: 2, to: 1, color: COLORS.rose,   label: "5.  upstream 200 OK",                sub: "record usage · reputation +12" },
    { y: 6.30, from: 1, to: 0, color: COLORS.mint,   label: "6.  return upstream response",       sub: "x-locus-receipt = session_id" },
  ];

  rows.forEach((r, idx) => {
    const fromX = lifeX[r.from];
    const toX = lifeX[r.to];
    const minX = Math.min(fromX, toX);
    const maxX = Math.max(fromX, toX);
    const y = r.y;
    const dirRight = r.from < r.to;

    // Arrow line slightly above where the labels sit.
    const arrowY = y + 0.36;
    s.addShape("line", {
      x: minX + 0.04, y: arrowY, w: (maxX - minX) - 0.08, h: 0,
      line: {
        color: r.color, width: 1.75,
        endArrowType: dirRight ? "triangle" : "none",
        beginArrowType: dirRight ? "none" : "triangle",
      },
    });

    // Label sits *above* the arrow, centered between the two lifelines.
    s.addText(r.label, {
      x: minX, y: y - 0.05, w: maxX - minX, h: 0.25,
      fontSize: 12, bold: true, color: r.color, fontFace: FONT_BODY,
      align: "center", valign: "bottom", margin: 0,
    });
    s.addText(r.sub, {
      x: minX, y: y + 0.16, w: maxX - minX, h: 0.22,
      fontSize: 10, color: COLORS.muted, fontFace: FONT_BODY,
      align: "center", valign: "bottom", margin: 0, italic: true,
    });
  });

  // bottom note (sit just above the page footer)
  s.addText("Two extra HTTP calls — total. No browser, no redirects, no human required.", {
    x: 0.5, y: 6.72, w: W - 1, h: 0.28,
    fontSize: 12, italic: true, color: COLORS.sand, fontFace: FONT_BODY, align: "center", margin: 0,
  });
}

// ============================================================================
// Slide 5 — Differentiators
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);
  slideHeader(s, "what's unique", "Three things merchants can't be bothered to build.");
  footer(s, 5, TOTAL);

  const y0 = 2.2, y1 = 4.6;
  const cardW = 4.05, cardH = 2.1;

  featureCard(s, 0.5, y0, cardW, cardH, "§", "Policy-as-code DSL",
    "Per-agent caps, daily limits, geo blocks, burst detection, reputation gates — all declared as JSON, evaluated server-side, returning typed denial codes the agent SDK self-corrects against.",
    COLORS.mint);

  featureCard(s, 4.65, y0, cardW, cardH, "★", "Reputation-aware pricing",
    "Every agent has a 0–1000 score from on-chain history. Score 1000 → 0.6× the base price; score 0 → 1.6×. Trusted agents get a discount. Sketchy ones surge.",
    COLORS.violet);

  featureCard(s, 8.8, y0, cardW, cardH, "M", "MCP discovery, native",
    "Every public tollgate auto-publishes to a built-in MCP server. Claude / Cursor / ChatGPT discover, search by category and price, and pay-and-call — without merchant-side integration.",
    COLORS.rose);

  featureCard(s, 0.5, y1, cardW, cardH, "$", "Sub-cent settlement",
    "Settled in micros via USDC on Base. 0.001 USDC works. Card networks can't do this profitably; we do it because the buyer is software.",
    COLORS.mint);

  featureCard(s, 4.65, y1, cardW, cardH, "↻", "402 + replay loop",
    "x402-compatible flow. We capture the request body, mint the Locus session, and replay after payment. The agent sends the same request twice — that's the whole protocol.",
    COLORS.violet);

  featureCard(s, 8.8, y1, cardW, cardH, "≡", "Live analytics from call #1",
    "Revenue/min, top-spending agents, p95 latency, payment failure heatmap. The merchant sees exactly which agent paid, when, for what — and what they tried to abuse.",
    COLORS.rose);
}

// ============================================================================
// Slide 6 — Comparison Table
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);
  slideHeader(s, "vs. existing solutions", "Where AgentTollgate wins.");
  footer(s, 6, TOTAL);

  const tableRows = [
    [
      { text: "Concern", options: { bold: true, color: COLORS.muted, fill: { color: COLORS.bg } } },
      { text: "Stripe + custom code", options: { bold: true, color: COLORS.muted, fill: { color: COLORS.bg } } },
      { text: "Crossmint / Coinbase", options: { bold: true, color: COLORS.muted, fill: { color: COLORS.bg } } },
      { text: "AgentTollgate", options: { bold: true, color: COLORS.mint, fill: { color: COLORS.bg } } },
    ],
    [
      { text: "Designed for AI agents", options: { color: COLORS.sand } },
      { text: "✗", options: { color: COLORS.rose, align: "center" } },
      { text: "partial — web-only", options: { color: COLORS.muted, align: "center" } },
      { text: "yes — 402-pattern, headless first", options: { color: COLORS.mint, bold: true, align: "center" } },
    ],
    [
      { text: "USDC settlement", options: { color: COLORS.sand } },
      { text: "✗", options: { color: COLORS.rose, align: "center" } },
      { text: "yes", options: { color: COLORS.sand, align: "center" } },
      { text: "yes (Locus, USDC on Base)", options: { color: COLORS.mint, bold: true, align: "center" } },
    ],
    [
      { text: "Per-agent spend caps", options: { color: COLORS.sand } },
      { text: "DIY", options: { color: COLORS.muted, align: "center" } },
      { text: "✗", options: { color: COLORS.rose, align: "center" } },
      { text: "built-in DSL", options: { color: COLORS.mint, bold: true, align: "center" } },
    ],
    [
      { text: "Reputation pricing", options: { color: COLORS.sand } },
      { text: "✗", options: { color: COLORS.rose, align: "center" } },
      { text: "✗", options: { color: COLORS.rose, align: "center" } },
      { text: "on-chain audit trail → discounts", options: { color: COLORS.mint, bold: true, align: "center" } },
    ],
    [
      { text: "MCP discovery", options: { color: COLORS.sand } },
      { text: "✗", options: { color: COLORS.rose, align: "center" } },
      { text: "✗", options: { color: COLORS.rose, align: "center" } },
      { text: "first-class", options: { color: COLORS.mint, bold: true, align: "center" } },
    ],
    [
      { text: "Sub-cent price points", options: { color: COLORS.sand } },
      { text: "impractical (fees)", options: { color: COLORS.muted, align: "center" } },
      { text: "possible", options: { color: COLORS.sand, align: "center" } },
      { text: "trivial — settled in micros", options: { color: COLORS.mint, bold: true, align: "center" } },
    ],
  ];

  s.addTable(tableRows, {
    x: 0.5, y: 2.1, w: W - 1, colW: [3.5, 2.8, 2.9, 3.13],
    rowH: 0.55,
    fontSize: 12, fontFace: FONT_BODY, color: COLORS.sand,
    border: { type: "solid", color: COLORS.border, pt: 0.5 },
    fill: { color: COLORS.panel },
    valign: "middle",
  });
}

// ============================================================================
// Slide 7 — Reputation Pricing (chart)
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);
  slideHeader(s, "reputation-aware pricing", "Trusted agents pay less. Sketchy ones surge.");
  footer(s, 7, TOTAL);

  // Build the multiplier curve: multiplier = 1.6 - score/1000
  const labels = [];
  const values = [];
  for (let score = 0; score <= 1000; score += 100) {
    labels.push(String(score));
    values.push(Number((1.6 - score / 1000).toFixed(2)));
  }

  s.addShape("roundRect", {
    x: 0.5, y: 2.1, w: 7.6, h: 4.6, rectRadius: 0.15,
    fill: { color: COLORS.panel }, line: { color: COLORS.border, width: 1 },
  });

  s.addChart(pres.ChartType.line, [{
    name: "Price multiplier",
    labels,
    values,
  }], {
    x: 0.7, y: 2.3, w: 7.2, h: 4.2,
    chartColors: [COLORS.mint],
    showLegend: false,
    showTitle: true,
    title: "Price multiplier vs. reputation score",
    titleColor: COLORS.white,
    titleFontFace: FONT_HEAD,
    titleFontSize: 14,
    catAxisLabelColor: COLORS.muted,
    catAxisLabelFontSize: 10,
    catAxisTitle: "Reputation score (0–1000)",
    catAxisTitleColor: COLORS.muted,
    catAxisTitleFontSize: 10,
    showCatAxisTitle: true,
    valAxisLabelColor: COLORS.muted,
    valAxisLabelFontSize: 10,
    valAxisTitle: "× base price",
    valAxisTitleColor: COLORS.muted,
    valAxisTitleFontSize: 10,
    showValAxisTitle: true,
    lineSize: 3,
    lineDataSymbol: "circle",
    lineDataSymbolSize: 8,
    lineDataSymbolLineColor: COLORS.violet,
    plotArea: { fill: { color: COLORS.bg } },
  });

  // explainer panel
  s.addShape("roundRect", {
    x: 8.3, y: 2.1, w: 4.55, h: 4.6, rectRadius: 0.15,
    fill: { color: COLORS.panel }, line: { color: COLORS.border, width: 1 },
  });

  s.addText("How the score moves", {
    x: 8.5, y: 2.25, w: 4.2, h: 0.4,
    fontSize: 14, bold: true, color: COLORS.mint, fontFace: FONT_HEAD,
  });

  const lines = [
    { lbl: "Successful call", val: "+12 (cap +60/day)" },
    { lbl: "Heavy spender bonus", val: "+0.001 per USDC" },
    { lbl: "Failed delivery (5xx)", val: "−40" },
    { lbl: "Inactivity", val: "decays toward 500" },
    { lbl: "Starting score", val: "500" },
  ];

  lines.forEach((l, i) => {
    const y = 2.75 + i * 0.55;
    s.addText(l.lbl, {
      x: 8.5, y, w: 2.5, h: 0.45,
      fontSize: 12, color: COLORS.sand, fontFace: FONT_BODY, valign: "middle", margin: 0,
    });
    s.addText(l.val, {
      x: 11.0, y, w: 1.75, h: 0.45,
      fontSize: 12, bold: true, color: COLORS.mint, fontFace: FONT_BODY, valign: "middle", align: "right", margin: 0,
    });
  });

  s.addText("Computed from the on-chain audit trail Locus already gives us — no additional data plane required.", {
    x: 8.5, y: 5.65, w: 4.2, h: 0.95,
    fontSize: 11, italic: true, color: COLORS.muted, fontFace: FONT_BODY, valign: "top", margin: 0,
  });
}

// ============================================================================
// Slide 8 — Policy DSL (code panel)
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);
  slideHeader(s, "policy as code", "Guardian rules in plain JSON.");
  footer(s, 8, TOTAL);

  // left: code
  s.addShape("roundRect", {
    x: 0.5, y: 2.1, w: 7.0, h: 4.6, rectRadius: 0.12,
    fill: { color: "070d1a" }, line: { color: COLORS.border, width: 1 },
  });

  s.addText("policy.json", {
    x: 0.7, y: 2.2, w: 6.6, h: 0.35,
    fontSize: 11, color: COLORS.muted, fontFace: FONT_MONO, italic: true,
  });

  const code =
`{
  "max_per_call_usdc": 5,
  "max_per_agent_per_day_usdc": 50,
  "max_per_tollgate_per_day_usdc": 500,
  "rate_limit_per_minute": 60,
  "require_min_reputation": 250,
  "block_unknown_agents": false,
  "block_geos": ["KP", "IR"],
  "block_burst": true,
  "emit_receipts": true
}`;

  s.addText(code, {
    x: 0.7, y: 2.55, w: 6.6, h: 4.0,
    fontSize: 13, color: COLORS.mint, fontFace: FONT_MONO, valign: "top", margin: 0, paraSpaceAfter: 0,
  });

  // right: typed denial codes
  s.addText("Typed denial codes", {
    x: 7.85, y: 2.1, w: 5, h: 0.4,
    fontSize: 14, bold: true, color: COLORS.violet, fontFace: FONT_HEAD,
  });

  const denials = [
    "policy/over_per_call_cap",
    "policy/over_daily_cap",
    "policy/over_rate_limit",
    "policy/insufficient_reputation",
    "policy/unknown_agent_blocked",
    "policy/burst_blocked",
    "policy/geo_blocked",
  ];

  denials.forEach((d, i) => {
    const y = 2.6 + i * 0.4;
    s.addShape("roundRect", {
      x: 7.85, y, w: 5, h: 0.35, rectRadius: 0.06,
      fill: { color: COLORS.panel }, line: { color: COLORS.border, width: 0.5 },
    });
    s.addText(d, {
      x: 7.95, y, w: 4.85, h: 0.35,
      fontSize: 11, color: COLORS.mint, fontFace: FONT_MONO, valign: "middle", margin: 0,
    });
  });

  s.addText("Returned as HTTP 429. Agents back off, climb reputation, or pick another tollgate — without human intervention.", {
    x: 7.85, y: 5.55, w: 5, h: 1.1,
    fontSize: 11, italic: true, color: COLORS.muted, fontFace: FONT_BODY, valign: "top", margin: 0,
  });
}

// ============================================================================
// Slide 9 — Architecture
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);
  slideHeader(s, "architecture", "One Next.js project. Five primitives.");
  footer(s, 9, TOTAL);

  // Build a stacked architecture diagram
  // Layers stacked vertically with side annotations.

  const cx = 4.5, cw = 5.5;
  const lay = [
    { y: 2.1, label: "AI Agent", sub: "Claude · Cursor · ChatGPT · custom", c: COLORS.mint },
    { y: 2.95, label: "MCP Server (stdio JSON-RPC)", sub: "search_tollgates · call_tollgate", c: COLORS.violet },
    { y: 3.8, label: "/api/proxy/[slug]", sub: "policy → pricing → 402 → replay", c: COLORS.mint },
    { y: 4.65, label: "src/lib/locus.ts", sub: "preflight · confirm · verifyWebhookSignature  (real ⇄ mock)", c: COLORS.violet },
    { y: 5.5, label: "Locus Checkout — USDC on Base", sub: "settlement layer", c: COLORS.rose },
  ];

  lay.forEach((l) => {
    s.addShape("roundRect", {
      x: cx, y: l.y, w: cw, h: 0.7, rectRadius: 0.1,
      fill: { color: COLORS.panel }, line: { color: l.c, width: 1.2 },
    });
    s.addText(l.label, {
      x: cx + 0.2, y: l.y, w: cw - 0.4, h: 0.4,
      fontSize: 13, bold: true, color: COLORS.white, fontFace: FONT_HEAD, valign: "middle", margin: 0,
    });
    s.addText(l.sub, {
      x: cx + 0.2, y: l.y + 0.35, w: cw - 0.4, h: 0.32,
      fontSize: 10, color: COLORS.muted, fontFace: FONT_MONO, valign: "middle", margin: 0,
    });
  });

  // arrows between layers
  for (let i = 0; i < lay.length - 1; i++) {
    s.addShape("line", {
      x: cx + cw / 2, y: lay[i].y + 0.7, w: 0, h: lay[i + 1].y - (lay[i].y + 0.7),
      line: { color: COLORS.border, width: 1.5, endArrowType: "triangle" },
    });
  }

  // left side annotations
  const left = [
    { y: 2.25, t: "discovery", c: COLORS.mint },
    { y: 3.95, t: "request lifecycle", c: COLORS.mint },
    { y: 4.85, t: "Locus boundary", c: COLORS.violet },
    { y: 5.65, t: "settlement", c: COLORS.rose },
  ];
  left.forEach((l) => {
    s.addText(l.t.toUpperCase(), {
      x: 0.5, y: l.y, w: 3.8, h: 0.3,
      fontSize: 11, bold: true, color: l.c, fontFace: FONT_BODY, charSpacing: 4,
    });
  });

  // right side: storage / observability
  s.addShape("roundRect", {
    x: cx + cw + 0.3, y: 2.1, w: 3.0, h: 4.1, rectRadius: 0.12,
    fill: { color: COLORS.panel }, line: { color: COLORS.border, width: 1 },
  });
  s.addText("State & observability", {
    x: cx + cw + 0.45, y: 2.2, w: 2.7, h: 0.3,
    fontSize: 12, bold: true, color: COLORS.mint, fontFace: FONT_HEAD,
  });
  const rightItems = [
    "merchants",
    "tollgates",
    "sessions  (id = locus_id)",
    "usage  (analytics)",
    "reputation",
    "rate_window",
  ];
  rightItems.forEach((t, i) => {
    s.addText("•  " + t, {
      x: cx + cw + 0.45, y: 2.55 + i * 0.36, w: 2.7, h: 0.32,
      fontSize: 11, color: COLORS.sand, fontFace: FONT_MONO, valign: "middle", margin: 0,
    });
  });
  s.addText("better-sqlite3 → swap to Postgres for prod. Every query is plain SQL.", {
    x: cx + cw + 0.45, y: 4.85, w: 2.7, h: 1.3,
    fontSize: 10, italic: true, color: COLORS.muted, fontFace: FONT_BODY, valign: "top", margin: 0,
  });

  s.addText("All Locus contact lives in one file. When the final API ships, only locus.ts changes.", {
    x: 0.5, y: 6.55, w: W - 1, h: 0.4,
    fontSize: 12, italic: true, color: COLORS.sand, fontFace: FONT_BODY, align: "center",
  });
}

// ============================================================================
// Slide 10 — Why now / market
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);
  slideHeader(s, "why now", "Three rails crossed in 2025.");
  footer(s, 10, TOTAL);

  const rails = [
    { title: "USDC on Base went mainstream", body: "Fees dropped to fractions of a cent. Sub-cent API calls became settle-able for the first time. The unit economics for high-frequency agent traffic finally work." , c: COLORS.mint },
    { title: "Agents got wallets and budgets", body: "Claude Agent SDK, OpenAI's Agent Builder, x402, Locus's CheckoutWithLocus — every agent runtime shipped a payment primitive in the last six months. The buyer is real.", c: COLORS.violet },
    { title: "MCP made discovery free", body: "Once any tool can be exposed via MCP, every Claude / Cursor / ChatGPT user has a built-in marketplace client. Distribution became a feature flag.", c: COLORS.rose },
  ];

  rails.forEach((r, i) => {
    const y = 2.1 + i * 1.55;
    s.addShape("roundRect", {
      x: 0.5, y, w: W - 1, h: 1.4, rectRadius: 0.12,
      fill: { color: COLORS.panel }, line: { color: COLORS.border, width: 1 },
    });
    // accent stripe
    s.addShape("rect", {
      x: 0.5, y, w: 0.12, h: 1.4,
      fill: { color: r.c }, line: { color: r.c },
    });
    s.addText(r.title, {
      x: 0.85, y: y + 0.2, w: W - 1.7, h: 0.5,
      fontSize: 18, bold: true, color: COLORS.white, fontFace: FONT_HEAD, valign: "top", margin: 0,
    });
    s.addText(r.body, {
      x: 0.85, y: y + 0.7, w: W - 1.7, h: 0.7,
      fontSize: 12, color: COLORS.muted, fontFace: FONT_BODY, valign: "top", margin: 0,
    });
  });

  s.addText("Stripe was built for human shoppers in browsers. AgentTollgate is built for the buyer that comes next.", {
    x: 0.5, y: 6.85, w: W - 1, h: 0.4,
    fontSize: 13, italic: true, color: COLORS.sand, fontFace: FONT_BODY, align: "center",
  });
}

// ============================================================================
// Slide 11 — Close / CTA
// ============================================================================
{
  const s = pres.addSlide();
  darkBg(s);

  // left vertical accent
  gradientBar(s, 0.5, 1.2, 0.08, H - 2.4);

  s.addText("BUILT ON CHECKOUTWITHLOCUS · OPEN-SOURCE · MIT", {
    x: 0.85, y: 1.2, w: W - 1.7, h: 0.4,
    fontSize: 11, color: COLORS.mint, fontFace: FONT_HEAD, bold: true, charSpacing: 5,
  });

  s.addText("Try it tonight.", {
    x: 0.85, y: 1.7, w: W - 1.7, h: 1.4,
    fontSize: 60, bold: true, color: COLORS.white, fontFace: FONT_HEAD, valign: "top", margin: 0,
  });

  s.addText("90 seconds from clone to first paid call. No Locus key required for the demo — mock mode is built in.", {
    x: 0.85, y: 3.05, w: W - 1.7, h: 0.8,
    fontSize: 18, color: COLORS.sand, fontFace: FONT_BODY, valign: "top", margin: 0,
  });

  // command block
  s.addShape("roundRect", {
    x: 0.85, y: 4.05, w: W - 1.7, h: 1.55, rectRadius: 0.12,
    fill: { color: "070d1a" }, line: { color: COLORS.border, width: 1 },
  });
  s.addText([
    { text: "$ ", options: { color: COLORS.mint } },
    { text: "git clone <repo> && cd agenttollgate\n", options: { color: COLORS.sand } },
    { text: "$ ", options: { color: COLORS.mint } },
    { text: "npm install && cp .env.example .env\n", options: { color: COLORS.sand } },
    { text: "$ ", options: { color: COLORS.mint } },
    { text: "npm run seed && npm run dev\n", options: { color: COLORS.sand } },
    { text: "→ ", options: { color: COLORS.violet } },
    { text: "http://localhost:3000", options: { color: COLORS.mint, bold: true } },
  ], {
    x: 1.1, y: 4.2, w: W - 2.2, h: 1.3,
    fontSize: 16, fontFace: FONT_MONO, valign: "top", margin: 0,
  });

  // bottom signature row
  s.addShape("line", {
    x: 0.85, y: 6.0, w: W - 1.7, h: 0,
    line: { color: COLORS.border, width: 1 },
  });

  const sig = [
    { lbl: "Track", val: "Week 3 — CheckoutWithLocus" },
    { lbl: "Stack", val: "Next.js 15 · TS · USDC on Base" },
    { lbl: "License", val: "MIT" },
  ];
  sig.forEach((row, i) => {
    const x = 0.85 + i * 4.05;
    s.addText(row.lbl.toUpperCase(), {
      x, y: 6.2, w: 4, h: 0.3,
      fontSize: 10, color: COLORS.muted, fontFace: FONT_BODY, charSpacing: 4, bold: true,
    });
    s.addText(row.val, {
      x, y: 6.5, w: 4, h: 0.4,
      fontSize: 14, color: COLORS.white, fontFace: FONT_HEAD, bold: true,
    });
  });

  // tiny page number bottom right
  s.addText(`${TOTAL} / ${TOTAL}`, {
    x: W - 1, y: H - 0.45, w: 0.6, h: 0.3,
    fontSize: 10, color: COLORS.muted, fontFace: FONT_BODY, align: "right", bold: true,
  });
}

// ----- write -----------------------------------------------------------------

const out = path.resolve(__dirname, "AgentTollgate-Pitch.pptx");
pres.writeFile({ fileName: out }).then((f) => {
  console.log("wrote:", f);
}).catch((e) => {
  console.error("failed:", e);
  process.exit(1);
});
