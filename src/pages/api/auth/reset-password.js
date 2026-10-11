import prisma from "../../../lib/prisma";
import { hash } from "bcryptjs";
import { hashResetToken } from "../../../lib/passwordReset";
import { isString, passwordProblem } from "../../../lib/validation";

const INVALID_LINK = "This reset link is invalid or has expired.";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { token, password } = req.body || {};
  if (!token || !password) {
    return res.status(400).json({ error: "Token and new password are required" });
  }
  if (!isString(token)) return res.status(400).json({ error: INVALID_LINK });
  const problem = passwordProblem(password);
  if (problem) return res.status(400).json({ error: problem });

  const tokenHash = hashResetToken(token);
  const user = await prisma.user.findUnique({ where: { resetTokenHash: tokenHash } });

  if (!user || !user.resetTokenExpires || user.resetTokenExpires < new Date()) {
    return res.status(400).json({ error: INVALID_LINK });
  }

  const passwordHash = await hash(password, 10);

  // The token is re-checked inside the UPDATE itself (not just the read
  // above), so two simultaneous requests with the same link can't both win:
  // only one matches a row, the other sees count 0.
  const { count } = await prisma.user.updateMany({
    where: { id: user.id, resetTokenHash: tokenHash, resetTokenExpires: { gt: new Date() } },
    data: {
      passwordHash,
      resetTokenHash: null,
      resetTokenExpires: null,
      // Invalidates every existing session for this user (see the jwt
      // callback in lib/authOptions.js), so anyone who was signed in with
      // the old password is logged out on their next request.
      sessionVersion: { increment: 1 },
      // Receiving the reset link proves control of the inbox, so an
      // unverified account is verified by completing a reset.
      ...(user.emailVerified ? {} : { emailVerified: new Date(), verifyTokenHash: null, verifyTokenExpires: null }),
    },
  });
  if (count === 0) return res.status(400).json({ error: INVALID_LINK });

  return res.status(200).json({ ok: true });
}
