import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import { useSession } from "next-auth/react";
import RequireAuth from "../../../components/RequireAuth";
import Nav from "../../../components/Nav";
import VerifyEmailBanner from "../../../components/VerifyEmailBanner";
import ScanChart from "../../../components/ScanChart";
import {
  ERROR_LEVELS,
  PNG_SIZES,
  buildPng,
  buildSvg,
  downloadName,
  printInches,
  saveFile,
  saveText,
} from "../../../lib/qrExport";

const RANGES = [7, 30, 90];
const KIND_LABELS = { mobile: "Phone", tablet: "Tablet", desktop: "Computer", bot: "Robot / link preview", unknown: "Unknown" };

export default function QrDetailPage() {
  return (
    <RequireAuth>
      <QrDetail />
    </RequireAuth>
  );
}

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

function QrDetail() {
  const router = useRouter();
  const { data: session } = useSession();
  const id = typeof router.query.id === "string" ? router.query.id : null;

  const [data, setData] = useState(null);
  const [status, setStatus] = useState("loading"); // loading | ready | notfound | error
  const [message, setMessage] = useState("");
  const [days, setDays] = useState(30);
  const [bots, setBots] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [scans, setScans] = useState({ items: [], nextCursor: null });
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    setRefreshing(true);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
    const qs = new URLSearchParams({ days: String(days), tz, ...(bots ? { bots: "1" } : {}) });
    try {
      const res = await fetch(`/api/qr/${encodeURIComponent(id)}?${qs}`);
      if (res.status === 404) return setStatus("notfound");
      if (res.status === 429) {
        setMessage("You're going a little fast. Try again in a moment.");
        return setStatus((s) => (s === "ready" ? s : "error"));
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setScans(json.scans);
      setStatus("ready");
      setMessage("");
    } catch (err) {
      console.error("Failed to load QR details:", err);
      setMessage("Couldn't load this QR code. Please try again.");
      setStatus((s) => (s === "ready" ? s : "error"));
    } finally {
      setRefreshing(false);
    }
  }, [id, days, bots]);

  useEffect(() => { load(); }, [load]);

  const showMore = async () => {
    if (!scans.nextCursor || loadingMore) return;
    setLoadingMore(true);
    const qs = new URLSearchParams({ before: scans.nextCursor.before, beforeId: scans.nextCursor.beforeId, ...(bots ? { bots: "1" } : {}) });
    try {
      const res = await fetch(`/api/qr/${encodeURIComponent(id)}/scans?${qs}`);
      if (res.ok) {
        const page = await res.json();
        setScans((s) => ({ items: [...s.items, ...page.items], nextCursor: page.nextCursor }));
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <main className="page">
      <Nav userLabel={session?.user?.name || session?.user?.email} />
      {session?.user && !session.user.emailVerified && <VerifyEmailBanner email={session.user.email} />}
      <div className="container" style={{ paddingTop: 28, paddingBottom: 56 }}>
        <Link href="/dashboard" style={{ fontSize: "0.9rem" }}>&larr; Your QR codes</Link>

        {status === "loading" && <p style={{ color: "var(--text-faint)", marginTop: 24 }}>Loading…</p>}
        {status === "notfound" && (
          <div className="panel" style={{ marginTop: 20, maxWidth: 480 }}>
            <h1 style={{ fontSize: "1.3rem" }}>QR code not found</h1>
            <p>It may have been deleted, or it belongs to a different account.</p>
          </div>
        )}
        {status === "error" && (
          <div className="panel" style={{ marginTop: 20, maxWidth: 480 }}>
            <p role="alert">{message || "Something went wrong."}</p>
            <button className="btn btn-outline btn-sm" onClick={load}>Try again</button>
          </div>
        )}

        {status === "ready" && data && (
          <>
            <Header data={data} onChanged={load} onDeleted={() => router.push("/dashboard")} />
            {message && <p role="alert" style={{ color: "var(--danger)" }}>{message}</p>}

            <div className="detail-grid" style={{ marginTop: 24 }}>
              <DownloadPanel link={data.link} />
              <DetailsPanel link={data.link} totalAllTime={data.totalAllTime} />
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, margin: "36px 0 14px" }}>
              <h2 style={{ fontSize: "1.2rem", fontFamily: "var(--font-body)" }}>Scan activity</h2>
              <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
                <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: "0.85rem", color: "var(--text-soft)" }}>
                  <input type="checkbox" checked={bots} onChange={(e) => setBots(e.target.checked)} />
                  Include robots &amp; link previews
                </label>
                <div className="seg" role="group" aria-label="Date range">
                  {RANGES.map((r) => (
                    <button key={r} type="button" aria-pressed={days === r} onClick={() => setDays(r)}>
                      {r} days
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ opacity: refreshing ? 0.6 : 1, transition: "opacity .15s" }}>
              <StatTiles stats={data.stats} totalAllTime={data.totalAllTime} />

              <div className="panel" style={{ marginTop: 16 }}>
                <ScanChart daily={data.stats.daily} />
                {data.totalAllTime === 0 && (
                  <p style={{ color: "var(--text-faint)", fontSize: "0.9rem", marginBottom: 0 }}>
                    No scans yet. Print or share the QR code and activity will show up here.
                  </p>
                )}
                {!bots && data.stats.hiddenBots > 0 && (
                  <p style={{ color: "var(--text-faint)", fontSize: "0.85rem", marginBottom: 0 }}>
                    {data.stats.hiddenBots} hit{data.stats.hiddenBots === 1 ? "" : "s"} from robots and link previews
                    (like chat apps unfurling the link) {data.stats.hiddenBots === 1 ? "is" : "are"} hidden.
                  </p>
                )}
              </div>

              {data.stats.scans > 0 && (
                <div className="detail-grid" style={{ marginTop: 16, gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }}>
                  <Breakdown title="Devices" rows={data.stats.devices} labels={KIND_LABELS} />
                  <Breakdown title="Operating systems" rows={data.stats.systems} labels={{}} />
                </div>
              )}
            </div>

            <h2 style={{ fontSize: "1.2rem", fontFamily: "var(--font-body)", margin: "36px 0 14px" }}>Scan history</h2>
            <div className="panel" style={{ padding: 0 }}>
              {scans.items.length === 0 ? (
                <p style={{ padding: 24, margin: 0, color: "var(--text-faint)" }}>No scans to show.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr><th style={{ paddingLeft: 20 }}>When</th><th>Device</th><th>System</th></tr>
                    </thead>
                    <tbody>
                      {scans.items.map((s) => (
                        <tr key={s.id}>
                          <td style={{ paddingLeft: 20 }}>{fmtDateTime(s.scannedAt)}</td>
                          <td>{KIND_LABELS[s.kind] || s.kind}</td>
                          <td>{s.os}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {scans.nextCursor && (
                <div style={{ padding: 16, textAlign: "center" }}>
                  <button className="btn btn-outline btn-sm" onClick={showMore} disabled={loadingMore}>
                    {loadingMore ? "Loading…" : "Show more"}
                  </button>
                </div>
              )}
            </div>
            <p style={{ color: "var(--text-faint)", fontSize: "0.8rem", marginTop: 12 }}>
              Devices are estimated from the browser each person used. Visitors are approximate: people on the same
              network can count as one. We don&apos;t store anyone&apos;s IP address in readable form.
            </p>
          </>
        )}
      </div>
    </main>
  );
}

function hostOf(url) {
  try { return new URL(url).hostname.replace(/^www\./, ""); } catch { return url; }
}

function Header({ data, onChanged, onDeleted }) {
  const { link } = data;
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(link.destination);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    const res = await fetch("/api/qr/update", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: link.id, destination: url }),
    });
    setBusy(false);
    if (res.ok) {
      setEditing(false);
      onChanged();
    } else {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Failed to update");
    }
  };

  const remove = async () => {
    if (!confirm("Delete this QR code? Anyone who scans it afterwards will see an error.")) return;
    const res = await fetch("/api/qr/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: link.id }),
    });
    if (res.ok) onDeleted();
    else {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Failed to delete");
    }
  };

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 16, flexWrap: "wrap", alignItems: "flex-start" }}>
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: "1.7rem", marginBottom: 4, wordBreak: "break-all" }}>{hostOf(link.destination)}</h1>
          <div style={{ color: "var(--text-faint)", fontSize: "0.9rem" }}>
            Code <code>{link.slug}</code>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn btn-outline btn-sm" disabled={Boolean(link.disabledAt)} onClick={() => { setUrl(link.destination); setEditing(true); }}>
            Edit destination
          </button>
          <button className="btn btn-danger btn-sm" onClick={remove}>Delete</button>
        </div>
      </div>
      {link.disabledAt && (
        <p style={{ color: "var(--danger)", fontSize: "0.9rem" }}>
          This code has been disabled for violating our Terms of Service, so scanning it no longer redirects.
        </p>
      )}
      {editing && (
        <form onSubmit={save} className="panel" style={{ marginTop: 16, maxWidth: 560 }}>
          <div className="field">
            <label htmlFor="dest">Destination URL</label>
            <input id="dest" className="input" value={url} onChange={(e) => setUrl(e.target.value)} />
          </div>
          <p style={{ fontSize: "0.85rem", color: "var(--text-faint)" }}>
            The QR code itself doesn&apos;t change, so printed copies keep working and will go to the new address.
          </p>
          {error && <p role="alert" style={{ color: "var(--danger)" }}>{error}</p>}
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn btn-primary btn-sm" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
            <button type="button" className="btn btn-outline btn-sm" onClick={() => setEditing(false)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  );
}

function DownloadPanel({ link }) {
  const [level, setLevel] = useState("M");
  const [size, setSize] = useState(1024);
  const [preview, setPreview] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");
  const hint = ERROR_LEVELS.find((l) => l.value === level)?.hint;
  const suffix = level === "H" ? "-high" : "";

  useEffect(() => {
    let cancelled = false;
    buildPng(link.shortUrl, 512, level)
      .then((u) => { if (!cancelled) setPreview(u); })
      .catch((err) => console.error("Preview failed:", err));
    return () => { cancelled = true; };
  }, [link.shortUrl, level]);

  const run = async (kind, fn) => {
    setBusy(kind);
    setError("");
    try { await fn(); } catch (err) {
      console.error("Download failed:", err);
      setError("Couldn't create that file. Please try again.");
    } finally { setBusy(""); }
  };

  return (
    <div className="panel">
      <h2 style={{ fontSize: "1.05rem", fontFamily: "var(--font-body)", marginTop: 0 }}>QR code</h2>
      <div style={{ background: "#fff", borderRadius: 8, padding: 8, width: "fit-content", maxWidth: "100%", margin: "0 auto 16px" }}>
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={preview} alt={`QR code for ${link.shortUrl}`} width={240} height={240} style={{ display: "block", maxWidth: "100%", height: "auto" }} />
        ) : (
          <div style={{ width: 240, height: 240 }} />
        )}
      </div>

      <div className="field">
        <label htmlFor="ec">Error correction</label>
        <select id="ec" className="input" value={level} onChange={(e) => setLevel(e.target.value)}>
          {ERROR_LEVELS.map((l) => <option key={l.value} value={l.value}>{l.label}</option>)}
        </select>
        <div style={{ fontSize: "0.8rem", color: "var(--text-faint)", marginTop: 4 }}>{hint}</div>
      </div>

      <button
        className="btn btn-primary btn-full"
        disabled={busy !== ""}
        onClick={() => run("svg", async () => saveText(downloadName(link.slug, "svg", suffix), await buildSvg(link.shortUrl, level), "image/svg+xml"))}
      >
        {busy === "svg" ? "Preparing…" : "Download SVG (any size)"}
      </button>
      <div style={{ fontSize: "0.8rem", color: "var(--text-faint)", margin: "4px 0 16px" }}>
        Vector file: stays sharp at any size. Best for print, signs and design tools.
      </div>

      <div className="field">
        <label htmlFor="px">PNG size</label>
        <select id="px" className="input" value={size} onChange={(e) => setSize(Number(e.target.value))}>
          {PNG_SIZES.map((s) => <option key={s.px} value={s.px}>{s.label}</option>)}
        </select>
        <div style={{ fontSize: "0.8rem", color: "var(--text-faint)", marginTop: 4 }}>
          About {printInches(size)} inches wide at 300 dpi.
        </div>
      </div>
      <button
        className="btn btn-outline btn-full"
        disabled={busy !== ""}
        onClick={() => run("png", async () => saveFile(downloadName(link.slug, "png", `${suffix}-${size}px`), await buildPng(link.shortUrl, size, level)))}
      >
        {busy === "png" ? "Preparing…" : "Download PNG"}
      </button>
      {error && <p role="alert" style={{ color: "var(--danger)", fontSize: "0.85rem" }}>{error}</p>}
      <p style={{ fontSize: "0.8rem", color: "var(--text-faint)", marginBottom: 0 }}>
        Every version points to the same link, so you can use whichever fits. Keep the white border around the code and
        print it at least 2 cm (0.8 in) wide.
      </p>
    </div>
  );
}

