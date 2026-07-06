import test from "node:test";
import assert from "node:assert/strict";

import {
  planConsentedInventoryGathererPreview,
  buildConsentedInventoryGathererPreviewPayload,
  verifyConsentedInventoryGathererPreview,
  runConsentedInventoryGathererPreview,
  deriveInventorySummary,
  computeInventoryContentHash,
  CONSENTED_INVENTORY_CANONICAL_FIXTURE,
  CONSENTED_INVENTORY_MALICIOUS_FIXTURE,
  CONSENTED_INVENTORY_GATHERER_PREVIEW_GO_PHRASE,
  INVENTORY_SCAN_MODES,
} from "../packages/core/src/node0-consented-inventory-gatherer-preview.js";
import { runConsentedInventoryGathererPreviewCheck } from "../scripts/review/node0-consented-inventory-gatherer-preview-check.mjs";
import { REQUIRED_CAPABILITY_IDS } from "../packages/core/src/dema-capability-truth-registry.js";

const GO = CONSENTED_INVENTORY_GATHERER_PREVIEW_GO_PHRASE;
const clone = (v) => JSON.parse(JSON.stringify(v));
const run = (input, consent = GO) => runConsentedInventoryGathererPreview({ consent, input });
function planBlocks(mutate) {
  const input = clone(CONSENTED_INVENTORY_CANONICAL_FIXTURE);
  mutate(input);
  return planConsentedInventoryGathererPreview({ consent: GO, input }).blocked_by;
}

test("metadata_only gather works on fixture and produces a triage", () => {
  const r = run(CONSENTED_INVENTORY_CANONICAL_FIXTURE);
  assert.equal(r.ok, true, (r.blocked_by || []).join(", "));
  assert.equal(r.total_files, 5);
  assert.equal(r.content_read_allowed, false);
  assert.equal(r.by_category.doc, 2);
  assert.equal(r.by_category.archive, 1);
  assert.equal(r.by_category.video, 1);
  assert.match(r.inventory_snapshot_hash, /^sha256:[0-9a-f]{64}$/);
});

test("sensitive-name candidate is flagged (wallet.key)", () => {
  const r = run(CONSENTED_INVENTORY_CANONICAL_FIXTURE);
  assert.ok(r.sensitive_name_candidates.some((c) => c.relative_path.endsWith("wallet.key")));
  assert.ok(r.recommended_next_actions.includes("review_sensitive_name_candidates_before_any_share"));
});

test("duplicate-name candidate is detected (bizra-notes.md x2)", () => {
  const r = run(CONSENTED_INVENTORY_CANONICAL_FIXTURE);
  assert.ok(r.duplicate_name_candidates.some((d) => d.name === "bizra-notes.md" && d.count === 2));
});

test("stale candidate is detected by mtime age", () => {
  const r = run(CONSENTED_INVENTORY_CANONICAL_FIXTURE);
  // 2025-01-01 is > 180 days before 2026-07-06
  assert.ok(r.stale_candidates.some((s) => s.relative_path.endsWith(".bak/bizra-notes.md")));
});

test("largest_files is sorted desc (demo.mp4 first)", () => {
  const r = run(CONSENTED_INVENTORY_CANONICAL_FIXTURE);
  assert.equal(r.largest_files[0].relative_path, "media/demo.mp4");
});

test("unknown scan mode rejected", () => {
  assert.ok(planBlocks((i) => { i.scan_mode = "wipe"; }).includes("scan_mode_invalid"));
});

test("full_local_content_index is listed as a future option but refused in preview", () => {
  assert.ok(INVENTORY_SCAN_MODES.includes("full_local_content_index"));
  assert.ok(planBlocks((i) => { i.scan_mode = "full_local_content_index"; }).includes("scan_mode_not_available_in_preview"));
});

test("content read is rejected in this slice", () => {
  const r = run(CONSENTED_INVENTORY_MALICIOUS_FIXTURE);
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("content_read_claimed"));
});

test("missing root_label blocks", () => {
  assert.ok(planBlocks((i) => { delete i.root_label; }).includes("root_label_missing"));
});

test("missing consent blocks", () => {
  const r = run(CONSENTED_INVENTORY_CANONICAL_FIXTURE, "wrong");
  assert.equal(r.ok, false);
  assert.ok(r.blocked_by.includes("consent_phrase_mismatch"));
});

test("produces a deterministic inventory hash", () => {
  const a = buildConsentedInventoryGathererPreviewPayload(CONSENTED_INVENTORY_CANONICAL_FIXTURE);
  const b = buildConsentedInventoryGathererPreviewPayload(CONSENTED_INVENTORY_CANONICAL_FIXTURE);
  assert.equal(a.inventory_snapshot_hash, b.inventory_snapshot_hash);
  assert.equal(a.content_hash, a.inventory_snapshot_hash);
});

