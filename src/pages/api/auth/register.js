import prisma from "../../../lib/prisma";
import { hash } from "bcryptjs";
import isEmail from "validator/lib/isEmail";
import { rateLimit, getClientIp } from "../../../lib/rateLimit";

const MIN_PASSWORD_LENGTH = 8;
const REGISTER_WINDOW_MS = 15 * 60 * 1000;
const REGISTER_MAX_PER_WINDOW = 5;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { allowed, retryAfterMs } = rateLimit(`register:${getClientIp(req)}`, {
    windowMs: REGISTER_WINDOW_MS,
    max: REGISTER_MAX_PER_WINDOW,
  });
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many registration attempts. Try again later." });
  }

  const { email, password, name } = req.body || {};
  if (!email || !password) return res.status(400).json({ error: "Email and password required" });
  const normalizedEmail = email.trim().toLowerCase();
  if (!isEmail(normalizedEmail)) return res.status(400).json({ error: "Invalid email" });
  if (password.length < MIN_PASSWORD_LENGTH) {
    return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
  }
  const exists = await prisma.user.findUnique({ where: { email: normalizedEmail } });
  if (exists) return res.status(409).json({ error: "User exists" });
  const passwordHash = await hash(password, 10);
  const user = await prisma.user.create({ data: { email: normalizedEmail, name, passwordHash } });
  return res.status(201).json({ id: user.id });
}