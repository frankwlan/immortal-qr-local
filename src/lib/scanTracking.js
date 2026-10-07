import { createHash } from "crypto";
import prisma from "./prisma";

export function hashIp(ip) {
  if (!ip || ip === "unknown") return null;
  return createHash("sha256").update(ip).digest("hex");
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
  }
}
