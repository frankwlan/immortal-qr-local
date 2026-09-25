/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    return [
      // Shorter public path for QR-encoded URLs; the API route is the
      // actual implementation so client code and QRCode.toDataURL calls
      // stay simple.
      { source: "/r/:slug", destination: "/api/qr/redirect/:slug" },
    ];
  },
};

module.exports = nextConfig;
