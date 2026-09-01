// L2-MICRO-LOOP-1A — chained verified micro-acts under one human-issued envelope.
//
// L2 does NOT introduce a second executor, receipt spine, or authority system.
// It composes the shipped L1 closed cycle, but it refuses L1's legacy/simple
// lease shape as authority. Before L2 may invoke the mechanical L1 primitive,
// the current v0.2 capability-lease kernel must re-verify an attenuated lease
// chain and return ALLOW.
//
// Semantics are VERIFIED PREFIX, not hidden transactionality:
//   - a hard system ceiling bounds the number of micro-acts per invocation;
//   - once an act is verified and sealed, it is history and remains committed;
//   - if a later act refuses/fails, no later act runs and the verified prefix
//     remains intact;
//   - the same L1 receipt chain is extended; L2 creates no parallel truth spine;
//   - authority_delta is always zero and every child result is checked for it.
//
// Authority law:
//   MODERN ATTENUATED LEASE -> authorityVerdict(ALLOW) -> mechanical L1 lease.
// The mechanical lease is a projection of already-verified authority, not a
// second grant. It is fixed to one act and can only be narrower than the leaf.
//
// No daemon. No scheduler. No model/network call. No LLM-as-judge. No mint.

import { authorityVerdict } from "./dema-capability-lease.js";
import { runL1Cycle, verifyChain } from "./l1-micro-loop.js";

export const L2_SCHEMA = "bizra.dema.l2_micro_loop.v0.2";
export const L2_TRUTH_LABEL = "L2_CHAINED_VERIFIED_PREFIX";

// System safety ceiling, not authority. A caller cannot raise it. Human authority
// is carried by the attenuated lease chain; this constant only narrows throughput.
export const L2_MAX_ACTS = 3;

function freezeRows(rows) {
  return Object.freeze(rows.map((row) => Object.freeze(row)));
}

function baseResult(extra = {}) {
  return Object.freeze({
    schema: L2_SCHEMA,
    truth_label: L2_TRUTH_LABEL,
    authority_delta: 0,
    ...extra,
  });
}

function validAct(act) {
  return (
    !!act &&
    typeof act === "object" &&
    !Array.isArray(act) &&
    typeof act.act_id === "string" &&
    act.act_id.length > 0 &&
    typeof act.src === "string" &&
    act.src.length > 0 &&
    typeof act.dst === "string" &&
    act.dst.length > 0
  );
}

function validateActs(acts) {
  if (!Array.isArray(acts) || acts.length === 0) return "acts_required";
  if (acts.length > L2_MAX_ACTS) return "chain_act_limit_exceeded";
  const ids = new Set();
  for (const act of acts) {
    if (!validAct(act)) return "act_malformed";
    if (ids.has(act.act_id)) return "duplicate_act_id";
    ids.add(act.act_id);
  }
  return null;
}

function authorityShapeOk(authority) {
  return (
    !!authority &&
    typeof authority === "object" &&
    typeof authority.capability_id === "string" &&
    authority.capability_id.length > 0 &&
    Array.isArray(authority.lease_chain) &&
    authority.lease_chain.length > 0 &&
    !!authority.standing_lease &&
    typeof authority.standing_lease === "object" &&
    typeof authority.hash === "function" &&
    !!authority.machine_state &&
    typeof authority.machine_state === "object"
  );
}

function iso(ms) {
  const value = new Date(ms).toISOString();
  return value;
}

// A rename changes one directory-entry binding and no file content bytes. Its
// reversible blast is therefore one file / zero content bytes. L1 separately
// verifies source/destination scope, destination occupancy, checkpoint restore,
// and byte identity.
function renameBlast() {
  return Object.freeze({ reversible: true, files: 1, bytes: 0 });
}

function renderAuthorityVerdict(authority, sandboxRoot, now) {
  return authorityVerdict({
    effect_class: "reversible_local",
    capability_id: authority.capability_id,
    exact_scope: sandboxRoot,
    standing_lease: authority.standing_lease,
    lease_chain: authority.lease_chain,
    hash: authority.hash,
    contract: "v0.2",
    measured_blast_radius: renameBlast(),
    machine_state: authority.machine_state,
    now: iso(now),
  });
}

// L1 still owns the mechanical rename/checkpoint/verify/seal primitive. L2
// supplies it a one-act projection only AFTER the stronger v0.2 authority
// verdict is ALLOW. The projection cannot outlive or outscope the verified leaf.
function projectMechanicalLease(authority) {
  const leaf = authority.lease_chain[authority.lease_chain.length - 1];
  return Object.freeze({
    lease_id: `attenuated:${leaf.chain_hash}`,
    scope_root: leaf.scope,
    expires_at: Date.parse(leaf.expires_at),
    budget_acts: 1,
  });
}

function refusal(reason, extra = {}) {
  return baseResult({
    ok: false,
    outcome: "REFUSED",
    reason,
    attempted_acts: 0,
    completed_acts: 0,
    remaining_chain_slots: L2_MAX_ACTS,
    receipts: Object.freeze([]),
    chain_entries_before: null,
    chain_entries_after: null,
    ...extra,
  });
}

/**
 * Run an ordered chain of L1-shaped reversible acts under ONE modern authority
 * chain. Each act re-renders authority at its own step time before L1 is called,
 * so expiry or changed machine readiness halts rather than turning preflight
 * into standing authority.
 */
