import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUnstructuredFixtureInventory,
  buildUnstructuredAssetAwareness,
  verifyUnstructuredAssetAwareness,
  runUnstructuredAssetAwarenessGate,
  UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
  UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
  UNSTRUCTURED_FIXTURE_RECORDS,
} from "../packages/core/src/unstructured-asset-awareness.js";

test("fixture includes all required mixed unstructured asset types", () => {
  assert.equal(UNSTRUCTURED_FIXTURE_RECORDS.length, 13);
  const paths = UNSTRUCTURED_FIXTURE_RECORDS.map((r) => r.relative_path);
  assert.ok(paths.some((p) => p.endsWith(".pdf") && p.includes("reports/")));
  assert.ok(paths.some((p) => p.endsWith(".md")));
  assert.ok(paths.some((p) => p.endsWith(".csv")));
  assert.ok(paths.some((p) => p.endsWith(".png")));
  assert.ok(paths.some((p) => p.endsWith(".m4a")));
  assert.ok(paths.some((p) => p.endsWith(".mp4")));
  assert.ok(paths.some((p) => p.endsWith(".zip")));
  assert.ok(paths.some((p) => p.endsWith(".py")));
  assert.ok(paths.some((p) => p.endsWith(".xlsx")));
  assert.ok(paths.some((p) => p.includes("legal/")));
  assert.ok(paths.some((p) => p.includes("duplicates/")));
  assert.ok(paths.some((p) => p.endsWith(".bin")));
  assert.ok(paths.some((p) => p.includes("private/")));
});

test("classifies every fixture asset with metadata-only boundary", () => {
  const report = buildUnstructuredAssetAwareness({
    inventory: buildUnstructuredFixtureInventory(),
  });
  assert.equal(report.schema, UNSTRUCTURED_ASSET_AWARENESS_SCHEMA);
  assert.equal(report.truth_label, UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL);
  assert.equal(report.valid, true);
  assert.equal(report.asset_classifications.length, 13);
  assert.equal(report.boundary.file_content_read, false);
  assert.equal(report.boundary.ocr_performed, false);
  assert.equal(report.boundary.embedding_generated, false);
  assert.equal(report.boundary.network_used, false);
});

test("sensitive assets require explicit consent before content read", () => {
  const report = buildUnstructuredAssetAwareness({
    inventory: buildUnstructuredFixtureInventory(),
  });
  const sensitive = report.asset_classifications.filter((a) =>
    a.sensitivity_class.startsWith("sensitive_"),
  );
  assert.ok(sensitive.length >= 4);
  for (const asset of sensitive) {
    assert.ok(
      asset.consent_requirements.includes("explicit_typed_go_before_content_read"),
      asset.record_id,
    );
  }
});

test("unknown binary is blocked and duplicate candidates are surfaced", () => {
  const report = buildUnstructuredAssetAwareness({
    inventory: buildUnstructuredFixtureInventory(),
  });
  assert.ok(report.duplicate_candidates.length >= 1);
  const unknown = report.asset_classifications.find(
    (a) => a.unstructured_type === "unknown_binary",
  );
  assert.ok(unknown);
  assert.ok(
    report.blocked_or_unknown_assets.some((b) => b.record_id === unknown.record_id),
  );
});

test("value transformations and proof plan stay preview-only", () => {
  const report = buildUnstructuredAssetAwareness({
    inventory: buildUnstructuredFixtureInventory(),
  });
  for (const candidate of report.value_transformation_candidates) {
    assert.equal(candidate.preview_only, true);
    assert.equal(candidate.economic_action_performed, false);
  }
  assert.ok(report.proof_plan.source_trace.length === 13);
  assert.equal(report.proof_plan.consent_boundary.metadata_first, true);
  assert.equal(report.proof_plan.preview_only, true);
  assert.ok(report.asset_management_plan.observe.includes("metadata"));
});

test("verify and gate pass on canonical fixture", () => {
  const report = buildUnstructuredAssetAwareness({
    inventory: buildUnstructuredFixtureInventory(),
  });
  const verified = verifyUnstructuredAssetAwareness(report);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
  const gate = runUnstructuredAssetAwarenessGate();
  assert.equal(gate.ok, true, gate.verified.blocked_by.join(", "));
});

test("invalid inventory fails closed", () => {
  const report = buildUnstructuredAssetAwareness({ inventory: { schema: "bad" } });
  assert.equal(report.valid, false);
  const verified = verifyUnstructuredAssetAwareness(report);
  assert.equal(verified.ok, false);
});

test("review gate helper passes", async () => {
  const { runUnstructuredAssetAwarenessCheck } = await import(
    "../scripts/review/unstructured-asset-awareness-check.mjs"
  );
  const result = runUnstructuredAssetAwarenessCheck();
  assert.equal(result.ok, true, result.verified.blocked_by.join(", "));
});
