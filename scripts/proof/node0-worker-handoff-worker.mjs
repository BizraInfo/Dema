// NODE0-WORKER-HANDOFF-1A — one worker in the handoff proof.
//
// This process exists to be killed, or to take over from something that was.
// Spawned only by node0-worker-handoff-proof.mjs, always against a caller-supplied
// DEMA_HOME, and it uses the SHIPPED modules — the same season store and the same
// ownership fencing production code uses. Nothing here simulates a handoff. The
// kill is a real SIGKILL of a real OS process.
//
// BOUNDARY: no network, no model, no daemon. The predecessor deliberately does not
// exit on its own: a worker that exits cleanly proves an orderly shutdown, and the
// invariant asks what survives a death the worker did not choose.

import { writeFileSync, renameSync } from "node:fs";

import { saveSeasonState, loadSeasonHead } from "../../packages/receipts/src/season-state-store.js";
import {
  acquireClosureOwnership,
  probeProcessIdentity,
  OWNERSHIP_ACQUIRED,
} from "../../packages/receipts/src/mission-closure-ownership.js";

const [, , role, demaHome, seasonId, transactionId, transactionHash, factsPath, commit, tree] =
  process.argv;

const state = (over = {}) => ({
  season_id: seasonId,
  mission_id: "NODE0-WORKER-HANDOFF-1A",
  mission_contract_hash: null,
  mission_phase: "IMPLEMENTATION",
  completed_steps: ["predecessor checkpointed"],
  next_safe_action: "AWAIT_HANDOFF_PROOF",
  must_not_repeat: [],
  pending_consent: [],
  last_receipt_hash: null,
  repository_commit: commit,
  repository_tree: tree,
  saved_at: "2026-08-09T00:00:00Z",
  ...over,
});

// ATOMIC, for the same reason as the runtime-mission worker: a poller that
// checks existsSync and then parses must never be able to see a prefix.
const emit = (facts) => {
  const tmp = `${factsPath}.partial`;
  writeFileSync(tmp, JSON.stringify(facts));
  renameSync(tmp, factsPath);
};
const fail = (error, detail) => { emit({ error, detail }); process.exit(2); };

const acquired = await acquireClosureOwnership({ demaHome, transactionId, transactionHash });
if (acquired.status !== OWNERSHIP_ACQUIRED) fail(`${role}_could_not_acquire`, acquired);
const probe = await probeProcessIdentity(process.pid);

if (role === "predecessor") {
  const saved = await saveSeasonState({ demaHome, state: state() });
  if (!saved?.ok) fail("predecessor_could_not_checkpoint", saved);
  emit({
    role,
    pid: process.pid,
    boot_identity_hash: probe?.boot_identity_hash ?? null,
    fencing_token: acquired.claim?.claim_hash ?? null,
    claim_kind: acquired.claim?.claim_kind ?? null,
    checkpoint_sequence: saved.state_sequence,
    checkpoint_head_hash: saved.state_hash,
    receipt_hash: saved.receipt_hash,
    season_id: seasonId,
  });
  // Hold the fence and WAIT TO BE KILLED.
  setInterval(() => {}, 1 << 30);
} else {
  // Successor. The predecessor is already dead. Resume ITS checkpoint rather
  // than opening a season of our own.
  const head = await loadSeasonHead({ demaHome, seasonId });
  const prevSeq = head?.head?.state_sequence ?? null;
  const prevHash = head?.head?.state_hash ?? null;
  const prevReceipt = head?.head?.receipt_hash ?? null;

  let resumed = null;
  if (Number.isInteger(prevSeq)) {
    resumed = await saveSeasonState({
      demaHome,
      state: state({
        completed_steps: ["predecessor checkpointed", "successor resumed"],
        next_safe_action: "HANDOFF_RECORDED",
        last_receipt_hash: prevReceipt,
      }),
    });
  }
  emit({
    role,
    pid: process.pid,
    boot_identity_hash: probe?.boot_identity_hash ?? null,
    claim_kind: acquired.claim?.claim_kind ?? null,
    fencing_token: acquired.claim?.claim_hash ?? null,
    predecessor_fencing_token: acquired.claim?.predecessor_claim_hash ?? null,
    resumed_sequence: resumed?.ok ? resumed.state_sequence : null,
    resumed_from_head_hash: prevHash,
    resume_refusal: resumed?.ok ? null : (resumed ?? "no_head_to_resume"),
    season_id: seasonId,
  });
  process.exit(0);
}
