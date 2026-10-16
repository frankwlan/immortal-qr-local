import * as Sentry from "@sentry/nextjs";

// Runs in the browser before the app starts. (This file replaces
// sentry.client.config.js, which only worked with webpack builds; Next.js 16
// builds with Turbopack by default and loads instrumentation-client.js.)
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: process.env.NODE_ENV === "development" ? 1.0 : 0.1,
  });
}
