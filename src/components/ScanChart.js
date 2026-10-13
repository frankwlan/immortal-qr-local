import { useState } from "react";

const W = 720;
const H = 220;
const PAD = { top: 12, right: 8, bottom: 28, left: 34 };

// Round the top of the y-axis up to a "nice" number so ticks are readable.
function niceMax(v) {
  if (v <= 4) return 4;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const m of [1, 2, 2.5, 5, 10]) if (v <= m * mag) return m * mag;
  return 10 * mag;
}

function fmtDay(day) {
  const [y, m, d] = day.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString(undefined, { month: "short", day: "numeric", timeZone: "UTC" });
}

// Scans per day as a bar chart. One series, baseline at zero, labelled
// ends: the question it answers is "when do people scan this code?".
export default function ScanChart({ daily }) {
  const [hover, setHover] = useState(null);
  const max = niceMax(Math.max(0, ...daily.map((d) => d.scans)));
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;
  const slot = innerW / daily.length;
  const barW = Math.max(2, slot * 0.7);
  const y = (v) => PAD.top + innerH - (v / max) * innerH;
  const ticks = [0, max / 2, max];
  const labelIdx = [0, Math.floor((daily.length - 1) / 2), daily.length - 1];
  const total = daily.reduce((n, d) => n + d.scans, 0);
  const active = hover !== null ? daily[hover] : null;

  return (
    <div>
      <div style={{ minHeight: 22, fontSize: "0.85rem", color: "var(--text-soft)" }} aria-live="polite">
        {active
          ? `${fmtDay(active.day)}: ${active.scans} scan${active.scans === 1 ? "" : "s"}, ${active.visitors} visitor${active.visitors === 1 ? "" : "s"}`
          : "Hover a bar for details"}
      </div>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        style={{ width: "100%", height: "auto", display: "block" }}
        role="img"
        aria-label={`Scans per day over the last ${daily.length} days. ${total} scans in total.`}
        onMouseLeave={() => setHover(null)}
      >
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--line)" strokeWidth="1" />
            <text x={PAD.left - 6} y={y(t) + 4} textAnchor="end" fontSize="11" fill="var(--text-faint)">
              {Number.isInteger(t) ? t : t.toFixed(1)}
            </text>
          </g>
        ))}
        {daily.map((d, i) => {
          const h = Math.max(d.scans > 0 ? 2 : 0, innerH - (y(d.scans) - PAD.top));
          const x = PAD.left + i * slot + (slot - barW) / 2;
          return (
            <g key={d.day} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}>
              {/* Full-height invisible target so thin bars are easy to hover. */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={innerH} fill="transparent" />
              <rect
                x={x}
                y={PAD.top + innerH - h}
                width={barW}
                height={h}
                rx="2"
                fill={hover === i ? "var(--cyan)" : "var(--blue)"}
              >
                <title>{`${fmtDay(d.day)}: ${d.scans} scan${d.scans === 1 ? "" : "s"}`}</title>
              </rect>
            </g>
          );
        })}
        {labelIdx.map((i, k) => (
          <text
            key={i}
            x={PAD.left + i * slot + slot / 2}
            y={H - 8}
            textAnchor={k === 0 ? "start" : k === 2 ? "end" : "middle"}
            fontSize="11"
            fill="var(--text-faint)"
          >
            {fmtDay(daily[i].day)}
          </text>
        ))}
      </svg>
    </div>
  );
}
