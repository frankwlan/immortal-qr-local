import RequireAuth from "../components/RequireAuth";
import { useState } from "react";

export default function Settings() {
  return (
    <RequireAuth>
      <SettingsInner />
    </RequireAuth>
  );
}

function SettingsInner() {
  const [form, setForm] = useState({ email: "", password: "" });

  const onSave = async (e) => {
    e.preventDefault();
    const res = await fetch("/api/auth/profile", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    alert(res.ok ? "Saved" : "Failed");
  };

  return (
    <main style={{ maxWidth: 600, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h2>Settings</h2>
      <form onSubmit={onSave}>
        <input placeholder="New email (optional)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={{ display: "block", width: "100%", marginBottom: 8 }} />
        <input type="password" placeholder="New password (optional)" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} style={{ display: "block", width: "100%", marginBottom: 8 }} />
        <button type="submit">Save</button>
      </form>
    </main>
  );
}