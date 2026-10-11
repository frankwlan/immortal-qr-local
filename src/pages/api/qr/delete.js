import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();
  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: "id required" });

  const { count } = await prisma.qrLink.updateMany({
    where: { id, userId: session.user.id, deletedAt: null },
    data: { deletedAt: new Date() },
  });
  if (count === 0) return res.status(404).end();
  res.status(200).json({ ok: true });
}