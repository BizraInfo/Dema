// C12 · Receipt mint integration (per ADR-008 §C12 · FINAL component).
//
// Bridges preview receipts (PAT-6 candidates) to canonical chain-bound
// receipts. C12 validates that all prerequisites are met BEFORE mint:
//   - Boundary verified (SAT-1)
//   - Consent audited (SAT-2)
//   - Doctrine compliant (SAT-3)
//   - Chain integrity verified (SAT-4)
//   - Identity verified (SAT-5)
//   - Per-receipt consent phrase typed
//   - OTS attestation declared (for the founding-document-grade receipts)
//
// The actual mint (writing to disk + invoking governed gateway) is gated
// by all of the above. C12 v0.1 is the PREPARATION + VALIDATION layer.

import { createHash } from "node:crypto";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.receipt_mint_integration.v0.1";
const MINT_REQUEST_SCHEMA = "bizra.dema.receipt_mint_request.v0.1";

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "mint_without_all_sat_verifications",
  "mint_without_per_receipt_consent",
  "advance_chain_without_governed_gateway",
  "forge_prev_hash",
  "modify_existing_receipt",
  "mint_outside_dema_receipts_dir",
  "skip_ots_attestation_for_founding_grade",
  "federation_invocation",
]);

const RECEIPT_GRADES = Object.freeze({
  preview: "preview only · no chain advance",
  measured: "operator-witnessed · chain advances · no OTS",
  founding:
    "founding-document-grade · chain advances · OTS-anchored to Bitcoin",
});

function safeObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

function sha256(input) {
  return createHash("sha256").update(String(input)).digest("hex");
}

const HASH_REGEX = /^[a-f0-9]{64}$/;

export function buildReceiptMintIntegrationPreview() {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    mint_target_directory: "~/.dema/receipts/",
    chain_advance_gated_by: Object.freeze([
      "sat-1-boundary-verifier",
      "sat-2-consent-auditor",
      "sat-3-doctrine-compliance",
      "sat-4-receipt-chain-verifier",
      "sat-5-identity-verifier",
      "per_receipt_typed_consent",
      "governed_gateway_handoff",
    ]),
    receipt_grades: RECEIPT_GRADES,
    ots_required_for_grade: "founding",
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    refusal_invariants: Object.freeze([
      "Mint never proceeds without ALL 5 SAT verifications passing",
      "Mint never proceeds without per-receipt typed consent phrase",
      "Mint never advances chain without governed gateway handoff",
      "Mint never forges prev_hash · gap is named honestly",
      "Mint never modifies existing receipts · chain is append-only",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

// Prepare a mint request: validates that all prerequisites are met.
// Does NOT actually mint · only validates and shapes the request.
// Operator typed consent + gateway handoff is what triggers actual mint.
export function buildReceiptMintRequest({
  candidate = null,
  sat_pipeline_result = null,
  receipt_grade = "preview",
  prev_chain_head_hash = null,
  ots_attestation_proof = null,
} = {}) {
  const c = safeObject(candidate);
  const pipeline = safeObject(sat_pipeline_result);
  const grade = Object.keys(RECEIPT_GRADES).includes(receipt_grade)
    ? receipt_grade
    : "preview";
  const prevHash =
    prev_chain_head_hash && typeof prev_chain_head_hash === "string"
      ? prev_chain_head_hash
      : null;
  const otsProof =
    ots_attestation_proof && typeof ots_attestation_proof === "string"
      ? ots_attestation_proof
      : null;

  const violations = [];

  // Gate 1: candidate must be a v0.1 receipt candidate
  if (!c) {
    violations.push("no_candidate");
  } else if (c.schema !== "bizra.dema.receipt_candidate.v0.1") {
    violations.push(
      `candidate_wrong_schema · expected bizra.dema.receipt_candidate.v0.1 · got '${c.schema}'`,
    );
  } else if (c.valid !== true) {
    violations.push("candidate_invalid · candidate.valid must be true");
  } else if (
    typeof c.candidate_hash !== "string" ||
    !HASH_REGEX.test(c.candidate_hash)
  ) {
    violations.push("candidate_hash_format_invalid · expected 64-char hex");
  }

  // Gate 2: SAT pipeline must have passed
  if (!pipeline) {
    violations.push("no_sat_pipeline_result");
  } else if (
    pipeline.schema !== "bizra.dema.orchestrator_verification_pipeline.v0.1"
  ) {
    violations.push("pipeline_wrong_schema");
  } else if (pipeline.passed !== true) {
    violations.push(
      `sat_pipeline_did_not_pass · failed: ${(pipeline.sats_failed || []).join(",")}`,
    );
  }

  // Gate 3: prev_chain_head_hash format check
  if (
    prevHash !== null &&
    !HASH_REGEX.test(prevHash) &&
    prevHash !== "genesis"
  ) {
    violations.push(`prev_chain_head_hash_format_invalid · '${prevHash}'`);
  }

  // Gate 4: founding-grade receipts require OTS attestation
  if (grade === "founding" && otsProof === null) {
    violations.push("founding_grade_requires_ots_attestation");
  }

  const valid = violations.length === 0;
  const candidateHash = c?.candidate_hash || null;
  const consentPhraseForMint = valid
    ? `GO: mint ${grade}-grade receipt at ${candidateHash}`
    : null;

  // Final receipt id would be sha256(candidate_hash + prev_hash + grade)
  const proposedReceiptId = valid
    ? sha256(`${candidateHash}|${prevHash || "genesis"}|${grade}`)
    : null;

  return Object.freeze({
    schema: MINT_REQUEST_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_at: new Date().toISOString(),
    candidate_hash: candidateHash,
    candidate_action_class: c?.action_class || null,
    receipt_grade: grade,
    prev_chain_head_hash: prevHash,
    proposed_receipt_id: proposedReceiptId,
    ots_attestation_required: grade === "founding",
    ots_attestation_proof_present: otsProof !== null,
    sat_pipeline_passed: pipeline?.passed === true,
    sat_pipeline_schema: pipeline?.schema || null,
    sats_passed_list: pipeline?.sats_passed || Object.freeze([]),
    valid,
    violations: Object.freeze(violations),
    consent_phrase_for_mint: consentPhraseForMint,
    mint_performed: false,
    chain_advance_performed: false,
    requires_typed_go: true,
    requires_governed_gateway_handoff: true,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary(),
  });
}

export function buildReceiptMintIntegrationSummary() {
  const preview = buildReceiptMintIntegrationPreview();
  return Object.freeze({
    schema: "bizra.dema.receipt_mint_integration_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    mint_target_directory: preview.mint_target_directory,
    sat_gate_count: preview.chain_advance_gated_by.length,
    receipt_grade_count: Object.keys(preview.receipt_grades).length,
    ots_required_for_grade: preview.ots_required_for_grade,
    blocked_effect_count: preview.blocked_effects.length,
    boundary: preview.boundary,
  });
}

export const RECEIPT_MINT_INTEGRATION_SCHEMA_NAME = SCHEMA;
export const RECEIPT_MINT_REQUEST_SCHEMA_NAME = MINT_REQUEST_SCHEMA;
export const RECEIPT_MINT_RECEIPT_GRADES = RECEIPT_GRADES;
export const RECEIPT_MINT_REQUIRED_BLOCKED_EFFECTS = REQUIRED_BLOCKED_EFFECTS;
