import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import { createLimiter } from "../../../lib/rateLimit";
import { generateVerifyToken, VERIFY_TOKEN_TTL_MS } from "../../../lib/emailVerification";
import { sendEmailChangeConfirmation } from "../../../lib/email";
import { getBaseUrl } from "../../../lib/baseUrl";
import { requireSameOrigin } from "../../../lib/sameOrigin";

const actionLimiter = createLimiter("email-change-action", { windowMs: 60 * 60 * 1000, max: 5 });

// Manage a pending email change from Settings:
//   { action: "resend" } sends a fresh confirmation link to the pending address
//   { action: "cancel" } drops the pending change
// Neither needs the password: resend only mails an address the user already
// asked for (after proving the password), and cancel only undoes a request.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireSameOrigin(req, res)) return;
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();
  const userId = session.user.id;

  const { action } = req.body || {};
  if (action !== "resend" && action !== "cancel") return res.status(400).json({ error: "Bad input" });

  const { allowed, retryAfterMs } = await actionLimiter.check(userId);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many requests. Try again later." });
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { pendingEmail: true } });
  if (!user) return res.status(404).end();
  if (!user.pendingEmail) return res.status(400).json({ error: "There is no pending email change." });

  if (action === "cancel") {
    await prisma.user.update({
      where: { id: userId },
      data: { pendingEmail: null, pendingEmailTokenHash: null, pendingEmailExpires: null },
    });
    return res.status(200).json({ ok: true });
  }

  // Resend: re-check the address wasn't taken in the meantime, then replace
  // the token so the earlier link stops working.
  const taken = await prisma.user.findUnique({ where: { email: user.pendingEmail }, select: { id: true } });
  if (taken) {
    return res.status(409).json({ error: "That email address is now in use by another account. Cancel and choose a different one." });
  }
  const { token, tokenHash } = generateVerifyToken();
  await prisma.user.update({
    where: { id: userId },
    data: { pendingEmailTokenHash: tokenHash, pendingEmailExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS) },
  });
  try {
    await sendEmailChangeConfirmation(user.pendingEmail, `${getBaseUrl()}/confirm-email-change?token=${token}`);
  } catch (err) {
    console.error("Failed to send email-change confirmation:", err);
    Sentry.captureException(err);
    return res.status(502).json({ error: "Couldn't send the email. Please try again shortly." });
  }
  return res.status(200).json({ ok: true });
}
