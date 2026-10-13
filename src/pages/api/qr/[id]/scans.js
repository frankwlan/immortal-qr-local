import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";
import prisma from "../../../../lib/prisma";
import { createLimiter } from "../../../../lib/rateLimit";
import { PAGE_SIZE, loadScanPage } from "../../../../lib/scanStats";

const pageLimiter = createLimiter("qr-scans-page", { windowMs: 60 * 1000, max: 120 });

// "Show more" for the scan history: the next page after a cursor returned by
// the detail endpoint (?before=<ISO time>&beforeId=<scan id>&bots=1).
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();
  const userId = session.user.id;

  const { allowed, retryAfterMs } = await pageLimiter.check(userId);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many requests. Try again in a moment." });
  }

  const { id, before, beforeId } = req.query;
  if (typeof id !== "string" || !id || id.length > 64) return res.status(404).end();
  if (typeof before !== "string" || Number.isNaN(Date.parse(before))) return res.status(400).json({ error: "Bad cursor" });
  if (typeof beforeId !== "string" || !beforeId || beforeId.length > 64) return res.status(400).json({ error: "Bad cursor" });

  const link = await prisma.qrLink.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });
  if (!link) return res.status(404).end();

  const page = await loadScanPage(link.id, {
    includeBots: req.query.bots === "1",
    before: new Date(before).toISOString(),
    beforeId,
    limit: PAGE_SIZE,
  });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(page);
}
