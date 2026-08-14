// NODE0-RECOVERY-OBSERVATION-1A — the producer for `recovery_after_worker_exit`.
//
//   node scripts/proof/node0-recovery-proof.mjs [--dema-home <path>] [--json]
//
// ── WHAT IT ACTUALLY DOES ──
// Starts the proof-only recovery supervisor (which lives behind the governed
// Node0 boundary and CONDUCTS). Waits until worker A has established the mission.
// Then SIGKILLs A **directly** — the supervisor is never signalled, messaged or
// told in any way. Whether anything happens next is up to the supervisor.
//
// The harness deliberately does NOT start the replacement. That is the whole
// distinction this row turns on, and `HARNESS_STARTED_REPLACEMENT` exists so a
// scripted replacement can never pass as a detection.
//
// A separate observer then re-derives the evidence, because the ruling forbids
// the supervisor certifying its own recovery.
//
// ── BOUNDARY BINDING, EXERCISED NOT ASSERTED ──
// It calls the real shipped `createNode0Adapter({ command })` against the
// supervisor's --status mode, proving the Dema face can reach this runtime only
// through the governed three-verb contract.
//
// ── BOUNDARIES ──
// No network, no model, no ambient daemon; every child reaped. Scoped temp
// DEMA_HOME unless --dema-home names one. authority_delta 0.

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync } from "node:fs";
import { writeFactsAtomic, readFactsWhenComplete } from "./atomic-facts-io.mjs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import { buildRecoveryObservation, isCleanEligibleRecovery } from "../../packages/core/src/node0-recovery-observation.js";
import { currentRecoveryKernelHash, RECOVERY_ARTEFACT_RELPATH } from "../../packages/core/src/node0-recovery-adapter.js";
import { createNode0Adapter } from "../../packages/node-adapter/src/node0-adapter.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const SUP = join(HERE, "node0-recovery-supervisor.mjs");
const OBS = join(HERE, "node0-recovery-observer.mjs");
const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
const homeArg = argv.indexOf("--dema-home");
const KEEP = homeArg !== -1;
const DEMA_HOME = KEEP ? argv[homeArg + 1] : mkdtempSync(join(tmpdir(), "node0-recovery-"));
const scratch = mkdtempSync(join(tmpdir(), "node0-recovery-scratch-"));

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rd = (f) => readFactsWhenComplete(f);
const recovery = (home, n) => join(home, "node0", "recovery", n);
const alive = (pid) => { try { process.kill(pid, 0); return true; } catch { return false; } };

async function until(fn, label, ms = 40_000) {
  const end = Date.now() + ms;
  while (Date.now() < end) { if (fn()) return true; await wait(25); }
  throw new Error(`timed out waiting for ${label}`);
}

/// One supervised episode. The harness kills A and then only WATCHES.
async function episode({ home, supArgs = [], killA = true }) {
  const sup = spawn(process.execPath, [SUP, home, ...supArgs], { stdio: "ignore" });
  // Capture the exit promise AT SPAWN. Attaching the listener later races the
  // child: if it has already exited, the listener never fires and the await hangs.
  const supExited = new Promise((res) => sup.on("exit", res));
  await until(() => rd(recovery(home, "worker-a.json")), "worker A");
  const a = rd(recovery(home, "worker-a.json"));
  if (killA) {
    process.kill(a.pid, "SIGKILL"); // the supervisor is NOT informed
    await until(() => !alive(a.pid), "worker A death");
  }
  // Give the supervisor its own time to notice. We never tell it.
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline && !rd(recovery(home, "worker-b.json"))) {
    if (!alive(sup.pid)) break;
    await wait(50);
  }
  if (alive(sup.pid)) sup.kill("SIGKILL");
  await supExited;
  if (!killA && alive(a.pid)) process.kill(a.pid, "SIGKILL");
  return { a, b: rd(recovery(home, "worker-b.json")), journal: rd(recovery(home, "supervisor-journal.json")) };
}

async function observe(home) {
  const out = join(scratch, `obs-${Math.abs(home.length * 31 + home.charCodeAt(home.length - 1))}.json`);
  await new Promise((res, rej) => {
    const o = spawn(process.execPath, [OBS, home, out], { stdio: "ignore" });
    o.on("exit", (c) => (c === 0 ? res() : rej(new Error(`observer exit ${c}`))));
  });
  return rd(out);
}

