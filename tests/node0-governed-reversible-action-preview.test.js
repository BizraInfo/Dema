import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNode0GovernedReversibleActionPreview,
  verifyNode0GovernedReversibleActionPreview,
  runNode0GovernedReversibleActionPreviewGate,
  NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_SCHEMA,
  NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_TRUTH_LABEL,
  NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_STAGE,
  NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE,
  NODE0_GOVERNED_REVERSIBLE_ACTION_HUMAN_GO_PHRASE,
} from "../packages/core/src/node0-governed-reversible-action-preview.js";
import { buildAasrNode0StateRouterPreview } from "../packages/core/src/aasr-node0-state-router-preview.js";
import { buildAprNode0RouteRefineryPreview } from "../packages/core/src/apr-node0-route-refinery-preview.js";

function refinedRoute() {
  return buildAprNode0RouteRefineryPreview({
    aasr_route_preview: buildAasrNode0StateRouterPreview({
      consent_proof: { collected: true, mode: "exact_preview" },
    }),
  });
}

test("builds frozen governed reversible action preview envelope", () => {
  const report = buildNode0GovernedReversibleActionPreview();
  assert.equal(report.schema, NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_SCHEMA);
  assert.equal(report.truth_label, NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_TRUTH_LABEL);
  assert.equal(report.action_stage, NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_STAGE);
  assert.equal(report.action_type, NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE);
  assert.equal(
    report.human_go_phrase_required,
    NODE0_GOVERNED_REVERSIBLE_ACTION_HUMAN_GO_PHRASE,
  );
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.action_eligibility));
  assert.ok(Object.isFrozen(report.backup_manifest_preview));
  assert.ok(Object.isFrozen(report.undo_manifest_preview));
});

test("accepts APR route-refinery preview as the refined route input", () => {
  const route = refinedRoute();
  const report = buildNode0GovernedReversibleActionPreview({
    refined_route_preview: route,
  });
  assert.equal(
    report.input_refined_route_id,
    route.chained_refinement_block_preview.block_preview_hash,
  );
  assert.equal(report.action_eligibility.eligible_for_human_go_review, true);
  assert.equal(report.action_eligibility.eligible_for_execution, false);
});

test("rejects raw AASR route input without APR refinement", () => {
  const report = buildNode0GovernedReversibleActionPreview({
    refined_route_preview: buildAasrNode0StateRouterPreview({
      consent_proof: { collected: true, mode: "exact_preview" },
    }),
  });
  assert.equal(report.action_eligibility.eligible_for_human_go_review, false);
  assert.ok(report.blocked_by.includes("apr_refinement_required"));

  const verified = verifyNode0GovernedReversibleActionPreview(report);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("action_not_eligible_for_human_go_review"));
});

test("accepts one low-risk rename-preview action candidate", () => {
  const report = buildNode0GovernedReversibleActionPreview({
    proposed_action: {
      action_type: NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE,
      target_resource: {
        resource_id_hash: "sha256:test-resource",
        parent_path_hash: "sha256:test-parent",
        current_name: "before.txt",
        proposed_name: "after.txt",
        content_read_required: false,
      },
      operator_intent: "Preview a reversible rename candidate.",
      execution_requested: false,
    },
  });
  assert.equal(report.risk_review.ok, true);
  assert.equal(report.risk_review.risk_level, "low");
  assert.deepEqual(report.blocked_by, []);
});

test("requires exact preview consent phrase before action eligibility", () => {
  const report = buildNode0GovernedReversibleActionPreview({
    consent_proof: {
      collected: true,
      mode: "checkbox",
      phrase: NODE0_GOVERNED_REVERSIBLE_ACTION_HUMAN_GO_PHRASE,
    },
  });
  assert.equal(report.consent_state.exact_preview_consent, false);
  assert.ok(report.blocked_by.includes("exact_preview_consent_missing"));
  assert.equal(report.action_eligibility.eligible_for_human_go_review, false);

  const verified = verifyNode0GovernedReversibleActionPreview(report);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("exact_preview_consent_missing"));
});

test("requires backup manifest preview", () => {
  const report = buildNode0GovernedReversibleActionPreview({
    backup_manifest_preview: { backup_preview_available: false },
  });
  assert.ok(report.blocked_by.includes("backup_manifest_preview_missing"));
  assert.equal(report.action_eligibility.eligible_for_human_go_review, false);

  const verified = verifyNode0GovernedReversibleActionPreview(report);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("backup_manifest_preview_missing"));
});

