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

// SCALE — graduated ramps absorbed from the 2026-07-30 Dema TUI design handoff.
//
// STATUS: TUI extension, NOT brand canon. Canon v0.2 lives upstream in
// bizra-data-lake and is vendored here byte-identically (sha256 2601f1e2…);
// Dema is the face, not the whole system, so it does not promote BIZRA-wide
// brand canon locally. Promotion to canon v0.3 is an upstream ratification.
// Same posture as the proof-state SEMANTIC group above.
//
// Six flat colors cannot express depth; these ramps can. They are anchored, not
// free-floating: origin_black and celestial_navy did not move, they turned out
// to be ground steps 2 and 4 of a ramp that was always implied. The drift-guard
// in tests/theme.test.js pins that anchoring.
//
// Vendored, not read from disk — this is a core kernel and stays fs-free
// (.claude/rules/paths/core-kernels.md).
export const SCALE = Object.freeze({
  ground: Object.freeze([
    "#02060C",
    "#040A12",
    HEX.originBlack,
    "#071120",
    HEX.navy,
  ]),
  gold: Object.freeze([HEX.gold, "#D4B875", "#EDD9A3"]),
  paper: Object.freeze(["#F8F6F1", "#F3EEDF", "#EDE6D3"]),
});

// TEXTURE is the identity move: epistemic status rendered as glyph weight
// rather than as a bracketed word. Solid is proven, stipple is declared.
//
// This is deliberately not a color. Color carries attention; texture carries
// certainty, and conflating them is how a preview surface gets read as ready.
// It is also direction-agnostic, so it survives RTL intact where "[PREVIEW_ONLY]"
// does not — see the bidi isolation gap in doctor-dashboard.js.
export const TEXTURE = Object.freeze({
  measured: "█",
  preview: "░",
  ruleMajor: "═",
  ruleMinor: "─",
  separator: "·",
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
