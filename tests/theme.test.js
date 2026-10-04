import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  HEX,
  ANSI,
  ROLE,
  SCALE,
  TEXTURE,
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

  it("vendored canon stays a faithful copy of upstream (v0.2, no local scales)", () => {
    // This file is a vendored copy of bizra-data-lake's canon. Dema is the face,
    // not the whole system, so it must not promote BIZRA-wide brand canon
    // locally. If this ever reads 0.3, upstream ratified it — not this repo.
    assert.equal(CANON.version, "0.2");
    assert.equal(CANON.scales, undefined);
  });

  it("SCALE is anchored to canon: the ramp cannot drift off the brand colors", () => {
    // The ground ramp is an extension, but it is not free-floating — it brackets
    // the two canon surface colors. origin_black is step 2 and celestial_navy is
    // step 4, so any edit to canon that moves them fails here.
    assert.equal(SCALE.ground.length, 5);
    assert.equal(SCALE.ground[2], CANON.colors.origin_black.hex);
    assert.equal(SCALE.ground[4], CANON.colors.celestial_navy.hex);
    // Gold ramp is rooted on genesis_gold; steps 1-2 are highlight lifts only.
    assert.equal(SCALE.gold.length, 3);
    assert.equal(SCALE.gold[0], CANON.colors.genesis_gold.hex);
    assert.equal(SCALE.paper.length, 3);
  });

  it("TEXTURE encodes truth state as glyph weight, not as a word", () => {
    // The identity move: proven surfaces render solid, unproven render stippled.
    // Direction-agnostic by construction — it survives RTL where a bracketed
    // label does not.
    assert.equal(TEXTURE.measured, "█");
    assert.equal(TEXTURE.preview, "░");
    assert.notEqual(TEXTURE.measured, TEXTURE.preview);
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

  it("supportsColor honors the DEMA_NO_COLOR override", () => {
    assert.equal(supportsColor({ DEMA_NO_COLOR: "1" }, { isTTY: true }), false);
  });

  it("supportsColor: empty NO_COLOR does NOT suppress color (no-color.org spec)", () => {
    assert.equal(supportsColor({ NO_COLOR: "" }, { isTTY: true }), true);
  });

  it("supportsColor is false when the stream is null/absent", () => {
    assert.equal(supportsColor({}, null), false);
  });

  it("paint default useColor arg resolves via supportsColor() (TTY-independent)", () => {
    // Don't assert a TTY-dependent literal; assert the default-arg wiring:
    // paint(text, code) must equal paint(text, code, supportsColor()).
    assert.equal(paint("x", ANSI.gold), paint("x", ANSI.gold, supportsColor()));
  });
});
