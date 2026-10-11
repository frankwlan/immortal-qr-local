// Rules for user-chosen ("vanity") QR addresses, e.g. /r/summer-menu.
// Slugs are always stored lowercase so lookups are case-insensitive.

export const SLUG_MIN = 3;
export const SLUG_MAX = 40;

// Words we keep for ourselves (future routes, and ones that look official
// or invite phishing-style abuse).
const RESERVED = new Set([
  "admin", "api", "app", "about", "account", "auth", "billing", "blog",
  "contact", "dashboard", "docs", "help", "home", "login", "logout",
  "pricing", "privacy", "register", "root", "security", "settings",
  "signin", "signup", "status", "support", "terms", "verify", "www",
  "immortal", "immortalqr", "immortal-qr", "null", "undefined",
]);

// Returns { slug } on success or { error } with a user-facing message.
export function validateSlug(input) {
  if (typeof input !== "string") return { error: "Custom address must be text." };
  const slug = input.trim().toLowerCase();
  if (slug.length < SLUG_MIN || slug.length > SLUG_MAX) {
    return { error: `Custom address must be ${SLUG_MIN}–${SLUG_MAX} characters.` };
  }
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)) {
    return {
      error: "Use only letters, numbers and single hyphens (no spaces, and no hyphen at the start or end).",
    };
  }
  if (RESERVED.has(slug)) {
    return { error: "That address is reserved. Please choose another." };
  }
  return { slug };
}
