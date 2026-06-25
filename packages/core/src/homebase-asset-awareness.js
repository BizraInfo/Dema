// DEMA-HOMEBASE-ASSET-AWARENESS-1A — metadata-only homebase asset awareness.
//
// Composes the existing local-asset inventory into clusters, hidden-gem
// candidates, monetization candidates, and risk flags. Performs NO content
// reads, NO network, NO mutation of the scanned root, and NO economic action.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  LOCAL_ASSET_INVENTORY_SCHEMA,
} from "./local-asset-awareness.js";

export const HOMEBASE_ASSET_AWARENESS_SCHEMA =
  "bizra.dema.homebase_asset_awareness.v0.1";
export const HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL =
  "DEMA_HOMEBASE_ASSET_AWARENESS_METADATA_ONLY";

const PROJECT_MANIFESTS = new Set([
  "package.json",
  "pyproject.toml",
  "cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
]);

const GEM_CATEGORY_WEIGHT = Object.freeze({
  receipt_or_proof: 40,
  model_artifact: 35,
  code_project: 30,
  dataset: 25,
  document: 15,
  media: 12,
  archive: 10,
  unknown: 5,
});

const MONETIZATION_CATEGORY_HINTS = Object.freeze({
  receipt_or_proof: "urp_contribution_candidate",
  model_artifact: "local_model_asset_candidate",
  code_project: "software_surface_candidate",
  document: "knowledge_product_candidate",
  media: "media_asset_candidate",
  dataset: "data_product_candidate",
  archive: "bundle_review_candidate",
  unknown: "manual_review_candidate",
});

const WHAT_THIS_DOES_NOT_PROVE = Object.freeze([
  "No file content was read — classification uses names, extensions, and metadata only.",
  "Hidden-gem and monetization candidates are heuristic previews, not valuations or offers.",
  "No upload, deletion, move, token action, or URP contribution was performed.",
  "Risk flags name structural signals only; they do not assert compromise or loss.",
]);

function sha256(value) {
  return createHash("sha256").update(String(value)).digest("hex");
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const v of Object.values(value)) freezeDeep(v);
  return value;
}

function isValidInventory(inventory) {
  return (
    inventory &&
    inventory.schema === LOCAL_ASSET_INVENTORY_SCHEMA &&
    Array.isArray(inventory.records) &&
    Array.isArray(inventory.denied)
  );
}

function topLevelSegment(relativePath) {
  const parts = String(relativePath || "").split("/").filter(Boolean);
  return parts.length > 0 ? parts[0] : ".";
}

function clusterKey(record) {
  return `${topLevelSegment(record.relative_path)}::${record.category}`;
}

function projectMarkersForRecords(records) {
  const markers = new Set();
  for (const record of records) {
    if (PROJECT_MANIFESTS.has(String(record.name || "").toLowerCase())) {
      markers.add(record.name);
    }
  }
  return Object.freeze([...markers].sort());
}

function buildClusters(records) {
  const map = new Map();
  for (const record of records) {
    const key = clusterKey(record);
    const existing = map.get(key) || {
      cluster_key: key,
      top_level: topLevelSegment(record.relative_path),
      category: record.category,
      record_count: 0,
      total_size_bytes: 0,
      record_ids: [],
      project_markers: [],
    };
    existing.record_count += 1;
    existing.total_size_bytes += record.size_bytes || 0;
    existing.record_ids.push(record.record_id);
    map.set(key, existing);
  }

  const clusters = [...map.values()]
    .map((cluster) => {
      const clusterRecords = records.filter((r) =>
        cluster.record_ids.includes(r.record_id),
      );
      return Object.freeze({
        cluster_id: `sha256:${sha256(stableStringify({
          top_level: cluster.top_level,
          category: cluster.category,
        }))}`,
        top_level: cluster.top_level,
        category: cluster.category,
        record_count: cluster.record_count,
        total_size_bytes: cluster.total_size_bytes,
        project_markers: projectMarkersForRecords(clusterRecords),
        record_ids: Object.freeze([...cluster.record_ids].sort()),
      });
    })
    .sort(
      (a, b) =>
        b.record_count - a.record_count ||
        a.top_level.localeCompare(b.top_level) ||
        a.category.localeCompare(b.category),
    );

  return Object.freeze(clusters);
}

