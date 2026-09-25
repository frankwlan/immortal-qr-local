import { randomBytes, createHash } from "crypto";

export const RESET_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour

// We store only a hash of the token, never the raw value — same principle
// as passwords. The raw token goes out in the email link; if the database
// ever leaks, a stolen resetTokenHash can't be used to reset anyone's
// password (you'd need the pre-image, which nobody has).
export function generateResetToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashResetToken(token) };
}

export function hashResetToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
