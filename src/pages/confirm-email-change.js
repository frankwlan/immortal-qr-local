import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";

export default function ConfirmEmailChange() {
  const router = useRouter();
  const [state, setState] = useState("working"); // working | success | error
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const started = useRef(false);
  const token = router.query.token;

  useEffect(() => {
    // The ref keeps React's dev-mode double effect from spending the
    // single-use token on the first call and failing the second.
    if (!router.isReady || started.current) return;
    started.current = true;

    if (!token || typeof token !== "string") {
      setState("error");
      setMessage("This confirmation link is missing its token.");
      return;
    }

    (async () => {
      const res = await fetch("/api/auth/confirm-email-change", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setEmail(data.email || "");
        setState("success");
      } else {
        setState("error");
        setMessage(data.error || "Something went wrong.");
      }
    })();
  }, [router.isReady, token]);

  return (
    <main className="page" style={{ justifyContent: "center" }}>
      <div className="container" style={{ maxWidth: 420 }}>
        {state === "working" && <h1 style={{ fontSize: "1.6rem" }}>Confirming your new email…</h1>}
        {state === "success" && (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>Email updated</h1>
            <p>
              Your account email is now <strong>{email}</strong>. Use it the next time you sign in.
            </p>
            <p>
              <button type="button" className="btn btn-primary" onClick={() => window.location.assign("/dashboard")}>
                Go to dashboard
              </button>
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <h1 style={{ fontSize: "1.6rem" }}>Couldn&apos;t confirm</h1>
            <p>{message}</p>
            <p>
              If you&apos;re signed in, you can request a new link from <Link href="/settings">Settings</Link>.
            </p>
          </>
        )}
      </div>
    </main>
  );
}