test("verify rejects a forged category count with a recomputed hash", () => {
  const p = buildConsentedInventoryGathererPreviewPayload(CONSENTED_INVENTORY_CANONICAL_FIXTURE);
  const forgedCore = {
    schema: p.schema, truth_label: p.truth_label, mode: p.mode, root_label: p.root_label,
    scan_mode: p.scan_mode, content_read_allowed: p.content_read_allowed,
    scan_modes_available: p.scan_modes_available, now_iso: p.now_iso, stale_after_days: p.stale_after_days,
    total_files: p.total_files, total_bytes: p.total_bytes,
    by_category: { ...p.by_category, doc: 99 }, by_extension: p.by_extension,
    largest_files: p.largest_files, stale_candidates: p.stale_candidates,
    duplicate_name_candidates: p.duplicate_name_candidates,
    sensitive_name_candidates: p.sensitive_name_candidates,
    recommended_next_actions: p.recommended_next_actions,
    authority_delta: p.authority_delta, boundary: p.boundary,
  };
  const h = computeInventoryContentHash(forgedCore);
  const forged = { ...forgedCore, content_hash: h, inventory_snapshot_hash: h };
  const v = verifyConsentedInventoryGathererPreview(forged);
  assert.equal(v.ok, false);
  assert.ok(v.blocked_by.includes("category_counts_not_consistent"));
});

test("review gate: clean passes, content-read fixture rejected", () => {
  const r = runConsentedInventoryGathererPreviewCheck();
  assert.equal(r.ok, true, (r.blocked_by || []).join(", "));
  assert.equal(r.total_files, 5);
});

test("capability row registered and bound to a passing gate", () => {
  assert.ok(REQUIRED_CAPABILITY_IDS.includes("NODE0_CONSENTED_INVENTORY_GATHERER_PREVIEW_1A"));
  assert.equal(runConsentedInventoryGathererPreviewCheck().ok, true);
});

// --- branch coverage ---
test("cov: non-object input + files not array + now_iso invalid + stale invalid", () => {
  assert.ok(planConsentedInventoryGathererPreview({ consent: GO, input: 1 }).blocked_by.includes("input_not_object"));
  assert.ok(planBlocks((i) => { i.files = {}; }).includes("files_not_array"));
  assert.ok(planBlocks((i) => { i.files[0] = 3; }).some((b) => b.startsWith("file_row_invalid:")));
  assert.ok(planBlocks((i) => { i.now_iso = "not-a-date"; }).includes("now_iso_invalid"));
  assert.ok(planBlocks((i) => { i.stale_after_days = -5; }).includes("stale_after_days_invalid"));
});

test("cov: verify rejects non-object / malformed hash / boundary / authority / mode", () => {
  assert.equal(verifyConsentedInventoryGathererPreview(null).ok, false);
  const p = buildConsentedInventoryGathererPreviewPayload(CONSENTED_INVENTORY_CANONICAL_FIXTURE);
  assert.ok(verifyConsentedInventoryGathererPreview({ ...p, content_hash: "no" }).blocked_by.includes("content_hash_malformed"));
  assert.ok(verifyConsentedInventoryGathererPreview({ ...p, content_hash: `sha256:${"0".repeat(64)}` }).blocked_by.includes("content_hash_mismatch"));
  assert.ok(verifyConsentedInventoryGathererPreview({ ...p, boundary: { ...p.boundary, network_used: true } }).blocked_by.includes("boundary_not_all_false"));
  assert.ok(verifyConsentedInventoryGathererPreview({ ...p, authority_delta: 1 }).blocked_by.includes("authority_delta_nonzero"));
  assert.ok(verifyConsentedInventoryGathererPreview({ ...p, content_read_allowed: true }).blocked_by.includes("content_read_allowed_true"));
  assert.ok(verifyConsentedInventoryGathererPreview({ ...p, inventory_snapshot_hash: `sha256:${"1".repeat(64)}` }).blocked_by.includes("inventory_snapshot_hash_mismatch"));
});

test("cov: deriveInventorySummary tidy workspace + category-from-provided", () => {
  const s = deriveInventorySummary(
    [{ relative_path: "a.xyz", extension: ".xyz", size_bytes: 1, mtime_iso: "2026-07-06T00:00:00.000Z", category: "custom" }],
    "2026-07-06T00:00:00.000Z", 180,
  );
  assert.equal(s.by_category.custom, 1);
  assert.ok(s.recommended_next_actions.includes("no_triage_flags_workspace_is_tidy"));
});
