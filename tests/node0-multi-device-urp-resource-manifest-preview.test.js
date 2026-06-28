import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNode0MultiDeviceUrpResourceManifestPreview,
  verifyNode0MultiDeviceUrpResourceManifestPreview,
  runNode0MultiDeviceUrpResourceManifestPreviewGate,
  NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_SCHEMA,
  NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_TRUTH_LABEL,
} from "../packages/core/src/node0-multi-device-urp-resource-manifest-preview.js";

test("builds frozen preview envelope", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  assert.equal(report.schema, NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_SCHEMA);
  assert.equal(report.truth_label, NODE0_MULTI_DEVICE_URP_RESOURCE_MANIFEST_TRUTH_LABEL);
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.device_manifests));
  assert.ok(Object.isFrozen(report.receipt_chain_preview));
});

test("accepts laptop and mobile manifests under one human node", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  assert.equal(report.node_id, "node0:mohamed");
  assert.equal(report.human_owner, "Mohamed");
  assert.equal(report.device_count, 2);
  const deviceTypes = new Set(report.device_manifests.map((d) => d.device_type));
  assert.ok(deviceTypes.has("laptop_node"));
  assert.ok(deviceTypes.has("mobile_node"));
});

test("preserves per-device provenance without scans or content reads", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  for (const manifest of report.device_manifests) {
    assert.equal(manifest.provenance.source, "provided_device_resource_manifest");
    assert.equal(manifest.provenance.scan_executed, false);
    assert.equal(manifest.provenance.content_read, false);
    assert.ok(manifest.resource_ids.length >= 1);
  }
});

test("produces unified Node Space summary", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  assert.equal(report.unified_node_space_summary.device_count, 2);
  assert.equal(report.unified_node_space_summary.resource_count, 6);
  assert.equal(report.unified_node_space_summary.metadata_only, true);
  assert.equal(report.unified_node_space_summary.category_counts.proof_archive, 2);
});

test("detects cross-device duplicate candidates", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  assert.equal(report.duplicate_cross_device_candidates.length, 1);
  const candidate = report.duplicate_cross_device_candidates[0];
  assert.deepEqual(candidate.device_ids, [
    "dev:laptop-primary",
    "dev:mobile-primary",
  ]);
  assert.equal(candidate.content_hash_required_for_confirmation, true);
  assert.equal(candidate.merge_allowed_now, false);
});

test("detects cross-device version-chain candidates", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  assert.ok(report.version_chain_cross_device_candidates.length >= 1);
  const chain = report.version_chain_cross_device_candidates.find(
    (item) => item.family === "bizra-notes",
  );
  assert.ok(chain);
  assert.equal(chain.latest_version_unverified, true);
  assert.equal(chain.content_compare_required, true);
});

test("flags sensitive resource hints for human review", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  const sensitivities = new Set(
    report.sensitive_resource_hints.map((hint) => hint.sensitivity),
  );
  assert.ok(sensitivities.has("financial"));
  assert.ok(sensitivities.has("private"));
  for (const hint of report.sensitive_resource_hints) {
    assert.equal(hint.human_review_required, true);
    assert.equal(hint.content_read_allowed, false);
  }
});

test("produces mint eligibility preview without minting", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  assert.equal(report.mint_eligibility_preview.preview_only, true);
  assert.ok(report.mint_eligibility_preview.eligible_candidate_count > 0);
  assert.equal(report.mint_eligibility_preview.token_minted, false);
  assert.equal(report.mint_eligibility_preview.wallet_accessed, false);
});

test("produces URP contribution preview without transfer", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  assert.equal(report.urp_contribution_preview.preview_only, true);
  assert.ok(report.urp_contribution_preview.candidate_resource_ids.length > 0);
  assert.equal(report.urp_contribution_preview.urp_write_performed, false);
  assert.equal(report.urp_contribution_preview.transfer_performed, false);
});

test("produces receipt chain preview from previous state hash", () => {
  const previous = "sha256:previous-state-test";
  const report = buildNode0MultiDeviceUrpResourceManifestPreview({
    previous_state_hash: previous,
  });
  assert.equal(report.receipt_chain_preview.previous_state_hash, previous);
  assert.match(report.receipt_chain_preview.block_preview_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(
    report.receipt_chain_preview.verification_result,
    "PREVIEW_VERIFIED_NO_DEVICE_ACTION",
  );
});

test("produces self-improvement inputs for later RSI without executing learning", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  assert.equal(report.self_improvement_inputs.preview_only, true);
  assert.equal(report.self_improvement_inputs.model_training_or_rl_performed, false);
  assert.ok(
    report.self_improvement_inputs.later_rsi_inputs.includes(
      "receipt_chain_continuity",
    ),
  );
});

test("keeps mutation/network/content/token/wallet/URP boundaries false", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  assert.equal(report.boundaries.file_content_read, false);
  assert.equal(report.boundaries.file_mutation_performed, false);
  assert.equal(report.boundaries.mobile_extraction_performed, false);
  assert.equal(report.boundaries.device_sync_performed, false);
  assert.equal(report.boundaries.ocr_performed, false);
  assert.equal(report.boundaries.embedding_generated, false);
  assert.equal(report.boundaries.network_used, false);
  assert.equal(report.boundaries.urp_write_performed, false);
  assert.equal(report.boundaries.token_minted, false);
  assert.equal(report.boundaries.wallet_accessed, false);
  assert.equal(report.boundaries.transfer_performed, false);
  assert.equal(report.boundaries.daemon_started, false);
  assert.equal(report.boundaries.autonomous_action_performed, false);
});

test("review verifier and gate pass canonical preview", () => {
  const report = buildNode0MultiDeviceUrpResourceManifestPreview();
  const verified = verifyNode0MultiDeviceUrpResourceManifestPreview(report);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
  const gate = runNode0MultiDeviceUrpResourceManifestPreviewGate();
  assert.equal(gate.ok, true);
  assert.equal(gate.device_count, 2);
  assert.equal(gate.resource_count, 6);
});