function gemScoreForRecord(record, categoryCounts) {
  const base = GEM_CATEGORY_WEIGHT[record.category] ?? GEM_CATEGORY_WEIGHT.unknown;
  const sizeBoost =
    record.size_bytes >= 10_000_000
      ? 15
      : record.size_bytes >= 1_000_000
        ? 8
        : 0;
  const total = categoryCounts[record.category] || 1;
  const rarityBoost = total <= 2 ? 10 : total <= 5 ? 5 : 0;
  const manifestBoost = PROJECT_MANIFESTS.has(String(record.name || "").toLowerCase())
    ? 12
    : 0;
  return base + sizeBoost + rarityBoost + manifestBoost;
}

function buildHiddenGemCandidates(records, categoryCounts) {
  const scored = records
    .filter((r) => r.kind === "file")
    .map((record) => {
      const gem_score = gemScoreForRecord(record, categoryCounts);
      return Object.freeze({
        candidate_id: `sha256:${sha256(stableStringify({
          record_id: record.record_id,
          gem_score,
        }))}`,
        record_id: record.record_id,
        category: record.category,
        relative_path_hash: `sha256:${sha256(record.relative_path)}`,
        gem_score,
        reasons: Object.freeze(
          [
            record.category === "receipt_or_proof" ? "proof_or_receipt_signal" : null,
            record.category === "model_artifact" ? "model_artifact_signal" : null,
            PROJECT_MANIFESTS.has(String(record.name || "").toLowerCase())
              ? "project_manifest_signal"
              : null,
            record.size_bytes >= 1_000_000 ? "large_asset_signal" : null,
            (categoryCounts[record.category] || 0) <= 2 ? "rare_category_signal" : null,
          ].filter(Boolean),
        ),
      });
    })
    .filter((c) => c.gem_score >= 25)
    .sort(
      (a, b) =>
        b.gem_score - a.gem_score || a.record_id.localeCompare(b.record_id),
    )
    .slice(0, 12);

  return Object.freeze(scored);
}

function buildMonetizationCandidates(records, hiddenGems) {
  const gemRecordIds = new Set(hiddenGems.map((g) => g.record_id));
  const candidates = records
    .filter((r) => r.kind === "file" && gemRecordIds.has(r.record_id))
    .map((record) =>
      Object.freeze({
        candidate_id: `sha256:${sha256(stableStringify({
          record_id: record.record_id,
          hint: MONETIZATION_CATEGORY_HINTS[record.category],
        }))}`,
        record_id: record.record_id,
        category: record.category,
        monetization_hint:
          MONETIZATION_CATEGORY_HINTS[record.category] ??
          MONETIZATION_CATEGORY_HINTS.unknown,
        relative_path_hash: `sha256:${sha256(record.relative_path)}`,
        preview_only: true,
        economic_action_performed: false,
      }),
    )
    .sort((a, b) => a.record_id.localeCompare(b.record_id));

  return Object.freeze(candidates);
}

function buildRiskFlags(inventory) {
  const flags = [];
  const denied = inventory.denied || [];
  const summary = inventory.summary || {};

  if (denied.some((d) => d.reason === "secret_or_key_pattern")) {
    flags.push("secret_or_key_pattern_denied");
  }
  if (denied.some((d) => d.reason === "wallet_or_secret_directory")) {
    flags.push("wallet_or_secret_directory_denied");
  }
  if (denied.some((d) => d.reason === "outside_root")) {
    flags.push("outside_root_entry_blocked");
  }
  if ((summary.symlinks_count || 0) > 0) {
    flags.push("symlinks_present_not_followed");
  }
  if (summary.truncated === true) {
    flags.push("scan_truncated_by_limits");
  }
  if (inventory.error === "permission_denied") {
    flags.push("permission_denied_at_root");
  }
  if ((summary.denied_count || 0) > 0) {
    flags.push("denied_entries_present");
  }

  return Object.freeze([...new Set(flags)].sort());
}

