import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import { hash } from "bcryptjs";
import isEmail from "validator/lib/isEmail";

const MIN_PASSWORD_LENGTH = 8;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const { email, password } = req.body || {};
  const data = {};

  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isEmail(normalizedEmail)) return res.status(400).json({ error: "Invalid email" });
    data.email = normalizedEmail;
  }
  if (password) {
    if (password.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    data.passwordHash = await hash(password, 10);
  }
  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: "Nothing to update" });
  }

  try {
    await prisma.user.update({ where: { id: session.user.id }, data });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Email already in use" });
    throw err;
  }
  res.status(200).json({ ok: true });
}