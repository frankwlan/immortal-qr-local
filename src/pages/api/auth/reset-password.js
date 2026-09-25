import prisma from "../../../lib/prisma";
import { hash } from "bcryptjs";
import { hashResetToken } from "../../../lib/passwordReset";

const MIN_PASSWORD_LENGTH = 8;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: "Token and new password are required" });
  }
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const tokenHash = hashResetToken(token);
  const user = await prisma.user.findUnique({ where: { resetTokenHash: tokenHash } });

  if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    return res.status(400).json({ error: "This reset link is invalid or has expired." });
  }

  const passwordHash = await hash(password, 10);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetTokenHash: null,
      resetTokenExpires: null,
    },
  });

  return res.status(200).json({ ok: true });
}
