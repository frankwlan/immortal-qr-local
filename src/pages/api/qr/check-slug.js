import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import { createLimiter } from "../../../lib/rateLimit";
import { validateSlug } from "../../../lib/slug";

// Availability lookups are cheap but enumerable, so keep them bounded.
const limiter = createLimiter("qr-check-slug", { windowMs: 60 * 1000, max: 30 });

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const { allowed, retryAfterMs } = await limiter.check(session.user.id);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many checks. Please wait a moment." });
  }

  const result = validateSlug(req.query.slug);
  if (result.error) return res.status(200).json({ available: false, reason: result.error });

  const existing = await prisma.qrLink.findUnique({
    where: { slug: result.slug },
    select: { id: true },
  });
  return res.status(200).json(
    existing
      ? { available: false, reason: "That address is already taken." }
      : { available: true, slug: result.slug }
  );
}
