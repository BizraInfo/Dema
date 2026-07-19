import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { commands, runChecks } from "../scripts/check.mjs";
import {
  CHECK_GATE_EVIDENCE_FD_ENV,
  CHECK_GATE_EVIDENCE_SCHEMA,
  checkGateFailure,
  checkGateStart,
} from "../scripts/ci/check-gate-evidence.mjs";

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
const CHECK_MODULE_URL = new URL("../scripts/check.mjs", import.meta.url).href;

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

function evidenceJsonl(...records) {
  return `${records.map((record) => JSON.stringify(record)).join("\n")}\n`;
}

function runRunner(fakeScriptBody, runnerArgs = []) {
  const dir = mkdtempSync(join(tmpdir(), "g8-runner-"));
  const log = join(dir, "run.log");
  const script = join(dir, "fake-gate.mjs");
  writeFileSync(script, fakeScriptBody);
  return spawnSync(
    process.execPath,
    [RUNNER, ...runnerArgs, "--log", log, "--", process.execPath, script],
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

test("T3b masked TAP noise plus an authoritative gate exit fails closed", () => {
  const evidence = evidenceJsonl(
    checkGateStart(127),
    checkGateFailure({
      index: 126,
      command: ["node", "scripts/review/actuator-check.mjs"],
      exitCode: 1,
      maskPolicy: "authoritative",
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
  assert.match(r.stderr, /G8 NON-TAP EXIT/);
  assert.match(r.stderr, /scripts\/review\/actuator-check\.mjs/);
});

test("T3c malformed structured gate-exit evidence fails closed", () => {
  const r = runClassifier(MASKED_ONLY_TAP, [
    "--check-exit",
    "1",
    "--require-check-gate-evidence",
    "--check-gate-evidence",
    '{"schema":"wrong"',
  ]);
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /G8 GATE EXIT EVIDENCE/);
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

test("T8b check-owner mode: nonzero exit with missing side-channel evidence fails closed", () => {
  const r = runRunner(
    `console.log("not ok 1 - isolated preflight CLI clears preview ceremony on fresh home");
console.log("  EROFS: read-only file system, mkdtemp '/home/x'");
console.log("1..1");
console.log("# tests 1");
console.log("# fail 1");
process.exit(1);`,
    ["--require-check-gate-evidence"],
  );
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /G8 GATE EXIT EVIDENCE/);
  assert.match(r.stderr, /missing/i);
});

test("T8c runner carries authoritative side-channel evidence into the classifier", () => {
  const r = runRunner(
    `import { runChecks } from ${JSON.stringify(CHECK_MODULE_URL)};
console.log("not ok 1 - isolated preflight CLI clears preview ceremony on fresh home");
console.log("  EROFS: read-only file system, mkdtemp '/home/x'");
console.log("1..1");
console.log("# tests 1");
console.log("# fail 1");
runChecks([["node", ["-e", "process.exit(1)"]]]);`,
    ["--require-check-gate-evidence"],
  );
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /G8 NON-TAP EXIT/);
});

test("T8d check-owner aggregate/evidence mismatch fails closed", () => {
  const r = runRunner(
    `import { writeSync } from "node:fs";
import { CHECK_GATE_EVIDENCE_FD_ENV, checkGateComplete, checkGateStart } from ${JSON.stringify(
      new URL("../scripts/ci/check-gate-evidence.mjs", import.meta.url).href,
    )};
const fd = Number(process.env[CHECK_GATE_EVIDENCE_FD_ENV]);
writeSync(fd, JSON.stringify(checkGateStart(1)) + "\\n");
writeSync(fd, JSON.stringify(checkGateComplete(1)) + "\\n");
console.log("not ok 1 - isolated preflight CLI clears preview ceremony on fresh home");
console.log("  EROFS: read-only file system, mkdtemp '/home/x'");
console.log("1..1");
console.log("# tests 1");
console.log("# fail 1");
process.exit(1);`,
    ["--require-check-gate-evidence"],
  );
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /G8 GATE EXIT EVIDENCE/);
  assert.match(r.stderr, /nonzero aggregate exit/i);
});

test("T8e check-owner success requires and accepts start + complete evidence", () => {
  const r = runRunner(
    `import { runChecks } from ${JSON.stringify(CHECK_MODULE_URL)};
runChecks([["node", ["-e", "console.log('ok 1 - green'); console.log('1..1'); console.log('# tests 1'); console.log('# pass 1'); console.log('# fail 0')"]]]);`,
    ["--require-check-gate-evidence"],
  );
  assert.equal(r.status, 0, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stdout, /Clean run/);
});

test("T8f runner: signal termination cannot be masked as TAP noise", () => {
  const r = runRunner(
    `console.log("not ok 1 - isolated preflight CLI clears preview ceremony on fresh home");
console.log("  EROFS: read-only file system, mkdtemp '/home/x'");
console.log("1..1");
console.log("# tests 1");
console.log("# fail 1");
process.kill(process.pid, "SIGTERM");`,
  );
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /terminated by SIGTERM/);
});

test("T8g check-owner start-only evidence fails closed", () => {
  const r = runRunner(
    `import { writeSync } from "node:fs";
import { CHECK_GATE_EVIDENCE_FD_ENV, checkGateStart } from ${JSON.stringify(
      new URL("../scripts/ci/check-gate-evidence.mjs", import.meta.url).href,
    )};
writeSync(Number(process.env[CHECK_GATE_EVIDENCE_FD_ENV]), JSON.stringify(checkGateStart(1)) + "\\n");
console.log("not ok 1 - isolated preflight CLI clears preview ceremony on fresh home");
console.log("  EROFS: read-only file system, mkdtemp '/home/x'");
console.log("1..1");
console.log("# tests 1");
console.log("# fail 1");
process.exit(1);`,
    ["--require-check-gate-evidence"],
  );
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /expected exactly start \+ terminal evidence/);
});

test("T8h check-owner oversized side-channel evidence fails closed", () => {
  const r = runRunner(
    `import { writeSync } from "node:fs";
const fd = Number(process.env.BIZRA_CHECK_GATE_EVIDENCE_FD);
for (let i = 0; i < 70; i++) writeSync(fd, "x".repeat(1024));
console.log("ok 1 - green");
console.log("1..1");
console.log("# tests 1");
console.log("# pass 1");
console.log("# fail 0");`,
    ["--require-check-gate-evidence"],
  );
  assert.equal(r.status, 1, `stdout:\n${r.stdout}\nstderr:\n${r.stderr}`);
  assert.match(r.stderr, /side channel exceeded 64 KiB/);
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
  assert.match(pkg.scripts.check, /--require-check-gate-evidence/);
  assert.doesNotMatch(pkg.scripts.test, /--require-check-gate-evidence/);
  assert.doesNotMatch(pkg.scripts.coverage, /--require-check-gate-evidence/);
});

test("T10 runChecks emits start + authoritative failure evidence before rethrowing", () => {
  const lines = [];
  const evidence = [];
  const failure = Object.assign(new Error("gate failed"), { status: 7 });

  assert.throws(
    () =>
      runChecks(
        [["node", ["scripts/review/actuator-check.mjs"]]],
        {
          execute() {
            throw failure;
          },
          log(line) {
            lines.push(line);
          },
          evidence(record) {
            evidence.push(record);
          },
        },
      ),
    (error) => error === failure,
  );

  assert.deepEqual(evidence, [
    {
      schema: CHECK_GATE_EVIDENCE_SCHEMA,
      event: "start",
      command_count: 1,
    },
    {
      schema: CHECK_GATE_EVIDENCE_SCHEMA,
      event: "failure",
      index: 0,
      command: ["node", "scripts/review/actuator-check.mjs"],
      exit_code: 7,
      mask_policy: "authoritative",
    },
  ]);
  assert.equal(lines.length, 1, "side-channel evidence must not use stdout");
});

test("T11 exactly the canonical direct TAP command is marked allowlist-maskable", () => {
  const marked = commands.filter(
    (entry) => entry[3]?.mask_policy === "tap_allowlist",
  );
  assert.equal(marked.length, 1);
  assert.deepEqual(marked[0].slice(0, 2), [
    "node",
    ["--test", "--test-reporter=tap"],
  ]);
});

test("T12 runChecks emits canonical tap_allowlist failure evidence", () => {
  const evidence = [];
  const failure = Object.assign(new Error("test gate failed"), { status: 1 });
  assert.throws(
    () =>
      runChecks([commands.find((entry) => entry[3]?.mask_policy)], {
        execute() {
          throw failure;
        },
        log() {},
        evidence(record) {
          evidence.push(record);
        },
      }),
    (error) => error === failure,
  );
  assert.equal(evidence.length, 2);
  assert.equal(evidence[1].event, "failure");
  assert.equal(evidence[1].mask_policy, "tap_allowlist");
});

test("T13 a signaled direct TAP child is authoritative, never maskable", () => {
  const evidence = [];
  const failure = Object.assign(new Error("terminated"), {
    status: null,
    signal: "SIGTERM",
  });
  assert.throws(
    () =>
      runChecks([commands.find((entry) => entry[3]?.mask_policy)], {
        execute() {
          throw failure;
        },
        log() {},
        evidence(record) {
          evidence.push(record);
        },
      }),
    (error) => error === failure,
  );
  assert.equal(evidence[1].event, "failure");
  assert.equal(evidence[1].exit_code, 1);
  assert.equal(evidence[1].mask_policy, "authoritative");
});

test("T14 child extraEnv cannot reintroduce the private evidence fd selector", () => {
  const evidence = [];
  let childEnv;
  runChecks(
    [
      [
        "node",
        ["-e", "process.exit(0)"],
        { [CHECK_GATE_EVIDENCE_FD_ENV]: "99" },
      ],
    ],
    {
      execute(_bin, _args, options) {
        childEnv = options.env;
      },
      log() {},
      evidence(record) {
        evidence.push(record);
      },
    },
  );
  assert.equal(Object.hasOwn(childEnv, CHECK_GATE_EVIDENCE_FD_ENV), false);
  assert.deepEqual(
    evidence.map((record) => record.event),
    ["start", "complete"],
  );
});
