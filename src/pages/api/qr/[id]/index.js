import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";
import prisma from "../../../../lib/prisma";
import { createLimiter } from "../../../../lib/rateLimit";
import { getBaseUrl } from "../../../../lib/baseUrl";
import { ALLOWED_RANGES, DEFAULT_RANGE, PAGE_SIZE, isValidTimeZone, loadScanPage, loadScanStats } from "../../../../lib/scanStats";

// The stats queries scan a link's events, so cap how often one user can run
// them. Generous for a person clicking around, small for a script.
const detailLimiter = createLimiter("qr-detail", { windowMs: 60 * 1000, max: 60 });

// Everything the detail page needs for one QR code: its basic info, the
// scan statistics for a date range, and the first page of scan history.
//   ?days=7|30|90   range for the chart and totals (default 30)
//   ?tz=<IANA zone> the viewer's time zone, so "per day" means their days
//   ?bots=1         include robots and link-preview fetchers
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();
  const userId = session.user.id;

  const { allowed, retryAfterMs } = await detailLimiter.check(userId);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many requests. Try again in a moment." });
  }

  const { id } = req.query;
  if (typeof id !== "string" || !id || id.length > 64) return res.status(404).end();

  // Ownership is part of the lookup: someone else's code is a plain 404, the
  // same as one that doesn't exist.
  const link = await prisma.qrLink.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true, slug: true, destination: true, disabledAt: true, createdAt: true, updatedAt: true },
  });
  if (!link) return res.status(404).end();

  const days = ALLOWED_RANGES.includes(Number(req.query.days)) ? Number(req.query.days) : DEFAULT_RANGE;
  const tz = isValidTimeZone(req.query.tz) ? req.query.tz : "UTC";
  const includeBots = req.query.bots === "1";

  const [stats, firstPage, totalAllTime] = await Promise.all([
    loadScanStats(link.id, { days, tz, includeBots }),
    loadScanPage(link.id, { includeBots, limit: PAGE_SIZE }),
    prisma.scanEvent.count({ where: { qrLinkId: link.id } }),
  ]);

  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json({
    link: {
      ...link,
      // The address the QR code must encode. Built on the server from the
      // configured site URL so a download made while browsing a preview
      // deployment can't end up printing a temporary domain.
      shortUrl: `${getBaseUrl()}/r/${link.slug}`,
    },
    totalAllTime,
    stats,
    scans: firstPage,
  });
}
