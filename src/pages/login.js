import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function Login() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [form, setForm] = useState({ email: "", password: "", name: "" });
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (status === "authenticated") router.replace("/dashboard");
  }, [status, router]);

  useEffect(() => {
    if (router.query.mode === "register") setMode("register");
  }, [router.query.mode]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    if (mode === "login") {
      await signIn("credentials", { email: form.email, password: form.password, callbackUrl: "/dashboard", redirect: true });
      setSubmitting(false);
    } else {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        await signIn("credentials", { email: form.email, password: form.password, callbackUrl: "/dashboard" });
      } else {
        const data = await res.json().catch(() => ({}));
        alert(data.error || "Registration failed");
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
