import test from "node:test";
import assert from "node:assert/strict";

import {
  buildMultiDeviceAssetAwareness,
  verifyMultiDeviceAssetAwareness,
  runMultiDeviceAssetAwarenessGate,
  MULTI_DEVICE_ASSET_AWARENESS_SCHEMA,
  MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL,
  DEVICE_CONSTELLATION_FIXTURE,
  DEFAULT_SCAN_MODE,
} from "../packages/core/src/multi-device-asset-awareness.js";

test("constellation includes four device classes", () => {
  const types = new Set(DEVICE_CONSTELLATION_FIXTURE.map((d) => d.device_type));
  assert.ok(types.has("laptop_node"));
  assert.ok(types.has("mobile_node"));
  assert.ok(types.has("external_drive"));
  assert.ok(types.has("optional_cloud_export_folder"));
});

test("report schema and metadata-only boundary", () => {
  const report = buildMultiDeviceAssetAwareness();
  assert.equal(report.schema, MULTI_DEVICE_ASSET_AWARENESS_SCHEMA);
  assert.equal(report.truth_label, MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL);
  assert.equal(report.default_scan_mode, DEFAULT_SCAN_MODE);
  assert.equal(report.boundary.file_content_read, false);
  assert.equal(report.boundary.mobile_extraction_performed, false);
  assert.equal(report.boundary.cloud_connector_accessed, false);
});

test("mobile node is high-value and high-sensitivity", () => {
  const report = buildMultiDeviceAssetAwareness();
  const mobile = report.devices.find((d) => d.device_type === "mobile_node");
  assert.equal(mobile.sensitivity_profile.high_value, true);
  assert.equal(mobile.sensitivity_profile.high_sensitivity, true);
  assert.equal(report.mobile_resource_value_profile.high_value, true);
  assert.equal(report.mobile_resource_value_profile.extraction_default, "blocked");
});

test("every device defaults to metadata-only scan", () => {
  const report = buildMultiDeviceAssetAwareness();
  for (const device of report.devices) {
    assert.equal(device.scan_mode_default, DEFAULT_SCAN_MODE);
  }
});

test("cross-device dedupe is plan-only and consent-gated", () => {
  const report = buildMultiDeviceAssetAwareness();
  assert.equal(report.duplicate_resolution_plan.preview_only, true);
  assert.equal(report.duplicate_resolution_plan.execution_blocked_without_consent, true);
  assert.equal(
    report.duplicate_resolution_plan.requires_consent,
    "fingerprint_dedupe_consent",
  );
});

test("organization plan covers mixed files across devices", () => {
  const report = buildMultiDeviceAssetAwareness();
  assert.equal(report.organization_plan.covers_mixed_files, true);
  assert.equal(report.organization_plan.device_count, 4);
});

test("context awareness does not imply content read", () => {
  const report = buildMultiDeviceAssetAwareness();
  assert.equal(report.context_awareness_plan.content_read_implied, false);
  assert.equal(report.context_awareness_plan.staged_not_automatic, true);
});

test("content awareness requires scoped consent; mobile requires strong consent", () => {
  const report = buildMultiDeviceAssetAwareness();
  assert.equal(report.content_awareness_consent_plan.default, DEFAULT_SCAN_MODE);
  const mobileRow = report.content_awareness_consent_plan.per_device.find(
    (r) => r.device_id === "dev:mobile-primary",
  );
  assert.equal(
    mobileRow.mobile_strong_consent,
    "deep_understanding_strong_consent",
  );
});

test("URP plan is candidate-only", () => {
  const report = buildMultiDeviceAssetAwareness();
  assert.equal(report.urp_candidate_boundaries.candidate_only, true);
  assert.equal(report.urp_candidate_boundaries.scan_does_not_imply_urp, true);
});

test("verify and gate pass", () => {
  const report = buildMultiDeviceAssetAwareness();
  const verified = verifyMultiDeviceAssetAwareness(report);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
  const gate = runMultiDeviceAssetAwarenessGate();
  assert.equal(gate.ok, true);
});
