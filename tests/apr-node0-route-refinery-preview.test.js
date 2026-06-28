import test from "node:test";
import assert from "node:assert/strict";

import {
  buildAprNode0RouteRefineryPreview,
  verifyAprNode0RouteRefineryPreview,
  runAprNode0RouteRefineryPreviewGate,
  APR_NODE0_ROUTE_REFINERY_SCHEMA,
  APR_NODE0_ROUTE_REFINERY_TRUTH_LABEL,
  APR_NODE0_ROUTE_REFINERY_STAGE,
} from "../packages/core/src/apr-node0-route-refinery-preview.js";
import { buildAasrNode0StateRouterPreview } from "../packages/core/src/aasr-node0-state-router-preview.js";

test("builds frozen APR route refinery preview envelope", () => {
  const report = buildAprNode0RouteRefineryPreview();
  assert.equal(report.schema, APR_NODE0_ROUTE_REFINERY_SCHEMA);
  assert.equal(report.truth_label, APR_NODE0_ROUTE_REFINERY_TRUTH_LABEL);
  assert.equal(report.refinery_stage, APR_NODE0_ROUTE_REFINERY_STAGE);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.proof_gap_analysis));
  assert.ok(Object.isFrozen(report.recommended_route_adjustments));
});

test("uses AASR state-block hash as the input route id", () => {
  const route = buildAasrNode0StateRouterPreview();
  const report = buildAprNode0RouteRefineryPreview({ aasr_route_preview: route });
  assert.equal(
    report.input_route_id,
    route.chained_state_block_preview.block_preview_hash,
  );
});

test("identifies missing consent before action eligibility", () => {
  const report = buildAprNode0RouteRefineryPreview();
  assert.equal(report.consent_gap_analysis.ok, false);
  assert.ok(
    report.consent_gap_analysis.blocked_by.includes(
      "exact_consent_missing_before_action",
    ),
  );
  assert.equal(
    report.safe_next_action_recommendation,
    "collect_exact_preview_consent_before_action_eligibility",
  );
});

test("raises route quality when AASR has exact preview consent", () => {
  const route = buildAasrNode0StateRouterPreview({
    consent_proof: { collected: true, mode: "exact_preview" },
  });
  const report = buildAprNode0RouteRefineryPreview({ aasr_route_preview: route });
  assert.equal(report.proof_gap_analysis.ok, true);
  assert.equal(report.consent_gap_analysis.ok, true);
  assert.equal(report.risk_gap_analysis.ok, true);
  assert.equal(report.overclaim_analysis.ok, true);
  assert.equal(report.route_quality_score, 1);
  assert.deepEqual(report.recommended_route_adjustments, []);
  assert.equal(
    report.safe_next_action_recommendation,
    "route_refined_for_human_review_only",
  );
});

test("rejects collected consent when mode is not exact preview", () => {
  const route = buildAasrNode0StateRouterPreview({
    consent_proof: { collected: true, mode: "checkbox" },
  });
  const report = buildAprNode0RouteRefineryPreview({ aasr_route_preview: route });
  assert.equal(report.consent_gap_analysis.ok, false);
  assert.equal(report.consent_gap_analysis.collected, true);
  assert.equal(report.consent_gap_analysis.exact_consent_collected, false);
  assert.ok(
    report.consent_gap_analysis.blocked_by.includes(
      "exact_consent_missing_before_action",
    ),
  );
});

test("surfaces proof gaps for incomplete route previews", () => {
  const route = buildAasrNode0StateRouterPreview({
    consent_proof: { collected: true, mode: "exact_preview" },
  });
  const { snr_decision: _omit, ...incompleteRoute } = route;
  const report = buildAprNode0RouteRefineryPreview({
    aasr_route_preview: incompleteRoute,
  });
  assert.equal(report.proof_gap_analysis.ok, false);
  assert.ok(
    report.proof_gap_analysis.missing_fields.includes("snr_decision"),
  );
  assert.ok(
    report.blocked_by.includes("missing_route_field:snr_decision"),
  );
});

test("surfaces risk gaps for crossed AASR route boundaries", () => {
  const route = buildAasrNode0StateRouterPreview({
    boundary: { network_used: true },
    consent_proof: { collected: true, mode: "exact_preview" },
  });
  const report = buildAprNode0RouteRefineryPreview({ aasr_route_preview: route });
  assert.equal(report.risk_gap_analysis.risk_level, "high");
  assert.ok(report.risk_gap_analysis.blocked_by.includes("boundary_not_all_false"));
  assert.equal(
    report.safe_next_action_recommendation,
    "reject_route_until_boundaries_are_false",
  );
});

test("deduplicates repeated boundary blockers in top-level blocked_by", () => {
  const route = buildAasrNode0StateRouterPreview({
    boundary: { network_used: true },
    consent_proof: { collected: true, mode: "exact_preview" },
  });
  const report = buildAprNode0RouteRefineryPreview({
    aasr_route_preview: route,
    boundary: { network_used: true },
  });
  assert.equal(
    report.blocked_by.filter((code) => code === "boundary_not_all_false").length,
    1,
  );
});

