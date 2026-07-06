import test from "node:test";
import assert from "node:assert/strict";

import {
  planNode0NodespaceBoundaryPreview,
  buildNode0NodespaceBoundaryPreviewPayload,
  verifyNode0NodespaceBoundaryPreview,
  runNode0NodespaceBoundaryPreview,
  computeNode0NodespaceContentHash,
  CORE_BODY_KEYS,
  NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE,
  NODE0_NODESPACE_BOUNDARY_MALICIOUS_FIXTURE,
  NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA,
  NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL,
  NODE0_NODESPACE_BOUNDARY_PREVIEW_GO_PHRASE,
  NODE0_NODESPACE_BOUNDARY_PREVIEW_VERIFICATION_RESULT,
} from "../packages/core/src/node0-nodespace-boundary-preview.js";
import { runNode0NodespaceBoundaryPreviewCheck } from "../scripts/review/node0-nodespace-boundary-preview-check.mjs";
import { REQUIRED_CAPABILITY_IDS } from "../packages/core/src/dema-capability-truth-registry.js";

const GO = NODE0_NODESPACE_BOUNDARY_PREVIEW_GO_PHRASE;

// Deep clone a frozen fixture so a test can mutate one field without touching
// the shared canonical/malicious fixtures.
function clone(v) {
  return JSON.parse(JSON.stringify(v));
}

// 1. accepts a valid Node0 hardware + OS-tree fixture
test("1 accepts a valid hardware + OS-tree fixture and produces an inert snapshot", () => {
  const result = runNode0NodespaceBoundaryPreview({ consent: GO, input: NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE });
  assert.equal(result.ok, true, (result.blocked_by || []).join(", "));
  assert.equal(result.schema, NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL);
  assert.equal(result.mode, "metadata_only_preview");
  assert.equal(result.authority_delta, 0);
  assert.match(result.inventory_snapshot_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(result.receipt_chain_preview.verification_result, NODE0_NODESPACE_BOUNDARY_PREVIEW_VERIFICATION_RESULT);
});

// 2. rejects a missing hardware section
test("2 rejects a missing hardware section", () => {
  const input = clone(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  delete input.hardware_assets;
  const plan = planNode0NodespaceBoundaryPreview({ consent: GO, input });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("hardware_assets_missing"));
});

// 3. rejects a missing OS-tree section
test("3 rejects a missing OS-tree section", () => {
  const input = clone(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  input.os_tree = [];
  const plan = planNode0NodespaceBoundaryPreview({ consent: GO, input });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.includes("os_tree_missing"));
});

// 4. rejects a raw serial number (only serial_hash is admitted)
test("4 rejects a raw serial number smuggled onto a hardware row", () => {
  const plan = planNode0NodespaceBoundaryPreview({ consent: GO, input: NODE0_NODESPACE_BOUNDARY_MALICIOUS_FIXTURE });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.some((b) => b.startsWith("raw_serial_field_present:")));
});

// 5. requires serial_hash for an identified device
test("5 requires serial_hash for an identified device", () => {
  const input = clone(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  delete input.hardware_assets[0].serial_hash;
  const plan = planNode0NodespaceBoundaryPreview({ consent: GO, input });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.some((b) => b.startsWith("serial_hash_missing_or_malformed:")));
});

// 6. rejects an OS node referencing an unknown device_id
test("6 rejects an OS node referencing an unknown device_id", () => {
  const input = clone(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  input.os_tree[0].device_id = "dev:does-not-exist";
  const plan = planNode0NodespaceBoundaryPreview({ consent: GO, input });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.some((b) => b.startsWith("os_references_unknown_device:")));
});

// 7. rejects a guest VM / container without a parent_os_id
test("7 rejects a guest VM without a parent_os_id", () => {
  const input = clone(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  input.os_tree[1].parent_os_id = null; // os:win-guest is a guest_vm
  const plan = planNode0NodespaceBoundaryPreview({ consent: GO, input });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.some((b) => b.startsWith("guest_without_parent_os:")));
});

