import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import * as Sentry from "@sentry/nextjs";

// Shared rate limiting via Upstash Redis when configured — this is what
// actually works across Vercel's serverless instances, unlike the old
// in-memory version (which only limited requests within one process).
// Falls back to in-memory automatically when Upstash isn't configured, so
// local dev keeps working without an Upstash account.
const redis =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
        // Fail fast. The client's default is several retries with growing
        // delays, which would stall every request for seconds during an
        // outage; a limiter that can't answer within a moment is skipped
        // instead (see failOpen below).
        retry: false,
        signal: () => AbortSignal.timeout(1500),
      })
    : null;

// --- In-memory fallback (per-process; see note above) ---
const buckets = new Map();
const CLEANUP_INTERVAL_MS = 10 * 60 * 1000;
let lastCleanup = Date.now();

function cleanupIfNeeded(now) {
  if (now - lastCleanup < CLEANUP_INTERVAL_MS) return;
  lastCleanup = now;
  for (const [key, bucket] of buckets) {
    if (now - bucket.start > CLEANUP_INTERVAL_MS) buckets.delete(key);
  }
}

function memoryCheck(key, windowMs, max) {
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

function memoryPeek(key, windowMs, max) {
  const bucket = buckets.get(key);
  const now = Date.now();
  if (!bucket || now - bucket.start > windowMs || bucket.count < max) return { allowed: true };
  return { allowed: false, retryAfterMs: windowMs - (now - bucket.start) };
}

/**
 * Creates a named limiter. Call .check(key) to test-and-consume one
 * request against it. Create one per call site, at module scope (not
 * inside the handler), and reuse it across requests.
 *
 * @param {string} name - unique name for this limiter (used as a Redis
 *   key prefix and to namespace the in-memory fallback)
 * @param {{ windowMs: number, max: number }} opts
 */
export function createLimiter(name, { windowMs, max }) {
  const upstash = redis
    ? new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(max, `${Math.max(1, Math.round(windowMs / 1000))} s`),
        prefix: `ratelimit:${name}`,
        analytics: false,
      })
    : null;

  // If Upstash itself is down, limits are skipped (with an error report)
  // rather than throwing: a Redis outage must not take down sign-in or,
  // above all, the public QR redirects.
  function failOpen(err) {
    console.error(`Rate limiter "${name}" unavailable; allowing request:`, err);
    Sentry.captureException(err, { level: "warning" });
    return { allowed: true };
  }

  return {
    // Counts this request against the limit and reports whether it's allowed.
    async check(key) {
      if (upstash) {
        try {
          const { success, reset } = await upstash.limit(key);
          return success ? { allowed: true } : { allowed: false, retryAfterMs: Math.max(0, reset - Date.now()) };
        } catch (err) {
          return failOpen(err);
        }
      }
      return memoryCheck(`${name}:${key}`, windowMs, max);
    },
    // Reports whether the limit is already used up WITHOUT counting this
    // request — for limits that should only count certain outcomes (e.g.
    // failed lookups), where the count is added later with check().
    async peek(key) {
      if (upstash) {
        try {
          const { remaining, reset } = await upstash.getRemaining(key);
          return remaining > 0 ? { allowed: true } : { allowed: false, retryAfterMs: Math.max(0, reset - Date.now()) };
        } catch (err) {
          return failOpen(err);
        }
      }
      return memoryPeek(`${name}:${key}`, windowMs, max);
    },
  };
}

export function getClientIp(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (typeof forwarded === "string" && forwarded.length > 0) {
    return forwarded.split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}
