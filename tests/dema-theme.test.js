// dema-theme.js tests — isomorphism with bizra-cli/src/theme.rs.
// Asserts:
//   - All color constants present with correct RGB byte-for-byte fidelity
//   - Border + symbol sets present
//   - Theme.* presets produce correct ANSI escape sequences
//   - noColor / palette downgrades work
//   - ihsanStyle + metricStyle thresholds match Rust source
//   - Mutation rejection on all frozen exports

import test from "node:test";
import assert from "node:assert/strict";
import {
  COLORS,
  BORDERS,
  SYMBOLS,
  Theme,
  paint,
  ihsanStyle,
  metricStyle,
  DEMA_THEME_SCHEMA,
} from "../packages/core/src/dema-theme.js";

// ----- Color palette fidelity (1:1 with bizra-cli theme.rs) ---------------

test("THEME-01: schema marker is bizra.dema.theme.v0.1", () => {
  assert.equal(DEMA_THEME_SCHEMA, "bizra.dema.theme.v0.1");
});

test("THEME-02: 21 color constants present (4 primary + 3 background + 5 semantic + 7 PAT + 2 voice)", () => {
  const keys = Object.keys(COLORS);
  assert.equal(keys.length, 21, `expected 21 colors, got ${keys.length}`);
  const expected = [
    "GOLD",
    "EMERALD",
    "AZURE",
    "PEARL",
    "DEEP_SPACE",
    "MIDNIGHT",
    "TWILIGHT",
    "IHSAN",
    "ACTIVE",
    "WARNING",
    "DANGER",
    "MUTED",
    "PAT_STRATEGIST",
    "PAT_RESEARCHER",
    "PAT_DEVELOPER",
    "PAT_ANALYST",
    "PAT_REVIEWER",
    "PAT_EXECUTOR",
    "PAT_GUARDIAN",
    "VOICE_ACTIVE",
    "VOICE_LISTENING",
  ];
  for (const k of expected) assert.ok(keys.includes(k), `missing color: ${k}`);
});

test("THEME-03: GOLD = RGB(212,175,55) — Ihsān anchor · byte-for-byte with Rust", () => {
  assert.deepEqual([...COLORS.GOLD.rgb], [212, 175, 55]);
  assert.equal(COLORS.GOLD.hex, "#D4AF37");
});

test("THEME-04: PAT-7 colors match Rust theme.rs exactly", () => {
  assert.deepEqual([...COLORS.PAT_STRATEGIST.rgb], [147, 112, 219]);
  assert.deepEqual([...COLORS.PAT_RESEARCHER.rgb], [70, 130, 180]);
  assert.deepEqual([...COLORS.PAT_DEVELOPER.rgb], [34, 139, 34]);
  assert.deepEqual([...COLORS.PAT_ANALYST.rgb], [255, 140, 0]);
  assert.deepEqual([...COLORS.PAT_REVIEWER.rgb], [178, 34, 34]);
  assert.deepEqual([...COLORS.PAT_EXECUTOR.rgb], [70, 70, 70]);
  // PAT_GUARDIAN is intentionally equal to GOLD per theme.rs:41
  assert.deepEqual([...COLORS.PAT_GUARDIAN.rgb], [...COLORS.GOLD.rgb]);
});

test("THEME-05: semantic IHSAN equals GOLD; ACTIVE equals EMERALD (Rust aliases)", () => {
  assert.deepEqual([...COLORS.IHSAN.rgb], [...COLORS.GOLD.rgb]);
  assert.deepEqual([...COLORS.ACTIVE.rgb], [...COLORS.EMERALD.rgb]);
});

test("THEME-06: COLORS is deep-frozen (mutation rejected)", () => {
  assert.equal(Object.isFrozen(COLORS), true);
  assert.equal(Object.isFrozen(COLORS.GOLD), true);
  assert.throws(() => {
    COLORS.NEW_COLOR = "evil";
  }, TypeError);
});

// ----- Borders + symbols --------------------------------------------------

test("THEME-07: 4 border sets present (STANDARD/IMPORTANT/FOCUSED/ARABIC)", () => {
  assert.deepEqual(Object.keys(BORDERS).sort(), [
    "ARABIC",
    "FOCUSED",
    "IMPORTANT",
    "STANDARD",
  ]);
  assert.equal(BORDERS.STANDARD.tl, "╭");
  assert.equal(BORDERS.IMPORTANT.tl, "╔");
  assert.equal(BORDERS.FOCUSED.tl, "┏");
  assert.equal(BORDERS.ARABIC.tl, "╭");
});

test("THEME-08: core SYMBOLS present (status + arrow + Arabic bismillah)", () => {
  assert.equal(SYMBOLS.active, "●");
  assert.equal(SYMBOLS.success, "✓");
  assert.equal(SYMBOLS.error, "✗");
  assert.equal(SYMBOLS.arrow_right, "→");
  assert.equal(SYMBOLS.bismillah, "﷽");
  assert.equal(SYMBOLS.bullet, "•");
});

// ----- paint() core primitive ---------------------------------------------

