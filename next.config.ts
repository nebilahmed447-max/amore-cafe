import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }] },
  // Keep the native canvas package out of webpack's JS parser.
  // PDF.js uses it at runtime to render scanned PDFs for OCR.
  serverExternalPackages: ["@napi-rs/canvas"],
};

export default nextConfig;
