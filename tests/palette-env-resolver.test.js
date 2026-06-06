// Palette resolution at the CLI boundary — closes the integration gap
// where dema-theme.js accepted `palette: '24bit' | '256' | 'none'` but
// no caller passed it. resolveFormatterOptsFromEnv now computes palette
// from COLORTERM / TERM / NO_COLOR / DEMA_PALETTE and forwards it to
// formatHomebasePreview, which forwards to Theme.title (and any future
// Theme.* call-sites).

import test from "node:test";
import assert from "node:assert/strict";
import {
  resolvePaletteFromEnv,
  resolveFormatterOptsFromEnv,
} from "../packages/core/src/tui-formatter.js";

// ----- resolvePaletteFromEnv direct ---------------------------------------

test("PAL-01: DEMA_PALETTE=24bit overrides everything", () => {
  assert.equal(
    resolvePaletteFromEnv({ DEMA_PALETTE: "24bit", NO_COLOR: "1" }),
    "24bit",
  );
});

test("PAL-02: DEMA_PALETTE=256 overrides COLORTERM", () => {
  assert.equal(
    resolvePaletteFromEnv({ DEMA_PALETTE: "256", COLORTERM: "truecolor" }),
    "256",
  );
});

test("PAL-03: DEMA_PALETTE=none overrides COLORTERM=truecolor", () => {
  assert.equal(
    resolvePaletteFromEnv({ DEMA_PALETTE: "none", COLORTERM: "truecolor" }),
    "none",
  );
});

test("PAL-04: invalid DEMA_PALETTE falls through to normal resolution", () => {
  assert.equal(
    resolvePaletteFromEnv({ DEMA_PALETTE: "weird", COLORTERM: "truecolor" }),
    "24bit",
  );
});

test("PAL-05: NO_COLOR (any non-empty value) → none", () => {
  assert.equal(resolvePaletteFromEnv({ NO_COLOR: "1" }), "none");
  assert.equal(resolvePaletteFromEnv({ NO_COLOR: "true" }), "none");
  assert.equal(
    resolvePaletteFromEnv({ NO_COLOR: "yes", COLORTERM: "truecolor" }),
    "none",
  );
});

test("PAL-06: NO_COLOR empty string falls through (per no-color.org spec)", () => {
  // Per https://no-color.org: "if NO_COLOR is set to a non-empty value"
  // An empty string SHOULD NOT trigger no-color. Our implementation uses
  // `if (env.NO_COLOR)` which is falsy for "" → correct behavior.
  assert.equal(
    resolvePaletteFromEnv({ NO_COLOR: "", COLORTERM: "truecolor" }),
    "24bit",
  );
});

test("PAL-07: TERM=dumb → none", () => {
  assert.equal(resolvePaletteFromEnv({ TERM: "dumb" }), "none");
});

test("PAL-08: COLORTERM=truecolor → 24bit", () => {
  assert.equal(resolvePaletteFromEnv({ COLORTERM: "truecolor" }), "24bit");
});

test("PAL-09: COLORTERM=24bit → 24bit", () => {
  assert.equal(resolvePaletteFromEnv({ COLORTERM: "24bit" }), "24bit");
});

test("PAL-10: TERM=xterm-256color → 256", () => {
  assert.equal(resolvePaletteFromEnv({ TERM: "xterm-256color" }), "256");
});

test("PAL-11: TERM=screen-256color → 256", () => {
  assert.equal(resolvePaletteFromEnv({ TERM: "screen-256color" }), "256");
});

test("PAL-12: legacy TERM (xterm · screen · linux · vt100) → 256 (conservative)", () => {
  assert.equal(resolvePaletteFromEnv({ TERM: "xterm" }), "256");
  assert.equal(resolvePaletteFromEnv({ TERM: "screen" }), "256");
  assert.equal(resolvePaletteFromEnv({ TERM: "linux" }), "256");
  assert.equal(resolvePaletteFromEnv({ TERM: "vt100" }), "256");
});

test("PAL-13: empty env → 24bit default (modern terminal assumption)", () => {
  assert.equal(resolvePaletteFromEnv({}), "24bit");
});

test("PAL-14: unrecognized TERM defaults to 24bit", () => {
  assert.equal(resolvePaletteFromEnv({ TERM: "alacritty" }), "24bit");
});

test("PAL-15: case-insensitive COLORTERM match", () => {
  assert.equal(resolvePaletteFromEnv({ COLORTERM: "TrueColor" }), "24bit");
  assert.equal(resolvePaletteFromEnv({ COLORTERM: "TRUECOLOR" }), "24bit");
});

// ----- resolveFormatterOptsFromEnv integration ----------------------------

test("PAL-16: resolveFormatterOptsFromEnv exposes palette field", () => {
  const opts = resolveFormatterOptsFromEnv({ COLORTERM: "truecolor" });
  assert.equal(opts.palette, "24bit");
  assert.equal(opts.noColor, false);
  assert.equal(opts.termDumb, false);
});

test("PAL-17: NO_COLOR forces both palette=none AND noColor=true (redundant safety)", () => {
  const opts = resolveFormatterOptsFromEnv({ NO_COLOR: "1" });
  assert.equal(opts.palette, "none");
  assert.equal(opts.noColor, true);
});

test("PAL-18: TERM=dumb sets termDumb=true AND palette=none", () => {
  const opts = resolveFormatterOptsFromEnv({ TERM: "dumb" });
  assert.equal(opts.termDumb, true);
  assert.equal(opts.palette, "none");
});

test("PAL-19: DEMA_TUI_WIDTH still works alongside palette", () => {
  const opts = resolveFormatterOptsFromEnv({
    DEMA_TUI_WIDTH: "100",
    COLORTERM: "truecolor",
  });
  assert.equal(opts.width, 100);
  assert.equal(opts.palette, "24bit");
});

test("PAL-20: default (no env vars) returns sensible 24bit defaults", () => {
  const opts = resolveFormatterOptsFromEnv({});
  assert.equal(opts.palette, "24bit");
  assert.equal(opts.noColor, false);
  assert.equal(opts.termDumb, false);
  assert.equal(opts.width, 76);
});
