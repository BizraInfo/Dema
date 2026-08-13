// NODE0-RUNTIME-MISSION-OBSERVATION-1A — the producer.
//
//   node scripts/proof/node0-runtime-mission-proof.mjs [--dema-home <path>] [--json]
//
// ── WHAT IT ACTUALLY DOES ──
// Spawns a real predecessor process which builds a mission contract, walks the
// shipped supervisor to PLAN, and persists the whole mission under DEMA_HOME.
// SIGKILLs it — no handler, no chance to flush. Spawns a SECOND process which is
// handed only its role and the home path: no mission id, no contract, no stage.
// If it continues the mission, the home is where it got it.
//
// It then runs the discriminating control: a worker that keeps its mission in
// memory and persists NOTHING, killed the same way. Its successor must FAIL to
// recover. Without that, "the successor recovered" would not be evidence that
// state lives outside the worker.
//
// While it is there, the successor also attempts a worker-channel contract
// amendment (must be refused, on-disk hash unchanged, refusal receipted) and an
// operator-channel one as the positive control (must yield a NEW hash), which is
// what separates immutability from a contract that refuses everything.
//
// ── BOUNDARIES ──
// PROOF HARNESS, NOT A SUPERVISOR. It conducts no real mission and is unreachable
// from the CLI. Per TASK-026's bound, a production supervisor stays outside the
// Dema face or behind the governed Node0 adapter; this measures, it does not
// conduct.
// NO DAEMON: every child is reaped before exit. NO NETWORK, NO MODEL, NO LISTENER.
// authority_delta is 0 in the artefact on every path.
// DEMA_HOME: a fresh temp dir unless --dema-home names one explicitly, because
// recording a closure artefact into the operator's live state is their call.

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import { buildRuntimeMissionObservation } from "../../packages/core/src/node0-runtime-mission-observation.js";
import {
  currentRuntimeKernelHash,
  RUNTIME_MISSION_ARTEFACT_RELPATH,
} from "../../packages/core/src/node0-runtime-mission-adapter.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER = join(HERE, "node0-runtime-mission-worker.mjs");
const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
const homeArg = argv.indexOf("--dema-home");
const KEEP = homeArg !== -1;
const DEMA_HOME = KEEP ? argv[homeArg + 1] : mkdtempSync(join(tmpdir(), "node0-runtime-mission-"));

const scratch = mkdtempSync(join(tmpdir(), "node0-runtime-scratch-"));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(predicate, label, ms = 30_000) {
  const deadline = Date.now() + ms;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await wait(25);
  }
  throw new Error(`timed out waiting for ${label}`);
}

function spawnWorker(role, home, factsPath) {
  return spawn(process.execPath, [WORKER, role, home, factsPath], { stdio: "ignore" });
}
// Defence in depth behind the atomic write. A poller that treats "the file
// exists" as "the file is complete" turns a race into a SyntaxError instead of
// another wait; unparseable means NOT YET READY, so `until()` keeps waiting and,
// if the file really is corrupt, times out with a message that names what it was
// waiting for rather than a bare JSON parse error.
const readFacts = (p) => {
  if (!existsSync(p)) return null;
  try {
    return JSON.parse(readFileSync(p, "utf8"));
  } catch {
    return null;
  }
};

/// One kill-and-replace measurement. `persistHome` is the home the predecessor
/// may write to; the control passes a role that writes nothing.
async function killAndReplace({ predecessorRole, successorRole, home }) {
  const preFacts = join(scratch, `${predecessorRole}.json`);
  const sucFacts = join(scratch, `${successorRole}.json`);
  const a = spawnWorker(predecessorRole, home, preFacts);
  await until(() => readFacts(preFacts) !== null, `${predecessorRole} facts`);
  const pre = readFacts(preFacts);

  a.kill("SIGKILL");
  await until(() => a.killed || a.exitCode !== null || a.signalCode !== null, `${predecessorRole} death`);
  const killed_with = a.signalCode ?? "SIGKILL";

  // No human step happens here. The next line is the replacement.
  const b = spawnWorker(successorRole, home, sucFacts);
  await new Promise((res) => b.on("exit", res));
  const suc = readFacts(sucFacts);
  return { pre: { ...pre, killed_with }, suc, predecessor_pid: a.pid, successor_pid: b.pid };
}