test("surfaces overclaim fragments before route refinement", () => {
  const route = buildAasrNode0StateRouterPreview({
    incoming_claim: "The route executed a token minted action",
    consent_proof: { collected: true, mode: "exact_preview" },
  });
  const report = buildAprNode0RouteRefineryPreview({ aasr_route_preview: route });
  assert.equal(report.overclaim_analysis.ok, false);
  assert.ok(report.overclaim_analysis.matched_fragments.includes("executed"));
  assert.ok(report.overclaim_analysis.matched_fragments.includes("token minted"));
  assert.equal(
    report.safe_next_action_recommendation,
    "reduce_claim_to_preview_safe_language",
  );
});

test("produces deterministic chained refinement block previews", () => {
  const previous = "sha256:previous-apr-refinery-test";
  const route = buildAasrNode0StateRouterPreview({
    consent_proof: { collected: true, mode: "exact_preview" },
  });
  const first = buildAprNode0RouteRefineryPreview({
    aasr_route_preview: route,
    previous_state_hash: previous,
  });
  const second = buildAprNode0RouteRefineryPreview({
    aasr_route_preview: route,
    previous_state_hash: previous,
  });
  assert.equal(
    first.chained_refinement_block_preview.previous_state_hash,
    previous,
  );
  assert.match(
    first.chained_refinement_block_preview.block_preview_hash,
    /^sha256:[0-9a-f]{64}$/,
  );
  assert.equal(
    first.chained_refinement_block_preview.block_preview_hash,
    second.chained_refinement_block_preview.block_preview_hash,
  );
  assert.equal(first.chained_refinement_block_preview.refinement_written, false);
  assert.equal(
    first.chained_refinement_block_preview.route_execution_performed,
    false,
  );
});

test("keeps route execution and effect boundaries false", () => {
  const report = buildAprNode0RouteRefineryPreview();
  assert.equal(report.boundaries.scan_executed, false);
  assert.equal(report.boundaries.route_execution_performed, false);
  assert.equal(report.boundaries.file_mutation_performed, false);
  assert.equal(report.boundaries.file_content_read, false);
  assert.equal(report.boundaries.ocr_performed, false);
  assert.equal(report.boundaries.embedding_generated, false);
  assert.equal(report.boundaries.network_used, false);
  assert.equal(report.boundaries.urp_write_performed, false);
  assert.equal(report.boundaries.token_minted, false);
  assert.equal(report.boundaries.wallet_accessed, false);
  assert.equal(report.boundaries.transfer_performed, false);
  assert.equal(report.boundaries.daemon_started, false);
  assert.equal(report.boundaries.model_invocation_performed, false);
  assert.equal(report.boundaries.autonomous_action_performed, false);
});

test("verifier rejects invalid schema and crossed refinery boundaries", () => {
  const report = buildAprNode0RouteRefineryPreview();
  const invalid = verifyAprNode0RouteRefineryPreview({
    ...report,
    schema: "bad",
  });
  assert.equal(invalid.ok, false);
  assert.ok(invalid.blocked_by.includes("invalid_schema"));
  assert.ok(Object.isFrozen(invalid.blocked_by));

  const crossed = verifyAprNode0RouteRefineryPreview({
    ...report,
    boundaries: { ...report.boundaries, network_used: true },
  });
  assert.equal(crossed.ok, false);
  assert.ok(crossed.blocked_by.includes("boundary_not_all_false"));

  const emptyBoundary = verifyAprNode0RouteRefineryPreview({
    ...report,
    boundaries: {},
  });
  assert.equal(emptyBoundary.ok, false);
  assert.ok(emptyBoundary.blocked_by.includes("boundary_not_all_false"));
});

test("verifier rejects tampered refinement execution", () => {
  const report = buildAprNode0RouteRefineryPreview();
  const tampered = verifyAprNode0RouteRefineryPreview({
    ...report,
    chained_refinement_block_preview: {
      ...report.chained_refinement_block_preview,
      route_execution_performed: true,
    },
  });
  assert.equal(tampered.ok, false);
  assert.ok(tampered.blocked_by.includes("route_execution_performed"));
});

test("verifier rejects stale refinement block hashes", () => {
  const report = buildAprNode0RouteRefineryPreview();
  const stale = verifyAprNode0RouteRefineryPreview({
    ...report,
    route_quality_score: report.route_quality_score + 0.1,
  });
  assert.equal(stale.ok, false);
  assert.ok(stale.blocked_by.includes("refinement_block_hash_mismatch"));
});

test("review verifier and gate pass canonical preview structure", () => {
  const report = buildAprNode0RouteRefineryPreview();
  const verified = verifyAprNode0RouteRefineryPreview(report);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
  const gate = runAprNode0RouteRefineryPreviewGate();
  assert.equal(gate.ok, true);
  assert.equal(gate.schema, APR_NODE0_ROUTE_REFINERY_SCHEMA);
});
