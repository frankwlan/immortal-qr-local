import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import { hash } from "bcryptjs";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();
  const { email, password } = req.body || {};
  const data = {};
  if (email) data.email = email;
  if (password) data.passwordHash = await hash(password, 10);
  await prisma.user.update({ where: { id: session.user.id }, data });
  res.status(200).json({ ok: true });
}