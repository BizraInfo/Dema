import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// CHECK-EXIT-INTEGRITY-1B proof contract.
//
// Defect (audit 2026-07-19, finding rank 2, reproduced by the frozen 07-16
// audit): the npm scripts ran `cmd | tee log; classifier --log log` — the
// semicolon hands the FINAL exit to the classifier, which reads only TAP. A
// late NON-TAP gate failure after a green TAP run therefore produced exit 0:
// failure laundered into progress. This contract proves the laundering path is
// closed while every existing masking behavior is preserved.

const CLASSIFIER = fileURLToPath(
  new URL("../scripts/ci/classify-known-harness-failures.mjs", import.meta.url),
);
const RUNNER = fileURLToPath(
  new URL("../scripts/ci/run-with-classifier.mjs", import.meta.url),
);

const GREEN_TAP = [
  "ok 1 - alpha passes",
  "1..1",
  "# tests 1",
  "# pass 1",
  "# fail 0",
].join("\n");

// Matches KNOWN_MASKABLE artifact_011_eros_sandbox: name pattern + EROFS cause
// inside the diagnostic block.
const MASKED_ONLY_TAP = [
  "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
  "  EROFS: read-only file system, mkdtemp '/home/x'",
  "1..1",
  "# tests 1",
  "# pass 0",
  "# fail 1",
].join("\n");

const UNRECOGNIZED_TAP = [
  "not ok 1 - some brand new real failure",
  "  Error: boom",
  "1..1",
  "# tests 1",
  "# fail 1",
].join("\n");

function runClassifier(logContent, extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), "g8-exit-"));
  const log = join(dir, "run.log");
  writeFileSync(log, logContent + "\n");
  return spawnSync(
    process.execPath,
    [CLASSIFIER, "--log", log, ...extraArgs],
    { encoding: "utf8" },
  );
}

function runRunner(fakeScriptBody) {
  const dir = mkdtempSync(join(tmpdir(), "g8-runner-"));
  const log = join(dir, "run.log");
  const script = join(dir, "fake-gate.mjs");
  writeFileSync(script, fakeScriptBody);
  return spawnSync(
    process.execPath,
    [RUNNER, "--log", log, "--", process.execPath, script],
    { encoding: "utf8" },
  );
}

// ── classifier: --check-exit contract ──

test("T1 green TAP + nonzero command exit fails closed (the laundering path)", () => {
  const r = runClassifier(GREEN_TAP, ["--check-exit", "1"]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /exited 1/);
});

test("T2 green TAP + zero command exit stays green", () => {
  const r = runClassifier(GREEN_TAP, ["--check-exit", "0"]);
  assert.equal(r.status, 0, r.stderr);
});

test("T3 masked-only environmental failure still masks under nonzero exit", () => {
  const r = runClassifier(MASKED_ONLY_TAP, ["--check-exit", "1"]);
  assert.equal(r.status, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /G8 MASKED/);
});

test("T4 unrecognized failure fails closed regardless of --check-exit", () => {
  const r = runClassifier(UNRECOGNIZED_TAP, ["--check-exit", "1"]);
  assert.equal(r.status, 1);
  assert.match(r.stderr, /UNRECOGNIZED/);
});

test("T5 without --check-exit the existing contract is unchanged (green log passes)", () => {
  const r = runClassifier(GREEN_TAP);
  assert.equal(r.status, 0, r.stderr);
});

// ── runner: end-to-end exit preservation ──

test("T6 runner: green TAP then process.exit(1) yields nonzero final exit", () => {
  const r = runRunner(
    `console.log("ok 1 - alpha passes");
console.log("1..1");
console.log("# tests 1");
console.log("# pass 1");
console.log("# fail 0");
process.exit(1);`,
  );
  assert.notEqual(r.status, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
});

test("T7 runner: fully green run passes through as exit 0", () => {
  const r = runRunner(
    `console.log("ok 1 - alpha passes");
console.log("1..1");
console.log("# tests 1");
console.log("# pass 1");
console.log("# fail 0");
process.exit(0);`,
  );
  assert.equal(r.status, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
});

test("T8 runner: masked-only environmental failure still exits 0 end-to-end", () => {
  const r = runRunner(
    `console.log("not ok 1 - isolated preflight CLI clears preview ceremony on fresh home");
console.log("  EROFS: read-only file system, mkdtemp '/home/x'");
console.log("1..1");
console.log("# tests 1");
console.log("# fail 1");
process.exit(1);`,
  );
  assert.equal(r.status, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
});

test("T9 package.json routes check/test/coverage through the runner (no bare semicolon classifier)", () => {
  const pkg = JSON.parse(
    spawnSync(process.execPath, ["-e", "console.log(require('fs').readFileSync('package.json','utf8'))"], {
      cwd: join(fileURLToPath(new URL("..", import.meta.url))),
      encoding: "utf8",
    }).stdout,
  );
  for (const name of ["check", "test", "coverage"]) {
    assert.match(pkg.scripts[name], /run-with-classifier\.mjs/, `${name} must use the runner`);
    assert.ok(!pkg.scripts[name].includes("; node scripts/ci/classify"), `${name} must not discard the real exit with a semicolon`);
  }
});
