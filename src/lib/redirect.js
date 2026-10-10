import { logScan } from "./scanTracking";
import { getClientIp } from "./rateLimit";

// Shared by both redirect routes (/r/<slug> and /r/<username>/<alias>).
export async function serveRedirect(req, res, link) {
  // Awaited (not fire-and-forget) because serverless functions can be
  // frozen/killed shortly after the response is sent, which would
  // silently drop an un-awaited write. logScan swallows its own
  // errors, so a failed analytics write still can't block the redirect.
  await logScan(link.id, { ip: getClientIp(req), userAgent: req.headers["user-agent"] });

  res.setHeader("Cache-Control", "no-store");
  res.writeHead(302, { Location: link.destination });
  res.end();
}
