import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import { createLimiter } from "../../../lib/rateLimit";
import { validateUsername } from "../../../lib/slug";

const limiter = createLimiter("username-claim", { windowMs: 60 * 60 * 1000, max: 10 });

// Claims a username for an account that doesn't have one yet. Deliberately
// one-way: a username appears in printed QR URLs, so changing it would
// silently break every code that user has already shared.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const { allowed, retryAfterMs } = await limiter.check(session.user.id);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many attempts. Try again later." });
  }

  const checked = validateUsername(req.body?.username);
  if (checked.error) return res.status(400).json({ error: checked.error });

  try {
    // updateMany with a null guard makes "only if still unset" atomic.
    const { count } = await prisma.user.updateMany({
      where: { id: session.user.id, username: null },
      data: { username: checked.username },
    });
    if (count === 0) {
      return res.status(409).json({ error: "Your username is already set and can't be changed." });
    }
    return res.status(200).json({ ok: true, username: checked.username });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That username is already taken." });
    throw err;
  }
}
