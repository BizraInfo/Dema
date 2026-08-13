// TEST-PLANE-CLASSIFICATION-1A — TPC-01…TPC-07.
//
// Measured this season: the aggregate suite mixes DEVELOPMENT-HARNESS tests
// (`tests/stop-hook-output.test.js` executes the `.codex/` and `.claude/` hook
// scripts) into the same population used to qualify DEMA runtime slices. Two of
// those harness failures reproduce at base 4e6d9f40 and currently sit inside the
// number a Dema slice is judged by.
//
// THIS SLICE IS CLASSIFICATION ONLY. It declares ownership and reports lanes.
// It does NOT change `npm test`, does NOT weaken an assertion, does NOT skip or
// relocate a test, and does NOT decide what qualification means. The code under
// qualification must never grant itself its own standard — a candidate that
// moves the failing questions outside the exam has not passed the exam. TPC-06
// pins that structurally: the report carries the run's own global totals
// verbatim and emits no verdict at all.
//
// WHY ATTRIBUTION IS DERIVED, NOT SUBTRACTED. `node --test` TAP carries no file
// for a subtest, and measured here: `stop-hook-output` PASSES when run in a
// two-file selection and FAILS in the full run. So "run the harness lane alone
// and subtract" is unsound — isolation changes the outcome. Attribution must
// come from the one real full-run log, by resolving each failing subtest name
// back to the file that declares it.
//
// DEFAULT IS THE STRICT LANE. A file with no declaration is `dema`. An
// unclassified harness test therefore lands in the strict lane and fails it —
// the conservative direction. The dangerous direction is mislabelling a Dema
// test as harness to move it out of the strict lane, so TPC-02 refuses a
// `plane: harness` declaration from a file that never touches provider surface.

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import assert from "node:assert/strict";
import test from "node:test";

import {
  DEMA_PLANE,
  HARNESS_PLANE,
  classifyFiles,
  buildTestPlaneReport,
} from "../scripts/review/test-plane-report.mjs";

const REPO = fileURLToPath(new URL("..", import.meta.url));

