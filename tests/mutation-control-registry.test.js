// MUTATION-CONTROL-REGISTRY-1A — MC-01…MC-05.
//
// The registry proves other guards are load-bearing. This proves the REGISTRY is
// — because a checker that cannot detect its own blindness is precisely the
// thing it exists to prevent, and the same "passes for the wrong reason" family
// applies to it as to everything else this campaign has repaired.
//
// The three ways it could lie, each pinned:
//   a STALE anchor silently testing nothing        (MC-02)
//   a baseline that was already red                (MC-03)
//   a syntax error read as a caught defect         (MC-04)

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MUTATION_CONTROLS,
  runMutationControls,
} from "../scripts/review/mutation-control-check.mjs";

const roots = [];
/** A minimal estate: one guarded module and one test that depends on the guard. */
function estate() {
  const root = mkdtempSync(join(tmpdir(), "mcr-"));
  roots.push(root);
  mkdirSync(join(root, "src"), { recursive: true });
  mkdirSync(join(root, "t"), { recursive: true });
  writeFileSync(
    join(root, "src/guarded.js"),
    "export function allow(v) {\n  if (v === 'unsafe') return false;\n  return true;\n}\n",
  );
  writeFileSync(
    join(root, "t/guarded.test.js"),
    [
      'import test from "node:test";',
      'import assert from "node:assert/strict";',
      'import { allow } from "../src/guarded.js";',
      'test("G-01: unsafe is refused", () => assert.equal(allow("unsafe"), false));',
      'test("G-02: safe is allowed", () => assert.equal(allow("safe"), true));',
      "",
    ].join("\n"),
  );
  return root;
}
test.after(() => roots.forEach((r) => rmSync(r, { recursive: true, force: true })));

const control = (over = {}) => ({
  id: "guard",
  file: "src/guarded.js",
  find: "  if (v === 'unsafe') return false;\n",
  replace: "",
  tests: ["t/guarded.test.js"],
  must_fail: ["G-01"],
  why: "unsafe input must be refused",
  ...over,
});

// ── MC-01 · a real guard, really proven ─────────────────────────────────────
test("MC-01: removing a load-bearing guard reddens its named test", () => {
  const [r] = runMutationControls({ extractionRoot: estate(), controls: [control()] });
  assert.equal(r.ok, true, r.reason);
  assert.deepEqual(r.reddened, ["G-01"]);
});

// ── MC-02 · THE VACUITY CHECK ON THE VACUITY CHECKER ────────────────────────
test("MC-02: an anchor that no longer exists FAILS rather than silently passing", () => {
  const [r] = runMutationControls({
    extractionRoot: estate(),
    controls: [control({ find: "  if (v === 'REFACTORED-AWAY') return false;\n" })],
  });
  // A stale control mutates nothing, so the tests stay green and the control
  // would report success forever while testing absolutely nothing.
  assert.equal(r.ok, false);
  assert.equal(r.reason, "anchor_missing");
});

// ── MC-03 · "it reddens" is meaningless if it was already red ───────────────
test("MC-03: an already-failing baseline FAILS the control", () => {
  const root = estate();
  writeFileSync(
    join(root, "t/guarded.test.js"),
    [
      'import test from "node:test";',
      'import assert from "node:assert/strict";',
      'test("G-01: unsafe is refused", () => assert.equal(1, 2));',
      "",
    ].join("\n"),
  );
  const [r] = runMutationControls({ extractionRoot: root, controls: [control()] });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "baseline_already_red");
});

// ── MC-04 · a broken module reddens everything and must not be credited ─────
test("MC-04: a mutation that breaks parsing is refused, not counted as a catch", () => {
  const [r] = runMutationControls({
    extractionRoot: estate(),
    controls: [control({ replace: "  if (((( {\n" })],
  });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "mutation_broke_the_module");
});

// ── MC-05 · the shipped registry is non-empty and fully specified ───────────
test("MC-05: every registered control names a file, an anchor and a test", () => {
  assert.ok(MUTATION_CONTROLS.length >= 8, `registry shrank to ${MUTATION_CONTROLS.length}`);
  for (const c of MUTATION_CONTROLS) {
    assert.ok(c.id && c.file && c.find && c.why, `underspecified control: ${c.id}`);
    assert.ok(c.tests.length > 0 && c.must_fail.length > 0, `control names no test: ${c.id}`);
  }
});
