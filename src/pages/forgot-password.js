import { useState } from "react";
import Link from "next/link";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    const res = await fetch("/api/auth/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    setLoading(false);
    if (res.ok) {
      setSubmitted(true);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Something went wrong");
    }
  };

  return (
    <main style={{ maxWidth: 400, margin: "4rem auto", fontFamily: "system-ui" }}>
      <h2>Reset your password</h2>
      {submitted ? (
        <p>If that email is registered, a reset link has been sent. Check your inbox.</p>
      ) : (
        <form onSubmit={onSubmit}>
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
          <button type="submit" disabled={loading} style={{ width: "100%", padding: 10 }}>
            {loading ? "Sending..." : "Send reset link"}
          </button>
        </form>
      )}
      <p style={{ marginTop: 16 }}>
        <Link href="/">Back to sign in</Link>
      </p>
    </main>
  );
}
