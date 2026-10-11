const { withSentryConfig } = require("@sentry/nextjs/config");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Never let another site embed ImmortalQR in a frame (clickjacking).
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          // Reset and verification tokens travel in URLs; keep them out of
          // Referer headers sent to other sites.
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Shorter public path for QR-encoded URLs; the API route is the
      // actual implementation so client code and QRCode.toDataURL calls
      // stay simple.
      { source: "/r/:slug", destination: "/api/qr/redirect/:slug" },
    ];
  },
};

// Wraps the build so API routes are auto-instrumented and errors reach
// Sentry. This works even with none of the SENTRY_* env vars set (verified
// directly — the build just skips source-map upload, which is the only
// part that needs org/project/authToken). Source maps for readable stack
// traces need SENTRY_ORG, SENTRY_PROJECT, and SENTRY_AUTH_TOKEN; without
// them, errors still reach Sentry, just with minified stack traces.
module.exports = withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: true,
  widenClientFileUpload: true,
});
