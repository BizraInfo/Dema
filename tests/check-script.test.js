import test from "node:test";
import assert from "node:assert/strict";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { commands, runChecks } from "../scripts/check.mjs";

function withOperatorHome(run) {
  const root = mkdtempSync(join(tmpdir(), "dema-check-hermeticity-test-"));
  const home = join(root, "operator-home");
  const sentinelPath = join(home, "sentinel.txt");
  mkdirSync(home);
  writeFileSync(sentinelPath, "operator-home-sentinel\n");
  const previous = process.env.DEMA_HOME;
  process.env.DEMA_HOME = home;

  try {
    run({ root, home, sentinelPath });
  } finally {
    if (previous === undefined) delete process.env.DEMA_HOME;
    else process.env.DEMA_HOME = previous;
    rmSync(root, { recursive: true, force: true });
  }
}

function commandKey(entry) {
  const [bin, args] = entry;
  return `${bin} ${args.join(" ")}`;
}

test("check gate includes hermetic provenance scans before perf bench", () => {
  const keys = commands.map(commandKey);
  const crossRepoIndex = keys.indexOf(
    "node scripts/review/cross-repo-genesis-provenance.mjs --no-block0",
  );
  const poolIndex = keys.indexOf(
    "node scripts/review/node0-local-resource-pool.mjs",
  );
  const perfIndex = keys.indexOf("node scripts/perf-bench.mjs");

  assert.notEqual(crossRepoIndex, -1);
  assert.notEqual(poolIndex, -1);
  assert.notEqual(perfIndex, -1);
  assert.ok(crossRepoIndex < poolIndex);
  assert.ok(poolIndex < perfIndex);
  assert.deepEqual(commands[crossRepoIndex][2], { CROSS_REPO_SKIP_GH: "1" });
  assert.deepEqual(commands[poolIndex][2], { NODE0_POOL_SKIP_SCAN: "1" });
  assert.equal(commands[0][4], "operator_observation");
});

test("check gate includes transition assurance before proof-room composition", () => {
  const keys = commands.map(commandKey);
  const transitionIndex = keys.indexOf(
    "node scripts/review/transition-assurance-check.mjs",
  );
  const artifact011Index = keys.indexOf(
    "node scripts/review/artifact-011-preflight-gate.mjs",
  );
  const proofRoomIndex = keys.indexOf(
    "node scripts/proof-room-bundle.mjs --json",
  );

  assert.notEqual(transitionIndex, -1);
  assert.notEqual(artifact011Index, -1);
  assert.notEqual(proofRoomIndex, -1);
  assert.ok(transitionIndex < artifact011Index);
  assert.ok(artifact011Index < proofRoomIndex);
});

test("qualification children isolate DEMA_HOME after command overrides", () => {
  withOperatorHome(({ root, home, sentinelPath }) => {
    const overriddenHome = join(root, "command-override-home");
    let childHome;
    let childHomeExistedDuringExecution = false;
    let preservedOverride;

    runChecks(
      [["node", ["qualification-fixture"], {
        DEMA_HOME: overriddenHome,
        QUALIFICATION_FIXTURE_OVERRIDE: "preserved",
      }]],
      {
        execute(_bin, _args, options) {
          childHome = options.env.DEMA_HOME;
          childHomeExistedDuringExecution = existsSync(childHome);
          preservedOverride = options.env.QUALIFICATION_FIXTURE_OVERRIDE;
        },
        log() {},
        evidence() {},
      },
    );

    assert.notEqual(childHome, home);
    assert.notEqual(childHome, overriddenHome);
    assert.equal(childHomeExistedDuringExecution, true);
    assert.equal(existsSync(childHome), false);
    assert.equal(preservedOverride, "preserved");
    assert.equal(readFileSync(sentinelPath, "utf8"), "operator-home-sentinel\n");
  });
});

test("operator-state observation requires an explicit check classification", () => {
  withOperatorHome(({ home }) => {
    let childHome;
    runChecks(
      [[
        "node",
        ["operator-observation-fixture"],
        { DEMA_HOME: "/command-override-must-not-win" },
        undefined,
        "operator_observation",
      ]],
      {
        execute(_bin, _args, options) {
          childHome = options.env.DEMA_HOME;
        },
        log() {},
        evidence() {},
      },
    );
    assert.equal(childHome, home);
  });
});

test("operator observation cannot inherit a command DEMA_HOME override", () => {
  const previous = process.env.DEMA_HOME;
  delete process.env.DEMA_HOME;
  try {
    let childHome = "unexpected";
    runChecks(
      [[
        "node",
        ["operator-observation-without-home-fixture"],
        { DEMA_HOME: "/command-override-must-not-win" },
        undefined,
        "operator_observation",
      ]],
      {
        execute(_bin, _args, options) {
          childHome = options.env.DEMA_HOME;
        },
        log() {},
        evidence() {},
      },
    );
    assert.equal(childHome, undefined);
  } finally {
    if (previous === undefined) delete process.env.DEMA_HOME;
    else process.env.DEMA_HOME = previous;
  }
});

test("unknown qualification gate policies fail closed", () => {
  let executed = false;
  assert.throws(
    () => runChecks(
      [["node", ["unclassified-fixture"], {}, undefined, "inherit"]],
      {
        execute() {
          executed = true;
        },
        log() {},
        evidence() {},
      },
    ),
    /unsupported qualification gate policy/,
  );
  assert.equal(executed, false);
});

test("qualification home is removed after child failure without changing exit semantics", () => {
  withOperatorHome(({ home }) => {
    const childFailure = Object.assign(new Error("fixture child failure"), {
      status: 17,
    });
    const evidenceRecords = [];
    let childHome;
    let childHomeExistedDuringExecution = false;

    assert.throws(
      () => runChecks(
        [["node", ["failing-qualification-fixture"]]],
        {
          execute(_bin, _args, options) {
            childHome = options.env.DEMA_HOME;
            childHomeExistedDuringExecution = existsSync(childHome);
            throw childFailure;
          },
          log() {},
          evidence(record) {
            evidenceRecords.push(record);
          },
        },
      ),
      (error) => error === childFailure && error.status === 17,
    );

    assert.notEqual(childHome, home);
    assert.equal(childHomeExistedDuringExecution, true);
    assert.equal(existsSync(childHome), false);
    assert.equal(evidenceRecords.length, 2);
  });
});

test("qualification cleanup failure fails closed without completion evidence", () => {
  const cleanupError = new Error("fixture cleanup failure");
  const evidenceRecords = [];
  let childHome;

  try {
    assert.throws(
      () => runChecks(
        [["node", ["successful-qualification-fixture"]]],
        {
          execute(_bin, _args, options) {
            childHome = options.env.DEMA_HOME;
          },
          log() {},
          evidence(record) {
            evidenceRecords.push(record);
          },
          removeQualificationHome() {
            throw cleanupError;
          },
        },
      ),
      (error) => error === cleanupError,
    );

    assert.equal(evidenceRecords.length, 1);
    assert.equal(existsSync(childHome), true);
  } finally {
    if (childHome) rmSync(childHome, { recursive: true, force: true });
  }
});
