import { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Link from "next/link";
import TurnstileWidget from "../components/TurnstileWidget";

const TURNSTILE_ENABLED = Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY);

const REASONS = [
  ["phishing", "Phishing or scam"],
  ["malware", "Malware or harmful download"],
  ["spam", "Spam"],
  ["illegal", "Illegal content"],
  ["other", "Something else"],
];

export default function Report() {
  const router = useRouter();
  const [form, setForm] = useState({ code: "", reason: "phishing", details: "", email: "" });
  const [state, setState] = useState("idle"); // idle | sending | done
  const [error, setError] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [turnstileReset, setTurnstileReset] = useState(0);

  // Links from the preview and "disabled" pages arrive with ?code=...
  useEffect(() => {
    if (typeof router.query.code === "string") {
      setForm((f) => ({ ...f, code: router.query.code }));
    }
  }, [router.query.code]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError("");
    if (TURNSTILE_ENABLED && !turnstileToken) {
      setError("Please complete the verification check first.");
      return;
    }
    setState("sending");
    const res = await fetch("/api/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, turnstileToken }),
    });
    if (res.ok) {
      setState("done");
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error || "Something went wrong. Please try again.");
      setState("idle");
      setTurnstileReset((n) => n + 1);
    }
  };

  return (
    <main className="page" style={{ justifyContent: "center" }}>
      <div className="container" style={{ maxWidth: 480, paddingTop: 36, paddingBottom: 48 }}>
        <p><Link href="/">&larr; Back</Link></p>
        <h1 style={{ fontSize: "1.6rem" }}>Report a link</h1>

        {state === "done" ? (
          <p>Thank you — we&apos;ve received your report and will review it.</p>
        ) : (
          <>
            <p>
              Found an ImmortalQR code that leads somewhere harmful? Tell us and we&apos;ll
              look into it. You don&apos;t need an account.
            </p>
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="code">Link or code</label>
                <input
                  id="code"
                  className="input"
                  required
                  maxLength={300}
                  placeholder="https://… /r/abc123… or just the code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="reason">What&apos;s the problem?</label>
                <select
                  id="reason"
                  className="input"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                >
                  {REASONS.map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label htmlFor="details">Details (optional)</label>
                <textarea
                  id="details"
                  className="input"
                  rows={4}
                  maxLength={1000}
                  value={form.details}
                  onChange={(e) => setForm({ ...form, details: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="email">Your email (optional)</label>
                <input
                  id="email"
                  type="email"
                  className="input"
                  placeholder="Only if you'd like us to follow up"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </div>

              <TurnstileWidget onToken={setTurnstileToken} resetSignal={turnstileReset} />

              {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}

              <button type="submit" className="btn btn-primary btn-full" disabled={state === "sending"}>
                {state === "sending" ? "Sending..." : "Send report"}
              </button>
            </form>
          </>
        )}
      </div>
    </main>
  );
}
