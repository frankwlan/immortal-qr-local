import { useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function ResetPassword() {
  const router = useRouter();
  const { token } = router.query;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) {
      alert("Passwords don't match");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/auth/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    setLoading(false);
    if (res.ok) {
      setDone(true);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Something went wrong");
    }
  };

  return (
    <main style={{ maxWidth: 400, margin: "4rem auto", fontFamily: "system-ui" }}>
      <h2>Choose a new password</h2>
      {done ? (
        <p>
          Your password has been reset. <Link href="/">Sign in</Link>
        </p>
      ) : (
        <form onSubmit={onSubmit}>
          <input
            type="password"
            required
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
          <input
            type="password"
            required
            placeholder="Confirm new password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            style={{ display: "block", width: "100%", marginBottom: 8 }}
          />
          <button type="submit" disabled={loading || !token} style={{ width: "100%", padding: 10 }}>
            {loading ? "Saving..." : "Reset password"}
          </button>
        </form>
      )}
    </main>
  );
}