let observation;
try {
  // ── the real measurement ──────────────────────────────────────────────────
  const main = await killAndReplace({ predecessorRole: "predecessor", successorRole: "successor", home: DEMA_HOME });

  // A THIRD process verifies. It never ran the work, and it is handed only the
  // home path — it obtains the acceptance law by re-deriving the contract from
  // the persisted fields rather than being given it by the party under judgement.
  const verFacts = join(scratch, "verifier.json");
  const v = spawnWorker("verifier", DEMA_HOME, verFacts);
  await new Promise((res) => v.on("exit", res));
  const ver = readFacts(verFacts);

  // ── the discriminating control, in its OWN home so it cannot read the real
  //    predecessor's state and appear to recover.
  const controlHome = mkdtempSync(join(tmpdir(), "node0-runtime-control-"));
  const control = await killAndReplace({
    predecessorRole: "worker_local_control",
    successorRole: "control_successor",
    home: controlHome,
  });
  rmSync(controlHome, { recursive: true, force: true });

  observation = buildRuntimeMissionObservation({
    predecessor: {
      pid: main.predecessor_pid,
      exited: true,
      killed_with: main.pre.killed_with,
      mission_id: main.pre.mission_id,
      contract_hash: main.pre.contract_hash,
      checkpoint_state_hash: main.pre.checkpoint_state_hash,
      state_seq: main.pre.state_seq,
    },
    successor: {
      pid: main.successor_pid,
      reconstructed_from: main.suc?.reconstructed_from ?? "unknown",
      mission_id: main.suc?.mission_id ?? null,
      contract_hash: main.suc?.contract_hash ?? null,
      resumed_state_hash: main.suc?.resumed_state_hash ?? null,
      state_seq: main.suc?.state_seq ?? null,
      human_steps_between: 0,
    },
    workerLocalControl: { attempted: true, recovered: control.suc?.recovered === true },
    immutability: {
      amendment_channel: "worker",
      amendment_refusal: main.suc?.amendment_refusal ?? null,
      contract_hash_before: main.suc?.contract_hash_before ?? null,
      contract_hash_after: main.suc?.contract_hash_after ?? null,
      refusal_receipted: main.suc?.refusal_receipted === true,
      operator_control_attempted: main.suc?.operator_control_attempted === true,
      operator_control_new_hash: main.suc?.operator_control_new_hash ?? null,
    },
    verification: ver
      ? {
          executor_pid: ver.executor_pid,
          verifier_pid: ver.verifier_pid,
          law_source: ver.law_source,
          executor_self_claimed_success: ver.executor_self_claimed_success,
          independently_rederived_verdict: ver.independently_rederived_verdict,
          positive_control_verdict: ver.positive_control_verdict,
          authoritative_verdict_source: ver.authoritative_verdict_source,
          exact_comparison_performed: ver.exact_comparison_performed,
        }
      : null,
    // The delta is MEASURED from the on-disk envelope before and after. The
    // carried claim is passed in only so the kernel can catch it disagreeing.
    authority: {
      authority_before_hash: main.pre.authority_before_hash ?? null,
      authority_after_hash: main.suc?.authority_after_hash ?? null,
      carried_authority_delta_claim: 0,
      worker_a_widen_refused: main.pre.worker_a_widen_refused,
      worker_b_widen_refused: main.suc?.worker_b_widen_refused,
      restart_widen_refused: main.suc?.restart_widen_refused,
      self_grant_refused: main.suc?.self_grant_refused,
      stale_grant_refused: main.suc?.stale_grant_refused,
    },
    evidenceClass: "OBSERVED",
    observedAt: new Date().toISOString(),
    executedCodeHash: currentRuntimeKernelHash(),
    hash: sha256CanonicalJsonV1,
  });

  const artefact = join(DEMA_HOME, RUNTIME_MISSION_ARTEFACT_RELPATH);
  mkdirSync(dirname(artefact), { recursive: true });
  writeFileSync(artefact, `${JSON.stringify(observation, null, 2)}\n`);

  const report = {
    schema: "bizra.dema.node0_runtime_mission_proof.v0.1",
    dema_home: DEMA_HOME,
    artefact,
    state_ownership_verdict: observation.state_ownership_verdict,
    contract_immutability_verdict: observation.contract_immutability_verdict,
    verifier_independence_verdict: observation.verifier_independence_verdict,
    authority_delta_verdict: observation.authority_delta_verdict,
    measured_authority_delta: observation.measured_authority_delta,
    executor_pid: ver?.executor_pid ?? null,
    verifier_pid: ver?.verifier_pid ?? null,
    executor_claimed: ver?.executor_self_claimed_verdict ?? null,
    independently_rederived: ver?.independently_rederived_verdict ?? null,
    predecessor_pid: main.predecessor_pid,
    successor_pid: main.successor_pid,
    killed_with: main.pre.killed_with,
    control_recovered: control.suc?.recovered === true,
    observation_hash: observation.observation_hash,
    boundary: {
      live_execution_performed: true,
      file_mutation_performed: true,
      model_invocation_performed: false,
      network_call_performed: false,
      daemon_started: false,
      authority_delta: 0,
    },
    what_this_does_not_prove:
      "Does not prove the production mission loop uses these modules, that any model or mission ran, that a supervisor detected the death (the harness performed the replacement), or that Node0 is closed. Four invariants of ten.",
  };

  if (JSON_MODE) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`state ownership:   ${report.state_ownership_verdict}`);
    console.log(`contract immutable:${report.contract_immutability_verdict}`);
    console.log(`killed:            ${report.killed_with}  pids ${report.predecessor_pid} -> ${report.successor_pid}`);
    console.log(`control recovered: ${report.control_recovered}  (must be false)`);
    console.log(`verifier indep:    ${report.verifier_independence_verdict}`);
    console.log(`authority delta:   ${report.authority_delta_verdict} (measured ${report.measured_authority_delta})`);
    console.log(`executor claimed ${report.executor_claimed} / verifier re-derived ${report.independently_rederived}  pids ${report.executor_pid} vs ${report.verifier_pid}`);
    console.log(`artefact:          ${artefact}`);
  }
} finally {
  rmSync(scratch, { recursive: true, force: true });
  if (!KEEP && observation === undefined) rmSync(DEMA_HOME, { recursive: true, force: true });
}
