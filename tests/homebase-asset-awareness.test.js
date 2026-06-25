import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  buildLocalAssetInventory,
  LOCAL_ASSET_INVENTORY_SCHEMA,
} from "../packages/core/src/local-asset-awareness.js";
import {
  buildHomebaseAssetAwareness,
  HOMEBASE_ASSET_AWARENESS_SCHEMA,
  HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
} from "../packages/core/src/homebase-asset-awareness.js";

const FIXED_NOW = new Date("2026-06-25T12:00:00.000Z");

function makeInventory(records, denied = [], extra = {}) {
  return {
    schema: LOCAL_ASSET_INVENTORY_SCHEMA,
    truth_label: "LOCAL_METADATA_MEASURED",
    mode: "metadata_only",
    valid: true,
    error: null,
    generated_at_iso: FIXED_NOW.toISOString(),
    root: {
      display: "/tmp/fixture",
      path_hash: "sha256:fixture",
      exists: true,
    },
    limits: { max_depth: 2, max_entries: 5000, follow_symlinks: false },
    summary: {
      records_count: records.length,
      files_count: records.filter((r) => r.kind === "file").length,
      dirs_count: records.filter((r) => r.kind === "directory").length,
      symlinks_count: records.filter((r) => r.kind === "symlink").length,
      denied_count: denied.length,
      truncated: extra.truncated === true,
    },
    categories: records.reduce((acc, r) => {
      acc[r.category] = (acc[r.category] ?? 0) + 1;
      return acc;
    }, {}),
    records,
    denied,
    warnings: [],
    boundary: {
      file_write_performed: false,
      file_content_read: false,
      network_used: false,
      scanned_root_mutated: false,
      symlink_followed: false,
    },
    ...extra,
  };
}

function fileRecord({
  relative_path,
  category,
  name,
  size_bytes = 100,
  record_id = `id:${relative_path}`,
}) {
  return {
    record_id,
    kind: "file",
    name: name ?? relative_path.split("/").pop(),
    relative_path,
    extension: `.${relative_path.split(".").pop()}`,
    category,
    size_bytes,
    mtime_iso: FIXED_NOW.toISOString(),
    risk_flags: [],
    content_hash: null,
    content_preview: null,
  };
}

test("schema + truth label + deterministic JSON shape", () => {
  const inventory = makeInventory([
    fileRecord({ relative_path: "app/package.json", category: "code_project", name: "package.json" }),
    fileRecord({ relative_path: "proofs/receipt.json", category: "receipt_or_proof" }),
  ]);
  const a = buildHomebaseAssetAwareness({ inventory });
  const b = buildHomebaseAssetAwareness({ inventory });
  assert.equal(a.schema, HOMEBASE_ASSET_AWARENESS_SCHEMA);
  assert.equal(a.truth_label, HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL);
  assert.deepEqual(a, b);
  assert.equal(a.boundary.file_content_read, false);
  assert.equal(a.boundary.network_used, false);
});

test("deterministic clustering by top-level + category", () => {
  const inventory = makeInventory([
    fileRecord({ relative_path: "app/package.json", category: "code_project", name: "package.json" }),
    fileRecord({ relative_path: "app/main.js", category: "code_project", name: "main.js" }),
    fileRecord({ relative_path: "media/photo.png", category: "media", name: "photo.png" }),
  ]);
  const report = buildHomebaseAssetAwareness({ inventory });
  assert.equal(report.clusters.length, 2);
  const appCluster = report.clusters.find((c) => c.top_level === "app");
  assert.equal(appCluster.record_count, 2);
  assert.deepEqual(appCluster.project_markers, ["package.json"]);
});

test("hidden gem score calculation ranks proof and model artifacts", () => {
  const inventory = makeInventory([
    fileRecord({ relative_path: "models/big.gguf", category: "model_artifact", size_bytes: 2_000_000 }),
    fileRecord({ relative_path: "proofs/impact.json", category: "receipt_or_proof" }),
    fileRecord({ relative_path: "misc.txt", category: "unknown" }),
  ]);
  const report = buildHomebaseAssetAwareness({ inventory });
  assert.ok(report.hidden_gem_candidates.length >= 2);
  assert.ok(report.hidden_gem_candidates[0].gem_score >= report.hidden_gem_candidates.at(-1).gem_score);
  assert.ok(report.hidden_gem_candidates.some((g) => g.category === "receipt_or_proof"));
});

test("monetization candidates are preview-only metadata hints", () => {
  const inventory = makeInventory([
    fileRecord({ relative_path: "proofs/impact.json", category: "receipt_or_proof" }),
  ]);
  const report = buildHomebaseAssetAwareness({ inventory });
  assert.equal(report.monetization_candidates.length, 1);
  assert.equal(report.monetization_candidates[0].preview_only, true);
  assert.equal(report.monetization_candidates[0].economic_action_performed, false);
  assert.equal(report.monetization_candidates[0].monetization_hint, "urp_contribution_candidate");
});

test("risk flag detection from denied entries and truncation", () => {
  const inventory = makeInventory(
    [fileRecord({ relative_path: "notes.md", category: "document" })],
    [
      { reason: "secret_or_key_pattern", path_hash: "sha256:x", kind: "file" },
      { reason: "outside_root", path_hash: "sha256:y", kind: "other" },
    ],
    { truncated: true, summary: { records_count: 1, files_count: 1, dirs_count: 0, symlinks_count: 0, denied_count: 2, truncated: true } },
  );
  const report = buildHomebaseAssetAwareness({ inventory });
  assert.ok(report.risk_flags.includes("secret_or_key_pattern_denied"));
  assert.ok(report.risk_flags.includes("outside_root_entry_blocked"));
  assert.ok(report.risk_flags.includes("scan_truncated_by_limits"));
});

test("invalid inventory fails closed", () => {
  const report = buildHomebaseAssetAwareness({ inventory: { schema: "wrong" } });
  assert.equal(report.valid, false);
  assert.equal(report.error, "invalid_or_missing_inventory");
});

test("integration: buildLocalAssetInventory does not read file content", async () => {
  const dir = mkdtempSync(join(tmpdir(), "hb-awareness-"));
  try {
    writeFileSync(join(dir, "readme.md"), "SECRET_CONTENT_SHOULD_NOT_APPEAR\n");
    const inventory = await buildLocalAssetInventory({
      root: dir,
      now: FIXED_NOW,
      limits: { maxDepth: 1, maxEntries: 20 },
      fs: {
        ...(await import("node:fs/promises")),
        async readFile() {
          throw new Error("readFile must not be used");
        },
      },
    });
    const report = buildHomebaseAssetAwareness({ inventory });
    assert.equal(inventory.boundary.file_content_read, false);
    assert.equal(report.boundary.file_content_read, false);
    const raw = JSON.stringify(report);
    assert.equal(raw.includes("SECRET_CONTENT_SHOULD_NOT_APPEAR"), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
