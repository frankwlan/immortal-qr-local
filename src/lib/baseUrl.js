// Public origin used in emailed links. NEXTAUTH_URL wins when set (and is
// what production should use); VERCEL_URL covers preview deployments, where
// NEXTAUTH_URL typically isn't configured and links would otherwise read
// "undefined/verify-email?...".
export function getBaseUrl() {
  if (process.env.NEXTAUTH_URL) return process.env.NEXTAUTH_URL.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}
