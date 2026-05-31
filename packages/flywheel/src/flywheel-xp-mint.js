// FLYWHEEL-1E · operator-approved XP mint bridge.
//
// Composes:
//   FLYWHEEL-1D proposal + SAT-VALIDATE-1A receipt + operator consent
//     -> AGENT-SKILL-1A signed skill ledger
//
// This is a local XP ledger build, not persistence, not public economy, not a
// token mint, and not the full flywheel. It exists to close §19 step 11 to the
// consent boundary using already-tested kernels.

import { createPublicKey } from "node:crypto";
import { loadPublicKey } from "../../receipts/src/authorship-key-store.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import {
  buildSkillLedger,
  verifySkillLedger,
  AGENT_SKILL_LEDGER_SCHEMA,
  MUTATE_AGENT_SKILL_LEDGER_ACTION_TYPE,
} from "../../agents/src/agent-skill-ledger.js";
import { verifyLedgerEntry } from "../../econ/src/dual-token-ledger.js";
import {
  FLYWHEEL_XP_PROPOSAL_SCHEMA,
  XP_FROM_IMPACT_RULE_ID,
} from "./flywheel-xp-proposal.js";
import { verifySatValidationReceipt } from "./flywheel-sat-validation.js";

export const FLYWHEEL_XP_MINT_SCHEMA =
  "bizra.dema.flywheel_xp_mint_bridge.v0.1";

const PREV_HASH_GENESIS = "0".repeat(64);

const SUCCESS_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: false,
  operator_dema_home_mutated: false,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  public_transfer_performed: false,
  xp_ledger_built: true,
});

const FAIL_BOUNDARY = Object.freeze({
  local_only: true,
  file_write_performed: false,
  operator_dema_home_mutated: false,
  network_used: false,
  federation_used: false,
  public_economic_claim_made: false,
  public_transfer_performed: false,
  xp_ledger_built: false,
});

function fail(stage, error, extra = {}) {
  return Object.freeze({
    schema: FLYWHEEL_XP_MINT_SCHEMA,
    minted: false,
    truth_label: "LOCAL_FLYWHEEL_XP_MINT_BRIDGE_FAILED",
    stage,
    error,
    ...extra,
    boundary: FAIL_BOUNDARY,
  });
}

function isNonEmptyString(s) {
  return typeof s === "string" && s.length > 0;
}

function fingerprintFromPem(pubkeyPem) {
  const pk = createPublicKey(pubkeyPem);
  return sha256(pk.export({ type: "spki", format: "der" }).toString("hex"));
}

function normalizeSkillGrant({ proposal, satValidationReceipt }) {
  const grant = proposal.proposed_skill_grant;
  return Object.freeze({
    skill_id: grant.skill_id,
    xp_amount: grant.xp_amount,
    evidence_impact_receipt_hash: grant.evidence_impact_receipt_hash,
    sat_validation_receipt_hash: satValidationReceipt.receipt_hash,
  });
}

function aggregateSingleGrant(grant) {
  return Object.freeze({
    xp_total: grant.xp_amount,
    skill_balances: Object.freeze({ [grant.skill_id]: grant.xp_amount }),
  });
}

function buildSkillLedgerBody({
  agent_id,
  skill_grants,
  skill_balances,
  xp_total,
  created_at_iso,
  operator_public_key_fingerprint,
}) {
  return {
    schema: AGENT_SKILL_LEDGER_SCHEMA,
    agent_id,
    skill_grants,
    skill_balances,
    xp_total,
    prev_hash: PREV_HASH_GENESIS,
    created_at_iso,
    operator_public_key_fingerprint,
  };
}

function impactReceiptFromLedgerEntry(entry) {
  return Object.freeze({
    receipt_hash: entry.entry_hash,
    entry_type: entry.entry_type,
    token_class: entry.token_class,
  });
}

