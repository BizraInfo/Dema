// C9 · Asset access (per ADR-008 §C9).
//
// Founder Asset Inventory v0.3 made queryable: 67 GB BIZRA-ASSET ·
// 505 GB cloud · 148 GH repos · 17,142 tests. Per-asset access policy ·
// audit trail. NEVER ingests new assets · NEVER modifies inventory.

import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.asset_access.v0.1";
const ACCESS_REQUEST_SCHEMA = "bizra.dema.asset_access_request.v0.1";

const REQUIRED_BLOCKED_EFFECTS = Object.freeze([
  "modify_inventory",
  "ingest_new_assets_without_consent",
  "share_asset_externally",
  "cache_asset_outside_dema_home",
  "execute_runtime",
  "federation_invocation",
  "publish_inventory_publicly"
]);

const ASSET_SURFACES = Object.freeze([
  "BIZRA-ASSET", "cloud_storage", "github_repos", "test_suites",
  "memory_entries", "receipts", "proof_of_priority"
]);

const ACCESS_TIERS = Object.freeze({
  read_metadata_only: "list + hash · no content",
  read_with_redaction: "content returned with D3/D4 redacted",
  read_full: "full content · explicit per-asset consent required"
});

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeNumber(v, fallback = 0) {
  return typeof v === "number" && !Number.isNaN(v) ? v : fallback;
}

export function buildAssetAccessPreview({
  inventory_sha256 = "",
  bizra_asset_size_gb = 0,
  cloud_storage_size_gb = 0,
  github_repos_count = 0,
  total_tests = 0
} = {}) {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    inventory_sha256: safeString(inventory_sha256),
    bizra_asset_size_gb: safeNumber(bizra_asset_size_gb, 0),
    cloud_storage_size_gb: safeNumber(cloud_storage_size_gb, 0),
    github_repos_count: safeNumber(github_repos_count, 0),
    total_tests: safeNumber(total_tests, 0),
    asset_surfaces: ASSET_SURFACES,
    access_tiers: ACCESS_TIERS,
    blocked_effects: REQUIRED_BLOCKED_EFFECTS,
    refusal_invariants: Object.freeze([
      "Inventory is never modified · read-only access",
      "Assets are never ingested without operator consent",
      "Assets are never shared externally · local-only",
      "Public inventory disclosure refused"
    ]),
    boundary: buildPreviewBoundary()
  });
}

export function buildAssetAccessRequest({
  asset_id = "",
  asset_surface = "",
  access_tier = "read_metadata_only",
  purpose = ""
} = {}) {
  const id = safeString(asset_id);
  const surface = safeString(asset_surface);
  const tier = Object.keys(ACCESS_TIERS).includes(access_tier) ? access_tier : "read_metadata_only";
  const purposeSafe = safeString(purpose).trim();

  const violations = [];
  if (id.length === 0) violations.push("no_asset_id");
  if (!ASSET_SURFACES.includes(surface)) violations.push(`invalid_asset_surface · expected one of ${ASSET_SURFACES.join(",")}`);
  if (purposeSafe.length === 0) violations.push("no_purpose");

  const valid = violations.length === 0;
  const consentPhrase = valid
    ? `GO: access ${tier} on ${surface}/'${id}' · '${purposeSafe.slice(0, 60)}'`
    : null;

  return Object.freeze({
    schema: ACCESS_REQUEST_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_at: new Date().toISOString(),
    asset_id: id,
    asset_surface: surface,
    access_tier: tier,
    purpose: purposeSafe,
    valid,
    violations: Object.freeze(violations),
    consent_phrase: consentPhrase,
    access_granted: false,
    requires_typed_go: true,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary()
  });
}

export function buildAssetAccessSummary(options = {}) {
  const preview = buildAssetAccessPreview(options);
  return Object.freeze({
    schema: "bizra.dema.asset_access_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    bizra_asset_size_gb: preview.bizra_asset_size_gb,
    github_repos_count: preview.github_repos_count,
    total_tests: preview.total_tests,
    surface_count: preview.asset_surfaces.length,
    access_tier_count: Object.keys(preview.access_tiers).length,
    boundary: preview.boundary
  });
}

export const ASSET_ACCESS_SCHEMA_NAME = SCHEMA;
export const ASSET_ACCESS_REQUEST_SCHEMA_NAME = ACCESS_REQUEST_SCHEMA;
export const ASSET_ACCESS_SURFACES = ASSET_SURFACES;
export const ASSET_ACCESS_TIERS = ACCESS_TIERS;
export const ASSET_ACCESS_REQUIRED_BLOCKED_EFFECTS = REQUIRED_BLOCKED_EFFECTS;
