import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 服务端 SDK 使用 node:crypto / ws，保持为 Node 外部包。
  serverExternalPackages: ["@lingya-ai/agents-sdk"],
  devIndicators: false,
};

export default nextConfig;
