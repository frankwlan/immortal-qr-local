import { timingSafeEqual } from "node:crypto";
import * as Sentry from "@sentry/nextjs";
import prisma from "../../../lib/prisma";
import { eraseUser } from "../../../lib/eraseUser";
import { purgeCutoff } from "../../../lib/retention";

// Runs daily (see vercel.json). Permanently erases accounts that were
// deleted more than RESTORE_WINDOW_DAYS ago. Vercel Cron calls this with
// "Authorization: Bearer $CRON_SECRET"; anything else is refused, and with
// no CRON_SECRET configured the endpoint refuses everyone (fails closed).
const BATCH = 100;

function authorized(req) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const given = Buffer.from(String(req.headers.authorization || ""));
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).end();
  if (!authorized(req)) return res.status(401).end();

  const due = await prisma.user.findMany({
    where: { deletedAt: { lt: purgeCutoff() } },
    select: { id: true },
    take: BATCH,
  });

  let erased = 0;
  let failed = 0;
  // One account at a time, each in its own transaction, so one bad row
  // can't block the rest; it is retried on the next run.
  for (const { id } of due) {
    try {
      await eraseUser(id);
      erased++;
    } catch (err) {
      failed++;
      console.error("Failed to purge deleted account:", id, err);
      Sentry.captureException(err);
    }
  }
  return res.status(200).json({ erased, failed });
}
