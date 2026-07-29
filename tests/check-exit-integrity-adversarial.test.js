import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { commands, runChecks } from "../scripts/check.mjs";
import {
  checkGateFailure,
  checkGateStart,
} from "../scripts/ci/check-gate-evidence.mjs";

const CLASSIFIER = fileURLToPath(
  new URL("../scripts/ci/classify-known-harness-failures.mjs", import.meta.url),
);
const RUNNER = fileURLToPath(
  new URL("../scripts/ci/run-with-classifier.mjs", import.meta.url),
);
const CHECK_MODULE_URL = new URL("../scripts/check.mjs", import.meta.url).href;
const GREEN_TAP = [
  "ok 1 - alpha passes",
  "1..1",
  "# tests 1",
  "# pass 1",
  "# fail 0",
].join("\n");
const MASKED_ONLY_TAP = [
  "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
  "  EROFS: read-only file system, mkdtemp '/home/x'",
  "1..1",
  "# tests 1",
  "# pass 0",
  "# fail 1",
].join("\n");

function runClassifier(logContent, extraArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), "g8-exit-adversarial-"));
  const log = join(dir, "run.log");
  writeFileSync(log, `${logContent}\n`);
  return spawnSync(
    process.execPath,
    [CLASSIFIER, "--log", log, ...extraArgs],
    { encoding: "utf8" },
  );
}

function runWithPrivateTempLog(scriptBody) {
  const dir = mkdtempSync(join(tmpdir(), "g8-temp-log-probe-"));
  const script = join(dir, "tap.mjs");
  writeFileSync(script, scriptBody);
  return spawnSync(
    process.execPath,
    [RUNNER, "--temp-log", "--", process.execPath, script],
    { encoding: "utf8" },
  );
}

