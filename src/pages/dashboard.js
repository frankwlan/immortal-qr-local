import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import RequireAuth from "../components/RequireAuth";
import isURL from "validator/lib/isURL";
import QrTable from "../components/QrTable";
import Nav from "../components/Nav";
import VerifyEmailBanner from "../components/VerifyEmailBanner";

export default function Dashboard() {
  return (
    <RequireAuth>
      <DashboardInner />
    </RequireAuth>
  );
}

function DashboardInner() {
  const { data: session } = useSession();
  const [dest, setDest] = useState("");
  const [slug, setSlug] = useState("");
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    const res = await fetch("/api/qr/list");
    if (res.ok) setItems(await res.json());
  };

  useEffect(() => { load(); }, []);

  const onCreate = async (e) => {
    e.preventDefault();
    if (!isURL(dest, { protocols: ["http", "https"], require_protocol: true })) {
      alert("Please enter a valid http(s) URL.");
      return;
    }
    setLoading(true);
    const res = await fetch("/api/qr/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ destination: dest, slug: slug.trim() || undefined })
    });
    setLoading(false);
    if (res.ok) {
      setDest("");
      setSlug("");
      await load();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to create QR link.");
    }
  };

  return (
    <main className="page">
      <Nav userLabel={session?.user?.name || session?.user?.email} />
      {session?.user && !session.user.emailVerified && <VerifyEmailBanner email={session.user.email} />}
      <div className="container" style={{ paddingTop: 36, paddingBottom: 48 }}>
        <h1 style={{ fontSize: "1.8rem" }}>Your QR codes</h1>

        <form onSubmit={onCreate} style={{ display: "flex", gap: 10, marginBottom: 8, maxWidth: 560, flexWrap: "wrap" }}>
          <input
            className="input"
            value={dest}
            onChange={(e) => setDest(e.target.value)}
            placeholder="https://destination.url"
            style={{ flex: 1 }}
          />
          <input
            className="input"
            value={slug}
            onChange={(e) => setSlug(e.target.value.toLowerCase())}
            placeholder="Custom address (optional), e.g. summer-menu"
            maxLength={40}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            style={{ flex: "1 1 100%" }}
          />
          <button type="submit" className="btn btn-primary" disabled={loading}>
            {loading ? "Creating..." : "Create QR"}
          </button>
        </form>
        <p style={{ fontSize: "0.85rem", marginBottom: 24, color: "var(--ink-soft)" }}>
          {slug.trim()
            ? <>Your link: <code>/r/{slug.trim()}</code></>
            : "Leave the address blank and we'll generate one. Custom addresses can't be changed later."}
        </p>

        <QrTable items={items} onChange={load} />
      </div>
    </main>
  );
}
