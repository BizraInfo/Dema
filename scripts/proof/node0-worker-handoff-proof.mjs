// NODE0-WORKER-HANDOFF-1A — the producer. Kills a real worker and records what
// survived, so the closure adapter has something honest to read.
//
//   node scripts/proof/node0-worker-handoff-proof.mjs [--dema-home <path>] [--json]
//
// ── WHAT IT ACTUALLY DOES ──
// Spawns worker A, which acquires the closure fence and checkpoints a season.
// SIGKILLs it — no signal handler, no chance to tidy up. Spawns worker B, which
// finds the owner dead, takes the fence over, and resumes A's checkpoint. Then
// proves the fence really moved by presenting A's OLD token and requiring the
// shipped validator to answer STALE_OWNER_FENCED.
//
// ── BOUNDARIES ──
// NO DAEMON: two short-lived foreground children, both reaped before exit.
// NO NETWORK, NO MODEL, NO AUTHORITY: `authority_delta` is 0 in the artefact.
// DEMA_HOME: defaults to a fresh temp dir. It writes into the real home ONLY when
// `--dema-home` names it explicitly, because recording a closure artefact into the
// operator's live state is their call, not a default.

import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import { sha256CanonicalJsonV1 } from "../../packages/canon/src/sha256-canonical-json-v1.js";
import { buildWorkerHandoffObservation } from "../../packages/core/src/node0-worker-handoff.js";
import {
  currentKernelHash,
  HANDOFF_ARTEFACT_RELPATH,
} from "../../packages/core/src/node0-worker-handoff-adapter.js";
import {
  validateFencingToken,
  STALE_OWNER_FENCED,
} from "../../packages/receipts/src/mission-closure-ownership.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const WORKER = join(HERE, "node0-worker-handoff-worker.mjs");
const argv = process.argv.slice(2);
const JSON_MODE = argv.includes("--json");
const homeArg = argv.indexOf("--dema-home");
const KEEP = homeArg !== -1;
const DEMA_HOME = KEEP ? argv[homeArg + 1] : mkdtempSync(join(tmpdir(), "node0-handoff-proof-"));

const SEASON = "season-handoff-proof";
const TX = "node0-worker-handoff-proof";
const TX_HASH = `sha256:${"7".repeat(64)}`;
const COMMIT = "0".repeat(40);
const TREE = "1".repeat(40);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

async function until(predicate, label, ms = 30_000) {
  const deadline = Date.now() + ms;
  while (!predicate()) {
    if (Date.now() > deadline) throw new Error(`timed out waiting for ${label}`);
    await wait(25);
  }
}

