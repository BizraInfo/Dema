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

const CLASSIFIER_ENTRY = "scripts/ci/run-with-classifier.mjs";

// The TAP/coverage boundary is check-habitat infrastructure, so it is identified
// by SHAPE and ADJACENCY — never by absolute command count or array index.
//
// Position-based identification made the command list effectively append-only:
// any gate added ahead of the boundary, and any legitimate runtime flag added to
// the child command, broke this test for a reason unrelated to the ordering law
// it protects, and the only way to pay for it was editing a literal. That turns
// the snapshot into the thing under test instead of the policy.
//
// These predicates carry no knowledge of which gates exist. Adding, removing or
// reordering unrelated gates ahead of the boundary requires no change here.

// Structural identity of a classifier-wrapped child command: the child argv
// after `--`, with the child executable removed — or null if this entry is not
// a classifier wrapper spawning node.
function classifierChildArgv(entry) {
  if (!Array.isArray(entry) || entry[0] !== "node") return null;
  const args = entry[1];
  if (!Array.isArray(args) || args[0] !== CLASSIFIER_ENTRY) return null;
  const separator = args.indexOf("--");
  if (separator < 0) return null;
  const child = args.slice(separator + 1);
  if (child[0] !== "node") return null;
  return child.slice(1);
}

// Recognise the isolated TAP boundary. Node runtime flags may sit between the
// child `node` and `--test`; their presence or order carries no meaning here.
// Containing the word "test" is NOT sufficient — the classifier wrapper, a node
// child, `--test` and the TAP reporter must all be present.
function isIsolatedTapBoundary(entry) {
  const argv = classifierChildArgv(entry);
  if (!argv) return false;
  return argv.includes("--test") && argv.includes("--test-reporter=tap");
}

// Recognise coverage by its own command identity, not by where it sits.
function isCoverageCommand(entry) {
  return (
    Array.isArray(entry) &&
    entry[0] === "npm" &&
    Array.isArray(entry[1]) &&
    entry[1].join(" ") === "run coverage"
  );
}

function findIsolatedTapCommand(entries = commands) {
  return entries.find(isIsolatedTapBoundary);
}

// The boundary law, asserted by shape. Fails loudly on every malformed or
// duplicated form; see the dedicated teeth test below.
function assertTapBoundaryShape(entries, label) {
  const boundaries = entries.filter(isIsolatedTapBoundary);
  const coverages = entries.filter(isCoverageCommand);
  assert.equal(
    boundaries.length,
    1,
    `${label}: exactly one isolated TAP boundary`,
  );
  assert.equal(coverages.length, 1, `${label}: exactly one coverage command`);
  assert.equal(
    isCoverageCommand(boundaries[0]),
    false,
    `${label}: the boundary is not the coverage command`,
  );
  assert.equal(
    entries.indexOf(coverages[0]),
    entries.indexOf(boundaries[0]) + 1,
    `${label}: coverage immediately follows the isolated TAP boundary`,
  );
}

