import * as Sentry from "@sentry/nextjs";
import prisma from "../../../../lib/prisma";
import { serveRedirect } from "../../../../lib/redirect";

export default async function handler(req, res) {
  const rawSlug = req.query.slug;
  if (typeof rawSlug !== "string" || rawSlug.length === 0) {
    return res.status(404).send("Not found");
  }
  // Slugs are stored lowercase; accept any casing in the printed URL.
  const slug = rawSlug.toLowerCase();

  try {
    const link = await prisma.qrLink.findUnique({ where: { slug } });
    if (!link || link.deletedAt) {
      return res.status(404).send("Not found");
    }
    await serveRedirect(req, res, link);
  } catch (err) {
    console.error("Redirect lookup failed:", err);
    Sentry.captureException(err);
    res.status(500).send("Something went wrong");
  }
}
