import * as Sentry from "@sentry/nextjs";
import prisma from "../../../../lib/prisma";
import { logScan } from "../../../../lib/scanTracking";
import { getClientIp } from "../../../../lib/rateLimit";
import { toSafeLocation } from "../../../../lib/url";
import { SLUG_PATTERN } from "../../../../lib/slug";
import { redirectIpLimiter, redirectMissLimiter, scanLogLimiter } from "../../../../lib/linkLimits";

function notFound(res) {
  return res.status(404).send("Not found");
}

export default async function handler(req, res) {
  const { slug } = req.query;
  // Anything that can't be a real code is rejected before touching the
  // database or the rate limiters.
  if (typeof slug !== "string" || !SLUG_PATTERN.test(slug)) return notFound(res);

  const ip = getClientIp(req);

  try {
    const [general, missState] = await Promise.all([redirectIpLimiter.check(ip), redirectMissLimiter.peek(ip)]);
    if (!general.allowed || !missState.allowed) {
      res.setHeader("Retry-After", Math.ceil((general.retryAfterMs || missState.retryAfterMs || 60000) / 1000));
      return res.status(429).send("Too many requests. Please try again shortly.");
    }

    const link = await prisma.qrLink.findUnique({ where: { slug } });
    if (!link || link.deletedAt) {
      await redirectMissLimiter.check(ip); // count the miss
      return notFound(res);
    }

    if (link.disabledAt) {
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.status(410).send(
        `<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">` +
          `<title>Link disabled</title><body style="font-family:system-ui,sans-serif;max-width:32rem;margin:4rem auto;padding:0 1rem">` +
          `<h1>This link has been disabled</h1>` +
          `<p>It was switched off for violating our Terms of Service, so we haven't sent you to its destination.</p>` +
          `<p><a href="/report?code=${slug}">Report a problem with this link</a></p></body>`
      );
    }

    // Canonicalize before responding: a destination saved before URL
    // normalization existed may hold raw non-ASCII characters, which Node
    // refuses to put in a Location header.
    const location = toSafeLocation(link.destination);
    if (!location) return notFound(res);

    // Awaited (not fire-and-forget) because serverless functions can be
    // frozen/killed shortly after the response is sent, which would
    // silently drop an un-awaited write. logScan swallows its own
    // errors, so a failed analytics write still can't block the redirect.
    const logAllowed = await scanLogLimiter.check(`${link.id}:${ip}`);
    if (logAllowed.allowed) {
      await logScan(link.id, { ip, userAgent: req.headers["user-agent"] });
    }

    res.setHeader("Cache-Control", "no-store");
    res.writeHead(302, { Location: location });
    res.end();
  } catch (err) {
    console.error("Redirect lookup failed:", err);
    Sentry.captureException(err);
    res.status(500).send("Something went wrong");
  }
}
