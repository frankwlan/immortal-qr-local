import * as Sentry from "@sentry/nextjs";
import prisma from "../../../lib/prisma";
import { createLimiter, getClientIp } from "../../../lib/rateLimit";
import { hashVerifyToken } from "../../../lib/emailVerification";
import { sendEmailChangedNotice } from "../../../lib/email";

// The link is opened from an inbox, often on another device, so this works
// without a session: possession of the single-use token (only a hash of which
// is stored) is the proof. The limit just keeps blind guessing cheap to refuse.
const confirmLimiter = createLimiter("confirm-email-change", { windowMs: 15 * 60 * 1000, max: 20 });

const INVALID = "This confirmation link is invalid or has expired.";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { allowed, retryAfterMs } = await confirmLimiter.check(getClientIp(req));
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }

  const { token } = req.body || {};
  if (!token || typeof token !== "string") return res.status(400).json({ error: "Token is required" });
  const tokenHash = hashVerifyToken(token);

  const user = await prisma.user.findFirst({
    where: { pendingEmailTokenHash: tokenHash, deletedAt: null },
    select: { id: true, email: true, pendingEmail: true, pendingEmailExpires: true },
  });
  if (!user || !user.pendingEmail || !user.pendingEmailExpires || user.pendingEmailExpires < new Date()) {
    return res.status(400).json({ error: INVALID });
  }

  let count;
  try {
    // Matching on the token hash again makes this single-use even if the link
    // is opened twice at once: only one request can still match.
    ({ count } = await prisma.user.updateMany({
      where: { id: user.id, pendingEmailTokenHash: tokenHash },
      data: {
        email: user.pendingEmail,
        // Clicking the emailed link proves the new address is theirs.
        emailVerified: new Date(),
        pendingEmail: null,
        pendingEmailTokenHash: null,
        pendingEmailExpires: null,
        // Links that were mailed to the OLD address must not outlive it.
        verifyTokenHash: null,
        verifyTokenExpires: null,
        resetTokenHash: null,
        resetTokenExpires: null,
      },
    }));
  } catch (err) {
    // Someone else registered or confirmed this address after the request.
    if (err.code === "P2002") {
      return res.status(409).json({ error: "That email address is now in use by another account." });
    }
    throw err;
  }
  if (count === 0) return res.status(400).json({ error: INVALID });

  // Tell the OLD address, so the real owner of a hijacked account finds out.
  try {
    if (user.email) await sendEmailChangedNotice(user.email, user.pendingEmail);
  } catch (err) {
    console.error("Failed to send email-change notice:", err);
    Sentry.captureException(err);
  }

  return res.status(200).json({ ok: true, email: user.pendingEmail });
}
