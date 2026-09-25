import prisma from "../../../lib/prisma";
import isEmail from "validator/lib/isEmail";
import { generateResetToken, RESET_TOKEN_TTL_MS } from "../../../lib/passwordReset";
import { sendPasswordResetEmail } from "../../../lib/email";
import { rateLimit, getClientIp } from "../../../lib/rateLimit";

const WINDOW_MS = 15 * 60 * 1000;
const MAX_PER_WINDOW = 5;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { allowed, retryAfterMs } = rateLimit(`forgot-password:${getClientIp(req)}`, {
    windowMs: WINDOW_MS,
    max: MAX_PER_WINDOW,
  });
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many requests. Try again later." });
  }

  const { email } = req.body || {};
  if (!email || !isEmail(email)) {
    return res.status(400).json({ error: "A valid email is required" });
  }
  const normalizedEmail = email.trim().toLowerCase();

  // Always respond the same way whether or not the account exists —
  // otherwise this endpoint becomes a way to test which emails are
  // registered.
  const genericResponse = { ok: true, message: "If that email is registered, a reset link has been sent." };

  const user = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (!user) {
    return res.status(200).json(genericResponse);
  }

  const { token, tokenHash } = generateResetToken();
  await prisma.user.update({
    where: { id: user.id },
    data: {
      resetTokenHash: tokenHash,
      resetTokenExpires: new Date(Date.now() + RESET_TOKEN_TTL_MS),
    },
  });

  const resetUrl = `${process.env.NEXTAUTH_URL}/reset-password?token=${token}`;
  try {
    await sendPasswordResetEmail(normalizedEmail, resetUrl);
  } catch (err) {
    console.error("Failed to send password reset email:", err);
    // Don't leak email-provider failures to the caller — same generic
    // response either way, to avoid the account-enumeration issue above.
  }

  return res.status(200).json(genericResponse);
}
