import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // 발행 JSON(public/data, 2만여 파일)은 정적 자산으로만 나간다. /y/[year]가 빌드 때 fs로 읽지만
  // 전부 SSG라 런타임엔 필요 없다 — 서버 번들 추적에서 뺀다(빌드 경고 "matches 27336 files").
  outputFileTracingExcludes: {
    "/*": ["./public/data/**/*"],
  },
};

export default nextConfig;