// 8. rejects a filesystem root referencing an unknown owner OS
test("8 rejects a filesystem root with an unknown owner_os_id", () => {
  const input = clone(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  input.os_tree[0].filesystem_roots[0].owner_os_id = "os:ghost";
  const plan = planNode0NodespaceBoundaryPreview({ consent: GO, input });
  assert.equal(plan.eligible, false);
  assert.ok(plan.blocked_by.some((b) => b.startsWith("root_references_unknown_os:")));
});

// 9. re-derives inside / outside / unknown boundary counts from the arrays
test("9 detects inside / outside / unknown boundary counts", () => {
  const result = runNode0NodespaceBoundaryPreview({ consent: GO, input: NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE });
  assert.deepEqual({ ...result.boundary_summary }, { inside_homebase: 2, outside_homebase: 0, unknown: 1 });
  assert.equal(result.homebase_device_count, 2);
  assert.equal(result.os_count, 3);
  assert.equal(result.filesystem_root_count, 2);
});

// 10. rejects a boundary asserting content_read_performed:true
test("10 rejects a boundary flag content_read_performed:true", () => {
  const payload = buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  const forged = { ...payload, boundary: { ...payload.boundary, content_read_performed: true } };
  const v = verifyNode0NodespaceBoundaryPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("boundary_not_all_false"));
});

// 11. rejects a boundary asserting urp_write_performed:true
test("11 rejects a boundary flag urp_write_performed:true", () => {
  const payload = buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  const forged = { ...payload, boundary: { ...payload.boundary, urp_write_performed: true } };
  const v = verifyNode0NodespaceBoundaryPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("boundary_not_all_false"));
});

// 12. rejects a boundary asserting token_minted:true
test("12 rejects a boundary flag token_minted:true", () => {
  const payload = buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  const forged = { ...payload, boundary: { ...payload.boundary, token_minted: true } };
  const v = verifyNode0NodespaceBoundaryPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("boundary_not_all_false"));
});

// 13. rejects a boundary asserting wallet_accessed:true
test("13 rejects a boundary flag wallet_accessed:true", () => {
  const payload = buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  const forged = { ...payload, boundary: { ...payload.boundary, wallet_accessed: true } };
  const v = verifyNode0NodespaceBoundaryPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("boundary_not_all_false"));
});

// 14. deterministic inventory_snapshot_hash
test("14 produces a deterministic inventory_snapshot_hash", () => {
  const a = buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  const b = buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  assert.equal(a.inventory_snapshot_hash, b.inventory_snapshot_hash);
  assert.equal(a.content_hash, a.inventory_snapshot_hash);
  assert.match(a.inventory_snapshot_hash, /^sha256:[0-9a-f]{64}$/);
});

// 15. verifier rejects a tampered snapshot hash
test("15 verifier rejects a tampered content/snapshot hash", () => {
  const payload = buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  const tampered = { ...payload, content_hash: `sha256:${"0".repeat(64)}` };
  const v = verifyNode0NodespaceBoundaryPreview(tampered);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("content_hash_mismatch"));
});

// 16. verifier rejects a forged summary EVEN with a recomputed hash (independent
//     re-derivation anchor: the summary is a function of the primary arrays)
test("16 verifier rejects a forged summary with a recomputed hash", () => {
  const payload = buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  const forgedCore = {};
  for (const k of CORE_BODY_KEYS) forgedCore[k] = payload[k];
  forgedCore.homebase_device_count = payload.homebase_device_count + 1; // lie: claim one more inside
  const forgedHash = computeNode0NodespaceContentHash(forgedCore);
  const forged = {
    ...forgedCore,
    content_hash: forgedHash,
    inventory_snapshot_hash: forgedHash,
    receipt_chain_preview: {
      previous_state_hash: forgedCore.previous_state_hash,
      inventory_snapshot_hash: forgedHash,
      verification_result: NODE0_NODESPACE_BOUNDARY_PREVIEW_VERIFICATION_RESULT,
    },
  };
  // content_hash is internally consistent (recomputed), yet verify still rejects.
  assert.equal(computeNode0NodespaceContentHash(forged), forgedHash);
  const v = verifyNode0NodespaceBoundaryPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("homebase_device_count_not_rederivable"));
});

