import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  HOMEBASE_ASSET_GRAPH_SCHEMA,
  buildHomebaseAssetGraph,
  gatherHomebaseAssetGraph,
  renderHomebaseAssetGraph,
} from "../packages/core/src/homebase-asset-graph.js";
import { DEMA_REALM_WORLD_MAP_SCHEMA } from "../packages/core/src/dema-realm-world-map.js";
import { LOCAL_ASSET_INVENTORY_SCHEMA } from "../packages/core/src/local-asset-awareness.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const FIXED_NOW = new Date("2026-06-18T09:00:00.000Z");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-homebase-graph-"));
}

function writeInventory(home) {
  const path = join(home, "realm", "local-assets", "inventory-v0.1.json");
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(
    path,
    `${JSON.stringify(
      {
        schema: LOCAL_ASSET_INVENTORY_SCHEMA,
        truth_label: "LOCAL_METADATA_MEASURED",
        mode: "metadata_only",
        valid: true,
        generated_at_iso: "2026-06-18T08:55:00.000Z",
        root: { display: "~/Downloads", path_hash: "sha256:root", exists: true },
        limits: { max_depth: 2, max_entries: 5000, follow_symlinks: false },
        summary: {
          records_count: 3,
          files_count: 2,
          dirs_count: 1,
          symlinks_count: 0,
          denied_count: 1,
          truncated: false,
        },
        categories: { code_project: 1, receipt_or_proof: 1, document: 1 },
        records: [
          {
            record_id: "sha256:a",
            category: "code_project",
            kind: "file",
            name: "package.json",
            relative_path: "app/package.json",
            extension: ".json",
            size_bytes: 12,
            mtime_iso: "2026-06-18T08:00:00.000Z",
            risk_flags: [],
            content_hash: null,
            content_preview: null,
          },
          {
            record_id: "sha256:b",
            category: "receipt_or_proof",
            kind: "file",
            name: "impact-receipt.json",
            relative_path: "proofs/impact-receipt.json",
            extension: ".json",
            size_bytes: 20,
            mtime_iso: "2026-06-18T08:30:00.000Z",
            risk_flags: [],
            content_hash: null,
            content_preview: null,
          },
          {
            record_id: "sha256:c",
            category: "document",
            kind: "file",
            name: "notes.md",
            relative_path: "notes.md",
            extension: ".md",
            size_bytes: 8,
            mtime_iso: "2026-06-18T08:10:00.000Z",
            risk_flags: [],
            content_hash: null,
            content_preview: null,
          },
        ],
        denied: [],
        warnings: [],
        boundary: {
          file_write_performed: true,
          write_scope: "DEMA_HOME/realm/local-assets/inventory-v0.1.json",
          scanned_root_mutated: false,
          file_content_read: false,
          network_used: false,
          embedding_generated: false,
          model_invoked: false,
          symlink_followed: false,
          delete_or_move_performed: false,
          federation_used: false,
          economic_claim_made: false,
        },
      },
      null,
      2,
    )}\n`,
  );
}

function runCli(argv, { demaHome } = {}) {
  return new Promise((resolveOne) => {
    const child = spawn(process.execPath, [CLI_PATH, ...argv], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEMA_HOME: demaHome,
        DEMA_NO_TUI: "1",
        NODE_ENV: "test",
        NO_COLOR: "1",
      },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (b) => (stdout += b.toString("utf8")));
    child.stderr.on("data", (b) => (stderr += b.toString("utf8")));
    child.on("close", (code) => resolveOne({ exitCode: code, stdout, stderr }));
  });
}

test("buildHomebaseAssetGraph composes absent-inventory graph from world-map state", () => {
  const graph = buildHomebaseAssetGraph({
    renderedAtIso: FIXED_NOW.toISOString(),
    realmWorldMap: {
      schema: DEMA_REALM_WORLD_MAP_SCHEMA,
      status: "INVENTORY_ABSENT",
      artifact_path: null,
      clusters: [],
      next_safe_action: "Run dema assets scan --root ~/Downloads",
    },
  });

  assert.equal(graph.schema, HOMEBASE_ASSET_GRAPH_SCHEMA);
  assert.equal(graph.mode, "metadata_only");
  assert.ok(graph.summary.node_count >= 8);
  assert.equal(graph.summary.category_count, 0);
  assert.equal(graph.boundary.scanner_invoked, false);
  assert.equal(graph.boundary.network_used, false);
  assert.ok(graph.nodes.some((n) => n.kind === "homebase_root"));
  assert.ok(graph.nodes.some((n) => n.kind === "realm_world_map"));
});

test("buildHomebaseAssetGraph links categories to affordance hints", () => {
  const graph = buildHomebaseAssetGraph({
    renderedAtIso: FIXED_NOW.toISOString(),
    realmWorldMap: {
      schema: DEMA_REALM_WORLD_MAP_SCHEMA,
      status: "INVENTORY_READY",
      artifact_path: "/home/test/.dema/realm/local-assets/inventory-v0.1.json",
      clusters: [
        {
          category: "receipt_or_proof",
          count: 2,
          newest_mtime_iso: "2026-06-18T08:30:00.000Z",
          total_size_bytes: 40,
        },
        {
          category: "code_project",
          count: 1,
          newest_mtime_iso: "2026-06-18T08:00:00.000Z",
          total_size_bytes: 12,
        },
      ],
      summary: { records_count: 3 },
      next_safe_action: "Review local clusters",
    },
    homebaseGather: {
      receipts: { count: 4 },
      memory_size: { entries: 2 },
      profile: { source_present: true },
    },
  });

  assert.equal(graph.summary.category_count, 2);
  const receiptEdge = graph.edges.find(
    (e) =>
      e.relation === "suggested_for" &&
      graph.nodes.find((n) => n.node_id === e.from)?.label === "receipt_or_proof",
  );
  assert.ok(receiptEdge);
  assert.equal(receiptEdge.metadata.affordance_label, "Receipts");
  const inventoryNode = graph.nodes.find((n) => n.kind === "inventory_artifact");
  assert.ok(inventoryNode.metadata.artifact_path_hash.startsWith("sha256:"));
  assert.equal(graph.nodes.find((n) => n.kind === "homebase_root").metadata.receipts_count, 4);
});

test("gatherHomebaseAssetGraph reads inventory artifact without scanning root", async () => {
  const home = freshHome();
  writeInventory(home);
  const graph = await gatherHomebaseAssetGraph({
    demaHome: home,
    now: FIXED_NOW,
  });

  assert.equal(graph.sources.realm_world_map_status, "INVENTORY_READY");
  assert.equal(graph.summary.category_count, 3);
  assert.ok(renderHomebaseAssetGraph(graph).includes("receipt_or_proof"));
});

test("dema realm asset-graph --json emits graph schema", async () => {
  const home = freshHome();
  writeInventory(home);
  const result = await runCli(["realm", "asset-graph", "--json"], { demaHome: home });
  assert.equal(result.exitCode, 0);
  const graph = JSON.parse(result.stdout);
  assert.equal(graph.schema, HOMEBASE_ASSET_GRAPH_SCHEMA);
  assert.equal(graph.summary.category_count, 3);
});
