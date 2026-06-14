// packages/core/src/theme.js
// Brand color tokens for Dema TUI surfaces.
//
// CANON colors are vendored from docs/brand/BIZRA_VISUAL_TOKENS.json (v0.2,
// sha256 2601f1e2...). The proof-state SEMANTIC group and the NEUTRAL gray are a
// TUI extension that is NOT in brand canon v0.2 (sourced from the brand-identity
// HTML), pending canon ratification — do not present them as brand-canonical.
// The drift-guard test in tests/theme.test.js binds the canon values to the JSON.

const truecolor = (r, g, b) => `\x1b[38;2;${r};${g};${b}m`;

export const HEX = Object.freeze({
  gold: "#C9A962",
  navy: "#0A1628",
  originBlack: "#050B14",
  white: "#FFFFFF",
  ivory: "#F6F2E9",
  teal: "#2CB7A7",
  proofVerified: "#34D399",
  proofPending: "#FBBF24",
  proofFailed: "#F87171",
  neutral: "#9CA3AF",
});

export const ANSI = Object.freeze({
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  gold: truecolor(201, 169, 98),
  navy: truecolor(10, 22, 40),
  teal: truecolor(44, 183, 167),
  white: truecolor(255, 255, 255),
  ivory: truecolor(246, 242, 233),
  proofVerified: truecolor(52, 211, 153),
  proofPending: truecolor(251, 191, 36),
  proofFailed: truecolor(248, 113, 113),
  neutral: truecolor(156, 163, 175),
});

// ROLE maps SEMANTIC FOREGROUND intent only. Surface/background colors
// (navy, originBlack) intentionally have no ROLE alias: HEX is their source of
// truth, and originBlack is HEX-only (no fg ANSI entry) since it is never a text color.
export const ROLE = Object.freeze({
  brand: ANSI.gold,
  accent: ANSI.teal,
  statusOk: ANSI.proofVerified,
  statusWarn: ANSI.proofPending,
  statusErr: ANSI.proofFailed,
  muted: ANSI.neutral,
});

export function supportsColor(env = process.env, stream = process.stdout) {
  if (env.NO_COLOR != null && env.NO_COLOR !== "") return false;
  if (env.DEMA_NO_COLOR === "1") return false;
  return Boolean(stream && stream.isTTY);
}

export function paint(text, code, useColor = supportsColor()) {
  if (!useColor || !code) return String(text);
  return `${code}${text}${ANSI.reset}`;
}
