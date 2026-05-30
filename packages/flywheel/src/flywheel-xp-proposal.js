// FLYWHEEL-1D · agent XP grant proposal bridge.
//
// §19 step-11 minimal vertebra. Composes the verified local impact ledger
// (FLYWHEEL-1B/1C) into an XP grant PROPOSAL — and stops there on purpose.
//
//   verified IMPACT_CREDIT ledger entry
//     -> deterministic impact-amount -> XP mapping
//     -> a proposed AGENT-SKILL-1A grant whose sat_validation_receipt_hash
//        is NULL, so the existing skill-ledger kernel REFUSES to mint XP
//        from it (reward_without_validation) until SAT validation + operator
//        approval exist.
//
// This is intentionally not a grant, not SAT, not consent, not a file write,
// not XP, not public economy. It is pure: no key load, no I/O, no clock,
// no randomness. The output is deep-frozen.
//
// PDF §11 load-bearing rules respected by construction:
//   - No XP without proof          -> evidence_impact_receipt_hash = entry hash
//   - No reward without validation -> sat_validation_receipt_hash = null (gap)
//   - No self-minting              -> this module mints nothing

import { verifyLedgerEntry } from "../../econ/src/dual-token-ledger.js";

export const FLYWHEEL_XP_PROPOSAL_SCHEMA =
  "bizra.dema.flywheel_xp_grant_proposal.v0.1";

// 1:1 impact points -> XP. Deterministic, named, re-derivable. Kept trivial
// on purpose; a richer curve is a later slice with its own rule id.
export const XP_FROM_IMPACT_RULE_ID = "impact_amount_to_xp.v0.1";

const PROPOSAL_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: false,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  xp_granted: false,
  consent_required: false,
});

function fail(stage, error, extra = {}) {
  return Object.freeze({
    schema: FLYWHEEL_XP_PROPOSAL_SCHEMA,
    proposed: false,
    truth_label: "LOCAL_FLYWHEEL_XP_PROPOSAL_REFUSED",
    stage,
    error,
    ...extra,
    boundary: PROPOSAL_BOUNDARY,
  });
}

function isNonEmptyString(s) {
  return typeof s === "string" && s.length > 0;
}

export function xpAmountFromImpact(amount) {
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 0) {
    return null;
  }
  return amount; // 1:1
}

/**
 * Propose one XP grant from a verified IMPACT_CREDIT ledger entry. Pure.
 *
 * Returns a frozen proposal envelope on success, or a frozen failure
 * envelope. NEVER grants XP — the proposed grant carries a null
 * sat_validation_receipt_hash so AGENT-SKILL-1A refuses to mint it.
 */
export function proposeFlywheelXpGrant({
  ledgerEntry,
  operatorPubkeyPem,
  skillId,
  agentId,
  createdAtIso,
} = {}) {
  if (
    !isNonEmptyString(createdAtIso) ||
    Number.isNaN(Date.parse(createdAtIso))
  ) {
    return fail("input", "created_at_iso_required");
  }
  if (!isNonEmptyString(skillId)) {
    return fail("input", "skill_id_required");
  }
  if (!isNonEmptyString(agentId)) {
    return fail("input", "agent_id_required");
  }

  // Zero-trust: the impact entry must verify under the EXTERNAL pubkey before
  // it can justify any XP. A tampered amount or foreign key fails here.
  const impactVerification = verifyLedgerEntry({
    entry: ledgerEntry,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!impactVerification.verified) {
    return fail("impact_verify", "impact_entry_unverified", {
      impact_verification: impactVerification,
    });
  }

  if (
    ledgerEntry.entry_type !== "IMPACT_CREDIT" ||
    ledgerEntry.token_class !== "IMPACT"
  ) {
    return fail("impact_verify", "not_an_impact_credit");
  }

  const xpAmount = xpAmountFromImpact(ledgerEntry.amount);
  if (xpAmount === null) {
    return fail("derive", "impact_amount_invalid");
  }

  const proposedSkillGrant = Object.freeze({
    skill_id: skillId,
    xp_amount: xpAmount,
    evidence_impact_receipt_hash: ledgerEntry.entry_hash,
    // The deliberate gap: this is what the AGENT-SKILL-1A gate requires before
    // it will mint XP. It stays null until a DIFFERENT agent's SAT validation
    // and operator approval produce a real hash. This module never fills it.
    sat_validation_receipt_hash: null,
  });

  return Object.freeze({
    schema: FLYWHEEL_XP_PROPOSAL_SCHEMA,
    proposed: true,
    status: "PENDING_SAT_VALIDATION",
    truth_label: "LOCAL_FLYWHEEL_XP_PROPOSAL_PENDING_SAT",
    xp_rule_id: XP_FROM_IMPACT_RULE_ID,
    agent_id: agentId,
    proposed_skill_grant: proposedSkillGrant,
    impact_verification: impactVerification,
    what_this_proves: Object.freeze([
      "A verified IMPACT_CREDIT ledger entry exists and earns a deterministic XP amount.",
      "The proposed grant is bound to that entry's content hash as evidence.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "No XP is granted — sat_validation_receipt_hash is null by design.",
      "No SAT validation, no operator approval, no skill-level change yet.",
      "No public economy, no transfer, no reward value.",
    ]),
    boundary: PROPOSAL_BOUNDARY,
  });
}
