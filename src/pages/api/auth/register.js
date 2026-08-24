import prisma from "../../../lib/prisma";
import { hash } from "bcryptjs";

export default async function handler(req, res) {
 if (req.method !== "POST") return res.status(405).end();

 const email = String(req.body?.email ?? "").trim().toLowerCase();
 const password = String(req.body?.password ?? "");
 const name = String(req.body?.name ?? "").trim();

 if (!email || !password) {
   return res.status(400).json({ error: "Email and password required" });
 }

 const exists = await prisma.user.findUnique({ where: { email } });
 if (exists) return res.status(409).json({ error: "User exists" });

 const passwordHash = await hash(password, 10);
 const user = await prisma.user.create({
   data: {
     email,
     name: name || null,
     passwordHash,
   },
 });

 return res.status(200).json({ id: user.id });
}