// Simple fixed-window rate limiter.
//
// NOTE: this is in-memory, so it's per server process. On a single
// long-running server this works fine. On serverless platforms
// (Vercel, etc.) each instance has its own memory, so a determined
// attacker spread across instances can exceed these limits. That's
// an acceptable tradeoff to ship something working now; if abuse
// becomes a real problem, swap this for a shared store like
// Upstash Redis (@upstash/ratelimit) — the call sites below don't
// need to change, just this file's internals.

const buckets = new Map();

// Periodically clear old buckets so this doesn't grow forever.
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupIfNeeded(now) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > CLEANUP_INTERVAL_MS) buckets.delete(key);
  }
}

/**
 * @param {string} key - unique identifier for the caller (IP, user id, etc.)
 * @param {{ windowMs: number, max: number }} opts
 * @returns {{ allowed: boolean, retryAfterMs?: number }}
 */
export function rateLimit(key, { windowMs, max }) {
  const now = Date.now();
  cleanupIfNeeded(now);

  const bucket = buckets.get(key);
  if (!bucket || now - bucket.start > windowMs) {
    buckets.set(key, { start: now, count: 1 });
    return { allowed: true };
  }
  if (bucket.count >= max) {
    return { allowed: false, retryAfterMs: windowMs - (now - bucket.start) };
  }
  bucket.count += 1;
  return { allowed: true };
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}
