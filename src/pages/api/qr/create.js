import { getServerSession } from "next-auth";
import { authOptions } from "../../../lib/authOptions";
import prisma from "../../../lib/prisma";
import isURL from "validator/lib/isURL";
import { randomUUID } from "crypto";
import { createLimiter } from "../../../lib/rateLimit";
import { validateAlias } from "../../../lib/slug";

const CREATE_WINDOW_MS = 60 * 60 * 1000;
const CREATE_MAX_PER_WINDOW = 30;
const MAX_ACTIVE_LINKS_PER_USER = 50;

const createLinkLimiter = createLimiter("qr-create", {
  windowMs: CREATE_WINDOW_MS,
  max: CREATE_MAX_PER_WINDOW,
});

function conflictsOnAlias(err) {
  const target = err?.meta?.target;
  const fields = Array.isArray(target) ? target.join(",") : String(target || "");
  return fields.includes("alias");
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  const session = await getServerSession(req, res, authOptions);
  if (!session?.user?.id) return res.status(401).end();

  const { allowed, retryAfterMs } = await createLinkLimiter.check(session.user.id);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many QR codes created recently. Try again later." });
  }

  const { destination, alias: requestedAlias } = req.body || {};
  if (!isURL(destination || "", { protocols: ["http", "https"], require_protocol: true })) {
    return res.status(400).json({ error: "Invalid URL" });
  }

  // Optional custom address, served at /r/<username>/<alias>. Blank or
  // missing means "generate a random one for me".
  let alias = null;
  if (typeof requestedAlias === "string" && requestedAlias.trim() !== "") {
    const checked = validateAlias(requestedAlias);
    if (checked.error) return res.status(400).json({ error: checked.error });
    alias = checked.alias;

    // Read from the database, not the session: the JWT can lag behind a
    // username that was just chosen.
    const owner = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { username: true },
    });
    if (!owner?.username) {
      return res.status(400).json({ error: "Choose a username in Settings before using a custom address." });
    }
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
          alias,
        },
        select: { id: true, slug: true, alias: true, destination: true },
      });
      return res.status(200).json(record);
    } catch (err) {
      if (err.code === "P2002") {
        // A taken alias will never succeed on retry; tell the user.
        if (alias && conflictsOnAlias(err)) {
          return res.status(409).json({ error: "You already use that custom address." });
        }
        // Otherwise it was a random-slug collision — retry with a new one.
        if (attempt < MAX_ATTEMPTS - 1) continue;
      }
      throw err;
    }
  }
}