function evidenceJsonl(...records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function isIsolatedTapCommand(entry) {
  const args = entry[1] ?? [];
  const separator = args.indexOf("--");
  return (
    entry[0] === "node" &&
    args[0] === "scripts/ci/run-with-classifier.mjs" &&
    separator >= 0 &&
    args.slice(separator + 1).join(" ") === "node --test --test-reporter=tap"
  );
}

function findIsolatedTapCommand(entries = commands) {
  return entries.find(isIsolatedTapCommand);
}

function isCoverageCommand(entry) {
  return entry[0] === "npm" && (entry[1] ?? []).join(" ") === "run coverage";
}

function isRotateExportBindGate(entry) {
  return (
    entry[0] === "node" &&
    (entry[1] ?? []).some(
      (arg) =>
        typeof arg === "string" &&
        arg.includes("authorship-key-rotate-export-bind-check"),
    )
  );
}

// Semantic gate-sequence invariants, asserted by SHAPE rather than by absolute
// count or index. The previous form pinned commands.length/indexOf to exact
// integers, so every unrelated gate added ahead of the isolated TAP command
// turned this test red and had to be paid for by editing the numbers — which is
// how a positional snapshot silently becomes the thing under test instead of
// the ordering policy it was meant to protect.
function assertGateSequenceInvariants(entries, label) {
  const isolatedMatches = entries.filter(isIsolatedTapCommand);
  const coverageMatches = entries.filter(isCoverageCommand);
  const exportBindMatches = entries.filter(isRotateExportBindGate);

  assert.equal(
    isolatedMatches.length,
    1,
    `${label}: exactly one isolated TAP command`,
  );
  assert.equal(
    coverageMatches.length,
    1,
    `${label}: exactly one coverage command`,
  );
  assert.equal(
    exportBindMatches.length,
    1,
    `${label}: exactly one authorship-key-rotate export-bind gate`,
  );

  const isolatedIndex = entries.indexOf(isolatedMatches[0]);
  const coverageIndex = entries.indexOf(coverageMatches[0]);
  const exportBindIndex = entries.indexOf(exportBindMatches[0]);

  assert.equal(
    coverageIndex,
    isolatedIndex + 1,
    `${label}: coverage immediately follows the isolated TAP command`,
  );
  // Policy: static scans run ahead of the TAP boundary so they fail fast rather
  // than sitting behind a gate that fails closed and never reaches them.
  assert.ok(
    exportBindIndex < isolatedIndex,
    `${label}: export-bind gate runs before the TAP/coverage boundary`,
  );
}

function runIsolatedTapThenLateGate(lateExit) {
  const dir = mkdtempSync(join(tmpdir(), "g8-composed-"));
  const innerLog = join(dir, "inner-tap.log");
  const outerLog = join(dir, "outer-check.log");
  const tapScript = join(dir, "tap-failure.mjs");
  const lateScript = join(dir, "late-gate.mjs");
  const checkScript = join(dir, "composed-check.mjs");
  writeFileSync(
    tapScript,
    `console.log("TAP version 13");
console.log("not ok 1 - isolated preflight CLI clears preview ceremony on fresh home");
console.log("  EROFS: read-only file system, mkdtemp '/home/x'");
console.log("1..1");
console.log("# tests 1");
console.log("# pass 0");
console.log("# fail 1");
process.exit(1);`,
  );
  writeFileSync(
    lateScript,
    `console.log("LATE_GATE_EXECUTED"); process.exit(${lateExit});`,
  );
  writeFileSync(
    checkScript,
    `import { runChecks } from ${JSON.stringify(CHECK_MODULE_URL)};
runChecks([
  [process.execPath, [${JSON.stringify(RUNNER)}, "--log", ${JSON.stringify(innerLog)}, "--", process.execPath, ${JSON.stringify(tapScript)}]],
  [process.execPath, [${JSON.stringify(lateScript)}]],
]);`,
  );
  return spawnSync(
    process.execPath,
    [
      RUNNER,
      "--require-check-gate-evidence",
      "--log",
      outerLog,
      "--",
      process.execPath,
      checkScript,
    ],
    { encoding: "utf8" },
  );
}

test("A1 a canonical TAP exit greater than 1 is authoritative", () => {
  const evidence = evidenceJsonl(
    checkGateStart(1),
    checkGateFailure({
      index: 0,
      command: ["node", "--test", "--test-reporter=tap"],
      exitCode: 2,
      maskPolicy: "tap_allowlist",
    }),
  );
  const r = runClassifier(MASKED_ONLY_TAP, [
    "--check-exit",
    "2",
    "--require-check-gate-evidence",
    "--check-gate-evidence",
    evidence,
  ]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /G8 (?:GATE EXIT EVIDENCE|EXIT)/);
});

test("A2 an earlier green trailer cannot complete a truncated failure", () => {
  const r = runClassifier(
    [
      GREEN_TAP,
      "TAP version 13",
      "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
      "  EROFS: read-only file system, mkdtemp '/home/x'",
    ].join("\n"),
    ["--check-exit", "1"],
  );
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /(?:truncated|incomplete|G8 GATE)/i);
});

test("A3 a named not-ok contradicting # fail 0 fails closed", () => {
  const contradictory = [
    "TAP version 13",
    "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
    "  EROFS: read-only file system, mkdtemp '/home/x'",
    "1..1",
    "# tests 1",
    "# pass 1",
    "# fail 0",
  ].join("\n");
  const r = runClassifier(contradictory, ["--check-exit", "0"]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
});

test("A4 an unnamed not-ok in a later TAP run is never invisible", () => {
  const r = runClassifier(
    [
      "TAP version 13",
      "ok 1 - inner green",
      "1..1",
      "# tests 1",
      "# pass 1",
      "# fail 0",
      "TAP version 13",
      "not ok 1",
      "1..1",
      "# tests 1",
      "# pass 0",
      "# fail 1",
    ].join("\n"),
    ["--check-exit", "0"],
  );
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /UNRECOGNIZED|uncaptured/i);
});

