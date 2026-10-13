import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import QRCode from "qrcode";

export default function QrTable({ items, onChange }) {
  const [editing, setEditing] = useState(null);
  const [editUrl, setEditUrl] = useState("");

  async function handleDelete(id) {
    if (!confirm("Delete this QR?")) return;
    const res = await fetch("/api/qr/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
    if (res.ok) {
      onChange();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to delete");
    }
  }

  async function handleUpdate(id) {
    const res = await fetch("/api/qr/update", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, destination: editUrl }) });
    if (res.ok) {
      setEditing(null);
      onChange();
    } else {
      const data = await res.json().catch(() => ({}));
      alert(data.error || "Failed to update");
    }
  }

  return (
    <div style={{ marginTop: 28 }}>
      <div style={{ overflowX: "auto" }}>
      <table>
        <thead>
          <tr>
            <th>QR</th>
            <th>Slug</th>
            <th>Destination</th>
            <th>Scans</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <Row key={it.id} it={it} onDelete={handleDelete} onEdit={() => { setEditing(it.id); setEditUrl(it.destination); }} />
          ))}
          {items.length === 0 && (
            <tr><td colSpan={5} style={{ color: "var(--text-faint)" }}>No links yet. Create your first one above.</td></tr>
          )}
        </tbody>
      </table>
      </div>

      {editing && (
        <div className="panel" style={{ marginTop: 20, maxWidth: 480 }}>
          <h3 style={{ fontSize: "1rem", fontFamily: "var(--font-body)", marginBottom: 12 }}>Edit destination</h3>
          <div className="field">
            <input className="input" value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" onClick={() => handleUpdate(editing)}>Save</button>
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ it, onDelete, onEdit }) {
  const router = useRouter();
  const detailHref = `/dashboard/qr/${it.id}`;
  const redirectUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${it.slug}`;
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(redirectUrl)
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch((err) => console.error("Failed to generate QR code:", err));
    return () => { cancelled = true; };
  }, [redirectUrl]);

  // The whole row opens the detail page, except where the click was really
  // meant for a link or button inside it. "Details" is the keyboard- and
  // screen-reader-friendly way in.
  const openDetails = (e) => {
    if (e.target.closest("a, button, input")) return;
    router.push(detailHref);
  };

  return (
    <tr className="row-link" onClick={openDetails}>
      <td>{dataUrl ? <img src={dataUrl} alt="qr" width={72} height={72} /> : "..."}</td>
      <td><code>{it.slug}</code></td>
      <td style={{ maxWidth: 380, wordBreak: "break-all" }}>
        <a href={redirectUrl} target="_blank" rel="noreferrer">{it.destination}</a>
        {it.disabledAt && (
          <div style={{ fontSize: "0.8em", color: "var(--danger)" }}>
            Disabled for violating our Terms of Service
          </div>
        )}
      </td>
      <td>
        <div>{it.scanCount ?? 0} scan{it.scanCount === 1 ? "" : "s"}</div>
        {it.lastScannedAt && (
          <div style={{ fontSize: "0.8em", color: "var(--text-faint)" }}>
            last {new Date(it.lastScannedAt).toLocaleDateString()}
          </div>
        )}
      </td>
      <td>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={detailHref} className="btn btn-outline btn-sm">Details</Link>
          <button className="btn btn-outline btn-sm" onClick={onEdit}>Edit</button>
          <button className="btn btn-danger btn-sm" onClick={() => onDelete(it.id)}>Delete</button>
        </div>
      </td>
    </tr>
  );
}
