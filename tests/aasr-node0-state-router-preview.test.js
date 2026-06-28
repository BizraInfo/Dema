import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAasrNode0StateRouterPreview,
  verifyAasrNode0StateRouterPreview,
  runAasrNode0StateRouterPreviewGate,
  AASR_NODE0_STATE_ROUTER_SCHEMA,
  AASR_NODE0_STATE_ROUTER_TRUTH_LABEL,
  AASR_NODE0_ROUTER_STAGE,
} from "../packages/core/src/aasr-node0-state-router-preview.js";
import { buildDemaNodeSpaceBondingFileSteward } from "../packages/core/src/dema-node-space-bonding-file-steward.js";
import { buildNode0MultiDeviceUrpResourceManifestPreview } from "../packages/core/src/node0-multi-device-urp-resource-manifest-preview.js";

test("builds frozen preview envelope", () => {
  const report = buildAasrNode0StateRouterPreview();
  assert.equal(report.schema, AASR_NODE0_STATE_ROUTER_SCHEMA);
  assert.equal(report.truth_label, AASR_NODE0_STATE_ROUTER_TRUTH_LABEL);
  assert.equal(report.router_stage, AASR_NODE0_ROUTER_STAGE);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.snr_decision));
  assert.ok(Object.isFrozen(report.chained_state_block_preview));
});

test("routes File Steward receipt preview atoms", () => {
  const steward = buildDemaNodeSpaceBondingFileSteward();
  const receipt = steward.file_action_receipt_previews[0];
  const report = buildAasrNode0StateRouterPreview({
    file_action_receipt_preview: receipt,
    resource_manifest_preview: null,
  });
  assert.equal(report.routed_artifact_type, "file_action_receipt_preview");
  assert.equal(
    report.file_action_state_transition_preview.source_receipt_preview_id,
    receipt.receipt_preview_id,
  );
  assert.equal(
    report.file_action_state_transition_preview.transition,
    "FILE_ACTION_PREVIEW_ROUTED_NO_EXECUTION",
  );
});

test("routes Node0 multi-device resource manifest previews", () => {
  const manifest = buildNode0MultiDeviceUrpResourceManifestPreview();
  const report = buildAasrNode0StateRouterPreview({
    file_action_receipt_preview: null,
    resource_manifest_preview: manifest,
  });
  assert.equal(report.routed_artifact_type, "resource_manifest_preview");
  assert.equal(report.resource_state_transition_preview.source_schema, manifest.schema);
  assert.equal(report.resource_state_transition_preview.device_count, 2);
  assert.equal(report.resource_state_transition_preview.urp_write_performed, false);
});

test("routes combined file and resource preview artifacts", () => {
  const report = buildAasrNode0StateRouterPreview();
  assert.equal(report.routed_artifact_type, "file_action_and_resource_manifest");
  assert.equal(report.file_action_state_transition_preview.present, true);
  assert.equal(report.resource_state_transition_preview.present, true);
});

test("normalizes claims without overclaiming execution", () => {
  const report = buildAasrNode0StateRouterPreview({
    incoming_claim: "   Route   PREVIEW   State   Only   ",
  });
  assert.equal(report.normalized_claim, "route preview state only");
  assert.equal(report.boundaries.autonomous_action_performed, false);
});

test("produces deterministic SNR decisions from explicit weights", () => {
  const report = buildAasrNode0StateRouterPreview({
    consent_proof: { collected: true, mode: "exact_preview" },
    snr_weights: { evidence: 0.5, consent: 0.2, compliance: 0.2, boundary: 0.1 },
  });
  assert.equal(report.snr_decision.score, 1);
  assert.equal(report.snr_decision.decision, "ROUTE_SIGNAL_ACCEPTED");
  assert.deepEqual(report.snr_decision.noise, []);
});

test("produces PAT/SAT route references as preview metadata only", () => {
  const report = buildAasrNode0StateRouterPreview({
    pat_sat_refs: ["PAT:test", "SAT:test"],
  });
  assert.deepEqual(report.pat_sat_route.refs, ["PAT:test", "SAT:test"]);
  assert.equal(report.pat_sat_route.route_status, "preview_reference_only");
  assert.equal(report.pat_sat_route.pat_executed, false);
  assert.equal(report.pat_sat_route.sat_executed, false);
});