// Add a legitimate Node runtime flag to the boundary's child command.
function withChildRuntimeFlag(entries, flag) {
  return entries.map((entry) => {
    if (!isIsolatedTapBoundary(entry)) return entry;
    const args = [...entry[1]];
    args.splice(args.indexOf("--") + 2, 0, flag);
    return [entry[0], args];
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

  // The ordering law, by shape. No absolute count or index carries authority.
  assertTapBoundaryShape(commands, "check.mjs");

  // A gate may enter ahead of the boundary without editing anything here.
  const withGate = [...commands];
  withGate.splice(commands.indexOf(isolated), 0, [
    "node",
    ["scripts/review/unrelated-example-gate.mjs"],
  ]);
  assertTapBoundaryShape(withGate, "with an unrelated gate inserted");
  assert.equal(withGate.length, commands.length + 1);

  // A legitimate child Node runtime flag preserves boundary recognition.
  const withFlag = withChildRuntimeFlag(commands, "--experimental-vm-modules");
  assertTapBoundaryShape(withFlag, "with a child runtime flag");
  assert.ok(
    classifierChildArgv(findIsolatedTapCommand(withFlag)).includes(
      "--experimental-vm-modules",
    ),
    "the flag must actually be present in the recognised child argv",
  );

  // Reordering unrelated gates ahead of the boundary is irrelevant to the law.
  const boundaryAt = commands.indexOf(isolated);
  const reordered = [
    ...commands.slice(0, boundaryAt).reverse(),
    ...commands.slice(boundaryAt),
  ];
  assertTapBoundaryShape(reordered, "with pre-boundary gates reordered");

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

test("A7b semantic boundary predicates reject every malformed shape", () => {
  const isolated = findIsolatedTapCommand();
  const coverage = commands.find(isCoverageCommand);
  const boundaryAt = commands.indexOf(isolated);
  const rejects = (entries, label, pattern) =>
    assert.throws(
      () => assertTapBoundaryShape(entries, label),
      pattern,
      `${label} must be rejected`,
    );

  // A semantic predicate that cannot fail is worse than the literal it replaced,
  // so every invalid boundary shape is proven to throw.
  rejects(
    [...commands, isolated],
    "duplicate TAP boundary",
    /exactly one isolated TAP boundary/,
  );
  rejects(
    commands.filter((entry) => entry !== isolated),
    "removed TAP boundary",
    /exactly one isolated TAP boundary/,
  );
  rejects(
    [...commands, coverage],
    "duplicate coverage",
    /exactly one coverage command/,
  );
  rejects(
    commands.filter((entry) => !isCoverageCommand(entry)),
    "removed coverage",
    /exactly one coverage command/,
  );
  rejects(
    [coverage, ...commands.filter((entry) => !isCoverageCommand(entry))],
    "coverage detached from the boundary",
    /coverage immediately follows/,
  );

  // Near-miss shapes must NOT be recognised as the boundary.
  const nearMisses = {
    // `--test` present, but no classifier wrapper at all.
    unwrapped_test: ["node", ["--test", "--test-reporter=tap"]],
    // Classifier wrapper, but the child executable is not node.
    child_not_node: [
      "node",
      [CLASSIFIER_ENTRY, "--temp-log", "--", "npm", "--test"],
    ],
    // Classifier wrapper spawning node, but no TAP reporter.
    missing_tap_reporter: [
      "node",
      [CLASSIFIER_ENTRY, "--temp-log", "--", "node", "--test"],
    ],
    // Classifier wrapper spawning node, but no --test at all.
    missing_test_flag: [
      "node",
      [CLASSIFIER_ENTRY, "--temp-log", "--", "node", "--test-reporter=tap"],
    ],
    // No child-process separator.
    missing_separator: [
      "node",
      [CLASSIFIER_ENTRY, "--temp-log", "node", "--test", "--test-reporter=tap"],
    ],
    // A command merely mentioning the word test.
    word_test_only: ["node", ["scripts/review/test-something-check.mjs"]],
  };
  for (const [label, entry] of Object.entries(nearMisses)) {
    assert.equal(
      isIsolatedTapBoundary(entry),
      false,
      `${label} must not be recognised as the TAP boundary`,
    );
    // Adding a near-miss ahead of the boundary must not disturb the law.
    const withNearMiss = [...commands];
    withNearMiss.splice(boundaryAt, 0, entry);
    assertTapBoundaryShape(withNearMiss, `near-miss ${label} inserted`);
  }

  // Coverage must not be mistaken for a TAP boundary, nor the reverse.
  assert.equal(isIsolatedTapBoundary(coverage), false);
  assert.equal(isCoverageCommand(isolated), false);
  assert.equal(isCoverageCommand(["npm", ["run", "coverage:html"]]), false);
  assert.equal(classifierChildArgv(coverage), null);
});
