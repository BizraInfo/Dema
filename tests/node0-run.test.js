// NODE0-RUN-1A — the node runner and endurance recorder.
//
// The load-bearing test is R3: a run that is REALLY killed mid-flight and
// resumed later must read as BROKEN, not as one long healthy run. That is the
// endurance analogue of the corridor's crash-recovery proof — and it is the
// only assertion here that could not be satisfied by a runner that merely
// appends plausible numbers.

import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, readFile } from "node:fs/promises";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { judgeRun, readSamples, NODE0_RUN_SCHEMA } from "../apps/cli/src/commands/node0-run.js";
import { ENDURANCE_TARGETS } from "../packages/core/src/node0-endurance.js";

const REPO = dirname(dirname(fileURLToPath(import.meta.url)));
const RUNNER = join(REPO, "apps", "cli", "src", "commands", "node0-run.js");

const homes = [];
async function newHome() {
  const h = await mkdtemp(join(tmpdir(), "dema-node0-run-"));
  homes.push(h);
  return h;
}
test.after(async () => {
  for (const h of homes) await rm(h, { recursive: true, force: true }).catch(() => {});
});

// Drive the runner as a REAL child process, so a kill is a real kill.
function spawnRun(home, runId, extra = []) {
  return spawn(process.execPath, [
    "--input-type=module",
    "-e",
    `import { cmdNode0Run } from ${JSON.stringify(RUNNER)};
     await cmdNode0Run({ argv: process.argv.slice(1) });`,
    "node0", "run",
    "--dema-home", home,
    "--run-id", runId,
    ...extra,
  ], { stdio: ["ignore", "pipe", "pipe"] });
}

const settle = (ms) => new Promise((r) => setTimeout(r, ms));

test("R1 a completed run records samples and seals an endurance receipt", async () => {
  const home = await newHome();
  const child = spawnRun(home, "r1", ["--interval-ms", "120", "--duration-ms", "700"]);
  await new Promise((r) => child.on("exit", r));

  const samples = await readSamples({ demaHome: home, runId: "r1" });
  assert.ok(samples.length >= 4, `expected several samples, got ${samples.length}`);
  for (const s of samples) {
    assert.equal(typeof s.at_ms, "number");
    assert.equal(typeof s.ok, "boolean");
  }

  const receipt = JSON.parse(await readFile(join(home, "node0", "endurance", "r1", "endurance-receipt.json"), "utf8"));
  assert.equal(receipt.schema, NODE0_RUN_SCHEMA);
  assert.equal(receipt.authority_delta, 0);
  assert.equal(receipt.boundary.daemon, false);
  assert.equal(receipt.boundary.effect_executed, false);
  assert.equal(receipt.boundary.nonce_claimed, false);
  assert.equal(receipt.boundary.model_invoked, false);
});

test("R2 the judgment is a pure read: judging twice changes nothing", async () => {
  const home = await newHome();
  const child = spawnRun(home, "r2", ["--interval-ms", "120", "--duration-ms", "600"]);
  await new Promise((r) => child.on("exit", r));

  const a = await judgeRun({ demaHome: home, runId: "r2", targetMs: 400, intervalMs: 120 });
  const b = await judgeRun({ demaHome: home, runId: "r2", targetMs: 400, intervalMs: 120 });
  assert.deepEqual(a, b);
  assert.equal(a.authority_delta, 0);
});

test("R3 a REAL kill and a late resume reads as BROKEN, not one long healthy run", async () => {
  const home = await newHome();

  // Phase 1: run briefly, then SIGKILL it mid-flight.
  const first = spawnRun(home, "r3", ["--interval-ms", "100", "--duration-ms", "60000"]);
  await settle(700);
  first.kill("SIGKILL");
  const code = await new Promise((r) => first.on("exit", (c, sig) => r(sig ?? c)));
  assert.equal(code, "SIGKILL", "control: the child was not actually killed");

  const afterKill = await readSamples({ demaHome: home, runId: "r3" });
  assert.ok(afterKill.length >= 2, "control: samples survived the kill");

  // Phase 2: resume the SAME run id after a gap far larger than the interval.
  await settle(1200);
  const second = spawnRun(home, "r3", ["--interval-ms", "100", "--duration-ms", "500"]);
  await new Promise((r) => second.on("exit", r));

  const samples = await readSamples({ demaHome: home, runId: "r3" });
  assert.ok(samples.length > afterKill.length, "control: the resume appended more samples");

  // A naive counter sees many samples across a long span and says healthy.
  const span = samples[samples.length - 1].at_ms - samples[0].at_ms;
  assert.ok(span > 1500, `control: the raw span really is long (${span}ms)`);

  // The kernel sees the blackout. maxGap = 3 * 100ms = 300ms; the outage was ~1200ms+.
  const verdict = await judgeRun({ demaHome: home, runId: "r3", targetMs: 500, intervalMs: 100 });
  assert.equal(verdict.verdict, "BROKEN", "a real blackout was counted as healthy time");
  assert.equal(verdict.continuously_observed, false);
  assert.ok(verdict.gap_count >= 1);
  assert.equal(verdict.ok, false);
});

test("R4 an absent run is INSUFFICIENT, never HEALTHY", async () => {
  const home = await newHome();
  const verdict = await judgeRun({ demaHome: home, runId: "never-ran", targetMs: ENDURANCE_TARGETS.MINIMUM_OPERATIONAL });
  assert.equal(verdict.ok, false);
  assert.equal(verdict.verdict, "INSUFFICIENT");
  assert.equal(verdict.sample_count, 0);
});

test("R5 the runner holds no effect, model or network capability", async () => {
  const src = await readFile(RUNNER, "utf8");
  assert.ok(src.length > 1000, "control: runner source unexpectedly small");
  for (const cap of ["node:net", "node:http", "node:https", "node:child_process", "node:worker_threads"]) {
    assert.equal(src.includes(`from "${cap}"`), false, `runner imports ${cap}`);
  }
  const CLAIM_FN = `claim${"Consent"}Nonce`;
  assert.equal(src.includes(CLAIM_FN), false, "runner claims a consent nonce");
  assert.equal(src.includes("runTransactionalMechanicalClosure"), false, "runner runs the effect transaction");
  // No daemonisation: it must not detach, fork or unref itself into the background.
  for (const d of ["detached: true", ".unref()", "fork("]) {
    assert.equal(src.includes(d), false, `runner daemonises via ${d}`);
  }
});
