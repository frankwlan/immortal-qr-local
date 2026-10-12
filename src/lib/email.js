import { Resend } from "resend";

// If RESEND_API_KEY isn't set (e.g. local dev without email configured),
// fall back to logging the email to the console instead of throwing. That
// keeps `npm run dev` usable out of the box while still working correctly
// in production once the env var is set.
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const FROM = process.env.EMAIL_FROM || "onboarding@resend.dev";

export async function sendPasswordResetEmail(to, resetUrl) {
  if (!resend) {
    console.log(`[email:dev] Password reset link for ${to}: ${resetUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Reset your ImmortalQR password",
    html: `
      <p>Someone requested a password reset for this email address.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>
    `,
  });
}

export async function sendEmailChangedNotice(to, newEmail) {
  if (!resend) {
    console.log(`[email:dev] Email-change notice to ${to}: account email changed to ${newEmail}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Your ImmortalQR email address was changed",
    html: `
      <p>The email address on your ImmortalQR account was just changed to <strong>${escapeHtml(newEmail)}</strong>.</p>
      <p>If this was you, no action is needed. If it wasn't, reset your password right away using the "Forgot password?" link on the sign-in page.</p>
    `,
  });
}

export async function sendAbuseReportNotice(to, report) {
  if (!resend) {
    console.log(`[email:dev] Abuse report (${report.reason}) for ${report.code}: ${report.details || "no details"}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: `Abuse report: ${report.reason}`,
    html: `
      <p><strong>Reason:</strong> ${escapeHtml(report.reason)}</p>
      <p><strong>Reported:</strong> ${escapeHtml(report.code)} ${report.matchedLink ? "(matches a link)" : "(no matching link)"}</p>
      <p><strong>Details:</strong> ${escapeHtml(report.details || "—")}</p>
      <p><strong>Reporter:</strong> ${escapeHtml(report.reporterEmail || "anonymous")}</p>
      <p>Report id: ${escapeHtml(report.id)}</p>
    `,
  });
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

export async function sendVerificationEmail(to, verifyUrl) {
  if (!resend) {
    console.log(`[email:dev] Email verification link for ${to}: ${verifyUrl}`);
    return;
  }

  await resend.emails.send({
    from: FROM,
    to,
    subject: "Verify your ImmortalQR email",
    html: `
      <p>Welcome to ImmortalQR. Please confirm this is your email address.</p>
      <p><a href="${verifyUrl}">Verify my email</a></p>
      <p>This link expires in 24 hours. If you didn't create an account, you can ignore this email.</p>
    `,
  });
}
