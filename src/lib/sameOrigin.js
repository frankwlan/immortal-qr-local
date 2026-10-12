// Defense-in-depth against cross-site request forgery for routes that change
// data. Session cookies are already SameSite=Lax, which blocks cross-site
// POSTs in modern browsers; this also rejects any browser request whose
// Origin header names a different site. Requests with no Origin header
// (curl, server-to-server) are allowed — they can't ride a victim's cookies.
//
// Returns true if the request may proceed; otherwise sends a 403 and returns
// false, so callers do: `if (!requireSameOrigin(req, res)) return;`
export function requireSameOrigin(req, res) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  try {
    if (host && new URL(origin).host === String(host).split(",")[0].trim()) return true;
  } catch {
    /* malformed Origin falls through to rejection */
  }
  res.status(403).json({ error: "Cross-site request blocked." });
  return false;
}
