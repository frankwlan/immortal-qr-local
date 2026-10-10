// Server-side verification of a Cloudflare Turnstile token.
//
// If TURNSTILE_SECRET_KEY isn't set, verification is skipped entirely, so
// local dev and first deploys work before Turnstile is configured. Once
// the secret IS set, this fails closed: a missing token, a rejected
// token, or an unreachable Cloudflare all mean "not verified".
export function isTurnstileEnabled() {
  return Boolean(process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(token, remoteIp) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return { ok: true };
  if (!token || typeof token !== "string") return { ok: false };

  const body = new URLSearchParams({ secret, response: token });
  if (remoteIp && remoteIp !== "unknown") body.set("remoteip", remoteIp);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      signal: controller.signal,
    });
    const data = await res.json();
    return { ok: data.success === true };
  } catch (err) {
    return { ok: false, error: err };
  } finally {
    clearTimeout(timeout);
  }
}
