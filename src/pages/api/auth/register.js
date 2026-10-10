import * as Sentry from "@sentry/nextjs";
import prisma from "../../../lib/prisma";
import { hash } from "bcryptjs";
import isEmail from "validator/lib/isEmail";
import { createLimiter, getClientIp } from "../../../lib/rateLimit";
import { verifyTurnstileToken } from "../../../lib/turnstile";
import { generateVerifyToken, VERIFY_TOKEN_TTL_MS } from "../../../lib/emailVerification";
import { sendVerificationEmail } from "../../../lib/email";
import { validateUsername } from "../../../lib/slug";

const MIN_PASSWORD_LENGTH = 8;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_MAX_PER_WINDOW = 5;

const registerLimiter = createLimiter("register", {
  windowMs: REGISTER_WINDOW_MS,
  max: REGISTER_MAX_PER_WINDOW,
});

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const ip = getClientIp(req);
  const { allowed, retryAfterMs } = await registerLimiter.check(ip);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many registration attempts. Try again later." });
  }

  const { email, password, name, username, turnstileToken } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const normalizedEmail = email.trim().toLowerCase();
  if (!isEmail(normalizedEmail)) return res.status(400).json({ error: "Invalid email" });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }

  const checkedUsername = validateUsername(username);
  if (checkedUsername.error) return res.status(400).json({ error: checkedUsername.error });

  // Bot check comes after the cheap input validation above (so a typo
  // doesn't burn a single-use token) but before any database work.
  const captcha = await verifyTurnstileToken(turnstileToken, ip);
  if (!captcha.ok) {
    if (captcha.error) Sentry.captureException(captcha.error);
    return res.status(400).json({ error: "Verification failed. Please try again." });
  }

  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (exists) return res.status(409).json({ error: "User exists" });

  const usernameTaken = await prisma.user.findUnique({ where: { username: checkedUsername.username } });
  if (usernameTaken) return res.status(409).json({ error: "That username is already taken." });

  const passwordHash = await hash(password, 10);
  const { token, tokenHash } = generateVerifyToken();
  let user;
  try {
    user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      username: checkedUsername.username,
      name,
      passwordHash,
      verifyTokenHash: tokenHash,
      verifyTokenExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
    });
  } catch (err) {
    // Lost a race with another signup between the checks above and here.
    if (err.code === "P2002") {
      const target = Array.isArray(err.meta?.target) ? err.meta.target.join(",") : String(err.meta?.target || "");
      return res.status(409).json({ error: target.includes("username") ? "That username is already taken." : "User exists" });
    }
    throw err;
  }

  // Best effort: a failed email shouldn't undo a successful signup. The
  // dashboard offers a "resend" button for exactly this case.
  try {
    await sendVerificationEmail(normalizedEmail, `${process.env.NEXTAUTH_URL}/verify-email?token=${token}`);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    Sentry.captureException(err);
  }

  return res.status(201).json({ id: user.id });
}
