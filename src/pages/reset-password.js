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
    <main className="page" style={{ justifyContent: "center" }}>
      <div className="container" style={{ maxWidth: 400 }}>
        <h1 style={{ fontSize: "1.6rem" }}>Choose a new password</h1>
        {done ? (
          <p>
            Your password has been reset. <Link href="/login">Sign in</Link>
          </p>
        ) : (
          <form onSubmit={onSubmit}>
            <div className="field">
              <label htmlFor="password">New password</label>
              <input
                id="password"
                type="password"
                required
                className="input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="confirm">Confirm new password</label>
              <input
                id="confirm"
                type="password"
                required
                className="input"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </div>
            <button type="submit" className="btn btn-primary btn-full" disabled={loading || !token}>
              {loading ? "Saving..." : "Reset password"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
