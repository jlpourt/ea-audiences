const isDev = process.env.NODE_ENV !== "production";

/**
 * Content-Security-Policy (Codex §8).
 *  - Generated media is served from the public GCS bucket, hence
 *    `storage.googleapis.com` in img/media; API calls stay server-side.
 *  - Next.js dev needs `'unsafe-eval'` for React Refresh and `'unsafe-inline'`
 *    for style injection. `'unsafe-eval'` is gated to dev only.
 *  - `blob:` is required for the force-graph canvas workers and client-side
 *    audio previews before upload.
 * TODO(security): nonce-based script-src via middleware once the app is no
 * longer statically optimised; until then `'unsafe-inline'` covers Next's
 * inline hydration script in production.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""} blob:`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  "img-src 'self' data: blob: https://storage.googleapis.com https://*.googleapis.com https://*.gstatic.com https://upload.wikimedia.org",
  "media-src 'self' data: blob: https://storage.googleapis.com https://*.googleapis.com",
  "connect-src 'self' https://storage.googleapis.com https://*.googleapis.com" +
    (isDev ? " ws://127.0.0.1:* ws://localhost:*" : ""),
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Per-process build dir so parallel dev servers don't clobber each other's chunks
  // (e.g. NEXT_DIST_DIR=.next-3102 npx next dev -p 3102). Production uses .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
  reactStrictMode: true,
  output: "standalone",
  poweredByHeader: false,
  transpilePackages: ["three", "react-force-graph-2d", "react-force-graph-3d", "three-spritetext"],
  experimental: {
    serverComponentsExternalPackages: [
      "@google-cloud/spanner",
      "@google-cloud/bigquery",
      "@google-cloud/storage",
      "@google-cloud/pubsub",
      "@google/genai",
      "google-auth-library",
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  webpack: (config) => {
    config.externals = [...(config.externals || []), { canvas: "canvas" }];
    return config;
  },
};

module.exports = nextConfig;
