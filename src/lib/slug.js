// Validation for usernames and per-user custom addresses ("aliases").
// Both are stored lowercase so lookups are case-insensitive.

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 30;
export const ALIAS_MIN = 3;
export const ALIAS_MAX = 40;

// Lowercase letters/digits, optionally separated by single hyphens.
const PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const PATTERN_MESSAGE =
  "Use only letters, numbers and single hyphens (no spaces, and no hyphen at the start or end).";

// Handles that look official or invite impersonation. Usernames appear in
// every link we serve, so keep the company's own names to ourselves.
const RESERVED_USERNAMES = new Set([
  "admin", "administrator", "api", "app", "auth", "billing", "contact",
  "dashboard", "help", "home", "info", "legal", "login", "logout", "mail",
  "moderator", "official", "owner", "postmaster", "privacy", "register",
  "root", "sales", "security", "settings", "signin", "signup", "staff",
  "status", "support", "system", "team", "terms", "verify", "webmaster",
  "www", "immortal", "immortalqr", "immortal-qr", "null", "undefined",
]);

// Aliases already live under the owner's username, so only a few words
// need blocking (they would be confusing next to our own routes).
const RESERVED_ALIASES = new Set(["api", "login", "admin", "null", "undefined"]);

function check(input, { min, max, label, reserved }) {
  if (typeof input !== "string") return { error: `${label} must be text.` };
  const value = input.trim().toLowerCase();
  if (value.length < min || value.length > max) {
    return { error: `${label} must be ${min}–${max} characters.` };
  }
  if (!PATTERN.test(value)) return { error: PATTERN_MESSAGE };
  if (reserved.has(value)) return { error: `That ${label.toLowerCase()} is reserved. Please choose another.` };
  return { value };
}

// Returns { username } on success or { error } with a user-facing message.
export function validateUsername(input) {
  const r = check(input, { min: USERNAME_MIN, max: USERNAME_MAX, label: "Username", reserved: RESERVED_USERNAMES });
  return r.error ? r : { username: r.value };
}

// Returns { alias } on success or { error } with a user-facing message.
export function validateAlias(input) {
  const r = check(input, { min: ALIAS_MIN, max: ALIAS_MAX, label: "Custom address", reserved: RESERVED_ALIASES });
  return r.error ? r : { alias: r.value };
}