// 17. review gate runs a clean fixture (PASS) and a malicious fixture (REJECT)
test("17 review gate passes clean fixture and rejects malicious fixture", () => {
  const result = runNode0NodespaceBoundaryPreviewCheck();
  assert.equal(result.ok, true, (result.blocked_by || []).join(", "));
  assert.equal(result.schema, NODE0_NODESPACE_BOUNDARY_PREVIEW_SCHEMA);
  assert.equal(result.truth_label, NODE0_NODESPACE_BOUNDARY_PREVIEW_TRUTH_LABEL);
  assert.match(result.content_hash, /^sha256:[0-9a-f]{64}$/);
});

// 18. the capability id is registered AND bound to a green gate
test("18 capability row is registered and bound to a passing gate", () => {
  assert.ok(REQUIRED_CAPABILITY_IDS.includes("NODE0_NODESPACE_BOUNDARY_PREVIEW_1A"));
  assert.equal(runNode0NodespaceBoundaryPreviewCheck().ok, true);
});

// ---------------------------------------------------------------------------
// Branch-coverage completions — exercise each named block once so the honesty
// ledger (18 headline cases) is backed by full validation + verify coverage.
// ---------------------------------------------------------------------------

const VALID_PAYLOAD = () =>
  buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);

function planBlocks(mutate) {
  const input = clone(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  mutate(input);
  return planNode0NodespaceBoundaryPreview({ consent: GO, input }).blocked_by;
}

test("cov: non-object input is fail-closed", () => {
  assert.ok(planNode0NodespaceBoundaryPreview({ consent: GO, input: 7 }).blocked_by.includes("input_not_object"));
});

test("cov: hardware row not an object", () => {
  assert.ok(planBlocks((i) => { i.hardware_assets[0] = 5; }).includes("hardware_row_not_object"));
});

test("cov: hardware device_type missing", () => {
  assert.ok(planBlocks((i) => { delete i.hardware_assets[0].device_type; }).some((b) => b.startsWith("hardware_device_type_missing:")));
});

test("cov: hardware boundary_status invalid", () => {
  assert.ok(planBlocks((i) => { i.hardware_assets[0].boundary_status = "nope"; }).some((b) => b.startsWith("hardware_boundary_status_invalid:")));
});

test("cov: inside_homebase without trust_level", () => {
  assert.ok(planBlocks((i) => { delete i.hardware_assets[0].trust_level; }).some((b) => b.startsWith("inside_homebase_without_trust_level:")));
});

test("cov: malformed serial_hash rejected", () => {
  assert.ok(planBlocks((i) => { i.hardware_assets[0].serial_hash = "sha256:zzz"; }).some((b) => b.startsWith("serial_hash_missing_or_malformed:")));
});

test("cov: os row not an object / os_id missing", () => {
  assert.ok(planBlocks((i) => { i.os_tree[2] = 9; }).includes("os_row_not_object"));
  assert.ok(planBlocks((i) => { delete i.os_tree[2].os_id; }).includes("os_id_missing"));
});

test("cov: os_family missing", () => {
  assert.ok(planBlocks((i) => { delete i.os_tree[0].os_family; }).some((b) => b.startsWith("os_family_missing:")));
});

test("cov: os virtualization_role invalid", () => {
  assert.ok(planBlocks((i) => { i.os_tree[0].virtualization_role = "hypervisor"; }).some((b) => b.startsWith("os_virtualization_role_invalid:")));
});

test("cov: parent_os_id references an unknown os", () => {
  assert.ok(planBlocks((i) => { i.os_tree[1].parent_os_id = "os:ghost"; }).some((b) => b.startsWith("parent_os_unknown:")));
});

test("cov: os scan_scope invalid", () => {
  assert.ok(planBlocks((i) => { i.os_tree[0].scan_scope = "read_everything"; }).some((b) => b.startsWith("os_scan_scope_invalid:")));
});

test("cov: filesystem_roots not an array", () => {
  assert.ok(planBlocks((i) => { i.os_tree[0].filesystem_roots = {}; }).some((b) => b.startsWith("filesystem_roots_not_array:")));
});

test("cov: root not object / root_id missing", () => {
  assert.ok(planBlocks((i) => { i.os_tree[0].filesystem_roots[0] = 1; }).some((b) => b.startsWith("root_not_object:")));
  assert.ok(planBlocks((i) => { delete i.os_tree[0].filesystem_roots[0].root_id; }).some((b) => b.startsWith("root_id_missing:")));
});

test("cov: root content_read_allowed:true rejected", () => {
  assert.ok(planBlocks((i) => { i.os_tree[0].filesystem_roots[0].content_read_allowed = true; }).some((b) => b.startsWith("root_content_read_allowed_true:")));
});

test("cov: root boundary_status / scan_scope invalid", () => {
  assert.ok(planBlocks((i) => { i.os_tree[0].filesystem_roots[0].boundary_status = "nope"; }).some((b) => b.startsWith("root_boundary_status_invalid:")));
  assert.ok(planBlocks((i) => { i.os_tree[0].filesystem_roots[0].scan_scope = "nope"; }).some((b) => b.startsWith("root_scan_scope_invalid:")));
});

test("cov: verify rejects a non-object payload", () => {
  assert.equal(verifyNode0NodespaceBoundaryPreview(null).ok, false);
  assert.equal(verifyNode0NodespaceBoundaryPreview("x").ok, false);
});

test("cov: verify rejects a malformed content_hash", () => {
  const v = verifyNode0NodespaceBoundaryPreview({ ...VALID_PAYLOAD(), content_hash: "not-a-hash" });
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("content_hash_malformed"));
});

