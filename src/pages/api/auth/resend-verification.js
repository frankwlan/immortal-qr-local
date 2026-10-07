import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import { createLimiter } from "../../../lib/rateLimit";
import { generateVerifyToken, VERIFY_TOKEN_TTL_MS } from "../../../lib/emailVerification";
import { sendVerificationEmail } from "../../../lib/email";

const resendLimiter = createLimiter("resend-verification", {
  windowMs: 60 * 60 * 1000,
  max: 3,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const { allowed, retryAfterMs } = await resendLimiter.check(session.user.id);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many requests. Try again later." });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, emailVerified: true },
  });
  if (!user) return res.status(404).end();
  if (user.emailVerified) return res.status(200).json({ ok: true, alreadyVerified: true });

  const { token, tokenHash } = generateVerifyToken();
  await prisma.user.update({
    where: { id: session.user.id },
    data: { verifyTokenHash: tokenHash, verifyTokenExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) },
  });

  try {
    await sendVerificationEmail(user.email, `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    Sentry.captureException(err);
    return res.status(502).json({ error: "Couldn't send the email. Please try again shortly." });
  }

  return res.status(200).json({ ok: true });
}
