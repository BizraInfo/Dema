import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildReceiptMintIntegrationPreview,
  buildReceiptMintIntegrationSummary,
  buildReceiptMintRequest,
  RECEIPT_MINT_INTEGRATION_SCHEMA_NAME,
  RECEIPT_MINT_REQUEST_SCHEMA_NAME,
  RECEIPT_MINT_RECEIPT_GRADES,
  RECEIPT_MINT_REQUIRED_BLOCKED_EFFECTS
} from "../packages/core/src/receipt-mint-integration.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";
import { shapeReceiptCandidate } from "../packages/core/src/pat-receipt-recorder.js";
import { runVerificationPipeline } from "../packages/core/src/multi-agent-orchestrator.js";
import { buildNode0StatePreview } from "../packages/core/src/state.js";

function validCandidate() {
  return shapeReceiptCandidate({
    event_schema: "bizra.dema.node0_state.v0.1",
    event_summary: { x: 1, schema_present: true },
    action_class: "preview"
  });
}

function passingPipeline() {
  return runVerificationPipeline({ artifact: buildNode0StatePreview() });
}

test("Receipt mint integration · canonical schema · 7 SAT gates declared", () => {
  const p = buildReceiptMintIntegrationPreview();
  assert.equal(p.schema, RECEIPT_MINT_INTEGRATION_SCHEMA_NAME);
  assert.equal(p.schema, "bizra.dema.receipt_mint_integration.v0.1");
  assert.equal(p.chain_advance_gated_by.length, 7);
});

test("Receipt mint · 3 receipt grades · founding requires OTS", () => {
  const p = buildReceiptMintIntegrationPreview();
  assert.equal(Object.keys(p.receipt_grades).length, 3);
  assert.ok(Object.keys(p.receipt_grades).includes("preview"));
  assert.ok(Object.keys(p.receipt_grades).includes("measured"));
  assert.ok(Object.keys(p.receipt_grades).includes("founding"));
  assert.equal(p.ots_required_for_grade, "founding");
});

test("Receipt mint · boundary canonical · deep frozen", () => {
  const p = buildReceiptMintIntegrationPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(Object.isFrozen(p));
});

test("Receipt mint · blocked_effects include mint-without-SAT · without-consent · without-gateway", () => {
  const p = buildReceiptMintIntegrationPreview();
  assert.ok(p.blocked_effects.includes("mint_without_all_sat_verifications"));
  assert.ok(p.blocked_effects.includes("mint_without_per_receipt_consent"));
  assert.ok(p.blocked_effects.includes("advance_chain_without_governed_gateway"));
  assert.ok(p.blocked_effects.includes("modify_existing_receipt"));
});

test("Mint request · valid candidate + passing pipeline + preview grade → valid", () => {
  const r = buildReceiptMintRequest({
    candidate: validCandidate(),
    sat_pipeline_result: passingPipeline(),
    receipt_grade: "preview",
    prev_chain_head_hash: null
  });
  assert.equal(r.schema, RECEIPT_MINT_REQUEST_SCHEMA_NAME);
  assert.equal(r.valid, true);
  assert.equal(r.mint_performed, false);
  assert.equal(r.chain_advance_performed, false);
  assert.match(r.consent_phrase_for_mint, /^GO: mint preview-grade receipt at [a-f0-9]{64}$/);
  assert.match(r.proposed_receipt_id, /^[a-f0-9]{64}$/);
});