function DetailsPanel({ link, totalAllTime }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link.shortUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable; the link is selectable below */ }
  };

  return (
    <div className="panel">
      <h2 style={{ fontSize: "1.05rem", fontFamily: "var(--font-body)", marginTop: 0 }}>Details</h2>
      <dl className="detail-list">
        <dt>Short link</dt>
        <dd>
          <a href={link.shortUrl} target="_blank" rel="noreferrer">{link.shortUrl}</a>{" "}
          <button type="button" className="btn-text" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
        </dd>
        <dt>Destination</dt>
        <dd><a href={link.destination} target="_blank" rel="noreferrer noopener">{link.destination}</a></dd>
        <dt>Created</dt>
        <dd>{fmtDateTime(link.createdAt)}</dd>
        <dt>Last changed</dt>
        <dd>{fmtDateTime(link.updatedAt)}</dd>
        <dt>Status</dt>
        <dd>{link.disabledAt ? <span style={{ color: "var(--danger)" }}>Disabled</span> : "Active"}</dd>
        <dt>Total scans</dt>
        <dd>{totalAllTime.toLocaleString()} (all time)</dd>
      </dl>
    </div>
  );
}

function StatTiles({ stats, totalAllTime }) {
  const tiles = [
    { value: stats.scans.toLocaleString(), label: `Scans, last ${stats.days} days` },
    { value: stats.visitors.toLocaleString(), label: "Unique visitors (approx.)" },
    { value: totalAllTime.toLocaleString(), label: "Scans, all time" },
    { value: stats.lastScannedAt ? fmtDateTime(stats.lastScannedAt) : "Never", label: "Last scanned", small: true },
  ];
  return (
    <div className="stat-tiles">
      {tiles.map((t) => (
        <div className="stat" key={t.label}>
          <div className="stat-value" style={t.small ? { fontSize: "1rem", paddingTop: 6 } : undefined}>{t.value}</div>
          <div className="stat-label">{t.label}</div>
        </div>
      ))}
    </div>
  );
}

function Breakdown({ title, rows, labels }) {
  const total = rows.reduce((n, r) => n + r.count, 0) || 1;
  return (
    <div className="panel">
      <h3 style={{ fontSize: "0.95rem", fontFamily: "var(--font-body)", marginTop: 0 }}>{title}</h3>
      {rows.map((r) => {
        const pct = Math.round((r.count / total) * 100);
        return (
          <div className="meter-row" key={r.key}>
            <span>{labels[r.key] || r.key}</span>
            <div className="meter-track"><div className="meter-fill" style={{ width: `${pct}%` }} /></div>
            <span style={{ textAlign: "right", color: "var(--text-soft)" }}>{pct}%</span>
          </div>
        );
      })}
    </div>
  );
}