const trackedTests = () =>
  execFileSync("git", ["ls-files", "tests/*.test.js"], { cwd: REPO, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);

const entriesFromDisk = () =>
  trackedTests().map((file) => ({ file, source: readFileSync(join(REPO, file), "utf8") }));

// A minimal TAP trailer, so fixtures exercise the same parser the real log does.
const tap = (lines, { tests, pass, fail }) =>
  ["TAP version 13", ...lines, `# tests ${tests}`, `# pass ${pass}`, `# fail ${fail}`].join("\n");

// ── TPC-01 · every tracked test resolves to a plane, and the scan is not blind ──
test("TPC-01: every tracked test file resolves to a plane, defaulting to dema", () => {
  const entries = entriesFromDisk();
  assert.ok(entries.length > 100, `control: expected the real suite, saw ${entries.length} files`);

  const { planes, violations } = classifyFiles(entries);
  assert.deepEqual(violations, [], "a declaration that cannot be honoured must be refused loudly");
  assert.equal(Object.keys(planes).length, entries.length, "every file must be classified");

  for (const [file, plane] of Object.entries(planes)) {
    assert.ok([DEMA_PLANE, HARNESS_PLANE].includes(plane), `${file} resolved to ${plane}`);
  }
  // The default must actually be the strict lane, not merely documented as one.
  const undeclared = entries.find((e) => !/^\/\/\s*plane:/m.test(e.source));
  assert.ok(undeclared, "control: expected at least one undeclared file");
  assert.equal(planes[undeclared.file], DEMA_PLANE);
});

// ── TPC-02 · a harness declaration must be earned, not asserted ──────────────
test("TPC-02: plane:harness is refused unless the file touches provider surface", () => {
  const honest = {
    file: "tests/x.test.js",
    source: '// plane: harness\nconst p = ".claude/hooks/stop.sh";\n',
  };
  assert.equal(classifyFiles([honest]).planes[honest.file], HARNESS_PLANE);

  // The dangerous direction: relabelling a Dema test to move it out of the
  // strict lane. Nothing in its body reaches provider surface.
  const mislabelled = {
    file: "tests/y.test.js",
    source: '// plane: harness\nassert.equal(demaSeasonHead().sequence, 2);\n',
  };
  const bad = classifyFiles([mislabelled]);
  assert.equal(bad.planes[mislabelled.file], DEMA_PLANE, "must fall back to the STRICT lane");
  assert.deepEqual(bad.violations, [
    { file: "tests/y.test.js", reason: "harness_declared_without_provider_surface" },
  ]);

  // And the real repo's one harness declaration is genuinely earned.
  const { planes } = classifyFiles(entriesFromDisk());
  const declared = Object.entries(planes).filter(([, p]) => p === HARNESS_PLANE).map(([f]) => f);
  assert.deepEqual(declared, ["tests/stop-hook-output.test.js"]);
});

// ── TPC-03 · a failure is attributed to the plane of the file that declares it ──
test("TPC-03: a failing subtest is attributed to its declaring file's plane", () => {
  const entries = [
    { file: "tests/a.test.js", source: '// plane: harness\nconst h=".claude/hooks/x";\ntest("alpha fails", () => {});\n' },
    { file: "tests/b.test.js", source: 'test("beta passes", () => {});\n' },
  ];
  const r = buildTestPlaneReport({
    entries,
    tap: tap(["not ok 1 - alpha fails", "ok 2 - beta passes"], { tests: 2, pass: 1, fail: 1 }),
  });
  assert.equal(r.report_derivable, true);
  assert.deepEqual(r.planes[HARNESS_PLANE].failures, ["alpha fails"]);
  assert.deepEqual(r.planes[DEMA_PLANE].failures, []);
  assert.deepEqual(r.unattributed, []);
});

// ── TPC-04 · an unattributable failure is surfaced, never dropped ────────────
test("TPC-04: a failure no file claims is UNATTRIBUTED, not silently absorbed", () => {
  const entries = [{ file: "tests/b.test.js", source: 'test("beta", () => {});\n' }];
  const r = buildTestPlaneReport({
    entries,
    tap: tap(["not ok 1 - a name no file declares"], { tests: 1, pass: 0, fail: 1 }),
  });
  assert.deepEqual(r.unattributed, ["a name no file declares"]);
  assert.deepEqual(r.planes[DEMA_PLANE].failures, [], "must not be absorbed into a lane");
  assert.deepEqual(r.planes[HARNESS_PLANE].failures, []);
  // Every failure in the log is accounted for somewhere.
  const placed =
    r.planes[DEMA_PLANE].failures.length +
    r.planes[HARNESS_PLANE].failures.length +
    r.unattributed.length;
  assert.equal(placed, r.global.fail);
});

// ── TPC-05 · ambiguous ownership is refused, not guessed ─────────────────────
test("TPC-05: a test name declared by two files is UNATTRIBUTED rather than guessed", () => {
  const entries = [
    { file: "tests/a.test.js", source: '// plane: harness\nconst h=".claude/x";\ntest("shared name", () => {});\n' },
    { file: "tests/b.test.js", source: 'test("shared name", () => {});\n' },
  ];
  const r = buildTestPlaneReport({
    entries,
    tap: tap(["not ok 1 - shared name"], { tests: 1, pass: 0, fail: 1 }),
  });
  assert.deepEqual(r.unattributed, ["shared name"]);
  assert.deepEqual(r.planes[HARNESS_PLANE].failures, [], "must not pick a lane on a coin flip");
});

// ── TPC-06 · the report may describe, never judge ────────────────────────────
test("TPC-06: the report carries the run's own totals verbatim and emits no verdict", () => {
  const entries = [{ file: "tests/a.test.js", source: 'test("alpha fails", () => {});\n' }];
  const r = buildTestPlaneReport({
    entries,
    tap: tap(["not ok 1 - alpha fails"], { tests: 9582, pass: 9577, fail: 5 }),
  });
  assert.deepEqual(r.global, { tests: 9582, pass: 9577, fail: 5 });
  assert.equal(r.qualification_verdict, null);
  assert.equal(r.boundary.decides_qualification, false);
  assert.equal(r.boundary.mutates_test_execution, false);
  // Structural, not stylistic: no key anywhere may carry a pass/fail judgment.
  const keys = JSON.stringify(Object.keys(r));
  assert.ok(!/qualified|bar_met|promote/i.test(keys), keys);
});

// ── TPC-07 · a blind report fails closed ─────────────────────────────────────
test("TPC-07: an empty or trailer-less log is refused, not reported as clean", () => {
  const entries = [{ file: "tests/a.test.js", source: 'test("alpha", () => {});\n' }];
  for (const bad of ["", "TAP version 13\nok 1 - alpha\n"]) {
    const r = buildTestPlaneReport({ entries, tap: bad });
    assert.equal(r.report_derivable, false, `blind input produced a report: ${JSON.stringify(bad)}`);
    assert.equal(r.reason, "tap_totals_unreadable");
  }
  // Non-vacuity: the same parser DOES derive a report from a well-formed log.
  const good = buildTestPlaneReport({
    entries,
    tap: tap(["ok 1 - alpha"], { tests: 1, pass: 1, fail: 0 }),
  });
  assert.equal(good.report_derivable, true);
});
