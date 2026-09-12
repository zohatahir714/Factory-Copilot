import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["groq-sdk"],
  // Pin workspace root — a stray package-lock.json in the user home folder
  // otherwise makes Next infer the wrong root (warning at dev/build time).
  outputFileTracingRoot: path.join(import.meta.dirname),
};

export default nextConfig;
