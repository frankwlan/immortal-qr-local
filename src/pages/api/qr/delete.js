import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();
  const { id } = req.body || {};
  const link = await prisma.qrLink.findUnique({ where: { id } });
  if (!link || link.userId !== session.user.id) return res.status(404).end();
  await prisma.qrLink.update({ where: { id }, data: { deletedAt: new Date() } });
  res.status(200).json({ ok: true });
}