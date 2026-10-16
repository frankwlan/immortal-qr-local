// Minimal CSV writer (RFC 4180: comma separated, CRLF line ends, quotes
// doubled). Cells that start with = + - @ or a tab/CR are prefixed with an
// apostrophe so a spreadsheet can't mistake them for a formula.
export function csvCell(value) {
  let s = value === null || value === undefined ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header, rows) {
  return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
