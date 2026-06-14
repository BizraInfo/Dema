import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  HEX,
  ANSI,
  ROLE,
  paint,
  supportsColor,
} from "../packages/core/src/theme.js";

const here = dirname(fileURLToPath(import.meta.url));
const CANON = JSON.parse(
  readFileSync(
    join(here, "..", "docs", "brand", "BIZRA_VISUAL_TOKENS.json"),
    "utf8",
  ),
);

describe("theme", () => {
  it("canon HEX values match the vendored BIZRA_VISUAL_TOKENS.json (drift-guard)", () => {
    assert.equal(HEX.gold, CANON.colors.genesis_gold.hex);
    assert.equal(HEX.navy, CANON.colors.celestial_navy.hex);
    assert.equal(HEX.originBlack, CANON.colors.origin_black.hex);
    assert.equal(HEX.white, CANON.colors.pure_white.hex);
    assert.equal(HEX.ivory, CANON.colors.ivory.hex);
    assert.equal(HEX.teal, CANON.colors.living_teal.hex);
  });

  it("non-canon semantic + neutral hexes are the documented TUI-extension values", () => {
    assert.equal(HEX.proofVerified, "#34D399");
    assert.equal(HEX.proofPending, "#FBBF24");
    assert.equal(HEX.proofFailed, "#F87171");
    assert.equal(HEX.neutral, "#9CA3AF");
  });

  it("ANSI builds correct truecolor codes from canon gold", () => {
    assert.equal(ANSI.gold, "\x1b[38;2;201;169;98m");
    assert.equal(ANSI.proofVerified, "\x1b[38;2;52;211;153m");
    assert.equal(ANSI.proofFailed, "\x1b[38;2;248;113;113m");
    assert.equal(ANSI.neutral, "\x1b[38;2;156;163;175m");
    assert.equal(ANSI.reset, "\x1b[0m");
  });

  it("ROLE maps semantic intent to ANSI codes", () => {
    assert.equal(ROLE.brand, ANSI.gold);
    assert.equal(ROLE.statusOk, ANSI.proofVerified);
    assert.equal(ROLE.statusErr, ANSI.proofFailed);
  });

  it("paint wraps text + reset when useColor true", () => {
    assert.equal(paint("x", ANSI.gold, true), "\x1b[38;2;201;169;98mx\x1b[0m");
  });

  it("paint returns plain text when useColor false", () => {
    assert.equal(paint("x", ANSI.gold, false), "x");
  });

  it("supportsColor is false when NO_COLOR is set", () => {
    assert.equal(supportsColor({ NO_COLOR: "1" }, { isTTY: true }), false);
  });

  it("supportsColor is false on a non-TTY", () => {
    assert.equal(supportsColor({}, { isTTY: false }), false);
  });
});