test("A5 # fail 2 cannot be covered by one parsed failure", () => {
  const undercounted = [
    "TAP version 13",
    "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
    "  EROFS: read-only file system, mkdtemp '/home/x'",
    "ok 2 - second point emitted",
    "1..2",
    "# tests 2",
    "# pass 0",
    "# fail 2",
  ].join("\n");
  const r = runClassifier(undercounted, ["--check-exit", "1"]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /contradicts|uncaptured/i);
});

test("A6 valid allowlisted TAP text with exit 0 fails closed", () => {
  const r = runClassifier(MASKED_ONLY_TAP, ["--check-exit", "0"]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /exact exit 1/i);
});

test("A6b malformed explicit exit evidence fails closed even for green TAP", () => {
  const r = runClassifier(GREEN_TAP, ["--check-exit", "not-a-status"]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /non-negative safe integer/i);
});

test("A6b2 a missing --check-exit operand fails closed", () => {
  const r = runClassifier(GREEN_TAP, ["--check-exit"]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /non-negative safe integer/i);
});

test("A6c one TAP run cannot borrow another run's failure count", () => {
  const crossRunContradiction = [
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
  ].join("\n");
  const r = runClassifier(crossRunContradiction, ["--check-exit", "1"]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /contradicts|uncaptured/i);
});

test("A6d a post-plan allowlisted not-ok is malformed, not maskable", () => {
  const postPlanFailure = [
    "TAP version 13",
    "ok 1 - actual point",
    "1..1",
    "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
    "  EROFS: read-only file system, mkdtemp '/home/x'",
    "# tests 1",
    "# pass 1",
    "# fail 0",
  ].join("\n");
  const r = runClassifier(postPlanFailure, ["--check-exit", "1"]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /incomplete|inconsistent run trailers/i);
});

test("A6e a pre-version allowlisted not-ok is not owned by the later run", () => {
  const preVersionFailure = [
    "not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
    "  EROFS: read-only file system, mkdtemp '/home/x'",
    "TAP version 13",
    "ok 1 - actual point",
    "1..1",
    "# tests 1",
    "# pass 1",
    "# fail 0",
  ].join("\n");
  const r = runClassifier(preVersionFailure, ["--check-exit", "1"]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /incomplete|inconsistent run trailers/i);
});

test("A6f an indented allowlisted not-ok is unrecognized", () => {
  const nestedFailure = [
    "TAP version 13",
    "ok 1 - top-level point",
    "    not ok 1 - isolated preflight CLI clears preview ceremony on fresh home",
    "      EROFS: read-only file system, mkdtemp '/home/x'",
    "1..1",
    "# tests 2",
    "# pass 2",
    "# fail 0",
  ].join("\n");
  const r = runClassifier(nestedFailure, ["--check-exit", "1"]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /UNRECOGNIZED/);
});

