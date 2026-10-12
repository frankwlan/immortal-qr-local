import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import { hash, compare } from "bcryptjs";
import isEmail from "validator/lib/isEmail";
import { generateVerifyToken, VERIFY_TOKEN_TTL_MS } from "../../../lib/emailVerification";
import { sendVerificationEmail, sendEmailChangedNotice } from "../../../lib/email";
import { createLimiter } from "../../../lib/rateLimit";
import { getBaseUrl } from "../../../lib/baseUrl";
import { requireSameOrigin } from "../../../lib/sameOrigin";
import { isString, passwordProblem, MAX_NAME_LENGTH } from "../../../lib/validation";

// Every attempt to change email/password verifies the current password, so
// cap how often that check can be tried.
const sensitiveChangeLimiter = createLimiter("profile-sensitive", { windowMs: 60 * 60 * 1000, max: 10 });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireSameOrigin(req, res)) return;
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const { name, email, password, currentPassword } = req.body || {};
  const data = {};

  if (name !== undefined) {
    if (!isString(name)) return res.status(400).json({ error: "Invalid name" });
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return res.status(400).json({ error: "Name cannot be empty" });
    if (trimmedName.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` });
    }
    data.name = trimmedName;
  }

  const current = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { email: true, passwordHash: true },
  });
  if (!current) return res.status(404).end();

  let newEmail = null;
  if (email !== undefined && email !== null && email !== "") {
    if (!isString(email)) return res.status(400).json({ error: "Invalid email" });
    const normalizedEmail = email.trim().toLowerCase();
    if (!isEmail(normalizedEmail)) return res.status(400).json({ error: "Invalid email" });
    // The settings form resends the current email on every save, so only
    // treat this as a change when the address actually differs.
    if (normalizedEmail !== current.email) newEmail = normalizedEmail;
  }

  let newPassword = null;
  if (password !== undefined && password !== null && password !== "") {
    const problem = passwordProblem(password);
    if (problem) return res.status(400).json({ error: problem });
    newPassword = password;
  }

  // Changing how someone signs in or recovers their account needs more than
  // a live session: a stolen cookie alone must not be enough to take over.
  if (newEmail || newPassword) {
    const { allowed, retryAfterMs } = await sensitiveChangeLimiter.check(session.user.id);
    if (!allowed) {
      res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
      return res.status(429).json({ error: "Too many attempts. Try again later." });
    }
    if (!isString(currentPassword) || !currentPassword) {
      return res.status(400).json({ error: "Enter your current password to change your email or password." });
    }
    const ok = current.passwordHash ? await compare(currentPassword, current.passwordHash) : false;
    if (!ok) return res.status(403).json({ error: "Current password is incorrect." });
  }

  let pendingVerifyToken = null;
  if (newEmail) {
    const { token, tokenHash } = generateVerifyToken();
    data.email = newEmail;
    // A changed address is unverified until its owner clicks a fresh link.
    data.emailVerified = null;
    data.verifyTokenHash = tokenHash;
    data.verifyTokenExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
    pendingVerifyToken = token;
  }
  if (newPassword) {
    data.passwordHash = await hash(newPassword, 10);
    // Signs out every other session (see the jwt callback in
    // lib/authOptions.js) — including this one, which is why the client
    // sends the user back to the login page after a password change.
    data.sessionVersion = { increment: 1 };
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  try {
    const user = await prisma.user.update({ where: { id: session.user.id }, data, select: { name: true, email: true } });

    if (newEmail) {
      // Tell the OLD address, so a hijacked account's real owner finds out.
      try {
        await sendEmailChangedNotice(current.email, newEmail);
      } catch (err) {
        console.error("Failed to send email-change notice:", err);
        Sentry.captureException(err);
      }
      try {
        await sendVerificationEmail(newEmail, `${getBaseUrl()}/verify-email?token=${pendingVerifyToken}`);
      } catch (err) {
        console.error("Failed to send verification email:", err);
        Sentry.captureException(err);
      }
    }

    res.status(200).json({ ok: true, name: user.name, email: user.email, reauth: Boolean(newPassword) });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Email already in use" });
    throw err;
  }
}
