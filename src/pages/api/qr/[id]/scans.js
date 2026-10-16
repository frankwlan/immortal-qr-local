import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";
import prisma from "../../../../lib/prisma";
import { createLimiter } from "../../../../lib/rateLimit";
import { DEFAULT_PAGE_SIZE, PAGE_SIZES, loadScanPage, parseWindow } from "../../../../lib/scanStats";

const pageLimiter = createLimiter("qr-scans-page", { windowMs: 60 * 1000, max: 120 });

// One page of the scan history table, newest first, limited to the same date
// range as the chart.
//   ?days=7|30|90   range (default 30), ?tz=<IANA zone>, ?bots=1
//   ?limit=10|20|50|100   rows per page (default 20)
//   ?before=<ISO time>&beforeId=<scan id>   cursor from the previous page;
//                                           leave both out for the first page
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

  // A cursor is both fields or neither.
  const hasCursor = before !== undefined || beforeId !== undefined;
  if (hasCursor) {
    if (typeof before !== "string" || Number.isNaN(Date.parse(before))) return res.status(400).json({ error: "Bad cursor" });
    if (typeof beforeId !== "string" || !beforeId || beforeId.length > 64) return res.status(400).json({ error: "Bad cursor" });
  }

  const limit = Number(req.query.limit ?? DEFAULT_PAGE_SIZE);
  if (!PAGE_SIZES.includes(limit)) return res.status(400).json({ error: "Bad page size" });

  const link = await prisma.qrLink.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true },
  });
  if (!link) return res.status(404).end();

  const page = await loadScanPage(link.id, {
    ...parseWindow(req.query),
    ...(hasCursor ? { before: new Date(before).toISOString(), beforeId } : {}),
    limit,
  });
  res.setHeader("Cache-Control", "no-store");
  return res.status(200).json(page);
}
