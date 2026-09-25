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
