import RequireAuth from "../components/RequireAuth";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
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
  const [form, setForm] = useState({ name: "", email: "", password: "", currentPassword: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (session?.user) {
      setForm((f) => ({ ...f, name: session.user.name || "", email: session.user.email || "" }));
    }
  }, [session?.user]);

  // Changing the email or password asks for the current password too, so a
  // session cookie alone can't be used to take over the account.
  const emailChanged =
    (form.email || "").trim().toLowerCase() !== (session?.user?.email || "").toLowerCase();
  const needsCurrentPassword = emailChanged || Boolean(form.password);

  const onSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = { name: form.name, email: form.email };
    if (form.password) body.password = form.password;
    if (needsCurrentPassword) body.currentPassword = form.currentPassword;

    const res = await fetch("/api/auth/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);

    if (res.ok) {
      const result = await res.json().catch(() => ({}));
      setForm((f) => ({ ...f, password: "", currentPassword: "" }));
      if (result.reauth) {
        // A password change signs out every session, this one included.
        await signOut({ callbackUrl: "/login?message=password-changed" });
        return;
      }
      await update();
      alert("Saved");
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to save changes");
    }
  };

  return (
    <main className="page">
      <Nav userLabel={session?.user?.name || session?.user?.email} />
      <div className="container" style={{ maxWidth: 480, paddingTop: 36, paddingBottom: 48 }}>
        <h1 style={{ fontSize: "1.6rem" }}>Settings</h1>

        <form onSubmit={onSave}>
          <div className="field">
            <label htmlFor="name">Name</label>
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

          {needsCurrentPassword && (
            <div className="field">
              <label htmlFor="currentPassword">Current password</label>
              <input
                id="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                className="input"
                placeholder="Required to change your email or password"
                value={form.currentPassword}
                onChange={(e) => setForm({ ...form, currentPassword: e.target.value })}
              />
            </div>
          )}

          <button type="submit" className="btn btn-primary" disabled={saving} style={{ marginTop: 8 }}>
            {saving ? "Saving..." : "Save changes"}
          </button>
        </form>
      </div>
    </main>
  );
}
