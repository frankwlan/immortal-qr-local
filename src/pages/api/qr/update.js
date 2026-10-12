import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import { normalizeDestination } from "../../../lib/url";
import { requireSameOrigin } from "../../../lib/sameOrigin";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireSameOrigin(req, res)) return;
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();
  const account = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { emailVerified: true },
  });
  if (!account?.emailVerified) {
    return res.status(403).json({
      error: "Please verify your email address before editing QR codes.",
      code: "EMAIL_NOT_VERIFIED",
    });
  }

  const { id, destination: rawDestination } = req.body || {};
  if (typeof id !== "string" || !id) return res.status(400).json({ error: "Bad input" });
  const normalized = normalizeDestination(rawDestination);
  if (normalized.error) return res.status(400).json({ error: normalized.error });
  const destination = normalized.url;

  const { count } = await prisma.qrLink.updateMany({
    // A disabled link can't be edited, or "switching it off" would be
    // undone by pointing it somewhere new.
    where: { id, userId: session.user.id, deletedAt: null, disabledAt: null },
    data: { destination },
  });
  if (count === 0) return res.status(404).end();
  res.status(200).json({ ok: true });
}