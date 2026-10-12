import { createLimiter } from "./rateLimit";

// Limits on the PUBLIC side of QR links. Scanners aren't logged in, so these
// are keyed by IP. Real scanning traffic is bursty (a poster at an event,
// many phones behind one venue Wi-Fi address), hence the generous ceilings.

// Every redirect/preview lookup from one IP. Mostly protects the database
// from being hammered, since each request costs a query.
export const redirectIpLimiter = createLimiter("redirect-ip", { windowMs: 60 * 1000, max: 300 });

// Only lookups that FIND NOTHING count here (see the redirect route). A real
// person almost never hits a missing code, but someone guessing codes does it
// constantly — so this blocks enumeration without touching normal scans.
export const redirectMissLimiter = createLimiter("redirect-miss", { windowMs: 10 * 60 * 1000, max: 20 });

// Scan-event writes per link per IP. The redirect itself still happens when
// this is exceeded; we just stop adding rows, so a script refreshing one link
// can't fill the database with analytics events.
export const scanLogLimiter = createLimiter("scan-log", { windowMs: 60 * 1000, max: 10 });
