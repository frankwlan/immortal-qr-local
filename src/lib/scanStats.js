import prisma from "./prisma";
import { BOT_PATTERN, classifyUserAgent } from "./userAgent";

export const ALLOWED_RANGES = [7, 30, 90];
export const DEFAULT_RANGE = 30;
// Rows per page in the scan history table. The viewer picks one of these.
export const PAGE_SIZES = [10, 20, 50, 100];
export const DEFAULT_PAGE_SIZE = 20;
// Most rows a single CSV export will contain. Far above what 90 days of
// scans on one code normally produces, but bounded so one request can't
// build an enormous response.
export const MAX_EXPORT_ROWS = 50000;

export function isValidTimeZone(tz) {
  if (typeof tz !== "string" || !tz || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

// Reads ?days=, ?tz= and ?bots= from a request, falling back to safe defaults
// for anything missing or invalid. Shared by every endpoint that reports on
// the chart's date range, so they always interpret it the same way.
export function parseWindow(query) {
  const days = ALLOWED_RANGES.includes(Number(query.days)) ? Number(query.days) : DEFAULT_RANGE;
  const tz = isValidTimeZone(query.tz) ? query.tz : "UTC";
  return { days, tz, includeBots: query.bots === "1" };
}

function localDate(instant, tz) {
  // "en-CA" formats as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

// The last `n` calendar days in `tz`, oldest first, ending with today. Days
// are stepped back as calendar dates (not 24h blocks) so a daylight-saving
// change can't repeat or skip a day.
export function dayLabels(n, tz, now = new Date()) {
  const [y, m, d] = localDate(now, tz).split("-").map(Number);
  return Array.from({ length: n }, (_, i) => {
    const back = n - 1 - i;
    return new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
  });
}

// First moment of the window, as a zone-less local timestamp string: midnight
// at the start of the oldest day shown on the chart. The chart, the totals and
// the scan history all use this one definition, so they can never disagree
// about which scans are "in range".
export function windowStart(days, tz, now = new Date()) {
  return `${dayLabels(days, tz, now)[0]} 00:00:00`;
}

// scannedAt is stored as a UTC `timestamp` (no zone). Instants returned from
// SQL are converted with AT TIME ZONE 'UTC' so they come back as unambiguous
// timestamptz values instead of depending on the driver's idea of local time.
// scannedAt is stored as a UTC `timestamp` (no zone). Reinterpret it as UTC,
// then express it in the viewer's zone, so "per day" means their days.
const LOCAL = `(("scannedAt" AT TIME ZONE 'UTC') AT TIME ZONE $2)`;
const IS_BOT = `("userAgent" IS NOT NULL AND "userAgent" ~* $4)`;

// Aggregates scan activity for one link over the last `days` days (in `tz`).
// Robots and link-preview fetchers are left out unless includeBots is set,
// and counted separately so the page can say how many it hid.
export async function loadScanStats(linkId, { days, tz, includeBots, now = new Date() }) {
  const labels = dayLabels(days, tz, now);
  const since = windowStart(days, tz, now);
  // $1 link, $2 tz, $3 since (local), $4 bot pattern, $5 includeBots
  const params = [linkId, tz, since, BOT_PATTERN, includeBots];
  const base = `FROM "ScanEvent" WHERE "qrLinkId" = $1 AND ${LOCAL} >= $3::timestamp`;
  const keep = `(NOT ${IS_BOT} OR $5::boolean)`;

  const [dailyRows, totalRows, deviceRows] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT to_char(date_trunc('day', ${LOCAL}), 'YYYY-MM-DD') AS day,
              count(*)::int AS scans,
              count(DISTINCT "ipHash")::int AS visitors
       ${base} AND ${keep} GROUP BY 1`,
      ...params
    ),
    prisma.$queryRawUnsafe(
      `SELECT count(*) FILTER (WHERE ${keep})::int AS scans,
              count(DISTINCT "ipHash") FILTER (WHERE ${keep})::int AS visitors,
              count(*) FILTER (WHERE ${IS_BOT})::int AS bots,
              max("scannedAt" AT TIME ZONE 'UTC') FILTER (WHERE ${keep}) AS "lastScannedAt"
       ${base}`,
      ...params
    ),
    prisma.$queryRawUnsafe(
      `SELECT "userAgent" AS ua, count(*)::int AS n
       ${base} AND ${keep} GROUP BY 1 ORDER BY 2 DESC LIMIT 300`,
      ...params
    ),
  ]);

  const byDay = new Map(dailyRows.map((r) => [r.day, r]));
  const daily = labels.map((day) => ({
    day,
    scans: byDay.get(day)?.scans ?? 0,
    visitors: byDay.get(day)?.visitors ?? 0,
  }));

  const kinds = new Map();
  const systems = new Map();
  for (const { ua, n } of deviceRows) {
    const { kind, os } = classifyUserAgent(ua);
    kinds.set(kind, (kinds.get(kind) || 0) + n);
    systems.set(os, (systems.get(os) || 0) + n);
  }
  const toList = (m) => [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);

  const t = totalRows[0] || {};
  return {
    days,
    tz,
    includeBots,
    daily,
    scans: t.scans ?? 0,
    visitors: t.visitors ?? 0,
    hiddenBots: includeBots ? 0 : t.bots ?? 0,
    lastScannedAt: t.lastScannedAt ? new Date(t.lastScannedAt).toISOString() : null,
    devices: toList(kinds),
    systems: toList(systems),
  };
}

// Individual scans inside the chart's date range, newest first. Only scans
// from the last `days` days (in the viewer's zone `tz`) are ever returned, the
// same window the chart and totals use.
//
// One page: the cursor is the last row's (scannedAt, id) pair, which is stable
// even when several scans share a millisecond. Pass no cursor for page one.
export async function loadScanPage(linkId, { includeBots, days, tz, before, beforeId, limit = DEFAULT_PAGE_SIZE, now = new Date() }) {
  const hasCursor = Boolean(before && beforeId);
  const rows = await prisma.$queryRawUnsafe(
    `SELECT "id", ("scannedAt" AT TIME ZONE 'UTC') AS "scannedAt", "userAgent"
     FROM "ScanEvent"
     WHERE "qrLinkId" = $1
       AND (NOT ${IS_BOT.replace("$4", () => "$2")} OR $3::boolean)
       AND (("scannedAt" AT TIME ZONE 'UTC') AT TIME ZONE $7) >= $8::timestamp
       AND ($4::timestamp IS NULL OR ("scannedAt", "id") < ($4::timestamp, $5::text))
     ORDER BY "scannedAt" DESC, "id" DESC
     LIMIT $6`,
    linkId,
    BOT_PATTERN,
    includeBots,
    hasCursor ? before : null,
    hasCursor ? beforeId : null,
    limit + 1,
    tz,
    windowStart(days, tz, now)
  );
  const page = rows.slice(0, limit);
  const items = page.map((r) => ({
    id: r.id,
    scannedAt: new Date(r.scannedAt).toISOString(),
    ...classifyUserAgent(r.userAgent),
  }));
  const last = page[page.length - 1];
  const nextCursor =
    rows.length > limit && last ? { before: new Date(last.scannedAt).toISOString(), beforeId: last.id } : null;
  return { items, nextCursor };
}

// Every scan in the date range for a CSV export, newest first, capped at
// MAX_EXPORT_ROWS. `truncated` says whether the cap cut the list short.
export async function loadScansForExport(linkId, { includeBots, days, tz, now = new Date() }) {
  const rows = await prisma.$queryRawUnsafe(
    `SELECT ("scannedAt" AT TIME ZONE 'UTC') AS "scannedAt",
            to_char((("scannedAt" AT TIME ZONE 'UTC') AT TIME ZONE $4), 'YYYY-MM-DD HH24:MI:SS') AS "local",
            "userAgent"
     FROM "ScanEvent"
     WHERE "qrLinkId" = $1
       AND (NOT ${IS_BOT.replace("$4", () => "$2")} OR $3::boolean)
       AND (("scannedAt" AT TIME ZONE 'UTC') AT TIME ZONE $4) >= $5::timestamp
     ORDER BY "scannedAt" DESC, "id" DESC
     LIMIT $6`,
    linkId,
    BOT_PATTERN,
    includeBots,
    tz,
    windowStart(days, tz, now),
    MAX_EXPORT_ROWS + 1
  );
  const page = rows.slice(0, MAX_EXPORT_ROWS);
  return {
    truncated: rows.length > MAX_EXPORT_ROWS,
    items: page.map((r) => ({
      scannedAt: new Date(r.scannedAt).toISOString(),
      local: r.local,
      ...classifyUserAgent(r.userAgent),
    })),
  };
}