function validateXpMintContext({
  proposal,
  ledgerEntry,
  satValidationReceipt,
  operatorPubkeyPem,
}) {
  if (
    !proposal ||
    typeof proposal !== "object" ||
    proposal.schema !== FLYWHEEL_XP_PROPOSAL_SCHEMA ||
    proposal.proposed !== true ||
    proposal.status !== "PENDING_SAT_VALIDATION" ||
    !proposal.proposed_skill_grant ||
    typeof proposal.proposed_skill_grant !== "object"
  ) {
    return { ok: false, error: "proposal_invalid" };
  }

  const impactVerification = verifyLedgerEntry({
    entry: ledgerEntry,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!impactVerification.verified) {
    return { ok: false, error: "impact_entry_unverified", impactVerification };
  }
  if (
    ledgerEntry.entry_type !== "IMPACT_CREDIT" ||
    ledgerEntry.token_class !== "IMPACT"
  ) {
    return { ok: false, error: "not_an_impact_credit", impactVerification };
  }

  const satVerification = verifySatValidationReceipt({
    receipt: satValidationReceipt,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!satVerification.verified) {
    return { ok: false, error: "sat_validation_unverified", satVerification };
  }

  const grant = proposal.proposed_skill_grant;
  if (grant.evidence_impact_receipt_hash !== ledgerEntry.entry_hash) {
    return { ok: false, error: "proposal_evidence_mismatch" };
  }
  if (satValidationReceipt.subject_agent_id !== proposal.agent_id) {
    return { ok: false, error: "sat_subject_mismatch" };
  }
  if (satValidationReceipt.skill_id !== grant.skill_id) {
    return { ok: false, error: "sat_skill_mismatch" };
  }
  if (satValidationReceipt.validated_xp_amount !== grant.xp_amount) {
    return { ok: false, error: "sat_xp_amount_mismatch" };
  }
  if (
    satValidationReceipt.evidence_impact_receipt_hash !== ledgerEntry.entry_hash
  ) {
    return { ok: false, error: "sat_evidence_mismatch" };
  }

  return Object.freeze({
    ok: true,
    impactVerification,
    satVerification,
    skillGrant: normalizeSkillGrant({ proposal, satValidationReceipt }),
  });
}

export async function buildFlywheelXpMintConsentScope({
  proposal,
  ledgerEntry,
  satValidationReceipt,
  operatorPubkeyPem,
  demaHome,
  createdAtIso,
} = {}) {
  if (
    !isNonEmptyString(createdAtIso) ||
    Number.isNaN(Date.parse(createdAtIso))
  ) {
    return fail("input", "created_at_iso_required");
  }

  const context = validateXpMintContext({
    proposal,
    ledgerEntry,
    satValidationReceipt,
    operatorPubkeyPem,
  });
  if (!context.ok) {
    return fail("xp_context", context.error, {
      impact_verification: context.impactVerification,
      sat_verification: context.satVerification,
    });
  }

  const publicKeyPem = await loadPublicKey(demaHome);
  if (!publicKeyPem) {
    return fail("input", "no_authorship_key");
  }
  // The consent scope is content-addressed over a body fingerprinted with the
  // local key, but the receipts were verified under operatorPubkeyPem. If they
  // diverge, the scope cannot mint under the claimed operator authority — fail
  // closed rather than return built:true for an unusable scope.
  if (
    fingerprintFromPem(publicKeyPem) !== fingerprintFromPem(operatorPubkeyPem)
  ) {
    return fail("input", "operator_key_mismatch");
  }

  const skillGrants = Object.freeze([context.skillGrant]);
  const { xp_total, skill_balances } = aggregateSingleGrant(context.skillGrant);
  const body = buildSkillLedgerBody({
    agent_id: proposal.agent_id,
    skill_grants: skillGrants,
    skill_balances,
    xp_total,
    created_at_iso: createdAtIso,
    operator_public_key_fingerprint: fingerprintFromPem(publicKeyPem),
  });
  const targetHash = sha256(stableStringify(body));

  return Object.freeze({
    schema: FLYWHEEL_XP_MINT_SCHEMA,
    built: true,
    truth_label: "LOCAL_FLYWHEEL_XP_MINT_CONSENT_SCOPE_BUILT",
    action_scope: Object.freeze({
      action_type: MUTATE_AGENT_SKILL_LEDGER_ACTION_TYPE,
      target_hash: targetHash,
    }),
    agent_id: proposal.agent_id,
    skill_grant: context.skillGrant,
    xp_rule_id: XP_FROM_IMPACT_RULE_ID,
    impact_verification: context.impactVerification,
    sat_verification: context.satVerification,
    boundary: FAIL_BOUNDARY,
  });
}

export async function mintFlywheelXpGrant({
  proposal,
  ledgerEntry,
  satValidationReceipt,
  operatorPubkeyPem,
  consentProof,
  demaHome,
  createdAtIso,
} = {}) {
  const scope = await buildFlywheelXpMintConsentScope({
    proposal,
    ledgerEntry,
    satValidationReceipt,
    operatorPubkeyPem,
    demaHome,
    createdAtIso,
  });
  if (!scope.built) {
    return fail(scope.stage || "xp_context", scope.error, {
      scope,
    });
  }

  const skillResult = await buildSkillLedger({
    agent_id: proposal.agent_id,
    skill_grants: [scope.skill_grant],
    consentProof,
    demaHome,
    createdAtIso,
  });
  if (!skillResult.built) {
    return fail("skill_ledger", skillResult.error, {
      consent_scope: scope.action_scope,
    });
  }

  const impactReceipts = Object.freeze([
    impactReceiptFromLedgerEntry(ledgerEntry),
  ]);
  const satValidations = Object.freeze([satValidationReceipt]);
  const skillLedgerVerification = verifySkillLedger({
    ledger: skillResult.ledger,
    impactReceipts,
    satValidations,
    pubkeyPem: operatorPubkeyPem,
  });
  if (!skillLedgerVerification.verified) {
    return fail("skill_ledger_verify", skillLedgerVerification.reason, {
      skill_ledger: skillResult.ledger,
      skill_ledger_verification: skillLedgerVerification,
    });
  }

  return Object.freeze({
    schema: FLYWHEEL_XP_MINT_SCHEMA,
    minted: true,
    status: "XP_LEDGER_BUILT",
    truth_label: "LOCAL_FLYWHEEL_XP_MINT_BRIDGE_VERIFIED",
    xp_rule_id: XP_FROM_IMPACT_RULE_ID,
    agent_id: proposal.agent_id,
    consent_scope: scope.action_scope,
    skill_grant: scope.skill_grant,
    skill_ledger: skillResult.ledger,
    skill_ledger_verification: skillLedgerVerification,
    impact_receipts: impactReceipts,
    sat_validations: satValidations,
    what_this_proves: Object.freeze([
      "A verified impact entry and SAT validation receipt can become a signed local XP skill ledger with operator consent.",
      "The skill ledger verifies against external public-key authority and referenced proof hashes.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "No persistent XP ledger file is written by this bridge.",
      "No public economy, no token transfer, no marketplace settlement, no House of Wisdom lesson, and no performance improvement are claimed.",
    ]),
    boundary: SUCCESS_BOUNDARY,
  });
}
