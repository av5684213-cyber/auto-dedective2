import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  allowedDevOrigins: [
    "preview-chat-d2269f74-2518-4eb6-8589-111b39f15d86.space-z.ai",
    "preview-595a2efb-6733-44f1-b702-61f1926d2733.space-z.ai",
    "preview-123e5fcb-2e93-404f-affb-60a123ffacf0.space-z.ai",
    "preview-chat-7df40b98-fab2-4fe9-814c-f80f3a9b24f8.space-z.ai",
    "*.space-z.ai",
  ],
};

export default nextConfig;
