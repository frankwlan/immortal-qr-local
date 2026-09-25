import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import isURL from "validator/lib/isURL";
import { randomUUID } from "crypto";
import { rateLimit } from "../../../lib/rateLimit";

const CREATE_WINDOW_MS = 60 * 60 * 1000;
const CREATE_MAX_PER_WINDOW = 30;
const MAX_ACTIVE_LINKS_PER_USER = 50;

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const { allowed, retryAfterMs } = rateLimit(`qr-create:${session.user.id}`, {
    windowMs: CREATE_WINDOW_MS,
    max: CREATE_MAX_PER_WINDOW,
  });
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many QR codes created recently. Try again later." });
  }

  const { destination } = req.body || {};
  if (!isURL(destination || "", { protocols: ["http", "https"], require_protocol: true })) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  const activeCount = await prisma.qrLink.count({
    where: { userId: session.user.id, deletedAt: null },
  });
  if (activeCount >= MAX_ACTIVE_LINKS_PER_USER) {
    return res.status(403).json({ error: `You've reached the limit of ${MAX_ACTIVE_LINKS_PER_USER} QR codes.` });
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