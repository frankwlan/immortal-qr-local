import QRCode from "qrcode";

// Error correction: how much of a code can be damaged or covered and still
// scan. Higher levels survive scratches and logos but make a denser pattern.
export const ERROR_LEVELS = [
  { value: "M", label: "Standard", hint: "Best for most uses. Cleanest, easiest to scan from far away." },
  { value: "H", label: "High", hint: "Survives scuffs, folds and stickers. Denser pattern, so print it a little larger." },
];

export const PNG_SIZES = [
  { px: 512, label: "Small (512 px)" },
  { px: 1024, label: "Medium (1024 px)" },
  { px: 2048, label: "Large (2048 px)" },
  { px: 4096, label: "Print (4096 px)" },
];

// The quiet zone (blank border) scanners need. 4 modules is the QR spec.
const MARGIN = 4;

export function isErrorLevel(v) {
  return ERROR_LEVELS.some((l) => l.value === v);
}

export function isPngSize(px) {
  return PNG_SIZES.some((s) => s.px === px);
}

// Resolution-independent: opens in design and print tools at any size.
export function buildSvg(text, errorCorrectionLevel = "M") {
  return QRCode.toString(text, { type: "svg", errorCorrectionLevel, margin: MARGIN });
}

export function buildPng(text, px = 1024, errorCorrectionLevel = "M") {
  return QRCode.toDataURL(text, { width: px, errorCorrectionLevel, margin: MARGIN });
}

export function downloadName(slug, ext, extra = "") {
  return `immortalqr-${slug}${extra}.${ext}`;
}

// Approximate printed width at 300 dpi, a common print resolution.
export function printInches(px) {
  return Math.round((px / 300) * 10) / 10;
}

export function saveFile(filename, href) {
  const a = document.createElement("a");
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function saveText(filename, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  saveFile(filename, url);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
