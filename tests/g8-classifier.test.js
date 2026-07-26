import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  classifyFailures,
  KNOWN_MASKABLE,
} from "../scripts/ci/classify-known-harness-failures.mjs";

describe("G8 classifier — hardened (per-failure allowlist)", () => {
  it("clean run (0 fail, 0 not-ok) → PASS", () => {
    const r = classifyFailures(
      "TAP version 13\nok 1 - green\n1..1\n# tests 1\n# pass 1\n# fail 0\n",
    );
    assert.equal(r.cleanRun, true);
    assert.equal(r.verdict, "PASS");
    assert.equal(r.unrecognized.length, 0);
  });

  it("only the artifact-011 sandbox failure (with EROFS cause) → masked (recognized), PASS", () => {
    const log = [
      "TAP version 13",
      "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
      "  ---",
      "  error: 'EROFS: read-only file system, mkdtemp'",
      "  ...",
      "1..1",
      "# tests 1",
      "# pass 0",
      "# fail 1",
    ].join("\n");
    const r = classifyFailures(log);
    assert.equal(r.recognized.length, 1);
    assert.equal(r.recognized[0].id, "artifact_011_eros_sandbox");
    assert.equal(r.unrecognized.length, 0);
    assert.equal(r.verdict, "PASS");
  });

  it("REGRESSION GUARD: a real failure is NOT masked just because known signature strings appear in passing output", () => {
    // The old classifier matched signature strings ANYWHERE + count<=2 and would
    // have masked this. The hardened one matches the actual `not ok` line.
    const log = [
      "ok 1 - integration check passes on current command, docs, smoke, and test matrix wiring",
      "ok 2 - baseline-l1-diff rejects non-baseline_l1.v0.1 inputs",
      "not ok 5 - some brand new real bug surfaced",
      "# tests 6",
      "# pass 5",
      "# fail 1",
    ].join("\n");
    const r = classifyFailures(log);
    assert.equal(r.recognized.length, 0);
    assert.equal(r.unrecognized.length, 1);
    assert.equal(r.unrecognized[0].name, "some brand new real bug surfaced");
    assert.equal(r.verdict, "FAIL");
  });

  it("genuinely environmental failures (allowlisted name + env cause in block) → masked, PASS", () => {
    const log = [
      "TAP version 13",
      "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
      "  ---",
      "  error: 'EROFS: read-only file system'",
      "  ...",
      "not ok 2 - baseline-l1-diff emits canonical schema + truth label + snapshot_diff mode",
      "  ---",
      "  error: 'ENOENT: no such file or directory, open /tmp/baseline-diff-x/artifact.json'",
      "  ...",
      "1..2",
      "# tests 2",
      "# pass 0",
      "# fail 2",
    ].join("\n");
    const r = classifyFailures(log);
    assert.equal(r.recognized.length, 2);
    assert.equal(r.unrecognized.length, 0);
    assert.equal(r.verdict, "PASS");
  });

  it("integration-check failures are NOT maskable (they mean real doc/wiring drift)", () => {
    const log = [
      "not ok 1433 - integration check passes on current command, docs, smoke, and test matrix wiring",
      "# fail 1",
    ].join("\n");
    const r = classifyFailures(log);
    assert.equal(r.unrecognized.length, 1);
    assert.equal(r.verdict, "FAIL");
  });

  it("mixed recognized + unrecognized → FAIL", () => {
    const log = [
      "not ok 137 - isolated preflight CLI clears preview ceremony on fresh home",
      "  ---",
      "  error: 'EROFS: read-only file system'",
      "  ...",
      "not ok 9 - a different real failure",
      "  ---",
      "  error: 'AssertionError: values are not equal'",
      "  ...",
      "# fail 2",
    ].join("\n");
    const r = classifyFailures(log);
    assert.equal(r.recognized.length, 1);
    assert.equal(r.unrecognized.length, 1);
    assert.equal(r.verdict, "FAIL");
  });

  it("allowlist entries each carry an id, a reason, a name pattern, and a cause signature", () => {
    assert.ok(KNOWN_MASKABLE.length >= 1);
    for (const k of KNOWN_MASKABLE) {
      assert.ok(k.id && k.reason && k.pattern instanceof RegExp && k.cause instanceof RegExp);
    }
  });

  it("fails closed when failures are reported but no not-ok names were captured", () => {
    // A runner error or a summary line `# fail N` with no parseable `not ok`
    // line must NOT pass as clean — the failure is real, just uncaptured.
    const r = classifyFailures("# tests 10\n# pass 9\n# fail 1\n");
    assert.equal(r.verdict, "FAIL");
  });

  it("fails closed when a top-level not-ok contradicts # fail 0", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
        "  EROFS: read-only file system, mkdtemp '/home/x'",
        "1..1",
        "# tests 1",
        "# pass 1",
        "# fail 0",
      ].join("\n"),
    );
    assert.equal(r.verdict, "FAIL");
    assert.ok(r.inconsistentFailureCount > 0);
  });

  it("fails closed when # fail reports more failures than were parsed", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
        "  EROFS: read-only file system, mkdtemp '/home/x'",
        "ok 2 - second point emitted",
        "1..2",
        "# tests 2",
        "# pass 0",
        "# fail 2",
      ].join("\n"),
    );
    assert.equal(r.uncapturedFailures, 1);
    assert.equal(r.verdict, "FAIL");
  });

  it("fails closed when an earlier complete TAP run precedes a truncated one", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "ok 1 - green",
        "1..1",
        "# tests 1",
        "# pass 1",
        "# fail 0",
        "TAP version 13",
        "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
        "  EROFS: read-only file system, mkdtemp '/home/x'",
      ].join("\n"),
    );
    assert.equal(r.complete, false);
    assert.equal(r.verdict, "FAIL");
  });

  it("does not let a trailer before the final not-ok complete that failure", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "1..1",
        "# tests 1",
        "# pass 0",
        "# fail 1",
        "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
        "  EROFS: read-only file system, mkdtemp '/home/x'",
      ].join("\n"),
    );
    assert.equal(r.complete, false);
    assert.equal(r.verdict, "FAIL");
  });

  it("binds failure counts per TAP run instead of balancing them globally", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
        "  EROFS: read-only file system, mkdtemp '/home/x'",
        "1..1",
        "# tests 1",
        "# pass 1",
        "# fail 0",
        "TAP version 13",
        "ok 1 - second run body",
        "1..1",
        "# tests 1",
        "# pass 0",
        "# fail 1",
      ].join("\n"),
    );
    assert.equal(r.inconsistentFailureCount, 2);
    assert.equal(r.verdict, "FAIL");
  });

  it("rejects a top-level not-ok injected after the run plan", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "ok 1 - actual point",
        "1..1",
        "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
        "  EROFS: read-only file system, mkdtemp '/home/x'",
        "# tests 1",
        "# pass 1",
        "# fail 0",
      ].join("\n"),
    );
    assert.equal(r.complete, false);
    assert.equal(r.verdict, "FAIL");
  });

  it("rejects a top-level not-ok before a versioned run", () => {
    const r = classifyFailures(
      [
        "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
        "  EROFS: read-only file system, mkdtemp '/home/x'",
        "TAP version 13",
        "ok 1 - actual point",
        "1..1",
        "# tests 1",
        "# pass 1",
        "# fail 0",
      ].join("\n"),
    );
    assert.equal(r.complete, false);
    assert.equal(r.verdict, "FAIL");
  });

  it("never allowlists an indented nested not-ok", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "ok 1 - top-level point",
        "    not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
        "      EROFS: read-only file system, mkdtemp '/home/x'",
        "1..1",
        "# tests 2",
        "# pass 2",
        "# fail 0",
      ].join("\n"),
    );
    assert.equal(r.recognized.length, 0);
    assert.equal(r.unrecognized.length, 1);
    assert.equal(r.verdict, "FAIL");
  });

  it("parses a bare top-level not-ok as an unrecognized failure", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "not ok 1",
        "1..1",
        "# tests 1",
        "# pass 0",
        "# fail 1",
      ].join("\n"),
    );
    assert.equal(r.notOk.length, 1);
    assert.equal(r.unrecognized.length, 1);
    assert.equal(r.verdict, "FAIL");
  });

  it("requires a coherent full TAP trailer, not one plan or summary field", () => {
    for (const partial of ["1..1\n", "# tests 1\n", "# fail 0\n"]) {
      const r = classifyFailures(partial);
      assert.equal(r.complete, false, partial);
      assert.equal(r.verdict, "FAIL", partial);
    }
  });

  it("fails when the plan declares a top-level TAP point that was never emitted", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "ok 1 - only emitted test",
        "1..2",
        "# tests 2",
        "# pass 1",
        "# fail 0",
      ].join("\n"),
    );
    assert.equal(r.complete, false);
    assert.equal(r.verdict, "FAIL");
  });

  // PROOF-GATE-TEETH-HARDENING-1A · defect 2 (cause-bound masking)
  // The old classifier masked by test NAME alone: pattern /baseline-l1-diff/i
  // matched ALL baseline-l1-diff tests — including correctness tests like
  // input-validation and the 16-key constitutional boundary. A genuine
  // regression in one of those would be silently masked. Masking must now
  // require the environmental CAUSE signature in the failure's own TAP block.
  it("DEFECT-2: a baseline-l1-diff CORRECTNESS regression (no env cause in block) is NOT masked", () => {
    const log = [
      "not ok 299 - baseline-l1-diff rejects non-baseline_l1.v0.1 inputs",
      "  ---",
      "  error: 'Expected the function to throw but it returned normally'",
      "  code: 'ERR_ASSERTION'",
      "  ...",
      "# tests 300",
      "# pass 299",
      "# fail 1",
    ].join("\n");
    const r = classifyFailures(log);
    assert.equal(r.recognized.length, 0, "correctness regression must not be masked");
    assert.equal(r.unrecognized.length, 1);
    assert.equal(r.verdict, "FAIL");
  });

  it("DEFECT-2: a failure WITH the environmental cause in its block IS masked", () => {
    const log = [
      "TAP version 13",
      "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
      "  ---",
      "  error: 'EROFS: read-only file system, mkdtemp'",
      "  ...",
      "1..1",
      "# tests 1",
      "# pass 0",
      "# fail 1",
    ].join("\n");
    const r = classifyFailures(log);
    assert.equal(r.recognized.length, 1, "true environmental failure should still be masked");
    assert.equal(r.recognized[0].id, "artifact_011_eros_sandbox");
    assert.equal(r.verdict, "PASS");
  });

  // PROOF-GATE-TEETH-HARDENING-1A · defect 3 (completeness / false-green-on-crash)
  // A run that crashed mid-way emits some `ok` lines but no TAP plan (1..N) and
  // no `# tests/# fail` summary. The old classifier saw 0 fail + 0 not-ok and
  // reported a CLEAN run (exit 0) — a false green. A run is only clean if it
  // also COMPLETED.
  it("DEFECT-3: a truncated/crashed run (ok lines, no plan or summary) FAILS, not false-green clean", () => {
    const log = ["ok 1 - a", "ok 2 - b", "ok 3 - c"].join("\n");
    const r = classifyFailures(log);
    assert.equal(r.complete, false);
    assert.equal(r.cleanRun, false, "an incomplete run is not a clean run");
    assert.equal(r.verdict, "FAIL");
  });

  it("DEFECT-3: a coherent full Node TAP trailer is recognized as complete", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "ok 1 - a",
        "ok 2 - b",
        "1..2",
        "# tests 2",
        "# pass 2",
        "# fail 0",
      ].join("\n"),
    );
    assert.equal(r.complete, true);
    assert.equal(r.cleanRun, true);
    assert.equal(r.verdict, "PASS");
  });

  it("accepts Node trailers where nested tests make # tests exceed the top-level plan", () => {
    const r = classifyFailures(
      [
        "TAP version 13",
        "ok 1 - top-level suite",
        "1..1",
        "# tests 2",
        "# pass 2",
        "# fail 0",
      ].join("\n"),
    );
    assert.equal(r.complete, true);
    assert.equal(r.verdict, "PASS");
  });

  it("coverage threshold errors FAIL even when TAP reports zero failed tests", () => {
    const log = [
      "TAP version 13",
      "ok 1 - release readiness",
      "1..1",
      "# tests 1",
      "# pass 1",
      "# fail 0",
      "# Error: 84.05% branch coverage does not meet threshold of 85%.",
      "# start of coverage report",
      "# all files | 95.43 | 84.05 | 97.66 |",
      "# end of coverage report",
    ].join("\n");
    const r = classifyFailures(log);
    assert.equal(r.cleanRun, false);
    assert.equal(r.coverageThresholdFailures.length, 1);
    assert.equal(r.verdict, "FAIL");
  });

  it("parses not-ok lines in linear time (regression guard: no polynomial ReDoS)", () => {
    // The prior `(.+?)\s*$` regex backtracked O(n^2) on a long run of spaces
    // before a non-space at line end (~4s at 60k spaces — measured). The linear
    // `(.+)$`+trim parses instantly. 60k gives a wide margin vs the 500ms bound
    // even with JIT warmup (vulnerable ~4s, linear ~0ms).
    const crafted = "not ok 1 - " + " ".repeat(60000) + "x";
    const t0 = Date.now();
    const r = classifyFailures(crafted);
    const elapsed = Date.now() - t0;
    assert.ok(elapsed < 500, `parse took ${elapsed}ms — ReDoS regression`);
    assert.equal(r.notOk[0].name, "x"); // name extracted + trimmed
  });
});
