import RequireAuth from "../components/RequireAuth";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Nav from "../components/Nav";

export default function Settings() {
  return (
    <RequireAuth>
      <SettingsInner />
    </RequireAuth>
  );
}

function SettingsInner() {
  const { data: session, update } = useSession();
  const [form, setForm] = useState({ name: "", email: "", password: "" });
  const [saving, setSaving] = useState(false);
  const [usernameInput, setUsernameInput] = useState("");
  const [usernameState, setUsernameState] = useState({ saving: false, error: "" });
  const [resend, setResend] = useState({ state: "idle", error: "" }); // idle | sending | sent | error

  useEffect(() => {
    if (session?.user) {
      setForm((f) => ({ ...f, name: session.user.name || "", email: session.user.email || "" }));
    }
  }, [session?.user]);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = { name: form.name, email: form.email };
    if (form.password) body.password = form.password;

    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (res.ok) {
      setForm((f) => ({ ...f, password: "" }));
      await update();
      alert("Saved");
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to save changes");
    }
  };

  const onClaimUsername = async (e) => {
    e.preventDefault();
    setUsernameState({ saving: true, error: "" });
    const res = await fetch("/api/auth/username", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: usernameInput }),
    });
    if (res.ok) {
      setUsernameState({ saving: false, error: "" });
      await update();
    } else {
      const data = await res.json().catch(() => ({}));
      setUsernameState({ saving: false, error: data.error || "Couldn't save username." });
    }
  };

  const onResend = async () => {
    setResend({ state: "sending", error: "" });
    const res = await fetch("/api/auth/resend-verification", { method: "POST" });
    if (res.ok) {
      setResend({ state: "sent", error: "" });
    } else {
      const data = await res.json().catch(() => ({}));
      setResend({ state: "error", error: data.error || "Something went wrong." });
    }
  };

  const username = session?.user?.username;
  const verified = Boolean(session?.user?.emailVerified);

  return (
    <main className="page">
      <Nav userLabel={session?.user?.name || session?.user?.email} />
      <div className="container" style={{ maxWidth: 480, paddingTop: 36, paddingBottom: 48 }}>
        <h1 style={{ fontSize: "1.6rem" }}>Settings</h1>

        <div className="panel" style={{ marginBottom: 24 }}>
          <h3 style={{ fontSize: "1rem", fontFamily: "var(--font-body)", marginBottom: 8 }}>Username</h3>
          {username ? (
            <>
              <p style={{ marginBottom: 4 }}><code>{username}</code></p>
              <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)" }}>
                Your custom QR links look like <code>/r/{username}/your-address</code>. Usernames are
                permanent so printed codes keep working.
              </p>
            </>
          ) : (
            <form onSubmit={onClaimUsername}>
              <p style={{ fontSize: "0.85rem", color: "var(--ink-soft)", marginBottom: 10 }}>
                Choose a username to unlock custom QR addresses like <code>/r/{usernameInput || "username"}/menu</code>.
                It&apos;s permanent once set.
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <input
                  className="input"
                  style={{ flex: 1 }}
                  value={usernameInput}
                  onChange={(e) => setUsernameInput(e.target.value.toLowerCase())}
                  placeholder="janedoe"
                  minLength={3}
                  maxLength={30}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  aria-label="Username"
                />
                <button type="submit" className="btn btn-primary" disabled={usernameState.saving || usernameInput.length < 3}>
                  {usernameState.saving ? "Saving..." : "Set username"}
                </button>
              </div>
              {usernameState.error && (
                <p style={{ color: "var(--danger)", fontSize: "0.85rem", marginTop: 8 }}>{usernameState.error}</p>
              )}
            </form>
          )}
        </div>

        <form onSubmit={onSave}>
          <div className="field">
            <label htmlFor="name">Display name</label>
            <input
              id="name"
              className="input"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="field">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              className="input"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div style={{ marginTop: 6, fontSize: "0.85rem", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              {verified ? (
                <span style={{ color: "var(--ink-soft)" }}>&#10003; Email verified</span>
              ) : resend.state === "sent" ? (
                <span style={{ color: "var(--ink-soft)" }}>Verification email sent. Check your inbox.</span>
              ) : (
                <>
                  <span style={{ color: "var(--danger)" }}>Email not verified</span>
                  <button type="button" className="btn btn-outline btn-sm" onClick={onResend} disabled={resend.state === "sending"}>
                    {resend.state === "sending" ? "Sending..." : "Resend verification email"}
                  </button>
                  {resend.state === "error" && <span style={{ color: "var(--danger)" }}>{resend.error}</span>}
                </>
              )}
            </div>
          </div>

          <div className="field">
            <label htmlFor="password">New password</label>
            <input
              id="password"
              type="password"
              className="input"
              placeholder="Leave blank to keep current password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
            />
          </div>

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </main>
  );
}
