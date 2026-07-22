import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { evaluateLogFreshness } from "../scripts/ci/classify-known-harness-failures.mjs";

const CLASSIFIER = fileURLToPath(
  new URL("../scripts/ci/classify-known-harness-failures.mjs", import.meta.url),
);
const TEST_TIMEOUT_MS = 30_000;

function runClassifier(logPath, extraArgs = []) {
  try {
    const stdout = execFileSync(
      process.execPath,
      [CLASSIFIER, "--log", logPath, ...extraArgs],
      {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "pipe"],
        timeout: TEST_TIMEOUT_MS,
      },
    );
    return { code: 0, output: stdout };
  } catch (e) {
    return {
      code: e.status ?? 1,
      output: `${e.stdout ?? ""}${e.stderr ?? ""}`,
    };
  }
}

// GO: G8-HARDEN-TEST-LOG-FRESHNESS
// A stale, empty, or unbound log must never classify as a clean run.
describe("G8 classifier — log freshness binding", () => {
  it("empty content is not bound", () => {
    assert.equal(evaluateLogFreshness("").bound, false);
  });

  it("whitespace-only content is not bound", () => {
    assert.equal(evaluateLogFreshness("   \n\t\n  ").bound, false);
  });

  it("content with no TAP markers is not bound", () => {
    const r = evaluateLogFreshness("Read-only file system\nunrelated text\n");
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

  it("a TAP plan line alone binds freshness but not completeness", () => {
    assert.equal(evaluateLogFreshness("1..42\nok 1 - a\n").bound, true);
  });

  it("CLI fails closed when the log file is missing", () => {
    const missing = join(tmpdir(), "g8-does-not-exist-xyz.log");
    const { code, output } = runClassifier(missing);
    assert.notEqual(code, 0);
    assert.match(output, /\[G8 FRESHNESS\]/);
  });

  it("CLI fails closed on an empty log", () => {
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

  it("CLI masks fresh valid environmental evidence only with exact exit 1", () => {
    const dir = mkdtempSync(join(tmpdir(), "g8-fresh-"));
    try {
      const logPath = join(dir, "run.log");
      writeFileSync(
        logPath,
        [
          "TAP version 13",
          "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
          "  ---",
          "  error: 'EROFS: read-only file system, mkdtemp'",
          "  ...",
          "1..1",
          "# tests 1",
          "# pass 0",
          "# fail 1",
        ].join("\n"),
      );
      const missingExit = runClassifier(logPath);
      assert.equal(missingExit.code, 1);
      assert.match(missingExit.output, /exact exit 1|no exit evidence/i);
      assert.equal(runClassifier(logPath, ["--check-exit", "1"]).code, 0);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
