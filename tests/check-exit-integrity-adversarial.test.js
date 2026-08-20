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

function findIsolatedTapCommand() {
  return commands.find((entry) => {
    const args = entry[1] ?? [];
    const separator = args.indexOf("--");
    return (
      entry[0] === "node" &&
      args[0] === "scripts/ci/run-with-classifier.mjs" &&
      separator >= 0 &&
      args.slice(separator + 1).join(" ") ===
        "node --test --test-reporter=tap"
    );
  });
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
  // Positional pins, DERIVED by importing `commands` from the merged check.mjs —
  // never carried over from either side of a merge. main stood at 199/123/124.
  // This slice adds three review gates, ALL ahead of the isolated TAP command:
  // DEMA-REVERSIBLE-FILE-STEWARD-1C (index 84), UI-TRUTH-LABEL-GATE-1A (85) and
  // TRACKED-TEST-EXEC-TARGET-GUARD-1A (125, right after claim-corpus-gate). So
  // 199+3 = 202 and the isolated index moves 123 -> 126.
  // NODE0-MINIMUM-SEASON-SAVE-RESUME-1A appends one further review gate ahead of
  // the isolated TAP command: 202 -> 203, isolated 126 -> 127, coverage 127 -> 128.
  // 199+3+1 = 203 and the isolated index moves 123 -> 127. The final +1 is
  // TASK-030's public-claim receipt-binding evidence gate, and +1 for
  // NODE0-AUTHORITY-GRAPH-1A's separation-of-powers gate.
  // The guard sits ahead of the suite on purpose: it is a static scan, so it must
  // fail fast rather than behind a TAP gate that fails closed and never reaches it.
  // NODE0-RESURRECTION-CORRECTION-1B appends node0-local-season-resurrection-check
  // at index 87, again ahead of the isolated TAP command: 203 -> 204, isolated
  // 127 -> 128, coverage 128 -> 129. Positions MEASURED by importing `commands`,
  // not carried over from the previous slice's arithmetic.
  // These are exact positional snapshots and will drift again on the next gate
  // added ahead of the isolated TAP command; that coupling is this lane's to decide on.
  assert.equal(commands.length, 209);
  assert.equal(commands.indexOf(isolated), 133);
  assert.deepEqual(commands[134].slice(0, 2), ["npm", ["run", "coverage"]]);
  assert.equal(commands.length, 209);
  assert.equal(commands.indexOf(isolated), 133);
  assert.deepEqual(commands[134].slice(0, 2), ["npm", ["run", "coverage"]]);
  assert.equal(commands.length, 209);
  assert.equal(commands.indexOf(isolated), 133);
  assert.deepEqual(commands[134].slice(0, 2), ["npm", ["run", "coverage"]]);
  // 2026-08-09: NODE0-CLOSURE-INVARIANTS-1A's ledger gate is added right after
  // node0-local-closure-readiness-check, which is ahead of the isolated TAP
  // command, so 204 -> 205 and the isolated index 128 -> 129.
  // 2026-08-11: consent cutover part 3 appends legacy-consent-authority-check
  // directly after the closure-invariants gate, again ahead of the isolated TAP
  // command: 207 -> 208, isolated 131 -> 132, coverage 132 -> 133. Positions
  // MEASURED by importing `commands`, never carried over by arithmetic.
  // 2026-08-21: dema-self-eval-collect-check appended ahead of the isolated TAP
  // command: 208 -> 209, isolated 132 -> 133, coverage 133 -> 134.
  assert.equal(commands.length, 209);
  assert.equal(commands.indexOf(isolated), 133);
  assert.deepEqual(commands[134].slice(0, 2), ["npm", ["run", "coverage"]]);

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
