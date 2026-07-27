// DEMA-REVERSIBLE-FILE-STEWARD-1B — sequenced execution + proven undo.
//
// Sequences the shipped, tested single-atom reversible-rename gate
// (executeReversibleRename / undoReversibleRename) over a bounded steward job,
// and PROVES the whole job round-trips: execute-all then undo-all returns the
// sandbox's user-file set to genesis. Per-atom content restoration is proven by
// the gate itself against its independent on-disk backup (undo → proven:true).
//
// Unlike the 1A planner (all-false), this kernel EXECUTES via an INJECTED fs —
// sandbox-scoped reversible file mutation only. Its boundary honestly reflects
// that: sandbox_only + reversible + undo_available true; network / model / mint /
// wallet / federation false. No network, no model, no clock (now injected).
//
// Effects are injected (fs, now). The gate's own containment (realpath, lstat,
// symlink refusal, no-clobber, exclusive backup, receipt log) does the disk work.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  planReversibleRename,
  executeReversibleRename,
  undoReversibleRename,
  NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
  NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
} from "./node0-reversible-execute-gate.js";

export const DEMA_REVERSIBLE_FILE_STEWARD_EXECUTION_SCHEMA = "bizra.dema.dema_reversible_file_steward_execution.v0.1";
export const DEMA_REVERSIBLE_FILE_STEWARD_EXECUTION_TRUTH_LABEL = "DEMA_REVERSIBLE_FILE_STEWARD_EXECUTION_MEASURED_REPO";
export const DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE = "GO: execute reversible file steward job with backup and undo receipts";

// Executed boundary — the honest observed reality of a sandbox-scoped reversible
// run: it mutates files (reversibly, with undo) but touches no network / model /
// economic surface. NOT all-false; that would be a false claim for an executor.
export function demaReversibleFileStewardExecutionBoundary() {
  return Object.freeze({
    sandbox_only: true,
    reversible: true,
    undo_available: true,
    network_used: false,
    model_invocation_performed: false,
    token_minted: false,
    wallet_accessed: false,
    federation_live: false,
  });
}

// A user-visible file is a regular, non-symlink file whose name is not one of the
// gate's own artifacts (backup dir / receipt log all start with ".node0-").
function isUserVisible(name) {
  return typeof name === "string" && name.length > 0 && !name.startsWith(".node0-") && !name.includes("/");
}

// Read-only measurement of the sandbox's user-file set. Content restoration is
// proven per-atom by the gate; this captures the NAME set to prove the whole job
// round-trips. fs injected.
export function measureStewardDirState({ fs, sandboxRoot } = {}) {
  if (!fs || typeof fs.readdirSync !== "function" || typeof fs.lstatSync !== "function") {
    return Object.freeze({ ok: false, reason: "fs_adapter_missing", files: Object.freeze([]), state_hash: null });
  }
  let entries;
  try {
    entries = fs.readdirSync(sandboxRoot);
  } catch {
    return Object.freeze({ ok: false, reason: "sandbox_root_unreadable", files: Object.freeze([]), state_hash: null });
  }
  const files = [];
  for (const name of entries) {
    if (!isUserVisible(name)) continue;
    try {
      const st = fs.lstatSync(`${sandboxRoot}/${name}`);
      if (st.isFile() && !st.isSymbolicLink()) files.push(name);
    } catch {
      /* skip unreadable */
    }
  }
  files.sort();
  return Object.freeze({
    ok: true,
    files: Object.freeze(files),
    state_hash: sha256CanonicalJsonV1({ user_files: files }),
  });
}

