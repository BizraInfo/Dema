import { test } from "node:test";
import assert from "node:assert/strict";

import {
  buildAssetAccessPreview,
  buildAssetAccessSummary,
  buildAssetAccessRequest,
  ASSET_ACCESS_SURFACES,
  ASSET_ACCESS_TIERS,
  ASSET_ACCESS_REQUIRED_BLOCKED_EFFECTS,
} from "../packages/core/src/asset-access.js";
import { isCanonicalBoundary } from "../packages/core/src/preview-boundary.js";

test("Asset access canonical schema · 7 asset surfaces · 3 access tiers", () => {
  const p = buildAssetAccessPreview();
  assert.equal(p.schema, "bizra.dema.asset_access.v0.1");
  assert.equal(p.asset_surfaces.length, 7);
  assert.equal(Object.keys(p.access_tiers).length, 3);
});

test("Asset access boundary canonical · refusals enumerated", () => {
  const p = buildAssetAccessPreview();
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(
    p.refusal_invariants.some((r) => r.includes("Inventory is never modified")),
  );
  assert.ok(
    p.refusal_invariants.some((r) => r.includes("never shared externally")),
  );
});

test("Asset access blocked_effects · modify · ingest · share-externally · cache-outside", () => {
  const p = buildAssetAccessPreview();
  assert.ok(p.blocked_effects.includes("modify_inventory"));
  assert.ok(p.blocked_effects.includes("share_asset_externally"));
  assert.ok(p.blocked_effects.includes("cache_asset_outside_dema_home"));
  assert.ok(p.blocked_effects.includes("publish_inventory_publicly"));
});

test("Asset access preserves inventory metadata", () => {
  const p = buildAssetAccessPreview({
    inventory_sha256: "9649ca81".padEnd(64, "0"),
    bizra_asset_size_gb: 67,
    cloud_storage_size_gb: 505,
    github_repos_count: 148,
    total_tests: 17142,
  });
  assert.equal(p.bizra_asset_size_gb, 67);
  assert.equal(p.github_repos_count, 148);
  assert.equal(p.total_tests, 17142);
});

test("Access request · valid input → consent phrase generated", () => {
  const r = buildAssetAccessRequest({
    asset_id: "bizra-omega-source",
    asset_surface: "BIZRA-ASSET",
    access_tier: "read_metadata_only",
    purpose: "verify file hashes",
  });
  assert.equal(r.valid, true);
  assert.equal(r.access_granted, false);
  assert.match(
    r.consent_phrase,
    /^GO: access read_metadata_only on BIZRA-ASSET/,
  );
});

test("Access request · missing asset_id → invalid", () => {
  const r = buildAssetAccessRequest({
    asset_surface: "BIZRA-ASSET",
    access_tier: "read_metadata_only",
    purpose: "test",
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes("no_asset_id"));
});

test("Access request · invalid asset_surface → invalid", () => {
  const r = buildAssetAccessRequest({
    asset_id: "x",
    asset_surface: "made_up_surface",
    purpose: "test",
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.some((v) => v.includes("invalid_asset_surface")));
});

test("Access request · invalid tier coerced to read_metadata_only default", () => {
  const r = buildAssetAccessRequest({
    asset_id: "x",
    asset_surface: "BIZRA-ASSET",
    access_tier: "fake_tier",
    purpose: "test",
  });
  assert.equal(r.access_tier, "read_metadata_only");
});

test("Access request · missing purpose → invalid", () => {
  const r = buildAssetAccessRequest({
    asset_id: "x",
    asset_surface: "BIZRA-ASSET",
  });
  assert.equal(r.valid, false);
  assert.ok(r.violations.includes("no_purpose"));
});

test("Adversarial · non-string inputs coerced safely", () => {
  const r = buildAssetAccessRequest({
    asset_id: { malicious: true },
    asset_surface: "BIZRA-ASSET",
    purpose: "test",
  });
  assert.equal(r.valid, false);
  assert.equal(r.asset_id, "");
});

test("Asset access · deep frozen + canonical boundary", () => {
  const p = buildAssetAccessPreview();
  const r = buildAssetAccessRequest({
    asset_id: "x",
    asset_surface: "BIZRA-ASSET",
    purpose: "x",
  });
  assert.ok(Object.isFrozen(p));
  assert.ok(Object.isFrozen(r));
  assert.ok(isCanonicalBoundary(p.boundary));
  assert.ok(isCanonicalBoundary(r.boundary));
});

test("Summary + exports", () => {
  const s = buildAssetAccessSummary({ bizra_asset_size_gb: 67 });
  assert.equal(s.bizra_asset_size_gb, 67);
  assert.ok(JSON.stringify(s, null, 2).split("\n").length <= 40);
  assert.ok(Object.isFrozen(ASSET_ACCESS_SURFACES));
  assert.ok(Object.isFrozen(ASSET_ACCESS_TIERS));
  assert.ok(Object.isFrozen(ASSET_ACCESS_REQUIRED_BLOCKED_EFFECTS));
});
