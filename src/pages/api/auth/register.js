import * as Sentry from "@sentry/nextjs";
import prisma from "../../../lib/prisma";
import { hash } from "bcryptjs";
import isEmail from "validator/lib/isEmail";
import { createLimiter, getClientIp } from "../../../lib/rateLimit";
import { verifyTurnstileToken } from "../../../lib/turnstile";
import { generateVerifyToken, VERIFY_TOKEN_TTL_MS } from "../../../lib/emailVerification";
import { sendVerificationEmail } from "../../../lib/email";
import { getBaseUrl } from "../../../lib/baseUrl";
import { isString, passwordProblem, MAX_NAME_LENGTH } from "../../../lib/validation";

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

  const { email, password, name, turnstileToken } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  if (!isString(email)) return res.status(400).json({ error: "Invalid email" });
  const normalizedEmail = email.trim().toLowerCase();
  if (!isEmail(normalizedEmail)) return res.status(400).json({ error: "Invalid email" });
  const passwordError = passwordProblem(password);
  if (passwordError) return res.status(400).json({ error: passwordError });

  let displayName = null;
  if (name !== undefined && name !== null && name !== "") {
    if (!isString(name)) return res.status(400).json({ error: "Invalid name" });
    displayName = name.trim().slice(0, MAX_NAME_LENGTH) || null;
  }

  // Bot check comes after the cheap input validation above (so a typo
  // doesn't burn a single-use token) but before any database work.
  const captcha = await verifyTurnstileToken(turnstileToken, ip);
  if (!captcha.ok) {
    if (captcha.error) Sentry.captureException(captcha.error);
    return res.status(400).json({ error: "Verification failed. Please try again." });
  }

  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (exists) return res.status(409).json({ error: "User exists" });

  const passwordHash = await hash(password, 10);
  const { token, tokenHash } = generateVerifyToken();
  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: displayName,
      passwordHash,
      verifyTokenHash: tokenHash,
      verifyTokenExpires: new Date(Date.now() + VERIFY_TOKEN_TTL_MS),
    },
  });

  // Best effort: a failed email shouldn't undo a successful signup. The
  // dashboard offers a "resend" button for exactly this case.
  try {
    await sendVerificationEmail(normalizedEmail, `${getBaseUrl()}/verify-email?token=${token}`);
  } catch (err) {
    console.error("Failed to send verification email:", err);
    Sentry.captureException(err);
  }

  return res.status(201).json({ id: user.id });
}