test("requires undo manifest preview", () => {
  const report = buildNode0GovernedReversibleActionPreview({
    undo_manifest_preview: {
      undo_preview_available: true,
      undo_steps: [],
      undo_executed: false,
    },
  });
  assert.ok(report.blocked_by.includes("undo_steps_missing"));
  assert.equal(report.action_eligibility.eligible_for_human_go_review, false);

  const verified = verifyNode0GovernedReversibleActionPreview(report);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("undo_steps_missing"));
});

test("produces pre-execution receipt preview and post-execution requirements", () => {
  const report = buildNode0GovernedReversibleActionPreview();
  assert.match(
    report.pre_execution_receipt_preview.receipt_preview_hash,
    /^sha256:[0-9a-f]{64}$/,
  );
  assert.equal(report.pre_execution_receipt_preview.receipt_written, false);
  assert.equal(report.pre_execution_receipt_preview.action_executed, false);
  assert.equal(
    report.post_execution_receipt_requirements.receipt_required_after_any_future_execution,
    true,
  );
  assert.ok(
    report.post_execution_receipt_requirements.required_fields.includes(
      "backup_manifest_hash",
    ),
  );
});

test("blocks delete, move, merge, content-read, network, token, and wallet claims", () => {
  const report = buildNode0GovernedReversibleActionPreview({
    proposed_action: {
      action_type: NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE,
      target_resource: {
        resource_id_hash: "sha256:test-resource",
        parent_path_hash: "sha256:test-parent",
        current_name: "before.txt",
        proposed_name: "after.txt",
        content_read_required: false,
      },
      operator_intent:
        "Preview must not delete, move, merge, content read, network, token, or wallet anything.",
      execution_requested: false,
    },
  });
  assert.equal(report.risk_review.ok, false);
  for (const fragment of ["delete", "move", "merge", "content read", "network", "token", "wallet"]) {
    assert.ok(
      report.risk_review.blocked_by.includes(`forbidden_action_fragment:${fragment}`),
    );
  }
});

test("produces deterministic chained action block previews", () => {
  const previous = "sha256:governed-action-preview-test";
  const first = buildNode0GovernedReversibleActionPreview({
    previous_state_hash: previous,
  });
  const second = buildNode0GovernedReversibleActionPreview({
    previous_state_hash: previous,
  });
  assert.equal(first.chained_action_block_preview.previous_state_hash, previous);
  assert.match(
    first.chained_action_block_preview.block_preview_hash,
    /^sha256:[0-9a-f]{64}$/,
  );
  assert.equal(
    first.chained_action_block_preview.block_preview_hash,
    second.chained_action_block_preview.block_preview_hash,
  );
  assert.equal(first.chained_action_block_preview.action_executed, false);
  assert.equal(first.chained_action_block_preview.state_written, false);
  assert.equal(first.chained_action_block_preview.undo_executed, false);
});

test("keeps all effect and action boundaries false", () => {
  const report = buildNode0GovernedReversibleActionPreview();
  assert.equal(report.boundaries.action_execution_performed, false);
  assert.equal(report.boundaries.file_mutation_performed, false);
  assert.equal(report.boundaries.actual_rename_performed, false);
  assert.equal(report.boundaries.move_performed, false);
  assert.equal(report.boundaries.merge_performed, false);
  assert.equal(report.boundaries.delete_performed, false);
  assert.equal(report.boundaries.file_content_read, false);
  assert.equal(report.boundaries.ocr_performed, false);
  assert.equal(report.boundaries.embedding_generated, false);
  assert.equal(report.boundaries.network_used, false);
  assert.equal(report.boundaries.urp_write_performed, false);
  assert.equal(report.boundaries.token_minted, false);
  assert.equal(report.boundaries.wallet_accessed, false);
  assert.equal(report.boundaries.daemon_started, false);
  assert.equal(report.boundaries.autonomous_action_performed, false);
});

test("verifier rejects tampered action block hashes", () => {
  const report = buildNode0GovernedReversibleActionPreview();
  const verified = verifyNode0GovernedReversibleActionPreview({
    ...report,
    chained_action_block_preview: {
      ...report.chained_action_block_preview,
      block_preview_hash:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    },
  });
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("action_block_hash_mismatch"));
});

test("verifier rejects tampered APR route-refinement evidence", () => {
  const report = buildNode0GovernedReversibleActionPreview();
  const verified = verifyNode0GovernedReversibleActionPreview({
    ...report,
    route_refinement_evidence: {
      ...report.route_refinement_evidence,
      schema: "bizra.node0.aasr_state_router_preview.v0.1",
    },
  });
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("apr_refinement_required"));
  assert.ok(verified.blocked_by.includes("action_block_hash_mismatch"));
});

