import { createHmac } from "crypto";
import * as Sentry from "@sentry/nextjs";
import prisma from "./prisma";

// Keyed (HMAC) rather than a plain hash: the IPv4 address space is small
// enough that unsalted hashes can be reversed by trying every address, but
// that doesn't work without the server-side secret.
export function hashIp(ip) {
  if (!ip || ip === "unknown") return null;
  return createHmac("sha256", process.env.NEXTAUTH_SECRET || "").update(ip).digest("hex");
}

// Logs a scan without throwing — a failed analytics write should never
// break the actual redirect, which is the thing the user is waiting on.
export async function logScan(qrLinkId, { ip, userAgent } = {}) {
  try {
    await prisma.scanEvent.create({
      data: {
        qrLinkId,
        ipHash: hashIp(ip),
        userAgent: userAgent ? userAgent.slice(0, 500) : null,
      },
    });
  } catch (err) {
    console.error("Failed to log scan event:", err);
    // Lower severity — a dropped analytics write is annoying, not an
    // outage, and shouldn't page anyone the way a real error would.
    Sentry.captureException(err, { level: "warning" });
  }
}
