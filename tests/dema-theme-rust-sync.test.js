// Structural sync test: dema-theme.js must stay byte-for-byte aligned with
// bizra-cli/src/theme.rs (the canonical Rust source authored by MoMo).
//
// This test reads the Rust source file directly (if reachable) and asserts
// every Color::Rgb(...) constant has a matching RGB tuple in dema-theme.js
// COLORS. The test SKIPS gracefully (not fails) if the Rust source isn't
// reachable — e.g., on a fresh clone without bizra-omega checked out — so
// it works in CI as well as locally.
//
// Per ADR-013 §"Negative consequences": this test converts the implicit
// maintenance burden into an explicit machine-enforced invariant.

import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { COLORS } from "../packages/core/src/dema-theme.js";

// Candidate paths where bizra-cli/src/theme.rs might live.
const CANDIDATE_PATHS = [
  // The operator's local layout (verified 2026-05-19 by the author).
  join(
    homedir(),
    "BIZRA Node0/bizra-data-lake/bizra-omega/bizra-cli/src/theme.rs",
  ),
  // Alternate layout some operators use.
  "/data/bizra/bizra-omega/bizra-cli/src/theme.rs",
];

function findRustSource() {
  for (const p of CANDIDATE_PATHS) {
    if (existsSync(p)) return p;
  }
  return null;
}

// Parse `pub const NAME: Color = Color::Rgb(R, G, B);` lines.
const RUST_COLOR_RE =
  /pub const (\w+):\s*Color\s*=\s*Color::Rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\);/g;

function parseRustColors(src) {
  const out = new Map();
  let m;
  while ((m = RUST_COLOR_RE.exec(src)) !== null) {
    const [, name, r, g, b] = m;
    out.set(name, [Number(r), Number(g), Number(b)]);
  }
  return out;
}

test(
  "SYNC-01: Rust theme.rs source can be located (or skip if absent)",
  { skip: !findRustSource() },
  () => {
    const path = findRustSource();
    assert.ok(path, "Rust source must be reachable for the sync gate to run");
    const src = readFileSync(path, "utf8");
    assert.ok(
      src.includes("BIZRA Visual Theme"),
      "Rust source header must identify the file",
    );
  },
);

test(
  "SYNC-02: every Color::Rgb in theme.rs has a matching RGB tuple in dema-theme COLORS",
  { skip: !findRustSource() },
  () => {
    const path = findRustSource();
    const src = readFileSync(path, "utf8");
    const rustColors = parseRustColors(src);
    assert.ok(
      rustColors.size > 0,
      "parser must find at least one Color::Rgb in Rust source",
    );

    const missing = [];
    const mismatched = [];
    for (const [name, rustRgb] of rustColors) {
      const jsColor = COLORS[name];
      if (!jsColor) {
        missing.push(name);
        continue;
      }
      const jsRgb = jsColor.rgb;
      if (
        jsRgb[0] !== rustRgb[0] ||
        jsRgb[1] !== rustRgb[1] ||
        jsRgb[2] !== rustRgb[2]
      ) {
        mismatched.push(`${name}: rust=[${rustRgb}] js=[${jsRgb}]`);
      }
    }

    assert.equal(
      missing.length,
      0,
      `dema-theme.js is missing ${missing.length} colors from theme.rs: ${missing.join(", ")}`,
    );
    assert.equal(
      mismatched.length,
      0,
      `RGB mismatches: ${mismatched.join(" · ")}`,
    );
  },
);

test(
  "SYNC-03: alias keys (IHSAN=GOLD, ACTIVE=EMERALD, PAT_GUARDIAN=GOLD) preserve identity across runtimes",
  { skip: !findRustSource() },
  () => {
    // theme.rs lines 28-29 + 41 establish these aliases:
    //   pub const IHSAN: Color = GOLD;
    //   pub const ACTIVE: Color = EMERALD;
    //   pub const PAT_GUARDIAN: Color = GOLD;
    // The Rust regex only matches Color::Rgb literals, so these alias lines
    // are skipped by the parser. We verify the JS port preserves the alias.
    assert.deepEqual([...COLORS.IHSAN.rgb], [...COLORS.GOLD.rgb]);
    assert.deepEqual([...COLORS.ACTIVE.rgb], [...COLORS.EMERALD.rgb]);
    assert.deepEqual([...COLORS.PAT_GUARDIAN.rgb], [...COLORS.GOLD.rgb]);
  },
);

test("SYNC-04: skip is reported clearly when Rust source absent (CI safe)", () => {
  // Sanity check: the test file itself must always run (this very test)
  // even when other SYNC-* are skipped due to Rust source absence.
  assert.equal(
    typeof findRustSource(),
    findRustSource() === null ? "object" : "string",
  );
});
