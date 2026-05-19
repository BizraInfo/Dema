// Dema Visual Theme — Isomorphic port of bizra-cli/src/theme.rs
// Source: /home/bizra-operating-system/BIZRA Node0/bizra-data-lake/bizra-omega/
//          bizra-cli/src/theme.rs (Rust · ratatui · 283 LOC)
// Author of source: MoMo (محمد) — Dubai Night Sky palette · Arabic borders ·
//                   PAT-7 colors · Ihsān-gold semantic anchor.
// Port discipline: zero new deps · plain ANSI escape codes · 24-bit / 256 /
//                  none palette fallback · noColor suppression compatible with
//                  resolveFormatterOptsFromEnv().
// ADR: docs/06-adr/ADR-013-visual-language-isomorphism-bizra-cli-to-dema.md

const ESC = "\x1b[";

// ----- COLORS -------------------------------------------------------------
// 4 primary · 3 background · 5 semantic · 7 PAT · 2 voice — each as [R,G,B].
// Byte-for-byte fidelity with bizra-cli theme.rs colors module.

export const COLORS = Object.freeze({
  // Primary
  GOLD:    Object.freeze({ rgb: [212, 175, 55],  hex: "#D4AF37", desc: "إحسان · Excellence" }),
  EMERALD: Object.freeze({ rgb: [80, 200, 120],  hex: "#50C878", desc: "Success · Active" }),
  AZURE:   Object.freeze({ rgb: [0, 127, 255],   hex: "#007FFF", desc: "Information" }),
  PEARL:   Object.freeze({ rgb: [234, 234, 234], hex: "#EAEAEA", desc: "Text · Borders" }),

  // Background (Dubai Night Sky)
  DEEP_SPACE: Object.freeze({ rgb: [10, 10, 20],  hex: "#0A0A14", desc: "Main background" }),
  MIDNIGHT:   Object.freeze({ rgb: [20, 20, 35],  hex: "#141423", desc: "Panel background" }),
  TWILIGHT:   Object.freeze({ rgb: [30, 30, 50],  hex: "#1E1E32", desc: "Highlighted background" }),

  // Semantic
  IHSAN:   Object.freeze({ rgb: [212, 175, 55],  hex: "#D4AF37", desc: "Excellence threshold met (= GOLD)" }),
  ACTIVE:  Object.freeze({ rgb: [80, 200, 120],  hex: "#50C878", desc: "Active · success (= EMERALD)" }),
  WARNING: Object.freeze({ rgb: [255, 191, 0],   hex: "#FFBF00", desc: "Amber warning" }),
  DANGER:  Object.freeze({ rgb: [220, 53, 69],   hex: "#DC3545", desc: "Error · violation" }),
  MUTED:   Object.freeze({ rgb: [108, 117, 125], hex: "#6C757D", desc: "Inactive · disabled" }),

  // PAT-7 (each agent has a signature color)
  PAT_STRATEGIST: Object.freeze({ rgb: [147, 112, 219], hex: "#9370DB", desc: "Purple · Strategy" }),
  PAT_RESEARCHER: Object.freeze({ rgb: [70, 130, 180],  hex: "#4682B4", desc: "Steel Blue · Knowledge" }),
  PAT_DEVELOPER:  Object.freeze({ rgb: [34, 139, 34],   hex: "#228B22", desc: "Forest Green · Code" }),
  PAT_ANALYST:    Object.freeze({ rgb: [255, 140, 0],   hex: "#FF8C00", desc: "Dark Orange · Data" }),
  PAT_REVIEWER:   Object.freeze({ rgb: [178, 34, 34],   hex: "#B22222", desc: "Firebrick · Quality" }),
  PAT_EXECUTOR:   Object.freeze({ rgb: [70, 70, 70],    hex: "#464646", desc: "Dark Gray · Action" }),
  PAT_GUARDIAN:   Object.freeze({ rgb: [212, 175, 55],  hex: "#D4AF37", desc: "Gold · Protection (= GOLD)" }),

  // Voice
  VOICE_ACTIVE:    Object.freeze({ rgb: [138, 43, 226], hex: "#8A2BE2", desc: "BlueViolet · Speaking" }),
  VOICE_LISTENING: Object.freeze({ rgb: [0, 191, 255],  hex: "#00BFFF", desc: "DeepSkyBlue · Listening" }),
});

