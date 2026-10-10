import prisma from "../../../lib/prisma";
import { hashVerifyToken } from "../../../lib/emailVerification";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { token } = req.body || {};
  if (!token || typeof token !== "string") {
    return res.status(400).json({ error: "Token is required" });
  }

  const user = await prisma.user.findUnique({ where: { verifyTokenHash: hashVerifyToken(token) } });
  if (!user || !user.verifyTokenExpires || user.verifyTokenExpires < new Date()) {
    return res.status(400).json({ error: "This verification link is invalid or has expired." });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { emailVerified: new Date(), verifyTokenHash: null, verifyTokenExpires: null },
  });

  return res.status(200).json({ ok: true });
}
