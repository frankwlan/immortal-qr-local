// The ImmortalQR brand mark: an infinity sign drawn out of QR modules.
// The cell layout below is exactly the one in the logo (a lemniscate
// sampled onto a 25×25 grid). It's a fixed list rather than computed at
// runtime so server and client render identically. Not a real QR code,
// so it can't be mistaken for something scannable.

const GRID = 25;

// [row, [columns...]] — only rows the infinity occupies (5–19)
const ROWS = [
  [5, [3, 4, 5, 6, 7, 17, 18, 19, 20, 21]],
  [6, [2, 3, 4, 5, 6, 7, 8, 16, 17, 18, 19, 20, 21, 22]],
  [7, [1, 2, 3, 6, 7, 8, 9, 15, 16, 17, 18, 21, 22, 23]],
  [8, [0, 1, 2, 8, 9, 10, 14, 15, 16, 22, 23, 24]],
  [9, [0, 1, 9, 10, 11, 13, 14, 15, 23, 24]],
  [10, [0, 1, 10, 11, 12, 13, 14, 23, 24]],
  [11, [0, 1, 10, 11, 12, 13, 14, 23, 24]],
  [12, [0, 1, 11, 12, 13, 23, 24]],
  [13, [0, 1, 10, 11, 12, 13, 14, 23, 24]],
  [14, [0, 1, 10, 11, 12, 13, 14, 23, 24]],
  [15, [0, 1, 9, 10, 11, 13, 14, 15, 23, 24]],
  [16, [0, 1, 2, 8, 9, 10, 14, 15, 16, 22, 23, 24]],
  [17, [1, 2, 3, 6, 7, 8, 9, 15, 16, 17, 18, 21, 22, 23]],
  [18, [2, 3, 4, 5, 6, 7, 8, 16, 17, 18, 19, 20, 21, 22]],
  [19, [3, 4, 5, 6, 7, 17, 18, 19, 20, 21]],
];

const CELLS = ROWS.flatMap(([r, cols]) => cols.map((c) => [r, c]));
const FIRST_ROW = ROWS[0][0];
const ROW_COUNT = ROWS.length;
const CENTER = (GRID - 1) / 2;

export default function QrGridArt({ size = 320 }) {
  const cell = size / GRID;
  const gap = cell * 0.2;
  const sq = cell - gap;
  const top = FIRST_ROW * cell;
  const height = ROW_COUNT * cell;

  return (
    <svg
      viewBox={`0 ${top} ${size} ${height}`}
      width={size}
      height={height}
      role="img"
      aria-label="Infinity sign made of QR code squares"
      style={{ overflow: "visible", display: "block" }}
    >
      <defs>
        <linearGradient id="iqr-grad" x1="0" y1="0" x2={size} y2="0" gradientUnits="userSpaceOnUse">
          <stop offset="0" style={{ stopColor: "var(--violet)" }} />
          <stop offset="0.5" style={{ stopColor: "var(--blue)" }} />
          <stop offset="1" style={{ stopColor: "var(--cyan)" }} />
        </linearGradient>
      </defs>
      <style>{`
        .qr-cell {
          animation: qr-stamp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
        }
        @keyframes qr-stamp {
          from { opacity: 0; transform: scale(0.3); transform-box: fill-box; transform-origin: center; }
          to   { opacity: 1; transform: scale(1); transform-box: fill-box; transform-origin: center; }
        }
      `}</style>
      <g fill="url(#iqr-grad)">
        {CELLS.map(([r, c]) => {
          // Ripple outward from the crossing point, like the loop being drawn
          const delay = (Math.abs(c - CENTER) + Math.abs(r - CENTER) * 0.5) * 0.025;
          return (
            <rect
              key={`${r}-${c}`}
              className="qr-cell"
              x={c * cell + gap / 2}
              y={r * cell + gap / 2}
              width={sq}
              height={sq}
              rx={sq * 0.22}
              style={{ animationDelay: `${delay.toFixed(3)}s` }}
            />
          );
        })}
      </g>
    </svg>
  );
}
