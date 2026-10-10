import * as Sentry from "@sentry/nextjs";
import prisma from "../../../../../lib/prisma";
import { serveRedirect } from "../../../../../lib/redirect";

// Serves /r/<username>/<alias> (see the rewrite in next.config.js).
export default async function handler(req, res) {
  const { username, alias } = req.query;
  if (typeof username !== "string" || typeof alias !== "string" || !username || !alias) {
    return res.status(404).send("Not found");
  }

  try {
    const link = await prisma.qrLink.findFirst({
      where: {
        alias: alias.toLowerCase(),
        deletedAt: null,
        user: { username: username.toLowerCase() },
      },
    });
    if (!link) return res.status(404).send("Not found");
    await serveRedirect(req, res, link);
  } catch (err) {
    console.error("Alias redirect lookup failed:", err);
    Sentry.captureException(err);
    res.status(500).send("Something went wrong");
  }
}
