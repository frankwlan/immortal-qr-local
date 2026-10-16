import * as Sentry from "@sentry/nextjs";

// Next.js calls register() once when the server starts. This is what turns
// server-side Sentry on: the SDK no longer loads sentry.server.config.js by
// itself, so without this file errors on the server (API routes, redirects,
// getServerSideProps) were never reported.
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("../sentry.server.config");
  }
}

// Reports errors that escape request handlers.
export const onRequestError = Sentry.captureRequestError;
