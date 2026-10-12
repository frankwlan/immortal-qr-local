import isURL from "validator/lib/isURL";
import { getBaseUrl } from "./baseUrl";

const MAX_URL_LENGTH = 2048;

// Public link shorteners. Pointing one redirect service at another hides the
// real destination (a favorite trick for malicious links) and stacks up
// redirect hops, so we ask people to use the final URL instead.
const SHORTENER_HOSTS = new Set([
  "bit.ly", "tinyurl.com", "t.co", "goo.gl", "ow.ly", "is.gd", "buff.ly",
  "rebrand.ly", "cutt.ly", "shorturl.at", "tiny.cc", "rb.gy", "t.ly",
]);

function isIpLiteral(hostname) {
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) || hostname.startsWith("[");
}

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

  const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
  // Raw IP addresses are almost never a legitimate public destination, and
  // are a staple of phishing and malware links.
  if (isIpLiteral(parsed.hostname)) {
    return { error: "Please use a website address (like example.com) rather than an IP address." };
  }
  if (/\.(local|localhost|internal|lan)$/.test(host)) return { error: "Invalid URL" };
  if (SHORTENER_HOSTS.has(host)) {
    return { error: "Please use the final destination URL rather than another link shortener." };
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