test("verifier rejects missing backup and missing undo previews", () => {
  const report = buildNode0GovernedReversibleActionPreview();
  const missingBackup = verifyNode0GovernedReversibleActionPreview({
    ...report,
    backup_manifest_preview: undefined,
  });
  assert.equal(missingBackup.ok, false);
  assert.ok(missingBackup.blocked_by.includes("backup_manifest_preview_missing"));

  const missingUndo = verifyNode0GovernedReversibleActionPreview({
    ...report,
    undo_manifest_preview: undefined,
  });
  assert.equal(missingUndo.ok, false);
  assert.ok(missingUndo.blocked_by.includes("undo_manifest_preview_missing"));
});

test("verifier rejects malformed backup and undo preview schemas", () => {
  const report = buildNode0GovernedReversibleActionPreview();
  const malformedBackup = verifyNode0GovernedReversibleActionPreview({
    ...report,
    backup_manifest_preview: {
      ...report.backup_manifest_preview,
      schema: "bad",
    },
  });
  assert.equal(malformedBackup.ok, false);
  assert.ok(malformedBackup.blocked_by.includes("backup_manifest_schema_invalid"));

  const malformedUndo = verifyNode0GovernedReversibleActionPreview({
    ...report,
    undo_manifest_preview: {
      ...report.undo_manifest_preview,
      truth_label: "bad",
    },
  });
  assert.equal(malformedUndo.ok, false);
  assert.ok(malformedUndo.blocked_by.includes("undo_manifest_truth_label_invalid"));
});

test("blocks extra action and target-resource keys", () => {
  const report = buildNode0GovernedReversibleActionPreview({
    proposed_action: {
      action_type: NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE,
      target_resource: {
        resource_id_hash: "sha256:test-resource",
        parent_path_hash: "sha256:test-parent",
        current_name: "before.txt",
        proposed_name: "after.txt",
        content_read_required: false,
        second_candidate: "sha256:other",
      },
      operator_intent: "Preview a reversible rename candidate.",
      execution_requested: false,
      batch_count: 2,
    },
  });
  assert.equal(report.risk_review.ok, false);
  assert.ok(report.risk_review.blocked_by.includes("unknown_action_key:batch_count"));
  assert.ok(
    report.risk_review.blocked_by.includes(
      "unknown_target_resource_key:second_candidate",
    ),
  );
});

test("verifier rejects stale pre-execution receipt hash and incomplete post requirements", () => {
  const report = buildNode0GovernedReversibleActionPreview();
  const staleReceipt = verifyNode0GovernedReversibleActionPreview({
    ...report,
    pre_execution_receipt_preview: {
      ...report.pre_execution_receipt_preview,
      receipt_preview_hash:
        "sha256:0000000000000000000000000000000000000000000000000000000000000000",
    },
  });
  assert.equal(staleReceipt.ok, false);
  assert.ok(staleReceipt.blocked_by.includes("pre_execution_receipt_hash_mismatch"));

  const incompletePost = verifyNode0GovernedReversibleActionPreview({
    ...report,
    post_execution_receipt_requirements: {
      ...report.post_execution_receipt_requirements,
      required_fields: ["pre_execution_receipt_hash"],
    },
  });
  assert.equal(incompletePost.ok, false);
  assert.ok(
    incompletePost.blocked_by.includes(
      "post_execution_receipt_requirement_missing:backup_manifest_hash",
    ),
  );
});

test("verifier rejects non-preview boundaries", () => {
  const report = buildNode0GovernedReversibleActionPreview();
  const crossed = verifyNode0GovernedReversibleActionPreview({
    ...report,
    boundaries: { ...report.boundaries, actual_rename_performed: true },
  });
  assert.equal(crossed.ok, false);
  assert.ok(crossed.blocked_by.includes("boundary_not_all_false"));

  const empty = verifyNode0GovernedReversibleActionPreview({
    ...report,
    boundaries: {},
  });
  assert.equal(empty.ok, false);
  assert.ok(empty.blocked_by.includes("boundary_not_all_false"));
});

test("review verifier and gate pass canonical preview structure", () => {
  const report = buildNode0GovernedReversibleActionPreview();
  const verified = verifyNode0GovernedReversibleActionPreview(report);
  assert.equal(verified.ok, true);
  assert.deepEqual(verified.blocked_by, []);
  assert.ok(Object.isFrozen(verified.blocked_by));

  const gate = runNode0GovernedReversibleActionPreviewGate();
  assert.equal(gate.ok, true);
  assert.equal(gate.eligible_for_human_go_review, true);
  assert.equal(gate.eligible_for_execution, false);
  assert.equal(gate.truth_label, NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_TRUTH_LABEL);
});
