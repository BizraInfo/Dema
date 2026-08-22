// L2-MICRO-LOOP-1A — chained verified micro-acts under one human-issued envelope.
//
// L2 does NOT introduce a second executor, receipt spine, or authority system.
// It composes the shipped L1 closed cycle. Each act is independently gated,
// checkpointed, judge-free verified, and sealed by L1 before L2 may attempt the
// next act.
//
// Semantics are VERIFIED PREFIX, not hidden transactionality:
//   - insufficient envelope budget refuses the entire chain before mutation;
//   - once an act is verified and sealed, it is history and remains committed;
//   - if a later act refuses/fails, no later act runs and the verified prefix
//     remains intact;
//   - the same L1 receipt chain is extended; L2 creates no parallel truth spine;
//   - authority_delta is always zero and every child result is checked for it.
//
// No daemon. No scheduler. No model/network call. No LLM-as-judge. No mint.

import { checkLease, runL1Cycle, verifyChain } from "./l1-micro-loop.js";

export const L2_SCHEMA = "bizra.dema.l2_micro_loop.v0.1";
export const L2_TRUTH_LABEL = "L2_CHAINED_VERIFIED_PREFIX";

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
  const ids = new Set();
  for (const act of acts) {
    if (!validAct(act)) return "act_malformed";
    if (ids.has(act.act_id)) return "duplicate_act_id";
    ids.add(act.act_id);
  }
  return null;
}

/**
 * Run an ordered chain of already-admissible L1-shaped reversible acts.
 *
 * The envelope is checked once before mutation for shape/scope/expiry and for
 * enough total act budget. L1 checks the same lease again for every individual
 * act, using the remaining budget and the current step time. A lease can thus
 * expire during a chain; that halts at the verified prefix rather than letting
 * a preflight observation become standing authority.
 */
export function runL2Chain({
  sandboxRoot,
  acts,
  lease,
  proposer = "actor:typed-intent",
  certifier = "habitat:l1-kernel",
  now = Date.now(),
  anchorDir = null,
} = {}) {
  const actProblem = validateActs(acts);
  if (actProblem) {
    return baseResult({
      ok: false,
      outcome: "REFUSED",
      reason: actProblem,
      attempted_acts: 0,
      completed_acts: 0,
      receipts: Object.freeze([]),
      chain_entries_before: null,
      chain_entries_after: null,
    });
  }

  const leaseProblem = checkLease(lease, { sandboxRoot, now });
  if (leaseProblem) {
    return baseResult({
      ok: false,
      outcome: "REFUSED",
      reason: leaseProblem,
      attempted_acts: 0,
      completed_acts: 0,
      receipts: Object.freeze([]),
      chain_entries_before: null,
      chain_entries_after: null,
    });
  }

  if (!Number.isInteger(lease.budget_acts) || lease.budget_acts < acts.length) {
    return baseResult({
      ok: false,
      outcome: "REFUSED",
      reason: "lease_budget_insufficient_for_chain",
      attempted_acts: 0,
      completed_acts: 0,
      remaining_budget: Number.isInteger(lease.budget_acts) ? lease.budget_acts : 0,
      receipts: Object.freeze([]),
      chain_entries_before: null,
      chain_entries_after: null,
    });
  }

  const before = verifyChain(sandboxRoot);
  if (!before.valid) {
    return baseResult({
      ok: false,
      outcome: "REFUSED",
      reason: "receipt_chain_invalid",
      detail: before.why ?? null,
      attempted_acts: 0,
      completed_acts: 0,
      remaining_budget: lease.budget_acts,
      receipts: Object.freeze([]),
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

    const childLease = {
      ...lease,
      // Narrow only. This cannot grant anything the parent did not hold.
      budget_acts: lease.budget_acts - i,
    };

    const child = runL1Cycle({
      sandboxRoot,
      src: act.src,
      dst: act.dst,
      lease: childLease,
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
        remaining_budget: lease.budget_acts - completed,
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
        remaining_budget: lease.budget_acts - completed,
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
        remaining_budget: lease.budget_acts - completed,
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
        remaining_budget: lease.budget_acts - completed,
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
      remaining_budget: lease.budget_acts - completed,
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
    remaining_budget: lease.budget_acts - completed,
    receipts: freezeRows(receipts),
    chain_entries_before: before.entries,
    chain_entries_after: after.entries,
  });
}
