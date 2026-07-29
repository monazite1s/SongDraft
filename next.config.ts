import type { NextConfig } from "next";

/**
 * 安全响应头（应用于所有路由 `/:path*`）。
 *
 * 设计要点（与本项目现状对齐，避免破坏功能）：
 * - X-Frame-Options: SAMEORIGIN —— 分享页 `/s/[token]` 防被任意 iframe 嵌套；
 *   若未来需允许特定域嵌入，改为 CSP `frame-ancestors` 白名单。
 * - X-Content-Type-Options / Referrer-Policy / HSTS —— 基础加固，无副作用。
 * - Permissions-Policy —— 仅放开制作台所需的 camera/microphone，geolocation 关闭。
 * - CSP 采用保守策略：Next.js 注入内联脚本与内联 style（Tailwind），
 *   故 script-src/style-src 必须含 'unsafe-inline'；SSE 流走同源
 *   `/api/creative-chat/stream`，`connect-src 'self'` 即可覆盖；
 *   音频播放可能来自 blob:/https:（MiniMax 临时 URL 与本地录音），
 *   故 media-src 含 blob: https:。未放开 frame-ancestors（即默认仅同源可嵌套）。
 *
 * 注意：CSP 未对 image/font 做严苛限制以兼容 data: 占位图与内联字体。
 */
const securityHeaders = [
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains",
  },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // Next.js 注入内联脚本；开发态/依赖可能用 eval，故保留 unsafe-eval
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
      // Tailwind 注入内联 style
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      // 音频：本地录音(blob:) + MiniMax 等外链 https
      "media-src 'self' https: blob:",
      // 同源 SSE(/api/creative-chat/stream) + 外部 LLM/COS 走 https
      "connect-src 'self' https:",
      "font-src 'self' data:",
      "base-uri 'self'",
      "form-action 'self'",
      // 仅同源可被嵌套（与 X-Frame-Options 同向加固）
      "frame-ancestors 'self'",
      "object-src 'none'",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
