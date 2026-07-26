// SAT-VALIDATE-1A · SAT validation receipt for an XP grant proposal.
//
// §19 step-11 closing vertebra. FLYWHEEL-1D emits a PENDING XP proposal that
// AGENT-SKILL-1A refuses to mint (reward_without_validation) until a
// sat_validation_receipt_hash exists. This kernel produces that hash.
//
//   FLYWHEEL-1D proposal + verified IMPACT_CREDIT entry
//     -> a SAT-5 agent (NOT the subject) re-derives the XP from the entry
//        via the SAME named rule (no drift, no inflation)
//     -> one signed SAT validation receipt, content-addressed
//     -> receipt.receipt_hash is exactly the sat_validation_receipt_hash the
//        skill ledger needs.
//
// PDF §11 laws enforced here:
//   - No self-verification  -> self_validation_forbidden
//   - No reward without verified impact -> impact entry re-verified first
//   - SAT must validate reward eligibility -> validator must be a SAT-5 id
//
// Pure-with-key-load: loads the operator key to sign, but no other I/O, no
// clock, no randomness. Output is deep-frozen. Grants nothing by itself —
// the operator still supplies key-bound consent to buildSkillLedger to mint.

import { createPublicKey } from "node:crypto";
import {
  signPayload,
  verifyPayload,
} from "../../receipts/src/authorship-signature.js";
import {
  loadActiveKeyPair,
} from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { verifyLedgerEntry } from "../../econ/src/dual-token-ledger.js";
import { CANONICAL_AGENTS } from "../../agents/src/agent-profile-registry.js";
import {
  FLYWHEEL_XP_PROPOSAL_SCHEMA,
  XP_FROM_IMPACT_RULE_ID,
  xpAmountFromImpact,
} from "./flywheel-xp-proposal.js";

export const SAT_VALIDATION_RECEIPT_SCHEMA =
  "bizra.dema.sat_validation_receipt.v0.1";

// The legal validators — canonical SAT-5 ids, derived from the registry so
// this set can never drift from CANONICAL_AGENTS.
export const SAT_AGENT_IDS = Object.freeze(
  CANONICAL_AGENTS.filter((a) => a.agent_class === "SAT").map(
    (a) => a.agent_id,
  ),
);
const SAT_ID_SET = new Set(SAT_AGENT_IDS);

function fail(error, extra = {}) {
  return Object.freeze({
    schema: SAT_VALIDATION_RECEIPT_SCHEMA,
    validated: false,
    truth_label: "LOCAL_SAT_VALIDATION_REFUSED",
    error,
    ...extra,
  });
}

function reject(reason) {
  return Object.freeze({ verified: false, rejected: true, reason });
}

function fingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  return sha256(pk.export({ type: "spki", format: "der" }).toString("hex"));
}

function isNonEmptyString(s) {
  return typeof s === "string" && s.length > 0;
}

function isSha256Hex(s) {
  return typeof s === "string" && /^[a-f0-9]{64}$/.test(s);
}

// Build the canonical signed body — basis for both signature and receipt_hash.
function buildReceiptBody({
  validator_agent_id,
  subject_agent_id,
  skill_id,
  validated_xp_amount,
  evidence_impact_receipt_hash,
  created_at_iso,
  operator_public_key_fingerprint,
}) {
  return {
    schema: SAT_VALIDATION_RECEIPT_SCHEMA,
    verdict: "VALIDATED",
    validator_agent_id,
    subject_agent_id,
    skill_id,
    validated_xp_amount,
    xp_rule_id: XP_FROM_IMPACT_RULE_ID,
    evidence_impact_receipt_hash,
    prev_hash: null,
    created_at_iso,
    operator_public_key_fingerprint,
  };
}

/**
 * Validate a FLYWHEEL-1D XP grant proposal as a SAT-5 agent. Returns a frozen
 * { validated:true, receipt } on success or a frozen { validated:false, error }.
 * Mints nothing — the receipt only unblocks the AGENT-SKILL-1A §11 gate.
 */
