// URP-4.1A pure share-decision kernel.
//
// Validates a verified URP local index against an operator decision +
// exact consent phrase and returns a frozen, content-addressed
// choose-decision envelope. NO file write. NO CLI. NO network. NO share
// publication. NO PoI. NO mint. NO federation. Consent is a domain
// invariant validated HERE, not deferred to a calling CLI surface.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { URP_LOCAL_INDEX_SCHEMA } from "./local-index.js";

export const URP_CHOOSE_RECEIPT_SCHEMA = "bizra.dema.urp_choose_receipt.v0.1";

export const DECISION_MARK_SHAREABLE = "MARK_SHAREABLE";
export const DECISION_MARK_LOCAL_ONLY = "MARK_LOCAL_ONLY";

export const CONSENT_MARK_SHAREABLE = "MARK URP ENTRY SHAREABLE";
export const CONSENT_MARK_LOCAL_ONLY = "MARK URP ENTRY LOCAL-ONLY";

const SHARE_STATUS_LOCAL = "MARKED_LOCAL_ONLY";
const SHARE_STATUS_CANDIDATE = "CANDIDATE_SHAREABLE";
const TRUTH_LABEL_INDEX = "LOCAL_VERIFIED_RESOURCE_INDEX";
const MODE_LOCAL_INDEX = "LOCAL_INDEX_ONLY";

const FORBIDDEN_FIELDS = Object.freeze([
  "private_key",
  "private_key_pem",
  "raw_artifact",
  "artifact_content",
  "full_receipt_json",
  "personal_memory",
  "mint_candidate",
  "token_eligible",
  "reward",
  "bzc",
  "imp",
  "economic_value",
  "federation_target",
]);

const PASS_BOUNDARY = Object.freeze({
  file_write_performed: false,
  network_used: false,
  federation_used: false,
  share_published: false,
  resource_offer_created: false,
  poi_score_calculated: false,
  token_minted: false,
  economic_claim_made: false,
  private_key_loaded: false,
  raw_artifact_included: false,
});

const FAIL_BOUNDARY = Object.freeze({
  file_write_performed: false,
  network_used: false,
  federation_used: false,
  share_published: false,
  resource_offer_created: false,
  poi_score_calculated: false,
  token_minted: false,
  economic_claim_made: false,
  private_key_loaded: false,
  raw_artifact_included: false,
});

const CHOOSE_TRANSITION_OBJECTIVE_FLAGS = Object.freeze([
  "explicit",
  "bounded",
  "receipt_backed",
  "rare_circuit_tested",
  "human_consent_aware",
  "ihsan_aligned",
  "ci_enforced",
]);

const CHOOSE_TRANSITION_RARE_CIRCUIT_REFS = Object.freeze([
  "invalid_index_input_refusal",
  "wrong_schema_refusal",
  "wrong_mode_refusal",
  "wrong_truth_label_refusal",
  "invalid_transition_refusal",
  "consent_required_or_mismatch_refusal",
  "forbidden_field_in_source_index_refusal",
  "invalid_now_refusal",
]);

const CHOOSE_TRANSITION_CI_REFS = Object.freeze([
  "tests/urp-choose-decision.test.js",
  "scripts/review/transition-assurance-check.mjs",
  "npm run check",
]);

function fail(error, details = {}) {
  return Object.freeze({
    schema: URP_CHOOSE_RECEIPT_SCHEMA,
    chosen: false,
    error,
    ...details,
    boundary: FAIL_BOUNDARY,
  });
}

function containsForbiddenField(obj) {
  const json = JSON.stringify(obj);
  for (const field of FORBIDDEN_FIELDS) {
    if (json.includes(`"${field}":`)) return field;
  }
  return null;
}

function expectedConsentFor(decision) {
  if (decision === DECISION_MARK_SHAREABLE) return CONSENT_MARK_SHAREABLE;
  if (decision === DECISION_MARK_LOCAL_ONLY) return CONSENT_MARK_LOCAL_ONLY;
  return null;
}

function nextShareStatusFor(decision) {
  if (decision === DECISION_MARK_SHAREABLE) return SHARE_STATUS_CANDIDATE;
  if (decision === DECISION_MARK_LOCAL_ONLY) return SHARE_STATUS_LOCAL;
  return null;
}

