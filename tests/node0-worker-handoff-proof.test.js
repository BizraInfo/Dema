// NODE0-WORKER-HANDOFF-1A — the producer, exercised for real.
//
// This is the test that costs a real process death. It runs the shipped proof
// script end to end: a worker takes the closure fence and checkpoints, the OS
// kills it, a second worker takes the fence from the corpse and continues the
// chain. Everything else in this slice is classification; this is the measurement.
//
// It is slow by nature (two spawns and a kill) and that is the point — there is
// no faster way to observe a transition between two processes.

import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

import {
  workerHandoffObservation,
  HANDOFF_ARTEFACT_RELPATH,
  WORKER_HANDOFF_INVARIANT_ID,
} from "../packages/core/src/node0-worker-handoff-adapter.js";
import {
  evaluateNode0ClosureInvariants,
  INVARIANT_STATUS,
} from "../packages/core/src/node0-closure-invariants.js";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROOF = join(REPO, "scripts", "proof", "node0-worker-handoff-proof.mjs");

function runProof(home) {
  const out = execFileSync(process.execPath, [PROOF, "--dema-home", home, "--json"], {
    encoding: "utf8",
    cwd: REPO,
    timeout: 120_000,
  });
  return JSON.parse(out);
}

test("WHP-01 a real SIGKILL, a real takeover, a real resume", { timeout: 180_000 }, () => {
  const home = mkdtempSync(join(tmpdir(), "node0-handoff-proof-test-"));
  try {
    const report = runProof(home);

    assert.equal(report.ok, true, `proof did not succeed: ${JSON.stringify(report.blocked_by)}`);
    assert.equal(report.verdict, "HANDOFF_PROVEN");

    // The death must be the OS reporting a kill, not a worker exiting politely.
    // A clean exit would prove an orderly shutdown, which is a different claim.
    assert.equal(report.predecessor.killed_with, "SIGKILL");

    // The fence must have MOVED. This is validated by presenting the dead
    // worker's own token to the shipped validator — a takeover that merely
    // succeeded would not prove the predecessor is barred from writing.
    assert.equal(report.fence_after_takeover, "STALE_OWNER_FENCED");
    assert.equal(report.successor.claim_kind, "DEAD_OWNER_TAKEOVER");

    // The successor continued the chain rather than starting one.
    assert.ok(
      report.successor.resumed_at > report.predecessor.checkpoint,
      "the resumed sequence must advance past the checkpoint",
    );

    // The producer discloses that it executed. The review gate declares the
    // opposite about ITSELF, and both are true of different subjects.
    assert.equal(report.boundary.live_execution_performed, true);
    assert.equal(report.boundary.file_mutation_performed, true);
    assert.equal(report.boundary.network_used, false);
    assert.equal(report.boundary.authority_delta, 0);

    assert.ok(existsSync(join(home, HANDOFF_ARTEFACT_RELPATH)), "artefact must be recorded");
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});

test("WHP-02 the recorded artefact settles the invariant, and tampering unsettles it", { timeout: 180_000 }, () => {
  // THE END-TO-END CLAIM: producer -> artefact -> adapter -> ledger. Asserted
  // together because each half passing alone proves nothing about the join.
  const home = mkdtempSync(join(tmpdir(), "node0-handoff-proof-test-"));
  try {
    assert.equal(runProof(home).ok, true);

    const observation = workerHandoffObservation({ demaHome: home });
    assert.ok(observation, "the recorded handoff must reach the adapter");
    const settled = evaluateNode0ClosureInvariants({ [WORKER_HANDOFF_INVARIANT_ID]: observation });
    assert.equal(
      settled.invariants.find((r) => r.id === WORKER_HANDOFF_INVARIANT_ID).status,
      INVARIANT_STATUS.SATISFIED,
    );
    // Two of ten is not ten of ten, and the ledger must keep saying so.
    assert.equal(settled.node0_closed, false);
    assert.equal(settled.verdict, "OPEN");

    // NEGATIVE CONTROL. Edit one covered fact in the recorded artefact; the
    // adapter must fall silent and the row must return to UNKNOWN. Without this,
    // the assertions above would also pass against an adapter that accepted
    // anything shaped roughly right.
    const path = join(home, HANDOFF_ARTEFACT_RELPATH);
    const tampered = { ...JSON.parse(readFileSync(path, "utf8")), checkpoint_sequence: 99 };
    writeFileSync(path, JSON.stringify(tampered));

    assert.equal(workerHandoffObservation({ demaHome: home }), null);
    const unsettled = evaluateNode0ClosureInvariants({});
    assert.equal(
      unsettled.invariants.find((r) => r.id === WORKER_HANDOFF_INVARIANT_ID).status,
      INVARIANT_STATUS.UNKNOWN,
    );
  } finally {
    rmSync(home, { recursive: true, force: true });
  }
});
