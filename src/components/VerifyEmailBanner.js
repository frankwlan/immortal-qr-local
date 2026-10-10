import { useState } from "react";

export default function VerifyEmailBanner({ email }) {
  const [state, setState] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  const resend = async () => {
    setState("sending");
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    if (res.ok) {
      setState("sent");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong.");
      setState("error");
    }
  };

  return (
    <div style={{ background: "var(--paper-raised)", borderBottom: "1px solid var(--line)" }}>
      <div
        className="container"
        style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", padding: "12px 24px" }}
      >
        <span style={{ color: "var(--ink)", fontSize: "0.9rem" }}>
          {state === "sent"
            ? `Verification email sent to ${email}. Check your inbox.`
            : `Please verify your email. We sent a link to ${email}.`}
        </span>
        {state !== "sent" && (
          <button type="button" className="btn btn-outline btn-sm" onClick={resend} disabled={state === "sending"}>
            {state === "sending" ? "Sending..." : "Resend email"}
          </button>
        )}
        {state === "error" && <span style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</span>}
      </div>
    </div>
  );
}
