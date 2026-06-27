import test from "node:test";
import assert from "node:assert/strict";

import {
  buildDemaNodeSpaceBondingFileSteward,
  verifyDemaNodeSpaceBondingFileSteward,
  runDemaNodeSpaceBondingFileStewardGate,
  DEMA_NODE_SPACE_BONDING_FILE_STEWARD_SCHEMA,
  DEMA_NODE_SPACE_BONDING_FILE_STEWARD_TRUTH_LABEL,
  DEMA_NODE_SPACE_BONDING_STAGE,
  FILE_STEWARD_FIXTURE_INVENTORY,
} from "../packages/core/src/dema-node-space-bonding-file-steward.js";

test("builds frozen preview envelope", () => {
  const report = buildDemaNodeSpaceBondingFileSteward();
  assert.equal(report.schema, DEMA_NODE_SPACE_BONDING_FILE_STEWARD_SCHEMA);
  assert.equal(report.truth_label, DEMA_NODE_SPACE_BONDING_FILE_STEWARD_TRUTH_LABEL);
  assert.equal(report.bonding_stage, DEMA_NODE_SPACE_BONDING_STAGE);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.file_type_clusters));
  assert.ok(Object.isFrozen(report.file_action_receipt_previews[0]));
});

test("classifies fixture files from metadata only", () => {
  const report = buildDemaNodeSpaceBondingFileSteward();
  assert.equal(
    report.node_space_inventory_summary.file_count,
    FILE_STEWARD_FIXTURE_INVENTORY.length,
  );
  assert.equal(report.node_space_inventory_summary.metadata_only, true);
  const clusters = new Map(
    report.file_type_clusters.map((cluster) => [cluster.category, cluster]),
  );
  assert.ok(clusters.has("notes"));
  assert.ok(clusters.has("media"));
  assert.ok(clusters.has("finance"));
  for (const row of report.unstructured_data_map) {
    assert.equal(row.content_read, false);
    assert.ok(row.metadata_fields_used.includes("name"));
  }
});

test("proposes deterministic folder groups", () => {
  const report = buildDemaNodeSpaceBondingFileSteward();
  const folders = report.folder_organization_plan_preview.map((plan) => [
    plan.category,
    plan.proposed_folder,
  ]);
  assert.deepEqual(folders, [
    ["archive", "06-archives"],
    ["finance", "03-finance"],
    ["media", "05-media"],
    ["notes", "01-notes"],
  ]);
});

test("proposes deterministic rename previews", () => {
  const first = buildDemaNodeSpaceBondingFileSteward();
  const second = buildDemaNodeSpaceBondingFileSteward();
  assert.deepEqual(first.batch_rename_plan_preview, second.batch_rename_plan_preview);
  assert.ok(
    first.batch_rename_plan_preview.some(
      (plan) => plan.proposed_name === "dema-node-space-notes-bizra-notes-final.md",
    ),
  );
  assert.ok(
    first.batch_rename_plan_preview.every(
      (plan) => plan.action_type === "rename_preview" && plan.mutation_performed === false,
    ),
  );
});

test("emits receipt hash previews for proposed actions", () => {
  const report = buildDemaNodeSpaceBondingFileSteward();
  assert.ok(report.file_action_receipt_previews.length > 0);
  for (const receipt of report.file_action_receipt_previews) {
    assert.match(receipt.receipt_preview_id, /^sha256:[0-9a-f]{64}$/);
    assert.equal(receipt.verification_result, "PREVIEW_VERIFIED_NO_FILE_CHANGED");
    assert.equal(receipt.no_file_changed, true);
    assert.equal(receipt.claim, "file_action_preview_only");
  }
});

test("requires consent for content-aware classification", () => {
  const report = buildDemaNodeSpaceBondingFileSteward();
  assert.equal(
    report.content_awareness_consent_requests.length,
    FILE_STEWARD_FIXTURE_INVENTORY.length,
  );
  for (const request of report.content_awareness_consent_requests) {
    assert.equal(request.default_allowed, false);
    assert.match(request.consent_phrase_required, /^GO: read content/);
  }
});

test("blocks delete and merge execution actions", () => {
  const report = buildDemaNodeSpaceBondingFileSteward();
  assert.equal(
    JSON.stringify(report).includes("delete_preview"),
    false,
    "delete previews must not be emitted in 1A",
  );
  assert.ok(report.duplicate_candidate_plan.length >= 1);
  for (const plan of report.merge_candidate_plan_preview) {
    assert.equal(plan.action_type, "merge_preview");
    assert.equal(plan.merge_allowed_now, false);
    assert.ok(plan.blocked_by.includes("content_hash_not_computed"));
  }
});

test("boundaries remain false for mutation, network, upload, and content read", () => {
  const report = buildDemaNodeSpaceBondingFileSteward();
  assert.equal(report.boundaries.file_rename_performed, false);
  assert.equal(report.boundaries.file_move_performed, false);
  assert.equal(report.boundaries.file_merge_performed, false);
  assert.equal(report.boundaries.file_delete_performed, false);
  assert.equal(report.boundaries.file_content_read, false);
  assert.equal(report.boundaries.ocr_performed, false);
  assert.equal(report.boundaries.embedding_generated, false);
  assert.equal(report.boundaries.upload_performed, false);
  assert.equal(report.boundaries.network_used, false);
  assert.equal(report.boundaries.autonomous_action_performed, false);
});

test("forbidden overclaims are absent from positive claims", () => {
  const report = buildDemaNodeSpaceBondingFileSteward();
  const positiveClaimText = JSON.stringify({
    proves: report.what_this_proves,
    policies: report.policies,
    summary: report.node_space_inventory_summary,
  }).toLowerCase();
  for (const forbidden of [
    "renamed file",
    "moved file",
    "merged file",
    "deleted file",
    "read file content",
    "autonomous action",
    "token reward",
  ]) {
    assert.equal(positiveClaimText.includes(forbidden), false, forbidden);
  }
});

test("review verifier and gate pass canonical preview", () => {
  const report = buildDemaNodeSpaceBondingFileSteward();
  const verified = verifyDemaNodeSpaceBondingFileSteward(report);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
  const gate = runDemaNodeSpaceBondingFileStewardGate();
  assert.equal(gate.ok, true);
  assert.equal(gate.receipt_preview_count, report.file_action_receipt_previews.length);
});
