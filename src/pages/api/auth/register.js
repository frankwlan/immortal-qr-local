import prisma from "../../../lib/prisma";
import { hash } from "bcryptjs";
import isEmail from "validator/lib/isEmail";

const MIN_PASSWORD_LENGTH = 8;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
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