import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import isURL from "validator/lib/isURL";
import { randomUUID } from "crypto";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const { destination } = req.body || {};
  if (!isURL(destination || "", { protocols: ["http", "https"], require_protocol: true })) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const MAX_ATTEMPTS = 5;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    // Basic slug generation using UUID (can switch to nanoid)
    const slug = randomUUID().slice(0, 8);
    try {
      const record = await prisma.qrLink.create({
        data: {
          userId: session.user.id,
          destination,
          slug,
        },
        select: { id: true, slug: true, destination: true }
      });
      return res.status(200).json(record);
    } catch (err) {
      // P2002 = unique constraint violation (slug collision) — retry with a new slug
      if (err.code === "P2002" && attempt < MAX_ATTEMPTS - 1) continue;
      throw err;
    }
  }
}