import "./globals.css";
import type { Metadata } from "next";
import Nav from "@/components/nav";
import Footer from "@/components/footer";

export const metadata: Metadata = {
  title: "AgentTollgate — Paywall any API for AI agents in 60 seconds",
  description:
    "Wrap any HTTP endpoint behind a CheckoutWithLocus paywall. AI agents preflight, pay in USDC, and consume — with policy enforcement, reputation-aware pricing, and live revenue analytics.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "AgentTollgate",
    description:
      "The drop-in paywall for the agentic economy. Built on CheckoutWithLocus. USDC on Base.",
    type: "website",
  },
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="min-h-screen flex flex-col">
        <Nav />
        <main className="flex-1">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
