import { randomBytes } from "crypto";

// Public codes (the part after /r/). New codes are 12 characters from a
// 32-letter alphabet = 60 bits of randomness, which makes guessing someone's
// "unlisted" destination impractical. Codes issued before this change are 8
// hex characters and keep working; SLUG_PATTERN accepts both.
const ALPHABET = "abcdefghijklmnopqrstuvwxyz234567"; // exactly 32 symbols
export const SLUG_LENGTH = 12;
export const SLUG_PATTERN = /^[a-z0-9]{8,32}$/;

export function generateSlug(length = SLUG_LENGTH) {
  const bytes = randomBytes(length);
  let out = "";
  // 256 is divisible by 32, so masking with 31 is unbiased.
  for (let i = 0; i < length; i++) out += ALPHABET[bytes[i] & 31];
  return out;
}

// Pulls a code out of whatever a person pasted: the bare code, a /r/ link,
// or a /preview/ link. Returns null if nothing code-shaped is at the end.
export function extractSlug(input) {
  if (typeof input !== "string") return null;
  const match = input.trim().toLowerCase().match(/(?:^|\/)([a-z0-9]{8,32})\/?(?:[?#].*)?$/);
  return match ? match[1] : null;
}
