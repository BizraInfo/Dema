// FLYWHEEL-REPLAY-1A · task-coherence verifier (§19 step 17).
//
// RECEIPT-CHAIN-1C binds a task's [action, IMPACT, SAT] receipts into a
// hash-linked canonical chain. Hash links prove tamper-evidence, NOT that the
// three receipts belong to the same task — three individually-valid receipts
// from unrelated runs would still chain-verify. This verifier closes that
// "Frankenstein" hole: it re-derives the semantic cross-references with zero
// trust, so a stranger can confirm the three artifacts are ONE coherent
// verified task, not just three signed objects.
//
// Pure (no key load, no I/O, no clock): each artifact is verified under the
// supplied EXTERNAL public key via the existing per-artifact verifiers, then
// the cross-references are re-derived from the EXISTING rule functions (no
// drift). Output is deep-frozen.
//
// Cross-references proven (all must hold):
//   1. IMPACT.evidence_receipt_hashes includes the flywheel receipt id
//      -> the IMPACT was settled FROM this action.
//   2. IMPACT.amount === impactAmountFromFlywheelScore(re-derived score)
//      -> the reward magnitude follows the action's re-derivable score.
//   3. SAT.evidence_impact_receipt_hash === IMPACT.entry_hash
//      -> the SAT validation is bound to THIS impact.
//   4. SAT.validated_xp_amount === xpAmountFromImpact(IMPACT.amount)
//      -> the validated XP follows the impact by the same rule.

import { replayOneTaskFlywheel } from "./flywheel-one-task.js";
import { impactAmountFromFlywheelScore } from "./flywheel-settlement.js";
import { xpAmountFromImpact } from "./flywheel-xp-proposal.js";
import { verifySatValidationReceipt } from "./flywheel-sat-validation.js";
import { verifyLedgerEntry } from "../../econ/src/dual-token-ledger.js";

export const FLYWHEEL_TASK_COHERENCE_SCHEMA =
  "bizra.dema.flywheel_task_coherence.v0.1";

const PURE_VERIFIER_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: false,
  operator_dema_home_mutated: false,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  public_transfer_performed: false,
  marketplace_used: false,
  house_of_wisdom_mutated: false,
  performance_delta_recorded: false,
  full_node0_complete_claimed: false,
  private_key_material_returned: false,
});

function fail(stage, reason, extra = {}) {
  return Object.freeze({
    schema: FLYWHEEL_TASK_COHERENCE_SCHEMA,
    coherent: false,
    truth_label: "LOCAL_FLYWHEEL_TASK_INCOHERENT",
    stage,
    reason,
    ...extra,
    boundary: PURE_VERIFIER_BOUNDARY,
  });
}

/**
 * Verify that one flywheel receipt + one IMPACT ledger entry + one SAT
 * validation receipt are a single coherent verified task. Pure; zero-trust.
 *
 * @returns frozen { coherent:true, task } or frozen { coherent:false, stage, reason }
 */
export function verifyTaskCoherence({
  flywheelReceipt,
  impactEntry,
  satReceipt,
  operatorPubkeyPem,
} = {}) {
  // ── (1) Each artifact must verify on its own, zero-trust ──────────
  const flywheelReplay = replayOneTaskFlywheel({
    flywheelReceipt,
    actionReceiptId: flywheelReceipt && flywheelReceipt.action_receipt_id,
  });
  if (!flywheelReplay.replayed) {
    return fail("flywheel_replay", flywheelReplay.reason, {
      flywheel_replay: flywheelReplay,
    });
  }

  const impactVerification = verifyLedgerEntry({
    entry: impactEntry,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!impactVerification.verified) {
    return fail("impact_verify", impactVerification.reason, {
      impact_verification: impactVerification,
    });
  }
  if (
    impactEntry.entry_type !== "IMPACT_CREDIT" ||
    impactEntry.token_class !== "IMPACT"
  ) {
    return fail("impact_verify", "not_an_impact_credit");
  }

  const satVerification = verifySatValidationReceipt({
    receipt: satReceipt,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!satVerification.verified) {
    return fail("sat_verify", satVerification.reason, {
      sat_verification: satVerification,
    });
  }

  // ── (2) Cross-references — the actual coherence proof ─────────────
  const score = flywheelReplay.score;

  // (a) IMPACT settled FROM this action.
  if (
    !Array.isArray(impactEntry.evidence_receipt_hashes) ||
    !impactEntry.evidence_receipt_hashes.includes(flywheelReceipt.receipt_id)
  ) {
    return fail("cross_reference", "impact_not_derived_from_action");
  }
  // (b) IMPACT magnitude follows the re-derived score.
  if (impactEntry.amount !== impactAmountFromFlywheelScore(score)) {
    return fail("cross_reference", "impact_amount_incoherent");
  }
  // (c) SAT bound to THIS impact.
  if (satReceipt.evidence_impact_receipt_hash !== impactEntry.entry_hash) {
    return fail("cross_reference", "sat_not_bound_to_impact");
  }
  // (d) Validated XP follows the impact by the same rule.
  if (
    satReceipt.validated_xp_amount !== xpAmountFromImpact(impactEntry.amount)
  ) {
    return fail("cross_reference", "xp_amount_incoherent");
  }

  return Object.freeze({
    schema: FLYWHEEL_TASK_COHERENCE_SCHEMA,
    coherent: true,
    truth_label: "LOCAL_FLYWHEEL_TASK_COHERENT",
    task: Object.freeze({
      action_receipt_id: flywheelReceipt.action_receipt_id,
      flywheel_receipt_id: flywheelReceipt.receipt_id,
      impact_entry_hash: impactEntry.entry_hash,
      sat_receipt_hash: satReceipt.receipt_hash,
      claim_state: flywheelReceipt.claim_state,
      score,
      impact_amount: impactEntry.amount,
      xp_amount: satReceipt.validated_xp_amount,
    }),
    verifications: Object.freeze({
      flywheel_replay: flywheelReplay,
      impact_verification: impactVerification,
      sat_verification: satVerification,
    }),
    boundary: PURE_VERIFIER_BOUNDARY,
  });
}
