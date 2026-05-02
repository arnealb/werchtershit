import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  serverExternalPackages: ["cheerio"],
  turbopack: {
    root: path.resolve(process.cwd()),
  },
};

export default nextConfig;
