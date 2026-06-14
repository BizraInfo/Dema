// B1A · Dema Realm World Map.
//
// Read-only consumer of the local asset inventory artifact. This module never
// scans the filesystem root; it reads only DEMA_HOME/realm/local-assets.

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";

import {
  LOCAL_ASSET_INVENTORY_SCHEMA,
  defaultLocalAssetInventoryPath,
} from "./local-asset-awareness.js";
import { ANSI } from "./theme.js";

export const DEMA_REALM_WORLD_MAP_SCHEMA = "bizra.dema.realm_world_map.v0.1";

const FRESHNESS_MS = 24 * 60 * 60 * 1000;

function color(s, code, useColor) {
  return useColor ? `${code}${s}${ANSI.reset}` : s;
}

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  Object.freeze(value);
  for (const v of Object.values(value)) freezeDeep(v);
  return value;
}

function defaultDemaHome() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function readOnlyBoundary() {
  return Object.freeze({
    file_write_performed: false,
    scanned_root_mutated: false,
    file_content_read: false,
    network_used: false,
    embedding_generated: false,
    model_invoked: false,
    symlink_followed: false,
    delete_or_move_performed: false,
    federation_used: false,
    economic_claim_made: false,
    scanner_invoked: false,
  });
}

function baseState({
  status,
  artifactPath,
  now,
  inventory = null,
  reason = null,
  nextSafeAction,
}) {
  return freezeDeep({
    schema: DEMA_REALM_WORLD_MAP_SCHEMA,
    truth_label: "LOCAL_REALM_WORLD_MAP",
    rendered_at_iso: now.toISOString(),
    status,
    reason,
    artifact_path: artifactPath,
    inventory,
    root_display: inventory?.root?.display ?? null,
    generated_at_iso: inventory?.generated_at_iso ?? null,
    summary: inventory?.summary ?? null,
    clusters: [],
    denied_count: inventory?.summary?.denied_count ?? 0,
    truncated: inventory?.summary?.truncated ?? false,
    next_safe_action: nextSafeAction,
    boundary: readOnlyBoundary(),
  });
}

function safeInventoryBoundary(inventory) {
  const b = inventory?.boundary;
  return Boolean(
    b &&
    b.scanned_root_mutated === false &&
    b.file_content_read === false &&
    b.network_used === false &&
    b.embedding_generated === false &&
    b.model_invoked === false &&
    b.symlink_followed === false &&
    b.delete_or_move_performed === false &&
    b.federation_used === false &&
    b.economic_claim_made === false,
  );
}

function validInventoryShape(inventory) {
  return Boolean(
    inventory &&
    typeof inventory === "object" &&
    inventory.schema === LOCAL_ASSET_INVENTORY_SCHEMA &&
    inventory.mode === "metadata_only" &&
    inventory.summary &&
    typeof inventory.summary === "object" &&
    Array.isArray(inventory.records),
  );
}

function deriveClusters(records) {
  const byCategory = new Map();
  for (const record of records) {
    const category = record.category || "unknown";
    const current = byCategory.get(category) || {
      category,
      count: 0,
      newest_mtime_iso: null,
      total_size_bytes: 0,
    };
    current.count += 1;
    current.total_size_bytes +=
      typeof record.size_bytes === "number" ? record.size_bytes : 0;
    if (
      record.mtime_iso &&
      (!current.newest_mtime_iso ||
        record.mtime_iso.localeCompare(current.newest_mtime_iso) > 0)
    ) {
      current.newest_mtime_iso = record.mtime_iso;
    }
    byCategory.set(category, current);
  }
  return [...byCategory.values()].sort(
    (a, b) => b.count - a.count || a.category.localeCompare(b.category),
  );
}

function statusForFreshness(inventory, now, freshnessMs) {
  const generated = Date.parse(inventory.generated_at_iso);
  if (!Number.isFinite(generated)) return "INVENTORY_INVALID";
  return now.getTime() - generated > freshnessMs
    ? "INVENTORY_STALE"
    : "INVENTORY_READY";
}

