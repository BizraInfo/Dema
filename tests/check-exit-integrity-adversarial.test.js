import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { commands, runChecks, CHECK_BOUNDARY_CONTRACT, ISOLATED_TAP_BOUNDARY_COMMAND, COVERAGE_COMMAND } from "../scripts/check.mjs";
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

// Boundary identity is declared by CHECK_BOUNDARY_CONTRACT — never inferred from
// argv resemblance or array index. These helpers only VALIDATE the declared
// handles and assert their placement by object reference.

function occurrences(entries, handle) {
  return entries.filter((entry) => entry === handle).length;
}

function isCoverageShaped(entry) {
  return (
    Array.isArray(entry) &&
    entry[0] === "npm" &&
    Array.isArray(entry[1]) &&
    entry[1].join(" ") === "run coverage"
  );
}

function isUndeclaredTapShaped(entry) {
  if (entry === CHECK_BOUNDARY_CONTRACT.isolatedTap) return false;
  if (!Array.isArray(entry) || entry[0] !== "node") return false;
  const args = entry[1];
  if (!Array.isArray(args) || args[0] !== CLASSIFIER_ENTRY) return false;
  const separator = args.indexOf("--");
  if (separator < 0) return false;
  const child = args.slice(separator + 1);
  if (child[0] !== "node") return false;
  const childArgv = child.slice(1);
  return (
    childArgv.includes("--test") && childArgv.includes("--test-reporter=tap")
  );
}

function assertBoundaryIdentity(entries, label) {
  const { isolatedTap, coverage } = CHECK_BOUNDARY_CONTRACT;
  assert.equal(
    isolatedTap,
    ISOLATED_TAP_BOUNDARY_COMMAND,
    `${label}: contract.isolatedTap is the exported TAP handle`,
  );
  assert.equal(
    coverage,
    COVERAGE_COMMAND,
    `${label}: contract.coverage is the exported coverage handle`,
  );
  assert.equal(
    occurrences(entries, isolatedTap),
    1,
    `${label}: declared TAP handle occurs exactly once`,
  );
  assert.equal(
    occurrences(entries, coverage),
    1,
    `${label}: declared coverage handle occurs exactly once`,
  );
  assert.equal(
    entries.indexOf(coverage),
    entries.indexOf(isolatedTap) + 1,
    `${label}: coverage immediately follows declared TAP`,
  );
  assert.notEqual(
    isolatedTap,
    coverage,
    `${label}: TAP and coverage are distinct objects`,
  );
  const undeclaredTap = entries.filter(isUndeclaredTapShaped);
  assert.equal(
    undeclaredTap.length,
    0,
    `${label}: no undeclared TAP-shaped boundary`,
  );
  const coverageShaped = entries.filter(isCoverageShaped);
  assert.equal(
    coverageShaped.length,
    1,
    `${label}: exactly one coverage-shaped command`,
  );
  assert.equal(
    coverageShaped[0],
    coverage,
    `${label}: coverage-shaped command is the declared handle`,
  );
}

function validateDeclaredTapCommand(entry, label = "declared TAP") {
  assert.ok(Array.isArray(entry), `${label}: tuple`);
  assert.equal(entry[0], "node", `${label}: executable is node`);
  const args = entry[1];
  assert.ok(Array.isArray(args), `${label}: args array`);
  assert.equal(args[0], CLASSIFIER_ENTRY, `${label}: classifier is args[0]`);
  const separators = args
    .map((token, index) => (token === "--" ? index : -1))
    .filter((index) => index >= 0);
  assert.equal(separators.length, 1, `${label}: exactly one child separator`);
  const separator = separators[0];
  const child = args.slice(separator + 1);
  assert.equal(child[0], "node", `${label}: child executable is node`);
  const childArgv = child.slice(1);
  assert.equal(
    childArgv.filter((token) => token === "--test").length,
    1,
    `${label}: --test exactly once`,
  );
  assert.equal(
    childArgv.filter((token) => token === "--test-reporter=tap").length,
    1,
    `${label}: --test-reporter=tap exactly once`,
  );
  assert.equal(
    childArgv.includes("--experimental-test-coverage"),
    false,
    `${label}: no --experimental-test-coverage`,
  );
  assert.equal(
    childArgv.some((token) => String(token).startsWith("--test-coverage-")),
    false,
    `${label}: no --test-coverage-*`,
  );
  assert.equal(
    childArgv.includes("--"),
    false,
    `${label}: no second child separator`,
  );
  const testAt = childArgv.indexOf("--test");
  assert.equal(
    childArgv.slice(0, testAt).some((token) => !String(token).startsWith("-")),
    false,
    `${label}: no script/module operand before --test`,
  );
  assert.equal(args.includes("--temp-log"), true, `${label}: --temp-log present`);
  assert.equal(args.includes("--log"), false, `${label}: shared --log absent`);
}

