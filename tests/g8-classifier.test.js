import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  classifyFailures,
  evaluateLogFreshness,
  KNOWN_MASKABLE,
} from "../scripts/ci/classify-known-harness-failures.mjs";

const CLASSIFIER = fileURLToPath(
  new URL("../scripts/ci/classify-known-harness-failures.mjs", import.meta.url),
);

// Run the classifier CLI against a --log path; capture exit code + combined output.
function runClassifier(logPath) {
  try {
    const stdout = execFileSync("node", [CLASSIFIER, "--log", logPath], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { code: 0, output: stdout };
  } catch (e) {
    return {
      code: e.status ?? 1,
      output: `${e.stdout ?? ""}${e.stderr ?? ""}`,
    };
  }
}

describe("G8 classifier — hardened (per-failure allowlist)", () => {
  it("clean run (0 fail, 0 not-ok) → PASS", () => {
    const r = classifyFailures("# tests 10\n# pass 10\n# fail 0\n");
    assert.equal(r.cleanRun, true);
    assert.equal(r.verdict, "PASS");
    assert.equal(r.unrecognized.length, 0);
  });

  it("only the artifact-011 sandbox failure (with EROFS cause) → masked (recognized), PASS", () => {
    const log = [
      "not ok 137 - isolated preflight CLI clears preview ceremony on fresh home",
      "  ---",
      "  error: 'EROFS: read-only file system, mkdtemp'",
      "  ...",
      "# tests 4496",
      "# pass 4495",
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
      "not ok 137 - isolated preflight CLI clears preview ceremony on fresh home",
      "  ---",
      "  error: 'EROFS: read-only file system'",
      "  ...",
      "not ok 200 - baseline-l1-diff emits canonical schema + truth label + snapshot_diff mode",
      "  ---",
      "  error: 'ENOENT: no such file or directory, open /tmp/baseline-diff-x/artifact.json'",
      "  ...",
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
      "not ok 137 - isolated preflight CLI clears preview ceremony on fresh home",
      "  ---",
      "  error: 'EROFS: read-only file system, mkdtemp'",
      "  ...",
      "# tests 4496",
      "# pass 4495",
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

  it("DEFECT-3: a complete run with a TAP plan line (1..N, N>0) is recognized as complete", () => {
    const r = classifyFailures(["TAP version 13", "ok 1 - a", "ok 2 - b", "1..2"].join("\n"));
    assert.equal(r.complete, true);
    assert.equal(r.cleanRun, true);
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

// GO: G8-HARDEN-TEST-LOG-FRESHNESS
// Law: a verifier must verify its evidence freshness before verifying the result.
// A stale/empty/unbound log must FAIL CLOSED — never be classified as a clean run.
describe("G8 classifier — log freshness binding", () => {
  it("empty content is not bound (tee failed → no captured output)", () => {
    const r = evaluateLogFreshness("");
    assert.equal(r.bound, false);
  });

  it("whitespace-only content is not bound", () => {
    const r = evaluateLogFreshness("   \n\t\n  ");
    assert.equal(r.bound, false);
  });

  it("content with no TAP markers is not bound (stale/garbage/truncated)", () => {
    const r = evaluateLogFreshness(
      "Read-only file system\nsome unrelated text\n",
    );
    assert.equal(r.bound, false);
  });

  it("a real node --test summary is bound", () => {
    const log = [
      "ok 1 - something passed",
      "not ok 2 - something failed",
      "# tests 2",
      "# pass 1",
      "# fail 1",
    ].join("\n");
    assert.equal(evaluateLogFreshness(log).bound, true);
  });

  it("a TAP plan line alone is bound", () => {
    assert.equal(evaluateLogFreshness("1..42\nok 1 - a\n").bound, true);
  });

  it("CLI fails closed (exit 1 + freshness message) when the log file is missing", () => {
    const missing = join(tmpdir(), "g8-does-not-exist-xyz.log");
    const { code, output } = runClassifier(missing);
    assert.notEqual(code, 0);
    assert.match(output, /\[G8 FRESHNESS\]/);
  });

  it("CLI fails closed on an EMPTY log instead of reporting a clean run (the stale-/tmp trap)", () => {
    const dir = mkdtempSync(join(tmpdir(), "g8-fresh-"));
    try {
      const empty = join(dir, "empty.log");
      writeFileSync(empty, "");
      const { code, output } = runClassifier(empty);
      assert.notEqual(code, 0);
      assert.match(output, /\[G8 FRESHNESS\]/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("CLI still classifies a fresh, valid log correctly (artifact-011 only → exit 0)", () => {
    const dir = mkdtempSync(join(tmpdir(), "g8-fresh-"));
    try {
      const logPath = join(dir, "run.log");
      writeFileSync(
        logPath,
        [
          "not ok 137 - isolated preflight CLI clears preview ceremony on fresh home",
          "  ---",
          "  error: 'EROFS: read-only file system, mkdtemp'",
          "  ...",
          "# tests 4503",
          "# pass 4502",
          "# fail 1",
        ].join("\n"),
      );
      const { code } = runClassifier(logPath);
      assert.equal(code, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
