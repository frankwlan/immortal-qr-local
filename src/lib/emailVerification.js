import { randomBytes, createHash } from "crypto";

export const VERIFY_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

// Same approach as password reset: only a hash of the token is stored,
// the raw value only ever exists in the emailed link.
export function generateVerifyToken() {
  const token = randomBytes(32).toString("hex");
  return { token, tokenHash: hashVerifyToken(token) };
}

export function hashVerifyToken(token) {
  return createHash("sha256").update(token).digest("hex");
}
