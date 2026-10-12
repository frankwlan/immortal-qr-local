import * as Sentry from "@sentry/nextjs";
import isEmail from "validator/lib/isEmail";
import prisma from "../../lib/prisma";
import { createLimiter, getClientIp } from "../../lib/rateLimit";
import { verifyTurnstileToken } from "../../lib/turnstile";
import { extractSlug } from "../../lib/slug";
import { requireSameOrigin } from "../../lib/sameOrigin";
import { sendAbuseReportNotice } from "../../lib/email";

export const REPORT_REASONS = ["phishing", "malware", "spam", "illegal", "other"];
const MAX_DETAILS = 1000;

// Public form, so it's both rate-limited and (once Turnstile is configured)
// protected against bots.
const reportLimiter = createLimiter("abuse-report", { windowMs: 60 * 60 * 1000, max: 5 });

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();
  if (!requireSameOrigin(req, res)) return;

  const ip = getClientIp(req);
  const { allowed, retryAfterMs } = await reportLimiter.check(ip);
  if (!allowed) {
    res.setHeader("Retry-After", Math.ceil(retryAfterMs / 1000));
    return res.status(429).json({ error: "Too many reports from your network. Please try again later." });
  }

  const { code, reason, details, email, turnstileToken } = req.body || {};
  if (typeof code !== "string" || !code.trim() || code.length > 300) {
    return res.status(400).json({ error: "Enter the link or code you're reporting." });
  }
  if (typeof reason !== "string" || !REPORT_REASONS.includes(reason)) {
    return res.status(400).json({ error: "Choose a reason." });
  }
  let cleanDetails = null;
  if (details !== undefined && details !== null && details !== "") {
    if (typeof details !== "string" || details.length > MAX_DETAILS) {
      return res.status(400).json({ error: `Details must be ${MAX_DETAILS} characters or fewer.` });
    }
    cleanDetails = details.trim() || null;
  }
  let reporterEmail = null;
  if (email !== undefined && email !== null && email !== "") {
    if (typeof email !== "string" || !isEmail(email.trim())) {
      return res.status(400).json({ error: "That email address doesn't look right." });
    }
    reporterEmail = email.trim().toLowerCase();
  }

  const captcha = await verifyTurnstileToken(turnstileToken, ip);
  if (!captcha.ok) {
    if (captcha.error) Sentry.captureException(captcha.error);
    return res.status(400).json({ error: "Verification failed. Please try again." });
  }

  // Keep the report even if the code doesn't match a link: it's still a
  // signal, and rejecting it would just teach reporters to give up.
  const slug = extractSlug(code);
  const link = slug ? await prisma.qrLink.findUnique({ where: { slug }, select: { id: true } }) : null;

  const report = await prisma.abuseReport.create({
    data: {
      qrLinkId: link ? link.id : null,
      code: code.trim().slice(0, 300),
      reason,
      details: cleanDetails,
      reporterEmail,
    },
  });

  // Best effort: the report is already saved, so a failed email must not
  // turn into an error for the person reporting.
  const notifyTo = process.env.ABUSE_REPORT_EMAIL;
  if (notifyTo) {
    try {
      await sendAbuseReportNotice(notifyTo, { ...report, matchedLink: Boolean(link) });
    } catch (err) {
      console.error("Failed to send abuse report notice:", err);
      Sentry.captureException(err);
    }
  }

  return res.status(200).json({ ok: true });
}