let observation;
try {
  // ── the real episode ───────────────────────────────────────────────────────
  const main = await episode({ home: DEMA_HOME });
  const facts = await observe(DEMA_HOME);

  // ── NC-1 · no supervisor at all: the death must NOT recover ────────────────
  const h1 = mkdtempSync(join(tmpdir(), "node0-rec-nc1-"));
  const sup1 = spawn(process.execPath, [SUP, h1, "--no-recover"], { stdio: "ignore" });
  const sup1Exited = new Promise((res) => sup1.on("exit", res));
  await until(() => rd(recovery(h1, "worker-a.json")), "nc1 worker A");
  const a1 = rd(recovery(h1, "worker-a.json"));
  process.kill(a1.pid, "SIGKILL");
  await wait(1500);
  const nc1Recovered = Boolean(rd(recovery(h1, "worker-b.json")));
  if (alive(sup1.pid)) sup1.kill("SIGKILL");
  await sup1Exited;
  rmSync(h1, { recursive: true, force: true });

  // ── NC-2 · the harness starting B must NOT satisfy the row ─────────────────
  const harnessStarted = buildRecoveryObservation({
    facts: { ...facts, successor: { ...facts.successor, started_by: "harness" } },
    evidenceClass: "OBSERVED",
    executedCodeHash: currentRecoveryKernelHash(),
    hash: sha256CanonicalJsonV1,
  });
  const nc2Accepted = isCleanEligibleRecovery(harnessStarted);

  // ── NC-3 · a LIVE predecessor must not trigger a replacement ───────────────
  const h3 = mkdtempSync(join(tmpdir(), "node0-rec-nc3-"));
  const e3 = await episode({ home: h3, killA: false });
  const nc3Started = Boolean(e3.b);
  rmSync(h3, { recursive: true, force: true });

  observation = buildRecoveryObservation({
    facts: {
      ...facts,
      controls: {
        no_supervisor_recovered: nc1Recovered,
        harness_started_b_accepted: nc2Accepted,
        alive_a_triggered_b: nc3Started,
      },
    },
    evidenceClass: "OBSERVED",
    observedAt: new Date().toISOString(),
    executedCodeHash: currentRecoveryKernelHash(),
    hash: sha256CanonicalJsonV1,
  });

  const artefact = join(DEMA_HOME, RECOVERY_ARTEFACT_RELPATH);
  mkdirSync(dirname(artefact), { recursive: true });
  writeFactsAtomic(artefact, observation);

  // ── the governed boundary, exercised against the real shipped adapter ──────
  const bridged = await createNode0Adapter({
    command: `${process.execPath} ${SUP} ${DEMA_HOME} --status`,
  }).status();

  const report = {
    schema: "bizra.dema.node0_recovery_proof.v0.1",
    dema_home: DEMA_HOME,
    artefact,
    recovery_verdict: observation.recovery_verdict,
    supervisor_pid: facts.supervisor.pid,
    supervisor_told_about_kill: facts.supervisor.told_about_kill,
    supervisor_detected_death: facts.supervisor.detected_death,
    detection_method: facts.supervisor.detection_method,
    predecessor_pid: facts.predecessor.pid,
    successor_pid: facts.successor.pid,
    successor_started_by: facts.successor.started_by,
    advanced_to_stage: facts.successor.advanced_to_stage,
    stale_token_result: facts.fencing.stale_token_result,
    certified_by: facts.attribution.certified_by,
    controls: { no_supervisor_recovered: nc1Recovered, harness_started_b_accepted: nc2Accepted, alive_a_triggered_b: nc3Started },
    governed_boundary: {
      adapter: "packages/node-adapter/src/node0-adapter.js createNode0Adapter",
      mode: bridged?.adapter?.mode ?? "legacy-shellout",
      reachable_verbs: ["status", "listReceipts", "proposeBoundedDiagnostic"],
      status_schema: bridged?.schema ?? null,
      mission_executed: bridged?.missionExecuted ?? null,
    },
    observation_hash: observation.observation_hash,
    boundary: { live_execution_performed: true, file_mutation_performed: true, model_invocation_performed: false, network_call_performed: false, authority_delta: 0 },
    what_this_does_not_prove:
      "Does not prove a production Node0 runtime exists, that any model ran, that this supervisor is anything but a proof-only producer, or that Node0 is closed. One invariant of ten.",
  };

  if (JSON_MODE) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`recovery:          ${report.recovery_verdict}`);
    console.log(`supervisor told?   ${report.supervisor_told_about_kill}   detected: ${report.supervisor_detected_death} via ${report.detection_method}`);
    console.log(`A ${report.predecessor_pid} killed -> B ${report.successor_pid} started_by=${report.successor_started_by} stage=${report.advanced_to_stage}`);
    console.log(`stale fence:       ${report.stale_token_result}`);
    console.log(`controls:          nc1_recovered=${report.controls.no_supervisor_recovered} nc2_accepted=${report.controls.harness_started_b_accepted} nc3_started=${report.controls.alive_a_triggered_b} (all must be false)`);
    console.log(`governed adapter:  ${report.governed_boundary.status_schema} mission_executed=${report.governed_boundary.mission_executed}`);
    console.log(`artefact:          ${artefact}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
  if (!KEEP && observation === undefined) rmSync(DEMA_HOME, { recursive: true, force: true });
}
