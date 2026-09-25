import { useEffect, useState } from "react";
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
    <div style={{ marginTop: 24 }}>
      <table width="100%" cellPadding="8" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr style={{ textAlign: "left", borderBottom: "1px solid #ddd" }}>
            <th>QR</th>
            <th>Slug</th>
            <th>Destination</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <Row key={it.id} it={it} onDelete={handleDelete} onEdit={() => { setEditing(it.id); setEditUrl(it.destination); }} />
          ))}
          {items.length === 0 && (
            <tr><td colSpan={4} style={{ opacity: 0.7 }}>No links yet.</td></tr>
          )}
        </tbody>
      </table>

      {editing && (
        <div style={{ marginTop: 16, border: "1px solid #ddd", padding: 12 }}>
          <h4>Edit destination</h4>
          <input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} style={{ width: "100%", marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={() => handleUpdate(editing)}>Save</button>
            <button onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ it, onDelete, onEdit }) {
  const redirectUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}/r/${it.slug}`;
  const [dataUrl, setDataUrl] = useState("");

  useEffect(() => {
    let cancelled = false;
    QRCode.toDataURL(redirectUrl)
      .then((url) => { if (!cancelled) setDataUrl(url); })
      .catch((err) => console.error("Failed to generate QR code:", err));
    return () => { cancelled = true; };
  }, [redirectUrl]);

  return (
    <tr style={{ borderBottom: "1px solid #eee" }}>
      <td>{dataUrl ? <img src={dataUrl} alt="qr" width={88} height={88} /> : "..."}</td>
      <td><code>{it.slug}</code></td>
      <td style={{ maxWidth: 420, wordBreak: "break-all" }}><a href={redirectUrl} target="_blank" rel="noreferrer">{it.destination}</a></td>
      <td>
        <button onClick={onEdit}>Edit</button>
        <button onClick={() => onDelete(it.id)} style={{ marginLeft: 8 }}>Delete</button>
      </td>
    </tr>
  );
}