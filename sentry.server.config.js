import * as Sentry from "@sentry/nextjs";

// DSN isn't a secret (it's meant to be public, same as an analytics key),
// so one value covers both client and server unless SENTRY_DSN is set to
// something different. No-ops entirely if neither is configured, so local
// dev and builds work fine before Sentry is set up.
const dsn = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });
}