export async function gatherDemaRealmWorldMap(options = {}) {
  const now = options.now || new Date();
  const home = options.demaHome || defaultDemaHome();
  const artifactPath =
    options.inventoryPath || defaultLocalAssetInventoryPath(home);

  let raw;
  try {
    raw = await readFile(artifactPath, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") {
      return baseState({
        status: "INVENTORY_ABSENT",
        artifactPath,
        now,
        nextSafeAction: "Run dema assets scan --root ~/Downloads",
      });
    }
    return baseState({
      status: "INVENTORY_INVALID",
      artifactPath,
      now,
      reason: "artifact_read_failed",
      nextSafeAction: "Re-run dema assets scan",
    });
  }

  let inventory;
  try {
    inventory = JSON.parse(raw);
  } catch {
    return baseState({
      status: "INVENTORY_INVALID",
      artifactPath,
      now,
      reason: "json_parse_failed",
      nextSafeAction: "Re-run dema assets scan",
    });
  }

  if (!validInventoryShape(inventory)) {
    return baseState({
      status: "INVENTORY_INVALID",
      artifactPath,
      now,
      reason: "schema_or_shape_invalid",
      nextSafeAction: "Re-run dema assets scan",
    });
  }
  if (!safeInventoryBoundary(inventory)) {
    return baseState({
      status: "INVENTORY_BOUNDARY_INVALID",
      artifactPath,
      now,
      inventory,
      reason: "unsafe_inventory_boundary",
      nextSafeAction: "Re-run dema assets scan",
    });
  }

  const status = statusForFreshness(
    inventory,
    now,
    options.freshnessMs ?? FRESHNESS_MS,
  );
  if (status === "INVENTORY_INVALID") {
    return baseState({
      status,
      artifactPath,
      now,
      reason: "generated_at_invalid",
      nextSafeAction: "Re-run dema assets scan",
    });
  }

  return freezeDeep({
    schema: DEMA_REALM_WORLD_MAP_SCHEMA,
    truth_label: "LOCAL_REALM_WORLD_MAP",
    rendered_at_iso: now.toISOString(),
    status,
    reason: null,
    artifact_path: artifactPath,
    inventory,
    root_display: inventory.root.display,
    generated_at_iso: inventory.generated_at_iso,
    summary: inventory.summary,
    clusters: deriveClusters(inventory.records),
    denied_count: inventory.summary.denied_count,
    truncated: inventory.summary.truncated,
    next_safe_action:
      status === "INVENTORY_STALE"
        ? "Run dema assets scan --root ~/Downloads"
        : "Review local clusters, then choose one safe next action.",
    boundary: readOnlyBoundary(),
  });
}

function statusColor(status) {
  if (status === "INVENTORY_READY") return ANSI.proofVerified;
  if (
    status === "INVENTORY_BOUNDARY_INVALID" ||
    status === "INVENTORY_INVALID"
  ) {
    return ANSI.proofFailed;
  }
  return ANSI.gold;
}

export function renderDemaRealmWorldMap(state, { useColor = true } = {}) {
  const lines = [
    color("DEMA REALM · WORLD MAP", ANSI.gold + ANSI.bold, useColor),
    color(
      `truth: ${state.truth_label} · status: ${state.status} · rendered: ${state.rendered_at_iso}`,
      statusColor(state.status) + ANSI.dim,
      useColor,
    ),
    "",
  ];

  if (
    state.status === "INVENTORY_ABSENT" ||
    state.status === "INVENTORY_INVALID" ||
    state.status === "INVENTORY_BOUNDARY_INVALID"
  ) {
    lines.push(`Inventory: ${state.status}`);
    if (state.reason) lines.push(`Reason: ${state.reason}`);
    lines.push(`Next: ${state.next_safe_action}`);
    lines.push("");
    lines.push(
      color(
        "Boundary: read-only · no scan · no mutation · no network · no content",
        ANSI.dim + ANSI.neutral,
        useColor,
      ),
    );
    return lines.join("\n");
  }

  lines.push(`Root: ${state.root_display}`);
  lines.push(`Generated: ${state.generated_at_iso}`);
  lines.push("");
  lines.push("Summary:");
  lines.push(
    `  records: ${state.summary.records_count} · files: ${state.summary.files_count} · dirs: ${state.summary.dirs_count} · symlinks: ${state.summary.symlinks_count}`,
  );
  lines.push(`  denied: ${state.denied_count} · truncated: ${state.truncated}`);
  lines.push("");
  lines.push("Clusters:");
  if (state.clusters.length === 0) {
    lines.push("  —");
  } else {
    for (const cluster of state.clusters) {
      lines.push(
        `  ${cluster.category.padEnd(16)} ${String(cluster.count).padStart(3)} · newest: ${cluster.newest_mtime_iso ?? "—"} · bytes: ${cluster.total_size_bytes}`,
      );
    }
  }
  lines.push("");
  lines.push(`Next: ${state.next_safe_action}`);
  lines.push(
    color(
      "Boundary: read-only · no scan · no mutation · no network · no content",
      ANSI.dim + ANSI.neutral,
      useColor,
    ),
  );
  return lines.join("\n");
}
