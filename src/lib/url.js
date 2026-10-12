import isURL from "validator/lib/isURL";
import { getBaseUrl } from "./baseUrl";

const MAX_URL_LENGTH = 2048;

// Validates and canonicalizes a user-supplied destination URL.
//
// Returns { url } (canonical form) or { error }. Canonicalizing matters
// beyond tidiness: `new URL().href` punycodes international hostnames and
// percent-encodes non-ASCII paths, which is the only form Node will accept
// in a `Location` header — a raw "https://example.com/日本語" would make
// every scan of that code fail with a 500.
export function normalizeDestination(input) {
  if (typeof input !== "string") return { error: "Invalid URL" };
  const raw = input.trim();
  if (!raw || raw.length > MAX_URL_LENGTH) return { error: "Invalid URL" };
  if (!isURL(raw, { protocols: ["http", "https"], require_protocol: true })) {
    return { error: "Invalid URL" };
  }

  let parsed;
  try {
    parsed = new URL(raw);
  } catch {
    return { error: "Invalid URL" };
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return { error: "Invalid URL" };

  // "https://paypal.com@evil.com" is a classic disguise: the visible text
  // starts with a trusted name but the real host is after the "@".
  if (parsed.username || parsed.password) {
    return { error: "URLs containing a username or password aren't allowed." };
  }

  // A code that points at one of our own redirect URLs can loop forever.
  try {
    const own = new URL(getBaseUrl());
    if (parsed.host === own.host && parsed.pathname.startsWith("/r/")) {
      return { error: "A QR code can't point to another ImmortalQR link." };
    }
  } catch {
    /* base URL unparsable — skip the loop check rather than block creation */
  }

  if (parsed.href.length > MAX_URL_LENGTH) return { error: "Invalid URL" };
  return { url: parsed.href };
}

// Safety net for the redirect route: destinations saved before
// normalization existed may still contain raw non-ASCII characters.
export function toSafeLocation(stored) {
  try {
    return new URL(stored).href;
  } catch {
    return null;
  }
}