test("blocks execution when consent is missing", () => {
  const report = buildAasrNode0StateRouterPreview();
  assert.equal(report.consent_state.collected, false);
  assert.equal(report.consent_state.execution_allowed, false);
  assert.ok(report.blocked_by.includes("consent_missing_for_state_transition"));
  assert.equal(report.final_router_verdict, "AASR_PREVIEW_BLOCKED");
});

test("blocks or warns on compliance policy violations", () => {
  const report = buildAasrNode0StateRouterPreview({
    incoming_claim: "Token minted and wallet accessed",
  });
  assert.equal(report.compliance_state.ok, false);
  assert.ok(
    report.blocked_by.includes("forbidden_claim_fragment:token minted"),
  );
  assert.ok(
    report.blocked_by.includes("forbidden_claim_fragment:wallet accessed"),
  );
});

test("produces chained state block preview from previous_state_hash", () => {
  const previous = "sha256:previous-aasr-test";
  const first = buildAasrNode0StateRouterPreview({
    previous_state_hash: previous,
  });
  const second = buildAasrNode0StateRouterPreview({
    previous_state_hash: previous,
  });
  assert.equal(first.chained_state_block_preview.previous_state_hash, previous);
  assert.match(
    first.chained_state_block_preview.block_preview_hash,
    /^sha256:[0-9a-f]{64}$/,
  );
  assert.equal(
    first.chained_state_block_preview.block_preview_hash,
    second.chained_state_block_preview.block_preview_hash,
  );
  assert.equal(first.chained_state_block_preview.state_written, false);
});

test("produces APR refinement recommendation without invoking models", () => {
  const report = buildAasrNode0StateRouterPreview();
  assert.equal(
    report.apr_refinement_recommendation.recommendation,
    "collect_exact_preview_consent_before_execution_surface",
  );
  assert.equal(report.apr_refinement_recommendation.model_invoked, false);
  assert.equal(report.apr_refinement_recommendation.apr_executed, false);
});

test("keeps mutation/network/content/model/URP/token/wallet boundaries false", () => {
  const report = buildAasrNode0StateRouterPreview();
  assert.equal(report.boundaries.scan_executed, false);
  assert.equal(report.boundaries.file_mutation_performed, false);
  assert.equal(report.boundaries.file_content_read, false);
  assert.equal(report.boundaries.ocr_performed, false);
  assert.equal(report.boundaries.embedding_generated, false);
  assert.equal(report.boundaries.network_used, false);
  assert.equal(report.boundaries.urp_write_performed, false);
  assert.equal(report.boundaries.token_minted, false);
  assert.equal(report.boundaries.wallet_accessed, false);
  assert.equal(report.boundaries.daemon_started, false);
  assert.equal(report.boundaries.model_invocation_performed, false);
  assert.equal(report.boundaries.autonomous_action_performed, false);
});

test("verifier rejects crossed-boundary and invalid-schema reports", () => {
  const report = buildAasrNode0StateRouterPreview();
  const crossed = verifyAasrNode0StateRouterPreview({
    ...report,
    boundaries: { ...report.boundaries, network_used: true },
  });
  assert.equal(crossed.ok, false);
  assert.ok(Object.isFrozen(crossed.blocked_by));
  assert.ok(crossed.blocked_by.includes("boundary_not_all_false"));

  const invalid = verifyAasrNode0StateRouterPreview({ ...report, schema: "bad" });
  assert.equal(invalid.ok, false);
  assert.ok(Object.isFrozen(invalid.blocked_by));
  assert.ok(invalid.blocked_by.includes("invalid_schema"));
});

test("verifier rejects tampered APR execution previews", () => {
  const report = buildAasrNode0StateRouterPreview();
  const tampered = verifyAasrNode0StateRouterPreview({
    ...report,
    apr_refinement_recommendation: {
      ...report.apr_refinement_recommendation,
      apr_executed: true,
    },
  });
  assert.equal(tampered.ok, false);
  assert.ok(tampered.blocked_by.includes("apr_executed"));
  assert.ok(Object.isFrozen(tampered.blocked_by));
});

test("review verifier and gate pass canonical preview", () => {
  const report = buildAasrNode0StateRouterPreview();
  const verified = verifyAasrNode0StateRouterPreview(report);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
  const gate = runAasrNode0StateRouterPreviewGate();
  assert.equal(gate.ok, true);
  assert.equal(gate.routed_artifact_type, "file_action_and_resource_manifest");
});
