// Very small user-agent classifier for the scan history. It only needs to
// answer "what kind of device, roughly" and "is this a robot": no version
// numbers, no fingerprinting.

// Used both in JS (RegExp, case-insensitive) and in SQL (Postgres `~*`), so
// it sticks to plain alternation that means the same in both engines.
// Matches crawlers and the link-preview fetchers chat apps run when someone
// pastes a short link, none of which is a person scanning a code.
export const BOT_PATTERN =
  "bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora link|whatsapp|telegram|slack|discord|skype|curl/|wget|python-requests|go-http-client|okhttp|headless|monitor|uptime|scanner";

const BOT_RE = new RegExp(BOT_PATTERN, "i");

export function isBotUserAgent(ua) {
  return typeof ua === "string" && BOT_RE.test(ua);
}

function detectOs(ua) {
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/android/i.test(ua)) return "Android";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os x|macintosh/i.test(ua)) return "macOS";
  if (/cros/i.test(ua)) return "ChromeOS";
  if (/linux|x11/i.test(ua)) return "Linux";
  return "Other";
}

// kind: "bot" | "mobile" | "tablet" | "desktop" | "unknown"
export function classifyUserAgent(ua) {
  if (typeof ua !== "string" || !ua.trim()) return { kind: "unknown", os: "Unknown" };
  if (isBotUserAgent(ua)) return { kind: "bot", os: detectOs(ua) };
  const os = detectOs(ua);
  if (/ipad|tablet/i.test(ua) || (/android/i.test(ua) && !/mobile/i.test(ua))) return { kind: "tablet", os };
  if (/mobi|iphone|ipod|android/i.test(ua)) return { kind: "mobile", os };
  return { kind: "desktop", os };
}