test("cov: verify rejects nonzero authority_delta", () => {
  const v = verifyNode0NodespaceBoundaryPreview({ ...VALID_PAYLOAD(), authority_delta: 3 });
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("authority_delta_nonzero"));
});

test("cov: verify rejects an invalid mode", () => {
  const v = verifyNode0NodespaceBoundaryPreview({ ...VALID_PAYLOAD(), mode: "live" });
  assert.ok(v.blocked_by.includes("mode_invalid"));
});

test("cov: verify rejects a mismatched inventory_snapshot_hash", () => {
  const v = verifyNode0NodespaceBoundaryPreview({ ...VALID_PAYLOAD(), inventory_snapshot_hash: `sha256:${"1".repeat(64)}` });
  assert.ok(v.blocked_by.includes("inventory_snapshot_hash_mismatch"));
});

test("cov: verify rejects missing / broken receipt_chain_preview", () => {
  const p = VALID_PAYLOAD();
  assert.ok(verifyNode0NodespaceBoundaryPreview({ ...p, receipt_chain_preview: undefined }).blocked_by.includes("receipt_chain_preview_missing"));
  assert.ok(verifyNode0NodespaceBoundaryPreview({ ...p, receipt_chain_preview: { ...p.receipt_chain_preview, inventory_snapshot_hash: `sha256:${"2".repeat(64)}` } }).blocked_by.includes("receipt_chain_snapshot_hash_mismatch"));
  assert.ok(verifyNode0NodespaceBoundaryPreview({ ...p, receipt_chain_preview: { ...p.receipt_chain_preview, verification_result: "X" } }).blocked_by.includes("receipt_chain_verification_result_invalid"));
  assert.ok(verifyNode0NodespaceBoundaryPreview({ ...p, receipt_chain_preview: { ...p.receipt_chain_preview, previous_state_hash: "other" } }).blocked_by.includes("receipt_chain_previous_state_hash_mismatch"));
});

test("cov: verify rejects forged os_count / filesystem_root_count / summary", () => {
  const p = VALID_PAYLOAD();
  assert.ok(verifyNode0NodespaceBoundaryPreview({ ...p, os_count: p.os_count + 1 }).blocked_by.includes("os_count_not_rederivable"));
  assert.ok(verifyNode0NodespaceBoundaryPreview({ ...p, filesystem_root_count: 99 }).blocked_by.includes("filesystem_root_count_not_rederivable"));
  assert.ok(verifyNode0NodespaceBoundaryPreview({ ...p, boundary_summary: { inside_homebase: 9, outside_homebase: 9, unknown: 9 } }).blocked_by.includes("boundary_summary_not_rederivable"));
});

