import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import TurnstileWidget from "../components/TurnstileWidget";

const TURNSTILE_ENABLED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

// NextAuth redirects back to /login?error=<code> when sign-in fails; without
// this a wrong password just reloads the page with no explanation.
const ERROR_MESSAGES = {
  CredentialsSignin: "Incorrect email or password.",
  RateLimited: "Too many sign-in attempts. Please wait a few minutes and try again.",
  SessionRequired: "Please sign in to continue.",
};

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [submitting, setSubmitting] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  useEffect(() => {
    if (router.query.mode === "register") setMode("register");
  }, [router.query.mode]);

  const errorCode = typeof router.query.error === "string" ? router.query.error : "";
  const notice =
    router.query.message === "password-changed"
      ? "Your password was changed. Please sign in again."
      : router.query.message === "account-deleted"
        ? "Your account has been deleted and your QR codes no longer work. Sign in within 30 days to restore them; after that everything is permanently erased."
        : router.query.message === "account-erased"
          ? "Your account and all of its data have been permanently erased."
          : errorCode
            ? ERROR_MESSAGES[errorCode] || "Something went wrong signing in. Please try again."
            : "";

  const onSubmit = async (e) => {
    e.preventDefault();
    if (mode === "register" && TURNSTILE_ENABLED && !turnstileToken) {
      alert("Please complete the verification check first.");
      return;
    }
    setSubmitting(true);
    if (mode === "login") {
      await signIn("credentials", { email: form.email, password: form.password, callbackUrl: "/dashboard", redirect: true });
      setSubmitting(false);
    } else {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, turnstileToken }),
      });
      if (res.ok) {
        await signIn("credentials", { email: form.email, password: form.password, callbackUrl: "/dashboard" });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Registration failed");
        // Turnstile tokens are single-use, so a failed attempt needs a new one.
        setTurnstileReset((n) => n + 1);
        setSubmitting(false);
      }
    }
  };

  if (status === "authenticated") return null;

  return (
    <main className="page" style={{ justifyContent: "center" }}>
      <div className="container" style={{ maxWidth: 420 }}>
        <p style={{ marginBottom: 24 }}>
          <Link href="/" className="btn-text" style={{ fontWeight: 500 }}>
            &larr; ImmortalQR
          </Link>
        </p>

        <h1 style={{ fontSize: "1.8rem", marginBottom: 6 }}>
          {mode === "login" ? "Sign in" : "Create your account"}
        </h1>
        <p style={{ marginBottom: 28 }}>
          {mode === "login" ? "Welcome back." : "Takes about a minute."}
        </p>

        {notice && (
          <p
            role={errorCode ? "alert" : "status"}
            style={{ marginBottom: 16, color: errorCode ? "var(--danger)" : "var(--ink-soft)" }}
          >
            {notice}
          </p>
        )}

        <form onSubmit={onSubmit}>
          {mode === "register" && (
            <div className="field">
              <label htmlFor="name">Name</label>
              <input
                id="name"
                className="input"
                placeholder="Jane Doe"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
            </div>
          )}
          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              required
              className="input"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>
          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              required
              className="input"
              placeholder="••••••••"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          {mode === "register" && <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />}

          <button type="submit" className="btn btn-primary btn-full" disabled={submitting} style={{ marginTop: 8 }}>
            {submitting ? "Please wait..." : mode === "login" ? "Sign in" : "Create account"}
          </button>

          <div style={{ marginTop: 16 }}>
            <button
              type="button"
              className="btn-text"
              onClick={() => setMode(mode === "login" ? "register" : "login")}
            >
              {mode === "login" ? "Create account" : "Have an account? Sign in"}
            </button>
          </div>

          {mode === "login" ? (
            <div style={{ marginTop: 8 }}>
              <Link href="/forgot-password">Forgot password?</Link>
            </div>
          ) : (
            <p style={{ marginTop: 8, fontSize: "0.85rem" }}>
              By registering, you agree to the <Link href="/terms">Terms</Link> and{" "}
              <Link href="/privacy">Privacy Policy</Link>.
            </p>
          )}
        </form>
      </div>
    </main>
  );
}