// Execute each atom in order via the shipped gate. TRANSACTIONAL: on the first
// atom that does not seal an executed receipt, auto-roll-back every already-applied
// atom (reverse order) so the sandbox returns to genesis — all-or-nothing, never a
// partial mutation left for manual cleanup. The genuinely dangerous case (a rollback
// undo that cannot prove) is surfaced loudly as `rollback_incomplete`, not hidden.
export function sequenceExecuteStewardJob({ sandboxRoot, atoms, consent, fs, now = null } = {}) {
  if (consent !== DEMA_REVERSIBLE_FILE_STEWARD_EXECUTE_GO_PHRASE) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["consent_phrase_mismatch"]), executed_count: 0, receipts: Object.freeze([]), stopped_at: null });
  }
  if (!Array.isArray(atoms) || atoms.length === 0) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["atoms_empty"]), executed_count: 0, receipts: Object.freeze([]), stopped_at: null });
  }
  const receipts = [];
  let stopped_at = null;
  for (let i = 0; i < atoms.length; i++) {
    const plan = planReversibleRename({
      sandboxRoot,
      fileName: atoms[i]?.from,
      newName: atoms[i]?.to,
      goPhrase: NODE0_REVERSIBLE_EXECUTE_GO_PHRASE,
      actionType: NODE0_REVERSIBLE_EXECUTE_ACTION_TYPE,
    });
    const receipt = executeReversibleRename({ plan, fs, now });
    if (receipt.executed !== true) {
      stopped_at = Object.freeze({ index: i, from: atoms[i]?.from ?? null, blocked_by: receipt.blocked_by ?? Object.freeze([]) });
      break;
    }
    receipts.push(receipt);
  }

  if (stopped_at === null) {
    return Object.freeze({
      ok: true,
      blocked_by: Object.freeze([]),
      executed_count: receipts.length,
      applied_before_stop: receipts.length,
      rolled_back: false,
      rollback_results: Object.freeze([]),
      receipts: Object.freeze(receipts),
      stopped_at,
    });
  }

  // Partial failure — reverse every applied atom, newest first.
  const rollback_results = [];
  let reverted_count = 0;
  for (let j = receipts.length - 1; j >= 0; j--) {
    const undo = undoReversibleRename({ receipt: receipts[j], fs });
    const reverted = undo.undone === true && undo.proven === true;
    if (reverted) reverted_count += 1;
    rollback_results.push(Object.freeze({
      from: receipts[j]?.to ?? null,
      to: receipts[j]?.from ?? null,
      reverted,
      reason: undo.reason ?? null,
    }));
  }
  const rolled_back = reverted_count === receipts.length;
  return Object.freeze({
    ok: false,
    blocked_by: Object.freeze([rolled_back ? "execute_stopped_rolled_back" : "execute_stopped_rollback_incomplete"]),
    executed_count: receipts.length - reverted_count, // net atoms still applied (0 when fully rolled back)
    applied_before_stop: receipts.length,
    rolled_back,
    rollback_results: Object.freeze(rollback_results),
    receipts: Object.freeze(receipts),
    stopped_at,
  });
}

// Undo every sealed receipt in reverse order. The gate proves each restoration
// against its independent on-disk backup (proven === true).
export function sequenceUndoStewardJob({ receipts, fs } = {}) {
  if (!Array.isArray(receipts)) {
    return Object.freeze({ ok: false, undo_results: Object.freeze([]) });
  }
  const undo_results = [];
  for (let i = receipts.length - 1; i >= 0; i--) {
    const r = receipts[i];
    const result = undoReversibleRename({ receipt: r, fs });
    undo_results.push(Object.freeze({ from: r?.to ?? null, to: r?.from ?? null, undone: result.undone === true, proven: result.proven === true, reason: result.reason ?? null }));
  }
  const ok = undo_results.length === receipts.length && undo_results.every((u) => u.undone && u.proven);
  return Object.freeze({ ok, undo_results: Object.freeze(undo_results) });
}

// The proof of the whole slice: measure genesis → execute-all → undo-all →
// measure final; the job round-trips iff every atom executed, every undo proved,
// and the user-file state hash returns to genesis.
export function verifyStewardRoundTrip({ sandboxRoot, atoms, consent, fs, now = null } = {}) {
  const boundary = demaReversibleFileStewardExecutionBoundary();
  const base = {
    schema: DEMA_REVERSIBLE_FILE_STEWARD_EXECUTION_SCHEMA,
    truth_label: DEMA_REVERSIBLE_FILE_STEWARD_EXECUTION_TRUTH_LABEL,
    boundary,
  };
  const genesis = measureStewardDirState({ fs, sandboxRoot });
  if (!genesis.ok) return Object.freeze({ ...base, round_trip_ok: false, stage: "genesis", reason: genesis.reason });

  const exec = sequenceExecuteStewardJob({ sandboxRoot, atoms, consent, fs, now });
  if (!exec.ok) return Object.freeze({ ...base, round_trip_ok: false, stage: "execute", executed_count: exec.executed_count, blocked_by: exec.blocked_by, stopped_at: exec.stopped_at });

  const undo = sequenceUndoStewardJob({ receipts: exec.receipts, fs });
  const final = measureStewardDirState({ fs, sandboxRoot });
  const restored = final.ok && genesis.state_hash === final.state_hash;
  return Object.freeze({
    ...base,
    round_trip_ok: exec.ok && undo.ok && restored,
    executed_count: exec.executed_count,
    all_undone_proven: undo.ok,
    genesis_hash: genesis.state_hash,
    final_hash: final.ok ? final.state_hash : null,
    genesis_files: genesis.files,
    undo_results: undo.undo_results,
  });
}