function awarenessBoundary(inventoryBoundary = {}) {
  return freezeDeep({
    ...buildPreviewBoundary(),
    ...inventoryBoundary,
    file_content_read: false,
    network_used: false,
    scanned_root_mutated: false,
    delete_or_move_performed: false,
    upload_performed: false,
    economic_action_performed: false,
    embedding_generated: false,
    model_invoked: false,
    symlink_followed: false,
  });
}

export function buildHomebaseAssetAwareness({
  inventory,
  generated_at_iso = "",
} = {}) {
  if (!isValidInventory(inventory)) {
    return freezeDeep({
      schema: HOMEBASE_ASSET_AWARENESS_SCHEMA,
      truth_label: HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
      valid: false,
      error: "invalid_or_missing_inventory",
      generated_at_iso:
        typeof generated_at_iso === "string" && generated_at_iso.length > 0
          ? generated_at_iso
          : inventory?.generated_at_iso || "",
      inventory: inventory ?? null,
      clusters: Object.freeze([]),
      hidden_gem_candidates: Object.freeze([]),
      monetization_candidates: Object.freeze([]),
      risk_flags: Object.freeze([]),
      what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
      boundary: awarenessBoundary(),
    });
  }

  const records = inventory.records || [];
  const categoryCounts = { ...(inventory.categories || {}) };
  const clusters = buildClusters(records);
  const hidden_gem_candidates = buildHiddenGemCandidates(records, categoryCounts);
  const monetization_candidates = buildMonetizationCandidates(
    records,
    hidden_gem_candidates,
  );
  const risk_flags = buildRiskFlags(inventory);

  return freezeDeep({
    schema: HOMEBASE_ASSET_AWARENESS_SCHEMA,
    truth_label: HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
    valid: inventory.valid === true,
    error: inventory.error ?? null,
    mode: "metadata_only",
    generated_at_iso:
      typeof generated_at_iso === "string" && generated_at_iso.length > 0
        ? generated_at_iso
        : inventory.generated_at_iso,
    root: inventory.root,
    limits: inventory.limits,
    summary: inventory.summary,
    categories: inventory.categories,
    clusters,
    hidden_gem_candidates,
    monetization_candidates,
    risk_flags,
    denied_count: inventory.summary?.denied_count ?? 0,
    inventory_schema: inventory.schema,
    what_this_does_not_prove: WHAT_THIS_DOES_NOT_PROVE,
    boundary: awarenessBoundary(inventory.boundary),
  });
}

export function renderHomebaseAssetAwarenessSummary(awareness) {
  if (!awareness || awareness.schema !== HOMEBASE_ASSET_AWARENESS_SCHEMA) {
    return "Dema homebase assets: invalid awareness report";
  }
  const lines = [
    "DEMA HOMEBASE ASSETS · AWARENESS (metadata only)",
    `truth: ${awareness.truth_label} · mode: ${awareness.mode}`,
    `root: ${awareness.root?.display ?? "unknown"}`,
    `records: ${awareness.summary?.records_count ?? 0} · clusters: ${awareness.clusters.length}`,
    `hidden gems: ${awareness.hidden_gem_candidates.length} · monetization candidates: ${awareness.monetization_candidates.length}`,
  ];
  if (awareness.risk_flags.length > 0) {
    lines.push(`risk flags: ${awareness.risk_flags.join(", ")}`);
  }
  const topGems = awareness.hidden_gem_candidates
    .slice(0, 3)
    .map((g) => `${g.category}(${g.gem_score})`)
    .join(", ");
  if (topGems) lines.push(`top gem signals: ${topGems}`);
  lines.push(
    "Boundary: metadata-only · no content · no symlink follow · no network · no scanned-root mutation · no upload",
  );
  return lines.join("\n");
}