export async function validateXpGrantProposal({
  proposal,
  ledgerEntry,
  validatorAgentId,
  operatorPubkeyPem,
  demaHome,
  createdAtIso,
} = {}) {
  // (1) Deterministic time.
  if (
    !isNonEmptyString(createdAtIso) ||
    Number.isNaN(Date.parse(createdAtIso))
  ) {
    return fail("created_at_iso_required");
  }

  // (2) Validator must be a canonical SAT-5 agent.
  if (
    !isNonEmptyString(validatorAgentId) ||
    !SAT_ID_SET.has(validatorAgentId)
  ) {
    return fail("validator_not_sat_agent");
  }

  // (3) Proposal must be a well-formed PENDING FLYWHEEL-1D proposal.
  if (
    !proposal ||
    typeof proposal !== "object" ||
    proposal.schema !== FLYWHEEL_XP_PROPOSAL_SCHEMA ||
    proposal.proposed !== true ||
    proposal.status !== "PENDING_SAT_VALIDATION" ||
    !proposal.proposed_skill_grant ||
    typeof proposal.proposed_skill_grant !== "object"
  ) {
    return fail("proposal_invalid");
  }

  const grant = proposal.proposed_skill_grant;
  const subject_agent_id = proposal.agent_id;
  if (!isNonEmptyString(subject_agent_id)) {
    return fail("proposal_invalid");
  }

  // (4) No self-verification (§11). A SAT agent may not validate its own reward.
  if (validatorAgentId === subject_agent_id) {
    return fail("self_validation_forbidden");
  }

  // (5) The impact entry must verify under the EXTERNAL pubkey.
  const impactVerification = verifyLedgerEntry({
    entry: ledgerEntry,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!impactVerification.verified) {
    return fail("impact_entry_unverified", {
      impact_verification: impactVerification,
    });
  }
  if (
    ledgerEntry.entry_type !== "IMPACT_CREDIT" ||
    ledgerEntry.token_class !== "IMPACT"
  ) {
    return fail("not_an_impact_credit");
  }

  // (6) Evidence binding: the proposal must be bound to THIS entry.
  if (grant.evidence_impact_receipt_hash !== ledgerEntry.entry_hash) {
    return fail("evidence_binding_mismatch");
  }

  // (7) Re-derive XP independently — never trust the proposal's number.
  const rederivedXp = xpAmountFromImpact(ledgerEntry.amount);
  if (rederivedXp === null) {
    return fail("impact_amount_invalid");
  }
  if (rederivedXp !== grant.xp_amount) {
    return fail("xp_amount_mismatch");
  }
  if (!isNonEmptyString(grant.skill_id)) {
    return fail("proposal_invalid");
  }

  // (8) Load operator key to sign the validation.
  const activePair = await loadActiveKeyPair(demaHome);
  const privateKeyPem = activePair.ok ? activePair.private_key_pem : null;
  const publicKeyPem = activePair.ok ? activePair.public_key_pem : null;
  if (!privateKeyPem || !publicKeyPem) {
    return fail("no_authorship_key");
  }
  const fingerprint = fingerprintFromPem(publicKeyPem);
  // The receipt is signed with the local key but the impact was verified under
  // operatorPubkeyPem. If they differ, the receipt would be self-inconsistent
  // (verifySatValidationReceipt under operatorPubkeyPem would always reject it).
  // Fail closed rather than emit an unverifiable receipt.
  if (fingerprint !== fingerprintFromPem(operatorPubkeyPem)) {
    return fail("operator_key_mismatch");
  }

  const body = buildReceiptBody({
    validator_agent_id: validatorAgentId,
    subject_agent_id,
    skill_id: grant.skill_id,
    validated_xp_amount: rederivedXp,
    evidence_impact_receipt_hash: ledgerEntry.entry_hash,
    created_at_iso: createdAtIso,
    operator_public_key_fingerprint: fingerprint,
  });
  const signature = signPayload(body, privateKeyPem);
  const receipt_hash = sha256(stableStringify(body));

  const receipt = Object.freeze({
    ...body,
    receipt_signature_b64: signature,
    receipt_hash,
  });

  return Object.freeze({
    schema: SAT_VALIDATION_RECEIPT_SCHEMA,
    validated: true,
    truth_label: "LOCAL_SAT_VALIDATION_RECEIPT_SIGNED",
    receipt,
    impact_verification: impactVerification,
  });
}

/**
 * Permissionless verifier for a SAT validation receipt. Authority = ONLY the
 * external pubkey (the embedded fingerprint is a claim, never trusted — mirrors
 * KEYCONSENT-1A / verdict-receipt REJECT-4). Returns frozen { verified } or
 * { verified:false, rejected, reason }.
 */
export function verifySatValidationReceipt({ receipt, pubkeyPem } = {}) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return reject("receipt_missing_or_malformed");
  }
  if (receipt.schema !== SAT_VALIDATION_RECEIPT_SCHEMA) {
    return reject("receipt_schema_mismatch");
  }
  if (
    typeof pubkeyPem !== "string" ||
    !pubkeyPem.includes("BEGIN PUBLIC KEY")
  ) {
    return reject("external_pubkey_required");
  }
  if (receipt.verdict !== "VALIDATED") {
    return reject("verdict_invalid");
  }
  for (const f of [
    "validator_agent_id",
    "subject_agent_id",
    "skill_id",
    "validated_xp_amount",
    "evidence_impact_receipt_hash",
    "created_at_iso",
    "operator_public_key_fingerprint",
    "receipt_signature_b64",
    "receipt_hash",
  ]) {
    if (receipt[f] === undefined || receipt[f] === null) {
      return reject(`structural_missing_field_${f}`);
    }
  }
  if (!isSha256Hex(receipt.receipt_hash)) {
    return reject("receipt_hash_invalid");
  }
  // Re-enforce the SAT-5 constitutional invariants at VERIFY time, not only at
  // build time — a correctly-signed but out-of-band-forged receipt (validator
  // not a SAT agent, or validator == subject) must NOT pass, or it would
  // bypass the "SAT only" / "no self-validation" rules through any downstream
  // verifier (e.g. verifyTaskCoherence / verifyConvergentTaskChain).
  if (!SAT_ID_SET.has(receipt.validator_agent_id)) {
    return reject("validator_not_sat_agent");
  }
  if (receipt.validator_agent_id === receipt.subject_agent_id) {
    return reject("self_validation_forbidden");
  }

  const body = buildReceiptBody({
    validator_agent_id: receipt.validator_agent_id,
    subject_agent_id: receipt.subject_agent_id,
    skill_id: receipt.skill_id,
    validated_xp_amount: receipt.validated_xp_amount,
    evidence_impact_receipt_hash: receipt.evidence_impact_receipt_hash,
    created_at_iso: receipt.created_at_iso,
    operator_public_key_fingerprint: receipt.operator_public_key_fingerprint,
  });
  if (sha256(stableStringify(body)) !== receipt.receipt_hash) {
    return reject("receipt_hash_mismatch");
  }
  if (!verifyPayload(body, receipt.receipt_signature_b64, pubkeyPem)) {
    return reject("signature_invalid");
  }

  return Object.freeze({ verified: true, receipt_hash: receipt.receipt_hash });
}