function validateDeclaredCoverageCommand(entry, label = "declared coverage") {
  assert.ok(Array.isArray(entry), `${label}: tuple`);
  assert.equal(entry[0], "npm", `${label}: executable is npm`);
  assert.deepEqual(entry[1], ["run", "coverage"], `${label}: run coverage`);
  assert.notEqual(
    entry,
    CHECK_BOUNDARY_CONTRACT.isolatedTap,
    `${label}: is not the TAP object`,
  );
}

function tapLikeClone(extraChildArgs = []) {
  return [
    "node",
    [
      CLASSIFIER_ENTRY,
      "--temp-log",
      "--",
      "node",
      "--test",
      "--test-reporter=tap",
      ...extraChildArgs,
    ],
  ];
}

function coverageBearingClone() {
  return tapLikeClone([
    "--experimental-test-coverage",
    "--test-coverage-lines=95",
    "--test-coverage-branches=84",
    "--test-coverage-functions=95",
  ]);
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
  const { isolatedTap, coverage } = CHECK_BOUNDARY_CONTRACT;
  assert.equal(isolatedTap, ISOLATED_TAP_BOUNDARY_COMMAND);
  assert.equal(coverage, COVERAGE_COMMAND);
  assert.deepEqual(isolatedTap[1].slice(0, 2), [
    "scripts/ci/run-with-classifier.mjs",
    "--temp-log",
  ]);
  assert.equal(isolatedTap[1].includes("--log"), false);

  assertBoundaryIdentity(commands, "check.mjs");
  validateDeclaredTapCommand(isolatedTap);
  validateDeclaredCoverageCommand(coverage);

  // Unrelated gates may enter ahead of the declared handles without editing this test.
  const withGate = [...commands];
  withGate.splice(commands.indexOf(isolatedTap), 0, [
    "node",
    ["scripts/review/unrelated-example-gate.mjs"],
  ]);
  assertBoundaryIdentity(withGate, "with an unrelated gate inserted");
  assert.equal(withGate.length, commands.length + 1);

  // Declared TAP grammar allows legitimate Node runtime flags before --test.
  const flaggedTap = [
    "node",
    [
      CLASSIFIER_ENTRY,
      "--temp-log",
      "--",
      "node",
      "--experimental-vm-modules",
      "--test",
      "--test-reporter=tap",
    ],
  ];
  validateDeclaredTapCommand(flaggedTap, "TAP with --experimental-vm-modules");

  // Reordering unrelated gates ahead of the declared boundary preserves identity.
  const boundaryAt = commands.indexOf(isolatedTap);
  const reordered = [
    ...commands.slice(0, boundaryAt).reverse(),
    ...commands.slice(boundaryAt),
  ];
  assertBoundaryIdentity(reordered, "with pre-boundary gates reordered");

  const evidence = [];
  const calls = [];
  const lateFailure = Object.assign(new Error("late gate failed"), { status: 7 });
  assert.throws(
    () =>
      runChecks([isolatedTap, ["node", ["scripts/review/late-gate.mjs"]]], {
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

test("A7b declared boundary identity rejects impersonation and malformed handles", () => {
  const { isolatedTap, coverage } = CHECK_BOUNDARY_CONTRACT;
  const boundaryAt = commands.indexOf(isolatedTap);
  const rejectsIdentity = (entries, label, pattern) =>
    assert.throws(
      () => assertBoundaryIdentity(entries, label),
      pattern,
      `${label} must be rejected`,
    );

  rejectsIdentity(
    [...commands, isolatedTap],
    "duplicate declared TAP",
    /declared TAP handle occurs exactly once/,
  );
  rejectsIdentity(
    commands.filter((entry) => entry !== isolatedTap),
    "removed declared TAP",
    /declared TAP handle occurs exactly once/,
  );
  rejectsIdentity(
    [...commands, coverage],
    "duplicate declared coverage",
    /declared coverage handle occurs exactly once/,
  );
  rejectsIdentity(
    commands.filter((entry) => entry !== coverage),
    "removed declared coverage",
    /declared coverage handle occurs exactly once/,
  );
  rejectsIdentity(
    [coverage, ...commands.filter((entry) => entry !== coverage)],
    "coverage detached from declared TAP",
    /coverage immediately follows/,
  );

  // Resemblance cannot acquire the declared role — undeclared TAP-shaped conflict.
  const lookalike = tapLikeClone();
  assert.notEqual(lookalike, isolatedTap);
  const withLookalike = [...commands];
  withLookalike.splice(boundaryAt, 0, lookalike);
  rejectsIdentity(
    withLookalike,
    "identical-looking TAP clone",
    /no undeclared TAP-shaped boundary/,
  );

  const coverageLike = coverageBearingClone();
  const forged = [...commands];
  forged[boundaryAt] = coverageLike;
  rejectsIdentity(
    forged,
    "coverage-bearing clone replacing declared TAP",
    /declared TAP handle occurs exactly once/,
  );
  assert.throws(
    () => validateDeclaredTapCommand(coverageLike, "coverage-bearing clone"),
    /no --experimental-test-coverage/,
  );

  for (const [label, entry] of Object.entries({
    duplicate_test: [
      "node",
      [
        CLASSIFIER_ENTRY,
        "--temp-log",
        "--",
        "node",
        "--test",
        "--test",
        "--test-reporter=tap",
      ],
    ],
    duplicate_reporter: [
      "node",
      [
        CLASSIFIER_ENTRY,
        "--temp-log",
        "--",
        "node",
        "--test",
        "--test-reporter=tap",
        "--test-reporter=tap",
      ],
    ],
    second_separator: [
      "node",
      [
        CLASSIFIER_ENTRY,
        "--temp-log",
        "--",
        "node",
        "--test",
        "--",
        "--test-reporter=tap",
      ],
    ],
    script_before_test: [
      "node",
      [
        CLASSIFIER_ENTRY,
        "--temp-log",
        "--",
        "node",
        "script.mjs",
        "--test",
        "--test-reporter=tap",
      ],
    ],
    tokens_after_second_sep: [
      "node",
      [
        CLASSIFIER_ENTRY,
        "--temp-log",
        "--",
        "node",
        "--test",
        "--test-reporter=tap",
        "--",
        "extra",
      ],
    ],
  })) {
    assert.throws(
      () => validateDeclaredTapCommand(entry, label),
      Error,
      `${label} must fail declared TAP validation`,
    );
    const withImpostor = [...commands];
    withImpostor.splice(boundaryAt, 0, entry);
    rejectsIdentity(
      withImpostor,
      `undeclared ${label}`,
      /no undeclared TAP-shaped boundary/,
    );
  }

  const coverageClone = ["npm", ["run", "coverage"]];
  assert.notEqual(coverageClone, coverage);
  rejectsIdentity(
    [...commands, coverageClone],
    "coverage argv clone inserted elsewhere",
    /exactly one coverage-shaped command/,
  );
  const swappedCoverage = commands.map((entry) =>
    entry === coverage ? coverageClone : entry,
  );
  rejectsIdentity(
    swappedCoverage,
    "equal-looking coverage clone replacing declared handle",
    /declared coverage handle occurs exactly once/,
  );
});
