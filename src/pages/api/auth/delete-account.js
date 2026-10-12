import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { compare } from "bcryptjs";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import { createLimiter } from "../../../lib/rateLimit";
import { requireSameOrigin } from "../../../lib/sameOrigin";
import { isString } from "../../../lib/validation";
import { eraseUser } from "../../../lib/eraseUser";
import { sendAccountDeletedNotice, sendAccountErasedNotice } from "../../../lib/email";

// Every attempt checks the password, so cap how often it can be tried.
const deleteLimiter = createLimiter("account-delete", { windowMs: 60 * 60 * 1000, max: 5 });

// Deletes the signed-in user's account. Two modes, both requiring the
// current password:
//
// - default: deactivate. The user gets deletedAt, their QR codes are
//   soft-deleted with the SAME timestamp (so printed codes stop redirecting
//   at once and a restore can find exactly these), and sessionVersion is
//   bumped to log out every device. Nothing is erased: signing in again
//   within RESTORE_WINDOW_DAYS undoes it, after which the daily purge job
//   erases it. A stolen password can therefore only deactivate an account.
// - erase: the user asked for immediate, permanent erasure. Everything goes
//   now, in one transaction, and cannot be undone.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireSameOrigin(req, res)) return;
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();
  const userId = session.user.id;

  const { allowed, retryAfterMs } = await deleteLimiter.check(userId);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }

  const { currentPassword, confirm, erase } = req.body || {};
  const eraseNow = erase === true;
  // The UI also asks for this; enforcing it here means a stray or scripted
  // request can't delete an account by accident. Permanent erasure needs a
  // different word so it can't be confused with the reversible option.
  const word = eraseNow ? "ERASE" : "DELETE";
  if (confirm !== word) {
    return res.status(400).json({ error: `Type ${word} to confirm.` });
  }
  if (!isString(currentPassword) || !currentPassword) {
    return res.status(400).json({ error: "Enter your current password to delete your account." });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true, passwordHash: true, deletedAt: true },
  });
  if (!user || user.deletedAt) return res.status(404).json({ error: "Account not found." });

  const passwordOk = user.passwordHash ? await compare(currentPassword, user.passwordHash) : false;
  if (!passwordOk) return res.status(403).json({ error: "Current password is incorrect." });

  if (eraseNow) {
    await eraseUser(userId);
  } else {
    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: userId },
        data: { deletedAt: now, sessionVersion: { increment: 1 } },
      }),
      prisma.qrLink.updateMany({
        where: { userId, deletedAt: null },
        data: { deletedAt: now },
      }),
    ]);
  }

  // Best effort: the change is already made, so a failed email must not turn
  // into an error. The session fails the jwt callback's database check (user
  // gone, or sessionVersion bumped) and is cleared on the next request.
  try {
    await (eraseNow ? sendAccountErasedNotice(user.email) : sendAccountDeletedNotice(user.email));
  } catch (err) {
    console.error("Failed to send account deletion notice:", err);
    Sentry.captureException(err);
  }

  return res.status(200).json({ ok: true });
}
