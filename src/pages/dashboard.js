import { useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import RequireAuth from "../components/RequireAuth";
import QRCode from "qrcode";
import isURL from "validator/lib/isURL";

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
      body: JSON.stringify({ destination: dest })
    });
    setLoading(false);
    if (res.ok) {
      setDest("");
      await load();
    } else {
      alert("Failed to create QR link.");
    }
  };

  return (
    <main style={{ maxWidth: 900, margin: "2rem auto", fontFamily: "system-ui" }}>
      <h2>Welcome, {session?.user?.email}</h2>
      <form onSubmit={onCreate} style={{ display: "flex", gap: 8 }}>
        <input value={dest} onChange={(e) => setDest(e.target.value)} placeholder="https://destination.url" style={{ flex: 1 }} />
        <button type="submit" disabled={loading}>{loading ? "Creating..." : "Create QR"}</button>
      </form>

      <QrTable items={items} onChange={load} />
    </main>
  );
}