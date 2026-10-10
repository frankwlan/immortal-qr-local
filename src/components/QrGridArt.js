// A stylized, deliberately non-functional QR-module pattern — the one
// bold visual element on the landing page. Deterministic (not random per
// render) so it's stable across server/client render. Not a real QR
// code: the pattern is hand-picked, not an actual encoding, so it can't
// be mistaken for something scannable.

const GRID = 9;
// 1 = ink square, 2 = brass square, 0 = empty (paper shows through)
const PATTERN = [
  [1, 1, 1, 0, 0, 2, 1, 1, 1],
  [1, 0, 1, 0, 2, 2, 1, 0, 1],
  [1, 1, 1, 0, 0, 0, 1, 1, 1],
  [0, 0, 0, 1, 2, 1, 0, 0, 0],
  [0, 2, 1, 0, 1, 0, 1, 2, 0],
  [0, 0, 0, 1, 2, 1, 0, 0, 0],
  [1, 1, 1, 0, 1, 0, 1, 1, 1],
  [1, 0, 1, 0, 2, 2, 1, 0, 1],
  [1, 1, 1, 0, 0, 2, 1, 1, 1],
];

export default function QrGridArt({ size = 320 }) {
  const cell = size / GRID;
  const gap = cell * 0.14;
  const sq = cell - gap;

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      width={size}
      height={size}
      role="img"
      aria-label="Abstract pattern of a QR code"
      style={{ overflow: "visible" }}
    >
      <style>{`
        .qr-cell {
          animation: qr-stamp 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) backwards;
        }
        @keyframes qr-stamp {
          from { opacity: 0; transform: scale(0.4); transform-box: fill-box; transform-origin: center; }
          to   { opacity: 1; transform: scale(1); transform-box: fill-box; transform-origin: center; }
        }
      `}</style>
      {PATTERN.flatMap((row, r) =>
        row.map((v, c) => {
          if (v === 0) return null;
          const delay = (r + c) * 0.018;
          return (
            <rect
              key={`${r}-${c}`}
              className="qr-cell"
              x={c * cell + gap / 2}
              y={r * cell + gap / 2}
              width={sq}
              height={sq}
              rx={sq * 0.18}
              fill={v === 1 ? "var(--ink)" : "var(--brass)"}
              style={{ animationDelay: `${delay}s` }}
            />
          );
        })
      )}
    </svg>
  );
}
