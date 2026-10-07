import prisma from "../../../../lib/prisma";
import { logScan } from "../../../../lib/scanTracking";
import { getClientIp } from "../../../../lib/rateLimit";

export default async function handler(req, res) {
  const { slug } = req.query;
  if (typeof slug !== "string" || slug.length === 0) {
    return res.status(404).send("Not found");
  }

  try {
    const link = await prisma.qrLink.findUnique({ where: { slug } });
    if (!link || link.deletedAt) {
      return res.status(404).send("Not found");
    }

    // Awaited (not fire-and-forget) because serverless functions can be
    // frozen/killed shortly after the response is sent, which would
    // silently drop an un-awaited write. logScan swallows its own
    // errors, so a failed analytics write still can't block the redirect.
    await logScan(link.id, { ip: getClientIp(req), userAgent: req.headers["user-agent"] });

    res.setHeader("Cache-Control", "no-store");
    res.writeHead(302, { Location: link.destination });
    res.end();
  } catch (err) {
    console.error("Redirect lookup failed:", err);
    res.status(500).send("Something went wrong");
  }
}