/// A file appearing is not a file finished: the parent can see the pathname after
/// open(2) and before the bytes land, so read only what parses.
function readWhenComplete(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function spawnWorker(role, factsPath) {
  return spawn(
    process.execPath,
    [WORKER, role, DEMA_HOME, SEASON, TX, TX_HASH, factsPath, COMMIT, TREE],
    { stdio: "ignore" },
  );
}

const scratch = mkdtempSync(join(tmpdir(), "node0-handoff-facts-"));
const preFacts = join(scratch, "pre.json");
const sucFacts = join(scratch, "suc.json");

let observation;
try {
  // ── 1. the predecessor takes the fence and checkpoints ──
  const a = spawnWorker("predecessor", preFacts);
  let pre = null;
  await until(() => (pre = readWhenComplete(preFacts)) !== null, "predecessor checkpoint");
  if (pre.error) throw new Error(`${pre.error}: ${JSON.stringify(pre.detail).slice(0, 300)}`);

  // ── 2. kill it. SIGKILL, so it cannot release the fence or flush anything ──
  const exited = new Promise((r) => a.on("exit", (code, signal) => r({ code, signal })));
  a.kill("SIGKILL");
  const death = await exited;

  // ── 3. the successor finds a dead owner, takes over, resumes ──
  const b = spawnWorker("successor", sucFacts);
  await new Promise((r) => b.on("exit", r));
  const suc = readWhenComplete(sucFacts);
  if (!suc) throw new Error("successor produced no facts");
  if (suc.error) throw new Error(`${suc.error}: ${JSON.stringify(suc.detail).slice(0, 300)}`);

  // ── 4. prove the fence MOVED, rather than assuming the takeover implies it ──
  // Present the dead worker's own token to the shipped validator. Anything but
  // STALE_OWNER_FENCED means the predecessor could still write.
  const fence = await validateFencingToken({
    demaHome: DEMA_HOME,
    transactionId: TX,
    fencingToken: pre.fencing_token,
  });
  const fenceStatus = fence.valid === false && fence.status === STALE_OWNER_FENCED
    ? STALE_OWNER_FENCED
    : `NOT_FENCED:${fence.status ?? "unknown"}`;

  observation = buildWorkerHandoffObservation({
    evidenceClass: "OBSERVED",
    executedCodeHash: currentKernelHash(),
    observedAt: new Date().toISOString(),
    predecessor: {
      worker_id: "predecessor",
      pid: pre.pid,
      boot_identity_hash: pre.boot_identity_hash,
      // The kill is the fact. `signal === "SIGKILL"` is the OS reporting the
      // death, not the worker claiming it.
      exited: death.signal === "SIGKILL" || death.code !== null,
      checkpoint_sequence: pre.checkpoint_sequence,
      checkpoint_head_hash: pre.checkpoint_head_hash,
      fencing_token: pre.fencing_token,
      season_id: pre.season_id,
    },
    successor: {
      worker_id: "successor",
      pid: suc.pid,
      boot_identity_hash: suc.boot_identity_hash,
      claim_kind: suc.claim_kind,
      predecessor_fence_status: fenceStatus,
      fencing_token: suc.fencing_token,
      predecessor_fencing_token: suc.predecessor_fencing_token,
      resumed_sequence: suc.resumed_sequence,
      resumed_from_head_hash: suc.resumed_from_head_hash,
      season_id: suc.season_id,
    },
    hash: sha256CanonicalJsonV1,
  });

  const artefact = join(DEMA_HOME, HANDOFF_ARTEFACT_RELPATH);
  mkdirSync(dirname(artefact), { recursive: true });
  writeFileSync(artefact, `${JSON.stringify(observation, null, 2)}\n`);

  const report = {
    schema: "bizra.dema.node0_worker_handoff_proof.v0.1",
    ok: observation.verdict === "HANDOFF_PROVEN",
    verdict: observation.verdict,
    blocked_by: observation.blocked_by,
    dema_home: DEMA_HOME,
    artefact,
    observation_hash: observation.observation_hash,
    predecessor: { pid: pre.pid, killed_with: death.signal, checkpoint: pre.checkpoint_sequence },
    successor: { pid: suc.pid, resumed_at: suc.resumed_sequence, claim_kind: suc.claim_kind },
    fence_after_takeover: fenceStatus,
    boundary: {
      live_execution_performed: true,
      file_mutation_performed: true,
      network_used: false,
      model_invocation_performed: false,
      daemon_started: false,
      authority_delta: 0,
    },
    what_this_proves:
      "The shipped season store and ownership fence survive a real SIGKILL: a second OS process took the fence from a dead owner and continued its checkpoint chain.",
    what_this_does_not_prove:
      "Does not prove the production mission loop uses these modules, that any model or mission ran, or that Node0 is closed. One invariant of ten.",
  };

  if (JSON_MODE) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`verdict:  ${report.verdict}`);
    console.log(`fence:    ${fenceStatus}`);
    console.log(`resumed:  seq ${pre.checkpoint_sequence} -> ${suc.resumed_sequence}`);
    console.log(`artefact: ${artefact}`);
  }
  if (!report.ok) process.exitCode = 1;
} finally {
  rmSync(scratch, { recursive: true, force: true });
  if (!KEEP && observation === undefined) rmSync(DEMA_HOME, { recursive: true, force: true });
}
