import * as Sentry from "@sentry/nextjs";
import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import { hash } from "bcryptjs";
import isEmail from "validator/lib/isEmail";
import { generateVerifyToken, VERIFY_TOKEN_TTL_MS } from "../../../lib/emailVerification";
import { sendVerificationEmail } from "../../../lib/email";

const MIN_PASSWORD_LENGTH = 8;
const MAX_NAME_LENGTH = 50;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const { name, email, password } = req.body || {};
  const data = {};

  if (name !== undefined) {
    const trimmedName = name.trim();
    if (trimmedName.length === 0) return res.status(400).json({ error: "Name cannot be empty" });
    if (trimmedName.length > MAX_NAME_LENGTH) {
      return res.status(400).json({ error: `Name must be ${MAX_NAME_LENGTH} characters or fewer` });
    }
    data.name = trimmedName;
  }
  let pendingVerifyToken = null;
  let pendingVerifyEmail = null;
  if (email) {
    const normalizedEmail = email.trim().toLowerCase();
    if (!isEmail(normalizedEmail)) return res.status(400).json({ error: "Invalid email" });

    // The settings form resends the current email on every save, so only
    // treat this as a change when the address actually differs. A changed
    // address is unverified until its owner clicks a fresh link.
    const current = await prisma.user.findUnique({ where: { id: session.user.id }, select: { email: true } });
    if (current && current.email !== normalizedEmail) {
      const { token, tokenHash } = generateVerifyToken();
      data.email = normalizedEmail;
      data.emailVerified = null;
      data.verifyTokenHash = tokenHash;
      data.verifyTokenExpires = new Date(Date.now() + VERIFY_TOKEN_TTL_MS);
      pendingVerifyToken = token;
      pendingVerifyEmail = normalizedEmail;
    }
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
    const user = await prisma.user.update({ where: { id: session.user.id }, data, select: { name: true, email: true } });

    if (pendingVerifyToken) {
      try {
        await sendVerificationEmail(pendingVerifyEmail, `${process.env.NEXTAUTH_URL}/verify-email?token=${pendingVerifyToken}`);
      } catch (err) {
        console.error("Failed to send verification email:", err);
        Sentry.captureException(err);
      }
    }

    res.status(200).json({ ok: true, name: user.name, email: user.email });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "Email already in use" });
    throw err;
  }
}