function isValidSourceShareStatus(decision, current) {
  if (decision === DECISION_MARK_SHAREABLE) {
    return current === SHARE_STATUS_LOCAL;
  }
  if (decision === DECISION_MARK_LOCAL_ONLY) {
    return current === SHARE_STATUS_LOCAL || current === SHARE_STATUS_CANDIDATE;
  }
  return false;
}

function freezeDeep(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) {
    value.forEach(freezeDeep);
    return Object.freeze(value);
  }
  if (typeof value === "object") {
    for (const key of Object.keys(value)) {
      freezeDeep(value[key]);
    }
    return Object.freeze(value);
  }
  return value;
}

export function buildUrpChooseTransitionContract({
  indexHash,
  decision,
  previousShareStatus,
  nextShareStatus,
  consentPhraseHash,
}) {
  return freezeDeep({
    explicit: true,
    bounded: true,
    receipt_backed: true,
    rare_circuit_tested: true,
    human_consent_aware: true,
    ihsan_aligned: true,
    ci_enforced: true,
    transition_id: `urp_choose:${indexHash}:${previousShareStatus}->${nextShareStatus}:${decision}`,
    proof_scope: "PURE_URP_CHOOSE_DECISION",
    bounds: {
      allowed_decisions: [DECISION_MARK_SHAREABLE, DECISION_MARK_LOCAL_ONLY],
      source_index_hash: indexHash,
      previous_share_status: previousShareStatus,
      next_share_status: nextShareStatus,
      file_write_performed: false,
      share_published: false,
    },
    receipt_backing: {
      receipt_schema: URP_CHOOSE_RECEIPT_SCHEMA,
      choose_hash_commits_to_contract: true,
      chain_advance_performed: false,
      file_write_performed: false,
      source_index_hash: indexHash,
    },
    consent: {
      exact_string_required_for_decision: true,
      consent_phrase_hash: consentPhraseHash,
      consent_verified: true,
    },
    ihsan: {
      refusal_is_valid_proof_event: true,
      overclaim_guard: "local_choose_decision_not_share_publication",
    },
    rare_circuit_test_refs: [...CHOOSE_TRANSITION_RARE_CIRCUIT_REFS],
    ci_enforcement_refs: [...CHOOSE_TRANSITION_CI_REFS],
  });
}

export function validateUrpChooseTransitionContract({ receipt }) {
  const contract = receipt?.transition_contract;
  if (!contract || typeof contract !== "object" || Array.isArray(contract)) {
    return "transition_contract_missing";
  }
  for (const flag of CHOOSE_TRANSITION_OBJECTIVE_FLAGS) {
    if (contract[flag] !== true) {
      return `transition_contract_${flag}_not_true`;
    }
  }
  const expectedTransitionId = `urp_choose:${receipt.source_index_hash}:${receipt.previous_share_status}->${receipt.next_share_status}:${receipt.decision}`;
  if (contract.transition_id !== expectedTransitionId) {
    return "transition_contract_transition_id_mismatch";
  }
  if (contract.proof_scope !== "PURE_URP_CHOOSE_DECISION") {
    return "transition_contract_proof_scope_invalid";
  }
  if (contract.bounds?.source_index_hash !== receipt.source_index_hash) {
    return "transition_contract_source_index_hash_mismatch";
  }
  if (
    contract.bounds?.previous_share_status !== receipt.previous_share_status
  ) {
    return "transition_contract_previous_status_mismatch";
  }
  if (contract.bounds?.next_share_status !== receipt.next_share_status) {
    return "transition_contract_next_status_mismatch";
  }
  if (contract.receipt_backing?.receipt_schema !== receipt.schema) {
    return "transition_contract_receipt_schema_mismatch";
  }
  const {
    decided_at_iso: _decidedAtIso,
    choose_hash: chooseHash,
    ...stableBody
  } = receipt;
  if (sha256(stableStringify(stableBody)) !== chooseHash) {
    return "transition_contract_choose_hash_mismatch";
  }
  if (contract.receipt_backing?.choose_hash_commits_to_contract !== true) {
    return "transition_contract_choose_hash_commit_not_true";
  }
  if (contract.receipt_backing?.chain_advance_performed !== false) {
    return "transition_contract_chain_advance_not_false";
  }
  if (contract.consent?.exact_string_required_for_decision !== true) {
    return "transition_contract_exact_consent_not_true";
  }
  if (contract.consent?.consent_phrase_hash !== receipt.consent_phrase_hash) {
    return "transition_contract_consent_hash_mismatch";
  }
  if (contract.ihsan?.refusal_is_valid_proof_event !== true) {
    return "transition_contract_ihsan_refusal_not_true";
  }
  for (const ref of CHOOSE_TRANSITION_RARE_CIRCUIT_REFS) {
    if (!contract.rare_circuit_test_refs?.includes(ref)) {
      return "transition_contract_rare_circuit_ref_missing";
    }
  }
  for (const ref of CHOOSE_TRANSITION_CI_REFS) {
    if (!contract.ci_enforcement_refs?.includes(ref)) {
      return "transition_contract_ci_ref_missing";
    }
  }
  return null;
}