test("THEME-09: paint with 24bit palette emits true-color escape sequences", () => {
  const out = paint("hello", COLORS.GOLD);
  // Default palette is 24bit. Open escape contains 38;2;212;175;55, close contains 39.
  assert.ok(
    out.includes("\x1b[38;2;212;175;55m"),
    `expected true-color open in: ${JSON.stringify(out)}`,
  );
  assert.ok(
    out.includes("\x1b[39m"),
    `expected fg-reset in: ${JSON.stringify(out)}`,
  );
  assert.ok(out.includes("hello"));
});

test("THEME-10: paint with palette:'none' or noColor:true returns plain text (no ANSI)", () => {
  const noColor = paint("plain", COLORS.GOLD, { noColor: true });
  const noneP = paint("plain", COLORS.GOLD, { palette: "none" });
  assert.equal(noColor, "plain");
  assert.equal(noneP, "plain");
});

test("THEME-11: paint with palette:'256' emits 8-bit indexed escape sequences", () => {
  const out = paint("hi", COLORS.GOLD, { palette: "256" });
  assert.match(out, /\x1b\[38;5;\d+m/);
});

test("THEME-12: paint with bold/italic/underline composes ANSI modifiers", () => {
  const out = paint("h", COLORS.PEARL, {
    bold: true,
    italic: true,
    underline: true,
  });
  assert.ok(out.includes("\x1b[1m")); // bold on
  assert.ok(out.includes("\x1b[3m")); // italic on
  assert.ok(out.includes("\x1b[4m")); // underline on
  assert.ok(out.includes("\x1b[22m")); // bold off
});

test("THEME-13: paint with null/undefined input returns empty string", () => {
  assert.equal(paint(null, COLORS.GOLD), "");
  assert.equal(paint(undefined, COLORS.GOLD), "");
});

// ----- Theme.* style presets ----------------------------------------------

test("THEME-14: Theme.title applies GOLD + bold", () => {
  const out = Theme.title("X");
  assert.ok(out.includes("\x1b[38;2;212;175;55m"));
  assert.ok(out.includes("\x1b[1m"));
});

test("THEME-15: Theme.ihsan applies GOLD + bold (= title visually, semantic difference)", () => {
  const titleOut = Theme.title("X");
  const ihsanOut = Theme.ihsan("X");
  assert.equal(
    titleOut,
    ihsanOut,
    "title and ihsan share the GOLD+bold style by design",
  );
});

test("THEME-16: Theme.muted applies MUTED RGB(108,117,125)", () => {
  const out = Theme.muted("dim");
  assert.ok(out.includes("\x1b[38;2;108;117;125m"));
});

test("THEME-17: Theme.patAgent dispatches by role (developer → forest green)", () => {
  const out = Theme.patAgent("developer", "Build");
  assert.ok(out.includes("\x1b[38;2;34;139;34m"));
});

test("THEME-18: Theme.patAgent fallback for unknown role uses PEARL", () => {
  const out = Theme.patAgent("unknownRole", "X");
  assert.ok(out.includes("\x1b[38;2;234;234;234m"));
});

test("THEME-19: Theme.patAgentActive adds bold + underline to role color", () => {
  const out = Theme.patAgentActive("guardian", "G");
  assert.ok(out.includes("\x1b[1m")); // bold
  assert.ok(out.includes("\x1b[4m")); // underline
});

// ----- ihsanStyle threshold (mirrors Rust theme.rs:275 ihsan_style) -------

test("THEME-20: ihsanStyle ≥0.95 uses GOLD/IHSAN style", () => {
  const out = ihsanStyle(0.97);
  assert.ok(
    out.includes("\x1b[38;2;212;175;55m"),
    `expected GOLD for 0.97: ${JSON.stringify(out)}`,
  );
});

test("THEME-21: ihsanStyle ≥0.85 and <0.95 uses WARNING", () => {
  const out = ihsanStyle(0.9);
  assert.ok(
    out.includes("\x1b[38;2;255;191;0m"),
    `expected WARNING amber: ${JSON.stringify(out)}`,
  );
});

test("THEME-22: ihsanStyle <0.85 uses DANGER", () => {
  const out = ihsanStyle(0.5);
  assert.ok(
    out.includes("\x1b[38;2;220;53;69m"),
    `expected DANGER red: ${JSON.stringify(out)}`,
  );
});

// ----- metricStyle (mirrors Rust theme.rs:259 metric_style) ---------------

test("THEME-23: metricStyle non-inverse · value passes threshold → IHSAN", () => {
  const out = metricStyle(0.98, 0.95);
  assert.ok(out.includes("\x1b[38;2;212;175;55m"));
});

test("THEME-24: metricStyle inverse=true · value ≤ threshold → IHSAN", () => {
  const out = metricStyle(0.02, 0.05, true);
  assert.ok(out.includes("\x1b[38;2;212;175;55m"));
});

test("THEME-25: noColor option suppresses all ANSI in helpers", () => {
  assert.equal(Theme.title("X", { noColor: true }), "X");
  assert.equal(Theme.muted("Y", { noColor: true }), "Y");
  assert.equal(ihsanStyle(0.99, "Z", { noColor: true }), "Z");
});
