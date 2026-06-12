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

  it("only the artifact-011 sandbox failure → masked (recognized), PASS", () => {
    const log = [
      "not ok 137 - isolated preflight CLI clears preview ceremony on fresh home",
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

  it("genuinely environmental failures (by name) → masked, PASS", () => {
    const log = [
      "not ok 137 - isolated preflight CLI clears preview ceremony on fresh home",
      "not ok 200 - baseline-l1-diff rejects non-baseline_l1.v0.1 inputs",
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
      "not ok 9 - a different real failure",
      "# fail 2",
    ].join("\n");
    const r = classifyFailures(log);
    assert.equal(r.recognized.length, 1);
    assert.equal(r.unrecognized.length, 1);
    assert.equal(r.verdict, "FAIL");
  });

  it("allowlist entries each carry an id and a reason", () => {
    assert.ok(KNOWN_MASKABLE.length >= 1);
    for (const k of KNOWN_MASKABLE) {
      assert.ok(k.id && k.reason && k.pattern instanceof RegExp);
    }
  });

  it("fails closed when failures are reported but no not-ok names were captured", () => {
    // A runner error or a summary line `# fail N` with no parseable `not ok`
    // line must NOT pass as clean — the failure is real, just uncaptured.
    const r = classifyFailures("# tests 10\n# pass 9\n# fail 1\n");
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
