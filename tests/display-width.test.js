import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { displayWidth, padToWidth } from "../packages/core/src/display-width.js";

// DISPLAY-WIDTH — column arithmetic for terminal surfaces.
//
// The defect this exists to prevent: `String.prototype.length` counts UTF-16
// code units, but a terminal column is a rendered cell. Arabic tashkeel are
// non-spacing marks — real code points that occupy zero columns — so `.length`
// over-counts every vocalised label and shifts every column to its right.
//
// Before this module, four surfaces each did their own arithmetic:
// doctor-dashboard.js:249 (nothing stripped), dema-realm-home.js:263 and
// node0-mumu-cockpit.js:65 (ANSI stripped, marks not). None was correct for
// Arabic. This is the single primitive they can converge on.

describe("displayWidth", () => {
  it("counts Latin text as one column per character", () => {
    assert.equal(displayWidth("Activation gate"), 15);
    assert.equal(displayWidth(""), 0);
  });

  it("counts unvocalised Arabic unchanged — the current labels must not move", () => {
    // Every shipped doctor label today is mark-free. If this changes, the fix
    // stopped being a no-op for existing output and needs re-review.
    assert.equal(displayWidth("بوابة التفعيل"), 13);
    assert.equal(displayWidth("الجاهزية"), 8);
  });

  it("excludes Arabic non-spacing marks, which occupy zero columns", () => {
    assert.equal("المُقَرْنَص".length, 11); // what .length wrongly reports
    assert.equal(displayWidth("المُقَرْنَص"), 7); // what the terminal renders
    assert.equal(displayWidth("التَّوْشيح"), 7);
    assert.equal(displayWidth("على خُطى بيت الحكمة"), 18);
  });

  it("excludes ANSI SGR sequences, which are invisible", () => {
    assert.equal(displayWidth("\x1b[36mready\x1b[0m"), 5);
    assert.equal(displayWidth("\x1b[38;2;201;169;98mBIZRA\x1b[0m"), 5);
  });

  it("excludes directional controls (RLM/LRM/FSI/PDI) — all zero-width", () => {
    // The dirMark idiom already prepends U+200F; it must not consume a column.
    assert.equal(displayWidth("‏الجاهزية"), 8);
    assert.equal(displayWidth("⁨BLOCKED⁩"), 7);
  });

  it("is never negative and tolerates non-strings by coercion", () => {
    assert.equal(displayWidth(null), 0);
    assert.equal(displayWidth(undefined), 0);
    assert.equal(displayWidth(42), 2);
  });
});

describe("padToWidth", () => {
  it("pads to the target column count using rendered width, not .length", () => {
    // The regression: a vocalised label padded by .length lands 4 columns short.
    assert.equal(padToWidth("المُقَرْنَص", 10), "المُقَرْنَص" + "   ");
    assert.equal(padToWidth("abc", 5), "abc  ");
  });

  it("returns the string unchanged when already at or over target", () => {
    assert.equal(padToWidth("abcdef", 3), "abcdef");
    assert.equal(padToWidth("abc", 3), "abc");
  });
});
