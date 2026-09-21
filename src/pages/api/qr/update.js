import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import isURL from "validator/lib/isURL";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();
  const { id, destination } = req.body || {};
  if (!id || !isURL(destination || "", { protocols: ["http", "https"], require_protocol: true })) return res.status(400).json({ error: "Bad input" });

  const { count } = await prisma.qrLink.updateMany({
    where: { id, userId: session.user.id, deletedAt: null },
    data: { destination },
  });
  if (count === 0) return res.status(404).end();
  res.status(200).json({ ok: true });
}