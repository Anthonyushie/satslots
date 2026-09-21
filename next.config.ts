import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // No `output: "export"`. The app needs a server: the Neon connection string
  // cannot be shipped to the browser, and the NIP-42 challenge/response flow
  // requires server-side signature verification. Deploy to a Node-capable host.
  reactStrictMode: true,
  images: { unoptimized: true },
  experimental: { cpus: 2 },
};

export default nextConfig;