test("A7 direct TAP is isolated and a later authoritative gate executes", () => {
  const isolated = findIsolatedTapCommand();
  assert.ok(isolated, "canonical TAP gate needs one isolated log");
  assert.deepEqual(isolated[1].slice(0, 2), [
    "scripts/ci/run-with-classifier.mjs",
    "--temp-log",
  ]);
  assert.equal(isolated[1].includes("--log"), false);

  // The ordering policy this test exists to protect, asserted by shape.
  assertGateSequenceInvariants(commands, "check.mjs");

  // And the property the absolute pins could not express: adding an unrelated
  // valid gate ahead of the boundary must keep every invariant true without a
  // single number in this file changing. This is the regression guard against
  // re-pinning positions the next time a gate lands.
  const isolatedIndex = commands.indexOf(isolated);
  const withUnrelatedGate = [...commands];
  withUnrelatedGate.splice(isolatedIndex, 0, [
    "node",
    ["scripts/review/unrelated-example-gate.mjs"],
  ]);
  assertGateSequenceInvariants(
    withUnrelatedGate,
    "with an unrelated gate inserted before the boundary",
  );
  assert.equal(withUnrelatedGate.length, commands.length + 1);

  // Teeth. Semantic invariants are worthless if they cannot fail, so prove each
  // one rejects the shape it exists to forbid — otherwise this test would have
  // traded brittle-but-real pins for assertions that pass on anything.
  const exportBindEntry = commands.find(isRotateExportBindGate);
  const movedPastBoundary = commands.filter((e) => !isRotateExportBindGate(e));
  movedPastBoundary.push(exportBindEntry);
  assert.throws(
    () => assertGateSequenceInvariants(movedPastBoundary, "violating"),
    /before the TAP\/coverage boundary/,
    "export-bind gate after the boundary must be rejected",
  );
  assert.throws(
    () => assertGateSequenceInvariants([...commands, exportBindEntry], "dup"),
    /exactly one authorship-key-rotate export-bind gate/,
    "a duplicated export-bind gate must be rejected",
  );
  const coverageDetached = commands.filter((e) => !isCoverageCommand(e));
  coverageDetached.unshift(commands.find(isCoverageCommand));
  assert.throws(
    () => assertGateSequenceInvariants(coverageDetached, "detached coverage"),
    /coverage immediately follows the isolated TAP command/,
    "coverage not adjacent to the isolated TAP must be rejected",
  );

  const evidence = [];
  const calls = [];
  const lateFailure = Object.assign(new Error("late gate failed"), { status: 7 });
  assert.throws(
    () =>
      runChecks([isolated, ["node", ["scripts/review/late-gate.mjs"]]], {
        execute(bin, args) {
          calls.push([bin, ...args]);
          if (calls.length === 2) throw lateFailure;
        },
        log() {},
        evidence(record) {
          evidence.push(record);
        },
      }),
    (error) => error === lateFailure,
  );
  assert.equal(calls.length, 2, "the late authoritative gate must execute");
  assert.equal(evidence[1].index, 1);
  assert.equal(evidence[1].mask_policy, "authoritative");
});

test("A8 terminal tap_allowlist cannot substitute for aggregate completion", () => {
  const evidence = evidenceJsonl(
    checkGateStart(2),
    checkGateFailure({
      index: 0,
      command: ["node", "--test", "--test-reporter=tap"],
      exitCode: 1,
      maskPolicy: "tap_allowlist",
    }),
  );
  const r = runClassifier(MASKED_ONLY_TAP, [
    "--check-exit",
    "1",
    "--require-check-gate-evidence",
    "--check-gate-evidence",
    evidence,
  ]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /G8 GATE EXIT EVIDENCE/);
});

test("A9 isolated TAP noise returns to the owner and the late gate executes", () => {
  const r = runIsolatedTapThenLateGate(0);
  assert.equal(r.status, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /G8 MASKED/);
  assert.match(r.stdout, /LATE_GATE_EXECUTED/);
  assert.match(r.stdout, /aggregate check emitted start \+ complete/);
});

test("A10 isolated TAP noise plus a late failure exits nonzero", () => {
  const r = runIsolatedTapThenLateGate(7);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /G8 MASKED/);
  assert.match(r.stdout, /LATE_GATE_EXECUTED/);
  assert.match(r.stderr, /G8 NON-TAP EXIT/);
  assert.match(r.stderr, /late-gate\.mjs/);
});

test("A11 runner-owned private temp log preserves isolated masking", () => {
  const r = runWithPrivateTempLog(
    `console.log("TAP version 13");
console.log("not ok 1 - isolated preflight CLI clears preview ceremony on fresh home");
console.log("  EROFS: read-only file system, mkdtemp '/home/x'");
console.log("1..1");
console.log("# tests 1");
console.log("# pass 0");
console.log("# fail 1");
process.exit(1);`,
  );
  assert.equal(r.status, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /G8 MASKED/);
});
