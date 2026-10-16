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

const DEL_INITIAL = { open: false, password: "", confirm: "", erase: false, busy: false, error: "", count: null };

function SettingsInner() {
  const { data: session, update } = useSession();
  const [form, setForm] = useState({ name: "", email: "", password: "", currentPassword: "" });
  const [saving, setSaving] = useState(false);
  const [del, setDel] = useState(DEL_INITIAL);

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
      if (result.emailError) alert(`Saved, but: ${result.emailError}`);
      else if (result.pendingEmail && result.pendingEmail !== session?.user?.pendingEmail) {
        alert(`Saved. We sent a confirmation link to ${result.pendingEmail}. Your email stays the same until you click it.`);
      } else alert("Saved");
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to save changes");
    }
  };

  const [pendingBusy, setPendingBusy] = useState(false);
  const pendingEmail = session?.user?.pendingEmail || null;

  const managePending = async (action) => {
    setPendingBusy(true);
    const res = await fetch("/api/auth/email-change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    });
    setPendingBusy(false);
    if (res.ok) {
      await update();
      if (action === "resend") alert(`We sent a new confirmation link to ${pendingEmail}.`);
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Something went wrong. Please try again.");
    }
  };

  const openDelete = async () => {
    setDel((d) => ({ ...d, open: true, error: "" }));
    // Show how much is about to disappear. Failure is fine — the warning
    // just falls back to the generic wording.
    try {
      const res = await fetch("/api/qr/list");
      if (res.ok) {
        const items = await res.json();
        setDel((d) => ({ ...d, count: items.length }));
      }
    } catch { /* non-critical */ }
  };

  const onDelete = async (e) => {
    e.preventDefault();
    setDel((d) => ({ ...d, busy: true, error: "" }));
    const res = await fetch("/api/auth/delete-account", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword: del.password, confirm: del.confirm, erase: del.erase }),
    });
    if (res.ok) {
      await signOut({ callbackUrl: `/login?message=${del.erase ? "account-erased" : "account-deleted"}` });
      return;
    }
    const data = await res.json().catch(() => ({}));
    setDel((d) => ({ ...d, busy: false, error: data.error || "Couldn't delete your account. Please try again." }));
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
            {pendingEmail && (
              <div role="status" style={{ fontSize: "0.85rem", color: "var(--text-soft)", marginTop: 8 }}>
                Waiting for you to confirm <strong>{pendingEmail}</strong>. We emailed it a link; your email stays{" "}
                <strong>{session?.user?.email}</strong> until you click it.{" "}
                <button type="button" className="btn-text" disabled={pendingBusy} onClick={() => managePending("resend")}>
                  Resend link
                </button>
                {" · "}
                <button type="button" className="btn-text" disabled={pendingBusy} onClick={() => managePending("cancel")}>
                  Cancel change
                </button>
              </div>
            )}
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

        <div className="panel" style={{ marginTop: 40 }}>
          <h2 style={{ fontSize: "1.1rem", fontFamily: "var(--font-body)", marginBottom: 8 }}>Delete account</h2>
          {!del.open ? (
            <>
              <p style={{ fontSize: "0.9rem" }}>
                Delete your account and turn off your QR codes. We keep your data for 30 days in case you change your mind; after that it is permanently erased.
              </p>
              <button type="button" className="btn btn-danger btn-sm" onClick={openDelete}>
                Delete my account…
              </button>
            </>
          ) : (
            <form onSubmit={onDelete}>
              <p style={{ fontSize: "0.9rem" }}>
                Your account will be deleted
                {del.count ? ` and your ${del.count === 1 ? "QR code" : `${del.count} QR codes`} will stop working right away` : ""}.{" "}
                <strong>Any QR code you&apos;ve already printed or shared stops working.</strong>
              </p>
              <div className="field">
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 400 }}>
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={!del.erase}
                    onChange={() => setDel({ ...del, erase: false, confirm: "" })}
                  />
                  <span>
                    <strong>Delete, and keep my data for 30 days.</strong> Sign in within 30 days to restore
                    everything; after that it is permanently erased.
                  </span>
                </label>
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontWeight: 400, marginTop: 8 }}>
                  <input
                    type="radio"
                    name="deleteMode"
                    checked={del.erase}
                    onChange={() => setDel({ ...del, erase: true, confirm: "" })}
                  />
                  <span>
                    <strong>Erase everything now.</strong> Your account, QR codes and scan history are
                    permanently erased immediately. This can&apos;t be undone.
                  </span>
                </label>
              </div>
              <div className="field">
                <label htmlFor="deletePassword">Current password</label>
                <input
                  id="deletePassword"
                  type="password"
                  required
                  autoComplete="current-password"
                  className="input"
                  value={del.password}
                  onChange={(e) => setDel({ ...del, password: e.target.value })}
                />
              </div>
              <div className="field">
                <label htmlFor="deleteConfirm">Type {del.erase ? "ERASE" : "DELETE"} to confirm</label>
                <input
                  id="deleteConfirm"
                  required
                  autoComplete="off"
                  className="input"
                  value={del.confirm}
                  onChange={(e) => setDel({ ...del, confirm: e.target.value })}
                />
              </div>
              {del.error && <p role="alert" style={{ color: "var(--danger)" }}>{del.error}</p>}
              <div style={{ display: "flex", gap: 8 }}>
                <button
                  type="submit"
                  className="btn btn-danger btn-sm"
                  disabled={del.busy || del.confirm !== (del.erase ? "ERASE" : "DELETE") || !del.password}
                >
                  {del.busy ? "Deleting..." : del.erase ? "Erase everything now" : "Delete account"}
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  disabled={del.busy}
                  onClick={() => setDel(DEL_INITIAL)}
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </main>
  );
}