test("Mint request · founding grade WITHOUT OTS → invalid", () => {
  const r = buildReceiptMintRequest({
    candidate: validCandidate(),
    sat_pipeline_result: passingPipeline(),
    receipt_grade: "founding"
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes("founding_grade_requires_ots_attestation"));
});

test("Mint request · founding grade WITH OTS proof → valid", () => {
  const r = buildReceiptMintRequest({
    candidate: validCandidate(),
    sat_pipeline_result: passingPipeline(),
    receipt_grade: "founding",
    ots_attestation_proof: "ots_proof_948027_948029"
  });
  assert.equal(r.valid, true);
  assert.equal(r.ots_attestation_required, true);
  assert.equal(r.ots_attestation_proof_present, true);
});

test("Mint request · missing candidate → invalid", () => {
  const r = buildReceiptMintRequest({
    sat_pipeline_result: passingPipeline()
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes("no_candidate"));
});

test("Mint request · candidate with wrong schema → invalid", () => {
  const r = buildReceiptMintRequest({
    candidate: { schema: "made.up.v0.1", valid: true },
    sat_pipeline_result: passingPipeline()
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.some((v) => v.includes("candidate_wrong_schema")));
});

test("Mint request · pipeline did not pass → invalid", () => {
  // Use a broken artifact to fail pipeline
  const brokenPipeline = runVerificationPipeline({
    artifact: { schema: "broken.v0.1", boundary: { runtime_execution_performed: true } }
  });
  const r = buildReceiptMintRequest({
    candidate: validCandidate(),
    sat_pipeline_result: brokenPipeline
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.some((v) => v.includes("sat_pipeline_did_not_pass")));
});

test("Mint request · prev_chain_head_hash invalid format → invalid", () => {
  const r = buildReceiptMintRequest({
    candidate: validCandidate(),
    sat_pipeline_result: passingPipeline(),
    prev_chain_head_hash: "not-a-valid-hash"
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.some((v) => v.includes("prev_chain_head_hash_format_invalid")));
});

test("Mint request · prev_chain_head_hash='genesis' → accepted", () => {
  const r = buildReceiptMintRequest({
    candidate: validCandidate(),
    sat_pipeline_result: passingPipeline(),
    prev_chain_head_hash: "genesis"
  });
  assert.equal(r.valid, true);
});

test("Mint request · proposed_receipt_id is deterministic given same inputs", () => {
  const c = validCandidate();
  const p = passingPipeline();
  const r1 = buildReceiptMintRequest({
    candidate: c, sat_pipeline_result: p, receipt_grade: "preview", prev_chain_head_hash: "genesis"
  });
  const r2 = buildReceiptMintRequest({
    candidate: c, sat_pipeline_result: p, receipt_grade: "preview", prev_chain_head_hash: "genesis"
  });
  assert.equal(r1.proposed_receipt_id, r2.proposed_receipt_id);
});

test("Mint request · requires_typed_go=true AND requires_governed_gateway_handoff=true ALWAYS", () => {
  const r = buildReceiptMintRequest({
    candidate: validCandidate(),
    sat_pipeline_result: passingPipeline()
  });
  assert.equal(r.requires_typed_go, true);
  assert.equal(r.requires_governed_gateway_handoff, true);
});

test("Mint request · deep frozen + canonical boundary", () => {
  const r = buildReceiptMintRequest({
    candidate: validCandidate(),
    sat_pipeline_result: passingPipeline()
  });
  assert.ok(Object.isFrozen(r));
  assert.ok(Object.isFrozen(r.violations));
  assert.ok(isCanonicalBoundary(r.boundary));
});

test("Mint request · unknown grade coerced to 'preview' default", () => {
  const r = buildReceiptMintRequest({
    candidate: validCandidate(),
    sat_pipeline_result: passingPipeline(),
    receipt_grade: "fake_grade"
  });
  assert.equal(r.receipt_grade, "preview");
});

test("Summary + exports", () => {
  const s = buildReceiptMintIntegrationSummary();
  assert.equal(s.sat_gate_count, 7);
  assert.equal(s.receipt_grade_count, 3);
  assert.equal(s.ots_required_for_grade, "founding");
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(RECEIPT_MINT_RECEIPT_GRADES));
  assert.ok(Object.isFrozen(RECEIPT_MINT_REQUIRED_BLOCKED_EFFECTS));
});
