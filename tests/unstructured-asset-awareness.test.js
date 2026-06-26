import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUnstructuredAssetFixture,
  buildUnstructuredAssetAwareness,
  verifyUnstructuredAssetAwareness,
  runUnstructuredAssetAwarenessGate,
  UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
  UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
  UNSTRUCTURED_FIXTURE_ASSETS,
} from "../packages/core/src/unstructured-asset-awareness.js";

test("fixture includes 13 mixed unstructured asset types", () => {
  const fixture = buildUnstructuredAssetFixture();
  assert.equal(fixture.assets.length, 13);
  assert.equal(fixture.assets.length, UNSTRUCTURED_FIXTURE_ASSETS.length);
  const types = new Set(fixture.assets.map((a) => a.unstructured_type));
  assert.ok(types.has("pdf_report"));
  assert.ok(types.has("unknown_binary"));
  assert.ok(types.has("personal_private"));
});

test("awareness report schema and metadata boundary", () => {
  const report = buildUnstructuredAssetAwareness();
  assert.equal(report.schema, UNSTRUCTURED_ASSET_AWARENESS_SCHEMA);
  assert.equal(report.truth_label, UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL);
  assert.equal(report.boundary.file_content_read, false);
  assert.equal(report.boundary.ocr_performed, false);
  assert.equal(report.boundary.embedding_generated, false);
  assert.equal(report.boundary.network_used, false);
});

test("all fixture assets classified in type counts", () => {
  const report = buildUnstructuredAssetAwareness();
  for (const asset of UNSTRUCTURED_FIXTURE_ASSETS) {
    assert.ok(
      report.asset_type_counts[asset.unstructured_type] >= 1,
      asset.unstructured_type,
    );
  }
});

test("sensitive assets require explicit consent beyond metadata default", () => {
  const report = buildUnstructuredAssetAwareness();
  const privateRow = report.consent_requirements.per_asset.find(
    (r) => r.asset_id === "ua:private/journal-entry.docx",
  );
  assert.equal(privateRow.minimum_consent_mode, "deep_understanding_strong_consent");
  const legalRow = report.consent_requirements.per_asset.find(
    (r) => r.asset_id === "ua:legal/service-agreement.pdf",
  );
  assert.equal(legalRow.minimum_consent_mode, "content_classification_consent");
});

test("unknown binary is blocked pending review", () => {
  const report = buildUnstructuredAssetAwareness();
  const blocked = report.blocked_or_unknown_assets.find(
    (b) => b.asset_id === "ua:unknown/mystery.dat",
  );
  assert.ok(blocked);
  assert.equal(blocked.allowed_default_action, "metadata_only");
});

test("duplicate candidates surfaced by metadata fingerprint", () => {
  const report = buildUnstructuredAssetAwareness();
  assert.ok(report.duplicate_candidates.length >= 1);
  const dup = report.duplicate_candidates[0];
  assert.ok(dup.asset_ids.includes("ua:reports/q4-summary.pdf"));
  assert.ok(dup.asset_ids.includes("ua:backups/q4-summary-copy.pdf"));
});

test("value transformations are preview-only", () => {
  const report = buildUnstructuredAssetAwareness();
  for (const candidate of report.value_transformation_candidates) {
    assert.equal(candidate.preview_only, true);
    assert.equal(candidate.economic_action_implied, false);
  }
  const privateTransform = report.value_transformation_candidates.find(
    (c) => c.asset_id === "ua:private/journal-entry.docx",
  );
  assert.equal(privateTransform.transformation_preview, "blocked_until_strong_consent");
});

test("five-stage asset management plan", () => {
  const report = buildUnstructuredAssetAwareness();
  assert.equal(report.asset_management_plan.stages.length, 5);
  assert.deepEqual(
    report.asset_management_plan.stages.map((s) => s.name),
    ["observe", "classify", "consent", "transform", "prove"],
  );
});

test("proof plan includes source trace and consent boundary", () => {
  const report = buildUnstructuredAssetAwareness();
  assert.ok(report.proof_plan.source_trace.asset_ids.length === 13);
  assert.equal(report.proof_plan.consent_boundary.default, "metadata_only_default");
  assert.match(report.proof_plan.reproducible_command, /metadata_only_default/);
});

test("verify and gate pass on canonical report", () => {
  const report = buildUnstructuredAssetAwareness();
  const verified = verifyUnstructuredAssetAwareness(report);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
  const gate = runUnstructuredAssetAwarenessGate();
  assert.equal(gate.ok, true);
});