test("cov: run() returns a fail-closed envelope on ineligible plan", () => {
  const r = runNode0NodespaceBoundaryPreview({ consent: "wrong", input: NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE });
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("consent_phrase_mismatch"));
  assert.equal(r.boundary.token_minted, false);
  assert.equal(r.boundary.daemon_started, false);
});

// ---------------------------------------------------------------------------
// Scan-policy amendment — metadata-only is the DEFAULT, not the final law.
// The node owner is the sole authority for scan depth; only receipts cross nodes.
// ---------------------------------------------------------------------------

const POLICY = () =>
  buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE).content_scan_policy_preview;

test("sp1 default scan mode is metadata_only", () => {
  assert.equal(POLICY().default_mode, "metadata_only");
});

test("sp2 full_local_content_index is an available future user-selectable mode", () => {
  assert.ok(POLICY().user_selectable_modes.includes("full_local_content_index"));
  assert.ok(POLICY().user_selectable_modes.includes("blocked_never_scan"));
});

test("sp3 current_slice_performed_content_scan is false", () => {
  assert.equal(POLICY().current_slice_performed_content_scan, false);
});

test("sp4 user_is_sole_authority_for_scan_depth is true", () => {
  assert.equal(POLICY().user_is_sole_authority_for_scan_depth, true);
  assert.equal(POLICY().requires_exact_consent_for_content_scan, true);
});

test("sp5 content_read_allowed_now is false on every preview root", () => {
  const p = buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  for (const o of p.os_tree) {
    for (const r of o.filesystem_roots || []) {
      assert.equal(r.scan_policy.content_read_allowed_now, false);
      assert.equal(r.content_read_allowed, false);
    }
  }
});

test("sp6 raw_content_cross_node_default is false", () => {
  assert.equal(POLICY().raw_content_cross_node_default, false);
});

test("sp7 receipt_cross_node_default is true", () => {
  assert.equal(POLICY().receipt_cross_node_default, true);
});

test("sp8 rejects a selected scan mode not in the root allowed-mode list", () => {
  const blocks = planBlocks((i) => {
    i.os_tree[0].filesystem_roots[0].scan_policy.selected_mode = "full_local_content_index";
    i.os_tree[0].filesystem_roots[0].scan_policy.allowed_modes = ["metadata_only"];
  });
  assert.ok(blocks.some((b) => b.startsWith("root_scan_policy_selected_not_allowed:")));
});

test("sp9 rejects content scan performed now without exact consent", () => {
  const blocks = planBlocks((i) => {
    i.os_tree[0].filesystem_roots[0].scan_policy.content_read_allowed_now = true;
  });
  assert.ok(blocks.some((b) => b.startsWith("root_scan_policy_content_read_now:")));
});

test("sp10 rejects any output implying Dema chose scan depth for the user", () => {
  const p = buildNode0NodespaceBoundaryPreviewPayload(NODE0_NODESPACE_BOUNDARY_CANONICAL_FIXTURE);
  const forged = {
    ...p,
    content_scan_policy_preview: { ...p.content_scan_policy_preview, user_is_sole_authority_for_scan_depth: false },
  };
  const v = verifyNode0NodespaceBoundaryPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("content_scan_policy_not_canonical"));
});

test("sp cov: missing / malformed root scan_policy is fail-closed", () => {
  assert.ok(planBlocks((i) => { delete i.os_tree[0].filesystem_roots[0].scan_policy; }).some((b) => b.startsWith("root_scan_policy_missing:")));
  assert.ok(planBlocks((i) => { i.os_tree[0].filesystem_roots[0].scan_policy.selected_mode = "wipe_disk"; }).some((b) => b.startsWith("root_scan_policy_selected_mode_invalid:")));
  assert.ok(planBlocks((i) => { i.os_tree[0].filesystem_roots[0].scan_policy.allowed_modes = ["nope"]; }).some((b) => b.startsWith("root_scan_policy_allowed_modes_invalid:")));
  assert.ok(planBlocks((i) => { i.os_tree[0].filesystem_roots[0].scan_policy.future_user_consent_required = false; }).some((b) => b.startsWith("root_scan_policy_future_consent_required:")));
});