// ----- BORDERS ------------------------------------------------------------
// Box-drawing character sets matching bizra-cli theme.rs borders module.

export const BORDERS = Object.freeze({
  STANDARD: Object.freeze({ tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│", desc: "Rounded · default panels" }),
  IMPORTANT: Object.freeze({ tl: "╔", tr: "╗", bl: "╚", br: "╝", h: "═", v: "║", desc: "Double · important panels" }),
  FOCUSED: Object.freeze({ tl: "┏", tr: "┓", bl: "┗", br: "┛", h: "━", v: "┃", desc: "Thick · active/focused" }),
  ARABIC: Object.freeze({ tl: "╭", tr: "╮", bl: "╰", br: "╯", h: "─", v: "│", desc: "Arabic-inspired (same as STANDARD)" }),
});

// ----- SYMBOLS ------------------------------------------------------------
// Unicode glyphs matching bizra-cli theme.rs symbols module.

export const SYMBOLS = Object.freeze({
  // Status
  active: "●", inactive: "○", pending: "◐", error: "✗", success: "✓", warning: "⚠",
  // Voice
  voice_on: "🎤", voice_off: "🔇", listening: "👂", speaking: "🔊",
  // PAT
  agent: "◆", agent_active: "◇",
  // FATE Gates
  gate_pass: "✓", gate_fail: "✗", gate_pending: "○",
  // Navigation
  arrow_right: "→", arrow_left: "←", arrow_up: "↑", arrow_down: "↓",
  // Separators
  separator: "│", dot: "·", bullet: "•",
  // Arabic-inspired
  bismillah: "﷽", star: "✦", crescent: "☾",
});

// ----- ANSI HELPERS -------------------------------------------------------

function fg24(r, g, b) { return `${ESC}38;2;${r};${g};${b}m`; }
function bg24(r, g, b) { return `${ESC}48;2;${r};${g};${b}m`; }
const RESET_FG = `${ESC}39m`;
const RESET_BG = `${ESC}49m`;
const BOLD_ON  = `${ESC}1m`;
const BOLD_OFF = `${ESC}22m`;
const ITALIC_ON  = `${ESC}3m`;
const ITALIC_OFF = `${ESC}23m`;
const UNDERLINE_ON  = `${ESC}4m`;
const UNDERLINE_OFF = `${ESC}24m`;

// ANSI 256-color approximation of a 24-bit RGB value (fallback for legacy terms).
// Uses the 6x6x6 color cube (216 colors) + 24-step grayscale ramp.
function rgbTo256(r, g, b) {
  if (r === g && g === b) {
    if (r < 8) return 16;
    if (r > 248) return 231;
    return Math.round(((r - 8) / 247) * 24) + 232;
  }
  return 16 +
    36 * Math.round((r / 255) * 5) +
    6  * Math.round((g / 255) * 5) +
    Math.round((b / 255) * 5);
}

// Resolves a color spec to either {} (noColor) or an open/close ANSI pair.
function ansiForColor(color, opts = {}) {
  const palette = opts.palette ?? "24bit";
  if (opts.noColor || palette === "none") return { open: "", close: "" };
  const [r, g, b] = color.rgb;
  if (palette === "24bit") {
    return { open: fg24(r, g, b), close: RESET_FG };
  }
  if (palette === "256") {
    const idx = rgbTo256(r, g, b);
    return { open: `${ESC}38;5;${idx}m`, close: RESET_FG };
  }
  // 'basic' falls back to 8-color (closest 3-bit ANSI). Conservative mapping.
  const idx = (r > 127 ? 1 : 0) | ((g > 127 ? 1 : 0) << 1) | ((b > 127 ? 1 : 0) << 2);
  return { open: `${ESC}3${idx}m`, close: RESET_FG };
}

// ----- STYLE PRESETS (mirror of theme.rs Theme struct) ---------------------

export const Theme = Object.freeze({
  // Text styles
  title:     (text, opts) => paint(text, COLORS.GOLD,    { bold: true, ...opts }),
  subtitle:  (text, opts) => paint(text, COLORS.PEARL,   { italic: true, ...opts }),
  text:      (text, opts) => paint(text, COLORS.PEARL,   opts),
  muted:     (text, opts) => paint(text, COLORS.MUTED,   opts),
  highlight: (text, opts) => paint(text, COLORS.AZURE,   { bold: true, ...opts }),
  success:   (text, opts) => paint(text, COLORS.ACTIVE,  opts),
  warning:   (text, opts) => paint(text, COLORS.WARNING, opts),
  error:     (text, opts) => paint(text, COLORS.DANGER,  opts),
  ihsan:     (text, opts) => paint(text, COLORS.IHSAN,   { bold: true, ...opts }),

  // PAT agent styles
  patAgent:       (role, text, opts) => paint(text, patColorFor(role),  opts),
  patAgentActive: (role, text, opts) => paint(text, patColorFor(role), { bold: true, underline: true, ...opts }),

  // Status
  statusActive:  (text, opts) => paint(text, COLORS.ACTIVE,  { bold: true, ...opts }),
  statusPending: (text, opts) => paint(text, COLORS.WARNING, opts),
  statusError:   (text, opts) => paint(text, COLORS.DANGER,  { bold: true, ...opts }),

  // Voice
  voiceActive:    (text, opts) => paint(text, COLORS.VOICE_ACTIVE,    { bold: true, ...opts }),
  voiceListening: (text, opts) => paint(text, COLORS.VOICE_LISTENING, { bold: true, ...opts }),
});

function patColorFor(role) {
  const r = String(role ?? "").toLowerCase();
  if (r === "strategist") return COLORS.PAT_STRATEGIST;
  if (r === "researcher") return COLORS.PAT_RESEARCHER;
  if (r === "developer")  return COLORS.PAT_DEVELOPER;
  if (r === "analyst")    return COLORS.PAT_ANALYST;
  if (r === "reviewer")   return COLORS.PAT_REVIEWER;
  if (r === "executor")   return COLORS.PAT_EXECUTOR;
  if (r === "guardian")   return COLORS.PAT_GUARDIAN;
  return COLORS.PEARL;
}

// Core paint primitive. All Theme.* helpers funnel through here.
export function paint(text, color, opts = {}) {
  if (text == null) return "";
  const s = String(text);
  if (opts.noColor || opts.palette === "none") return s;
  const { open, close } = ansiForColor(color, opts);
  let pre = open;
  let post = close;
  if (opts.bold)      { pre = BOLD_ON       + pre; post = post + BOLD_OFF; }
  if (opts.italic)    { pre = ITALIC_ON     + pre; post = post + ITALIC_OFF; }
  if (opts.underline) { pre = UNDERLINE_ON  + pre; post = post + UNDERLINE_OFF; }
  return pre + s + post;
}

// ----- UTILITY HELPERS (mirror of theme.rs free functions) -----------------

// Style a metric value by threshold. Mirrors theme.rs::metric_style.
// inverse=true means "value ≤ threshold is the pass condition" (lower-is-better).
export function metricStyle(value, threshold, inverse = false, text = String(value), opts = {}) {
  const passes = inverse ? value <= threshold : value >= threshold;
  const delta = Math.abs(value - threshold);
  if (passes) return Theme.ihsan(text, opts);
  if (delta < 0.05) return Theme.warning(text, opts);
  return Theme.error(text, opts);
}

// Style an Ihsān score per BIZRA canon: ≥0.95 GOLD · ≥0.85 WARNING · else DANGER.
// Mirrors theme.rs::ihsan_style.
export function ihsanStyle(score, text = score.toFixed(4), opts = {}) {
  if (score >= 0.95) return Theme.ihsan(text, opts);
  if (score >= 0.85) return Theme.warning(text, opts);
  return Theme.error(text, opts);
}

// ----- SCHEMA / EXPORT MARKER ---------------------------------------------

export const DEMA_THEME_SCHEMA = "bizra.dema.theme.v0.1";
