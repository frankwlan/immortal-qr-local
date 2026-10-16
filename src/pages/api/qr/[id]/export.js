import { getServerSession } from "next-auth";
import { authOptions } from "../../../../lib/authOptions";
import prisma from "../../../../lib/prisma";
import { createLimiter } from "../../../../lib/rateLimit";
import { toCsv } from "../../../../lib/csv";
import { loadScansForExport, parseWindow } from "../../../../lib/scanStats";

// Exports run a bigger query than a page of the table, so keep them to a
// handful a minute per person.
const exportLimiter = createLimiter("qr-export", { windowMs: 60 * 1000, max: 10 });

const KIND_LABELS = { mobile: "Phone", tablet: "Tablet", desktop: "Computer", bot: "Robot / link preview", unknown: "Unknown" };

// CSV of the scans in the chart's date range (?days=, ?tz=, ?bots=1).
// Contains only what the table shows: no IP addresses, no raw user agents.
export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();
  const userId = session.user.id;

  const { allowed, retryAfterMs } = await exportLimiter.check(userId);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many requests. Try again in a moment." });
  }

  const { id } = req.query;
  if (typeof id !== "string" || !id || id.length > 64) return res.status(404).end();

  const link = await prisma.qrLink.findFirst({
    where: { id, userId, deletedAt: null },
    select: { id: true, slug: true },
  });
  if (!link) return res.status(404).end();

  const window = parseWindow(req.query);
  const { items, truncated } = await loadScansForExport(link.id, window);
  const csv = toCsv(
    ["scanned_at_utc", "scanned_at_local", "time_zone", "device", "system"],
    items.map((s) => [s.scannedAt, s.local, window.tz, KIND_LABELS[s.kind] || s.kind, s.os])
  );

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="immortalqr-${link.slug}-scans-last-${window.days}-days.csv"`);
  res.setHeader("Cache-Control", "no-store");
  if (truncated) res.setHeader("X-Export-Truncated", "1");
  return res.status(200).send(csv);
}