export function buildChooseDecision(
  index,
  { decision, consent, now = new Date() } = {},
) {
  if (!index || typeof index !== "object") {
    return fail("invalid_index_input");
  }
  if (index.schema !== URP_LOCAL_INDEX_SCHEMA) {
    return fail("wrong_schema", { received_schema: index.schema ?? null });
  }
  if (index.mode !== MODE_LOCAL_INDEX) {
    return fail("wrong_mode", { received_mode: index.mode ?? null });
  }
  if (index.truth_label !== TRUTH_LABEL_INDEX) {
    return fail("wrong_truth_label", { received: index.truth_label ?? null });
  }
  if (
    index.share_status !== SHARE_STATUS_LOCAL &&
    index.share_status !== SHARE_STATUS_CANDIDATE
  ) {
    return fail("wrong_share_status", { received: index.share_status ?? null });
  }
  if (typeof index.index_hash !== "string" || index.index_hash.length !== 64) {
    return fail("missing_or_invalid_index_hash", {
      received: index.index_hash ?? null,
    });
  }

  const forbiddenInIndex = containsForbiddenField(index);
  if (forbiddenInIndex) {
    return fail("forbidden_field_in_source_index", { field: forbiddenInIndex });
  }

  if (
    decision !== DECISION_MARK_SHAREABLE &&
    decision !== DECISION_MARK_LOCAL_ONLY
  ) {
    return fail("unknown_decision", { received: decision ?? null });
  }

  const expectedConsent = expectedConsentFor(decision);
  if (typeof consent !== "string" || consent !== expectedConsent) {
    return fail("consent_required_or_mismatch", {
      decision,
      expected_consent: expectedConsent,
    });
  }

  if (!isValidSourceShareStatus(decision, index.share_status)) {
    return fail("invalid_transition", {
      decision,
      from: index.share_status,
    });
  }

  const previousShareStatus = index.share_status;
  const nextShareStatus = nextShareStatusFor(decision);

  const decidedAtIso =
    now instanceof Date && !Number.isNaN(now.getTime())
      ? now.toISOString()
      : null;
  if (!decidedAtIso) {
    return fail("invalid_now");
  }

  const consentPhraseHash = sha256(expectedConsent);
  const transitionContract = buildUrpChooseTransitionContract({
    indexHash: index.index_hash,
    decision,
    previousShareStatus,
    nextShareStatus,
    consentPhraseHash,
  });

  const body = {
    schema: URP_CHOOSE_RECEIPT_SCHEMA,
    chosen: true,
    decision,
    source_index_hash: index.index_hash,
    source_truth_label: TRUTH_LABEL_INDEX,
    previous_share_status: previousShareStatus,
    next_share_status: nextShareStatus,
    consent_verified: true,
    consent_phrase_hash: consentPhraseHash,
    decided_at_iso: decidedAtIso,
    boundary: PASS_BOUNDARY,
    transition_contract: transitionContract,
  };

  const { decided_at_iso: _decidedAtIso, ...stableBody } = body;
  const chooseHash = sha256(stableStringify(stableBody));

  return Object.freeze({
    ...body,
    choose_hash: chooseHash,
  });
}
