import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import Link from "next/link";

export default function VerifyEmail() {
  const router = useRouter();
  const { update } = useSession();
  const [state, setState] = useState("verifying"); // verifying | success | error
  const [message, setMessage] = useState("");
  const started = useRef(false);

  const token = router.query.token;

  useEffect(() => {
    // The token is only available once the router is ready, and the ref
    // keeps React's dev-mode double effect from spending a single-use
    // token on the first call and failing the second.
    if (!router.isReady || started.current) return;
    started.current = true;

    if (!token) {
      setState("error");
      setMessage("This verification link is missing its token.");
      return;
    }

    (async () => {
      const res = await fetch("/api/auth/verify-email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      if (res.ok) {
        setState("success");
        // If they're signed in on this browser, refresh the session so the
        // dashboard banner goes away without a re-login. (Harmless when
        // signed out — there's just no token to refresh.)
        try { await update(); } catch { /* non-critical */ }
      } else {
        const data = await res.json().catch(() => ({}));
        setState("error");
        setMessage(data.error || "Something went wrong.");
      }
    })();
  }, [router.isReady, token, update]);

  return (
    <main className="page" style={{ justifyContent: "center" }}>
      <div className="container" style={{ maxWidth: 420 }}>
        {state === "verifying" && <h1 style={{ fontSize: "1.6rem" }}>Verifying your email…</h1>}
        {state === "success" && (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>Email verified</h1>
            <p>Thanks — your email address is confirmed.</p>
            <p>
              <Link href="/dashboard" className="btn btn-primary">Go to dashboard</Link>
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>Couldn&apos;t verify</h1>
            <p>{message}</p>
            <p>
              If you&apos;re signed in, you can request a new link from your <Link href="/dashboard">dashboard</Link>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
