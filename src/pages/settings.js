import RequireAuth from "../components/RequireAuth";
import { useEffect, useState } from "react";
import { useSession, signOut } from "next-auth/react";
import Link from "next/link";

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

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "system-ui" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>Settings</h2>
        <Link href="/dashboard">Back to dashboard</Link>
      </div>
      <form onSubmit={onSave}>
        <label style={{ display: "block", marginBottom: 4 }}>Name</label>
        <input
          value={form.name}
          onChange={(e) => setForm({ ...form, name: e.target.value })}
          style={{ display: "block", width: "100%", marginBottom: 12 }}
        />

        <label style={{ display: "block", marginBottom: 4 }}>Email</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          style={{ display: "block", width: "100%", marginBottom: 12 }}
        />

        <label style={{ display: "block", marginBottom: 4 }}>New password (optional)</label>
        <input
          type="password"
          placeholder="Leave blank to keep current password"
          value={form.password}
          onChange={(e) => setForm({ ...form, password: e.target.value })}
          style={{ display: "block", width: "100%", marginBottom: 12 }}
        />

        <button type="submit" disabled={saving}>{saving ? "Saving..." : "Save changes"}</button>
      </form>

      <hr style={{ margin: "24px 0" }} />
      <button type="button" onClick={() => signOut({ callbackUrl: "/" })}>Sign out</button>
    </main>
  );
}
