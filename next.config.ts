import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Allow the embedded better-sqlite3 native binding to load in the App Router
    serverComponentsExternalPackages: ["better-sqlite3"],
  },
  // Allow demo deployment without credentials
  env: {
    LOCUS_API_BASE: process.env.LOCUS_API_BASE ?? "https://beta-api.paywithlocus.com",
  },
};

export default nextConfig;