export function runL2Chain({
  sandboxRoot,
  acts,
  authority = null,
  proposer = "actor:typed-intent",
  certifier = "habitat:l1-kernel",
  now = Date.now(),
  anchorDir = null,
} = {}) {
  const actProblem = validateActs(acts);
  if (actProblem) return refusal(actProblem);

  if (!authorityShapeOk(authority)) return refusal("modern_authority_required");

  // Positive preflight: prove the presented chain is lawful and covers this
  // exact effect class/scope before any L1 state or filesystem mutation exists.
  const initialAuthority = renderAuthorityVerdict(authority, sandboxRoot, now);
  if (initialAuthority.verdict !== "ALLOW") {
    return refusal(initialAuthority.reason, {
      authority_verdict: initialAuthority.verdict,
    });
  }

  const before = verifyChain(sandboxRoot);
  if (!before.valid) {
    return refusal("receipt_chain_invalid", {
      detail: before.why ?? null,
      remaining_chain_slots: L2_MAX_ACTS,
      chain_entries_before: before.entries,
      chain_entries_after: before.entries,
    });
  }

  const receipts = [];
  let attempted = 0;
  let completed = 0;

  for (let i = 0; i < acts.length; i++) {
    const act = acts[i];
    attempted += 1;

    // Complete mediation: the fact that act 1 was allowed does not authorize
    // act 2. Re-check the same attenuated chain at the current step time.
    const stepAuthority = renderAuthorityVerdict(authority, sandboxRoot, now + i);
    if (stepAuthority.verdict !== "ALLOW") {
      const afterAuthorityRefusal = verifyChain(sandboxRoot);
      return baseResult({
        ok: false,
        outcome: "HALTED_VERIFIED_PREFIX",
        reason: stepAuthority.reason,
        authority_verdict: stepAuthority.verdict,
        failed_act_id: act.act_id,
        attempted_acts: attempted,
        completed_acts: completed,
        remaining_chain_slots: L2_MAX_ACTS - completed,
        receipts: freezeRows(receipts),
        chain_entries_before: before.entries,
        chain_entries_after: afterAuthorityRefusal.entries,
      });
    }

    const child = runL1Cycle({
      sandboxRoot,
      src: act.src,
      dst: act.dst,
      lease: projectMechanicalLease(authority),
      proposer,
      certifier,
      now: now + i,
      anchorDir,
    });

    if (child.authority_delta !== 0) {
      const afterAuthorityViolation = verifyChain(sandboxRoot);
      return baseResult({
        ok: false,
        outcome: "HALTED_VERIFIED_PREFIX",
        reason: "child_authority_delta_nonzero",
        failed_act_id: act.act_id,
        attempted_acts: attempted,
        completed_acts: completed,
        remaining_chain_slots: L2_MAX_ACTS - completed,
        receipts: freezeRows(receipts),
        chain_entries_before: before.entries,
        chain_entries_after: afterAuthorityViolation.entries,
      });
    }

    if (!child.ok || child.outcome !== "PASS") {
      const afterFailure = verifyChain(sandboxRoot);
      return baseResult({
        ok: false,
        outcome: "HALTED_VERIFIED_PREFIX",
        reason: child.reason ?? `l1_outcome:${child.outcome ?? "unknown"}`,
        detail: child.detail ?? null,
        failed_act_id: act.act_id,
        attempted_acts: attempted,
        completed_acts: completed,
        remaining_chain_slots: L2_MAX_ACTS - completed,
        receipts: freezeRows(receipts),
        chain_entries_before: before.entries,
        chain_entries_after: afterFailure.entries,
      });
    }

    if (!child.receipt || child.receipt.authority_delta !== 0) {
      const afterReceiptViolation = verifyChain(sandboxRoot);
      return baseResult({
        ok: false,
        outcome: "HALTED_VERIFIED_PREFIX",
        reason: "child_receipt_authority_invalid",
        failed_act_id: act.act_id,
        attempted_acts: attempted,
        completed_acts: completed,
        remaining_chain_slots: L2_MAX_ACTS - completed,
        receipts: freezeRows(receipts),
        chain_entries_before: before.entries,
        chain_entries_after: afterReceiptViolation.entries,
      });
    }

    const afterAct = verifyChain(sandboxRoot);
    if (!afterAct.valid) {
      return baseResult({
        ok: false,
        outcome: "HALTED_VERIFIED_PREFIX",
        reason: "receipt_chain_invalid_after_act",
        detail: afterAct.why ?? null,
        failed_act_id: act.act_id,
        attempted_acts: attempted,
        completed_acts: completed,
        remaining_chain_slots: L2_MAX_ACTS - completed,
        receipts: freezeRows(receipts),
        chain_entries_before: before.entries,
        chain_entries_after: afterAct.entries,
      });
    }

    receipts.push(child.receipt);
    completed += 1;
  }

  const after = verifyChain(sandboxRoot);
  if (!after.valid) {
    return baseResult({
      ok: false,
      outcome: "HALTED_VERIFIED_PREFIX",
      reason: "receipt_chain_invalid_after_chain",
      detail: after.why ?? null,
      attempted_acts: attempted,
      completed_acts: completed,
      remaining_chain_slots: L2_MAX_ACTS - completed,
      receipts: freezeRows(receipts),
      chain_entries_before: before.entries,
      chain_entries_after: after.entries,
    });
  }

  return baseResult({
    ok: true,
    outcome: "PASS",
    decision: "stop_clean",
    attempted_acts: attempted,
    completed_acts: completed,
    remaining_chain_slots: L2_MAX_ACTS - completed,
    receipts: freezeRows(receipts),
    chain_entries_before: before.entries,
    chain_entries_after: after.entries,
  });
}
