import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const items = await prisma.qrLink.findMany({
    where: { userId: session.user.id, deletedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      destination: true,
      createdAt: true,
      _count: { select: { scans: true } },
    },
  });

  // One grouped query for "last scanned" across all of this user's links,
  // instead of one query per link.
  const lastScans = items.length
    ? await prisma.scanEvent.groupBy({
        by: ["qrLinkId"],
        where: { qrLinkId: { in: items.map((i) => i.id) } },
        _max: { scannedAt: true },
      })
    : [];
  const lastScanByLinkId = Object.fromEntries(
    lastScans.map((row) => [row.qrLinkId, row._max.scannedAt])
  );

  const result = items.map(({ _count, ...item }) => ({
    ...item,
    scanCount: _count.scans,
    lastScannedAt: lastScanByLinkId[item.id] || null,
  }));

  res.status(200).json(result);
}