import test from "node:test";
import assert from "node:assert/strict";

import {
  buildUnstructuredAssetScanModesPolicy,
  verifyUnstructuredAssetScanModesPolicy,
  runUnstructuredAssetScanModesGate,
  UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA,
  UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL,
  DEFAULT_SCAN_MODE,
  SCAN_MODE_IDS,
} from "../packages/core/src/unstructured-asset-scan-modes.js";

test("policy emits schema, truth label, and five scan modes", () => {
  const policy = buildUnstructuredAssetScanModesPolicy();
  assert.equal(policy.schema, UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA);
  assert.equal(policy.truth_label, UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL);
  assert.equal(policy.default_mode, DEFAULT_SCAN_MODE);
  assert.equal(policy.scan_modes.length, SCAN_MODE_IDS.length);
  assert.deepEqual(
    policy.scan_modes.map((m) => m.mode_id),
    [...SCAN_MODE_IDS],
  );
});

test("default metadata mode does not read content", () => {
  const policy = buildUnstructuredAssetScanModesPolicy();
  const metadata = policy.scan_modes.find(
    (m) => m.mode_id === "metadata_only_default",
  );
  assert.equal(metadata.consent_required, false);
  assert.ok(!metadata.allowed_operations.includes("read_file_bytes"));
  assert.ok(metadata.forbidden_operations.includes("read_file_bytes"));
  assert.equal(policy.boundary.file_content_read, false);
  assert.equal(policy.boundary.network_used, false);
  assert.equal(policy.boundary.upload_performed, false);
});

test("every non-default mode requires consent", () => {
  const policy = buildUnstructuredAssetScanModesPolicy();
  for (const mode of policy.scan_modes) {
    if (mode.mode_id === DEFAULT_SCAN_MODE) continue;
    assert.equal(
      mode.consent_required,
      true,
      `expected consent for ${mode.mode_id}`,
    );
  }
});

test("deep scan requires strong consent; share/export requires separate consent", () => {
  const policy = buildUnstructuredAssetScanModesPolicy();
  const deep = policy.scan_modes.find(
    (m) => m.mode_id === "deep_understanding_strong_consent",
  );
  const share = policy.scan_modes.find(
    (m) => m.mode_id === "share_export_separate_consent",
  );
  assert.equal(deep.strong_consent_required, true);
  assert.equal(share.separate_consent_required, true);
  assert.equal(share.strong_consent_required, true);
});

test("forbidden without consent includes silent scan, embedding, upload, sharing", () => {
  const policy = buildUnstructuredAssetScanModesPolicy();
  for (const action of [
    "silent_content_read",
    "silent_embedding",
    "silent_upload",
    "silent_sharing",
  ]) {
    assert.ok(
      policy.forbidden_without_consent.includes(action),
      `missing ${action}`,
    );
  }
});

test("proof receipt requires scope, consent, timestamp, boundaries, reproducible command", () => {
  const policy = buildUnstructuredAssetScanModesPolicy();
  const fields = policy.proof_receipt_requirements.required_fields;
  for (const field of [
    "scan_mode",
    "scope",
    "user_consent_phrase_or_approval_id",
    "timestamp_iso",
    "boundaries",
    "reproducible_command",
  ]) {
    assert.ok(fields.includes(field), `missing ${field}`);
  }
  assert.match(
    policy.proof_receipt_requirements.reproducible_command_template,
    /dema assets scan --root/,
  );
  assert.match(
    policy.proof_receipt_requirements.reproducible_command_template,
    /scan_mode=/,
  );
});

test("user choice model rejects vague permission prompts", () => {
  const policy = buildUnstructuredAssetScanModesPolicy();
  assert.equal(
    policy.user_choice_model.bad_prompt_example,
    "Can I scan your files?",
  );
  assert.ok(
    policy.user_choice_model.good_prompt_template.includes("{file_count}"),
  );
  const defaultChoice = policy.user_choice_model.choices.find(
    (c) => c.selected_by_default,
  );
  assert.equal(defaultChoice.mode_id, DEFAULT_SCAN_MODE);
});

test("economic action is never implied by scanning", () => {
  const policy = buildUnstructuredAssetScanModesPolicy();
  assert.ok(
    policy.forbidden_without_consent.includes("implied_reward_from_scan"),
  );
  assert.equal(policy.boundary.token_minted, false);
  assert.equal(policy.boundary.wallet_accessed, false);
  assert.equal(policy.boundary.urp_submission_performed, false);
  assert.equal(policy.product_law.reward_urp_token, "never implied by scanning");
});

test("verify passes on canonical policy", () => {
  const policy = buildUnstructuredAssetScanModesPolicy();
  const verified = verifyUnstructuredAssetScanModesPolicy(policy);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
});

test("gate runner passes", () => {
  const result = runUnstructuredAssetScanModesGate();
  assert.equal(result.ok, true, result.verified.blocked_by.join(", "));
  assert.equal(result.truth_label, UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL);
});

test("tampered default mode fails closed", () => {
  const policy = buildUnstructuredAssetScanModesPolicy();
  const bad = {
    ...policy,
    default_mode: "deep_understanding_strong_consent",
    scan_modes: policy.scan_modes,
    forbidden_without_consent: policy.forbidden_without_consent,
    proof_receipt_requirements: policy.proof_receipt_requirements,
    boundary: policy.boundary,
  };
  const verified = verifyUnstructuredAssetScanModesPolicy(bad);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("default_mode_not_metadata_only"));
});
