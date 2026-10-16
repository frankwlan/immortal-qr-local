import { useCallback, useEffect, useRef, useState } from "react";
import { saveText } from "../lib/qrExport";

const PAGE_SIZES = [10, 20, 50, 100];
const DEFAULT_SIZE = 20;
const STORAGE_KEY = "immortalqr.scanPageSize";
const KIND_LABELS = { mobile: "Phone", tablet: "Tablet", desktop: "Computer", bot: "Robot / link preview", unknown: "Unknown" };

function fmtDateTime(iso) {
  return new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

// The remembered page size is only a convenience, so a browser that blocks
// storage just gets the default.
function savedSize() {
  try {
    const n = Number(localStorage.getItem(STORAGE_KEY));
    return PAGE_SIZES.includes(n) ? n : DEFAULT_SIZE;
  } catch {
    return DEFAULT_SIZE;
  }
}

// The scan history table for one QR code. It shows the same date range as the
// chart above it (`days`), one page at a time, newest first. `total` is the
// number of scans in that range, used for "Showing 21–40 of 134".
export default function ScanHistory({ id, days, bots, total, allTime }) {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  const [pageSize, setPageSize] = useState(savedSize);
  // starts[n] is the cursor that loads page n (page 0 has none), which is what
  // lets "Newer" step back without refetching everything.
  const [view, setView] = useState({ items: [], nextCursor: null, starts: [null], page: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [exporting, setExporting] = useState(false);
  const latest = useRef(0);

  const params = useCallback(
    (extra) => new URLSearchParams({ days: String(days), tz, ...(bots ? { bots: "1" } : {}), ...extra }),
    [days, tz, bots]
  );

  // Fetch one page. Answers that arrive after a newer request was made (say,
  // after the range was changed) are dropped.
  const fetchPage = useCallback(
    async (cursor) => {
      const mine = ++latest.current;
      setLoading(true);
      setError("");
      const extra = { limit: String(pageSize), ...(cursor ? { before: cursor.before, beforeId: cursor.beforeId } : {}) };
      try {
        const res = await fetch(`/api/qr/${encodeURIComponent(id)}/scans?${params(extra)}`);
        if (res.status === 429) throw new Error("You're going a little fast. Try again in a moment.");
        if (!res.ok) throw new Error("Couldn't load scans. Please try again.");
        const body = await res.json();
        return mine === latest.current ? body : null;
      } catch (err) {
        if (mine === latest.current) setError(err.message || "Couldn't load scans. Please try again.");
        return null;
      } finally {
        if (mine === latest.current) setLoading(false);
      }
    },
    [id, pageSize, params]
  );

  // Back to the newest page whenever the range, the robot filter or the page
  // size changes.
  useEffect(() => {
    let live = true;
    fetchPage(null).then((body) => {
      if (live && body) setView({ items: body.items, nextCursor: body.nextCursor, starts: [null], page: 0 });
    });
    return () => { live = false; };
  }, [fetchPage]);

  const go = async (page, cursor, starts) => {
    const body = await fetchPage(cursor);
    if (body) setView({ items: body.items, nextCursor: body.nextCursor, starts, page });
  };
  const older = () => view.nextCursor && go(view.page + 1, view.nextCursor, [...view.starts.slice(0, view.page + 1), view.nextCursor]);
  const newer = () => view.page > 0 && go(view.page - 1, view.starts[view.page - 1], view.starts.slice(0, view.page));

  const changeSize = (n) => {
    setPageSize(n);
    try { localStorage.setItem(STORAGE_KEY, String(n)); } catch { /* remembering is optional */ }
  };

  const downloadCsv = async () => {
    setExporting(true);
    setError("");
    try {
      const res = await fetch(`/api/qr/${encodeURIComponent(id)}/export?${params({})}`);
      if (res.status === 429) throw new Error("You're going a little fast. Try again in a moment.");
      if (!res.ok) throw new Error("Couldn't export. Please try again.");
      const name = /filename="([^"]+)"/.exec(res.headers.get("Content-Disposition") || "")?.[1] || `scans-last-${days}-days.csv`;
      saveText(name, await res.text(), "text/csv;charset=utf-8");
      if (res.headers.get("X-Export-Truncated") === "1") setError("That range has more scans than one export holds, so the oldest were left out. Pick a shorter range for the rest.");
    } catch (err) {
      setError(err.message || "Couldn't export. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  const from = view.page * pageSize + 1;
  const to = view.page * pageSize + view.items.length;
  const shownTotal = Math.max(total, to);

  return (
    <>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, margin: "36px 0 14px" }}>
        <h2 style={{ fontSize: "1.2rem", fontFamily: "var(--font-body)" }}>Scan history</h2>
        <div style={{ display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ display: "flex", gap: 8, alignItems: "center", fontSize: "0.85rem", color: "var(--text-soft)" }}>
            Rows per page
            <span className="seg" role="group" aria-label="Rows per page">
              {PAGE_SIZES.map((n) => (
                <button key={n} type="button" aria-pressed={pageSize === n} onClick={() => changeSize(n)}>{n}</button>
              ))}
            </span>
          </span>
          <button type="button" className="btn btn-outline btn-sm" onClick={downloadCsv} disabled={exporting || total === 0}>
            {exporting ? "Preparing…" : "Download CSV"}
          </button>
        </div>
      </div>

      {error && <p role="alert" style={{ color: "var(--danger)", fontSize: "0.9rem" }}>{error}</p>}

      <div className="panel" style={{ padding: 0, opacity: loading ? 0.6 : 1, transition: "opacity .15s" }}>
        {view.items.length === 0 ? (
          <p style={{ padding: 24, margin: 0, color: "var(--text-faint)" }}>
            {loading
              ? "Loading…"
              : allTime > 0
                ? `No scans in the last ${days} days.${days < 90 ? " Try a longer range." : ""}`
                : "No scans yet."}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th style={{ paddingLeft: 20 }}>When</th><th>Device</th><th>System</th></tr>
              </thead>
              <tbody>
                {view.items.map((s) => (
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
        {(view.items.length > 0 || view.page > 0) && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, padding: "12px 20px", borderTop: "1px solid var(--border)" }}>
            <span style={{ fontSize: "0.85rem", color: "var(--text-soft)" }} aria-live="polite">
              {view.items.length > 0 ? `Showing ${from.toLocaleString()}–${to.toLocaleString()} of ${shownTotal.toLocaleString()}` : ""}
            </span>
            <span style={{ display: "flex", gap: 8 }}>
              <button type="button" className="btn btn-outline btn-sm" onClick={newer} disabled={loading || view.page === 0}>&larr; Newer</button>
              <button type="button" className="btn btn-outline btn-sm" onClick={older} disabled={loading || !view.nextCursor}>Older &rarr;</button>
            </span>
          </div>
        )}
      </div>
      <p style={{ color: "var(--text-faint)", fontSize: "0.8rem", marginTop: 12 }}>
        Shows the last {days} days, the same period as the chart. Devices are estimated from the browser each person
        used. Visitors are approximate: people on the same network can count as one. We don&apos;t store anyone&apos;s IP
        address in readable form.
      </p>
    </>
  );
}
