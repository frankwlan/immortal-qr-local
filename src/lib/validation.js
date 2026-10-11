// Small shared input checks. API handlers receive untyped JSON, so a field
// that should be a string can arrive as an object or array; validator and
// bcrypt both throw on those, which would surface as noisy 500s.

export const MIN_PASSWORD_LENGTH = 8;
// bcrypt only uses the first 72 bytes of a password; capping the length also
// keeps hashing cost bounded for unauthenticated endpoints.
export const MAX_PASSWORD_LENGTH = 72;
export const MAX_NAME_LENGTH = 50;

export function isString(value) {
  return typeof value === "string";
}

// Returns an error message, or null when the password is acceptable.
export function passwordProblem(password) {
  if (!isString(password)) return "Invalid password";
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters`;
  }
  if (password.length > MAX_PASSWORD_LENGTH) {
    return `Password must be ${MAX_PASSWORD_LENGTH} characters or fewer`;
  }
  return null;
}
