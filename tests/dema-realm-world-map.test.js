import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  DEMA_REALM_WORLD_MAP_SCHEMA,
  gatherDemaRealmWorldMap,
  renderDemaRealmWorldMap,
} from "../packages/core/src/dema-realm-world-map.js";
import { LOCAL_ASSET_INVENTORY_SCHEMA } from "../packages/core/src/local-asset-awareness.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const FIXED_NOW = new Date("2026-06-11T09:00:00Z");

function freshHome() {
  return mkdtempSync(join(tmpdir(), "dema-world-map-test-"));
}

function inventoryPath(home) {
  return join(home, "realm", "local-assets", "inventory-v0.1.json");
}

function writeInventory(home, overrides = {}) {
  const path = inventoryPath(home);
  mkdirSync(dirname(path), { recursive: true });
  const inventory = {
    schema: LOCAL_ASSET_INVENTORY_SCHEMA,
    truth_label: "LOCAL_METADATA_MEASURED",
    mode: "metadata_only",
    generated_at_iso: "2026-06-11T08:45:00.000Z",
    root: { display: "~/Downloads", path_hash: "sha256:root", exists: true },
    limits: { max_depth: 2, max_entries: 5000, follow_symlinks: false },
    summary: {
      records_count: 4,
      files_count: 3,
      dirs_count: 1,
      symlinks_count: 0,
      denied_count: 2,
      truncated: false,
    },
    categories: {
      code_project: 1,
      document: 1,
      receipt_or_proof: 1,
      unknown: 1,
    },
    records: [
      {
        record_id: "sha256:a",
        kind: "directory",
        category: "code_project",
        name: "app",
        relative_path: "app",
        extension: "",
        size_bytes: 0,
        mtime_iso: "2026-06-11T08:40:00.000Z",
        risk_flags: [],
        content_hash: null,
        content_preview: null,
      },
      {
        record_id: "sha256:b",
        kind: "file",
        category: "document",
        name: "notes.md",
        relative_path: "notes.md",
        extension: ".md",
        size_bytes: 12,
        mtime_iso: "2026-06-11T08:41:00.000Z",
        risk_flags: [],
        content_hash: null,
        content_preview: null,
      },
      {
        record_id: "sha256:c",
        kind: "file",
        category: "receipt_or_proof",
        name: "proof.json",
        relative_path: "proofs/proof.json",
        extension: ".json",
        size_bytes: 20,
        mtime_iso: "2026-06-11T08:42:00.000Z",
        risk_flags: [],
        content_hash: null,
        content_preview: null,
      },
      {
        record_id: "sha256:d",
        kind: "file",
        category: "unknown",
        name: "x.zzz",
        relative_path: "x.zzz",
        extension: ".zzz",
        size_bytes: 1,
        mtime_iso: "2026-06-11T08:39:00.000Z",
        risk_flags: [],
        content_hash: null,
        content_preview: null,
      },
    ],
    denied: [
      { reason: "secret_or_key_pattern", path_hash: "sha256:1", kind: "file" },
      {
        reason: "denylisted_directory",
        path_hash: "sha256:2",
        kind: "directory",
      },
    ],
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
    ...overrides,
  };
  writeFileSync(path, `${JSON.stringify(inventory, null, 2)}\n`);
  return path;
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

describe("gatherDemaRealmWorldMap", () => {
  it("reports INVENTORY_ABSENT without scanning disk", async () => {
    const home = freshHome();
    try {
      const state = await gatherDemaRealmWorldMap({
        demaHome: home,
        now: FIXED_NOW,
        scanner: async () => {
          throw new Error("scanner must not be called");
        },
      });
      assert.equal(state.schema, DEMA_REALM_WORLD_MAP_SCHEMA);
      assert.equal(state.status, "INVENTORY_ABSENT");
      assert.equal(state.inventory, null);
      assert.equal(state.boundary.file_write_performed, false);
      assert.equal(state.boundary.file_content_read, false);
      assert.match(state.next_safe_action, /dema assets scan/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("reports INVENTORY_INVALID without dumping raw JSON", async () => {
    const home = freshHome();
    try {
      mkdirSync(dirname(inventoryPath(home)), { recursive: true });
      writeFileSync(inventoryPath(home), "{not valid json SECRET_RAW");
      const state = await gatherDemaRealmWorldMap({
        demaHome: home,
        now: FIXED_NOW,
      });
      const out = renderDemaRealmWorldMap(state, { useColor: false });
      assert.equal(state.status, "INVENTORY_INVALID");
      assert.doesNotMatch(out, /SECRET_RAW/);
      assert.match(out, /INVENTORY_INVALID/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("reports INVENTORY_BOUNDARY_INVALID when artifact claims unsafe effects", async () => {
    const home = freshHome();
    try {
      writeInventory(home, {
        boundary: {
          file_write_performed: true,
          scanned_root_mutated: false,
          file_content_read: true,
          network_used: false,
          embedding_generated: false,
          model_invoked: false,
          symlink_followed: false,
          delete_or_move_performed: false,
          federation_used: false,
          economic_claim_made: false,
        },
      });
      const state = await gatherDemaRealmWorldMap({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(state.status, "INVENTORY_BOUNDARY_INVALID");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("renders a fresh valid inventory as INVENTORY_READY with category clusters", async () => {
    const home = freshHome();
    try {
      writeInventory(home);
      const state = await gatherDemaRealmWorldMap({
        demaHome: home,
        now: FIXED_NOW,
      });
      assert.equal(state.status, "INVENTORY_READY");
      assert.equal(state.summary.records_count, 4);
      assert.equal(state.denied_count, 2);
      assert.equal(state.truncated, false);
      assert.deepEqual(
        state.clusters.map((c) => c.category),
        ["code_project", "document", "receipt_or_proof", "unknown"],
      );
      const out = renderDemaRealmWorldMap(state, { useColor: false });
      assert.match(out, /DEMA REALM · WORLD MAP/);
      assert.match(out, /code_project\s+1/);
      assert.match(out, /denied:\s+2/);
      assert.match(
        out,
        /Boundary: read-only · no scan · no mutation · no network · no content/,
      );
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("renders old valid inventory as INVENTORY_STALE", async () => {
    const home = freshHome();
    try {
      writeInventory(home, { generated_at_iso: "2026-06-09T08:45:00.000Z" });
      const state = await gatherDemaRealmWorldMap({
        demaHome: home,
        now: FIXED_NOW,
        freshnessMs: 60 * 60 * 1000,
      });
      assert.equal(state.status, "INVENTORY_STALE");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});

describe("dema realm world-map CLI", () => {
  it("--json emits parseable schema-tagged JSON", async () => {
    const home = freshHome();
    try {
      // The CLI subprocess injects no `now` — it compares the inventory
      // timestamp against real wall-clock with the 24h freshness window.
      // Stamp the fixture relative to now so this READY assertion stays
      // deterministic (a hardcoded past date is a wall-clock time-bomb).
      writeInventory(home, {
        generated_at_iso: new Date(Date.now() - 60_000).toISOString(),
      });
      const r = await runCli(["realm", "world-map", "--json"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0, r.stderr);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, DEMA_REALM_WORLD_MAP_SCHEMA);
      assert.equal(out.status, "INVENTORY_READY");
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("--no-color output contains no ANSI sequences", async () => {
    const home = freshHome();
    try {
      writeInventory(home);
      const r = await runCli(["realm", "world-map", "--no-color"], {
        demaHome: home,
      });
      assert.equal(r.exitCode, 0, r.stderr);
      assert.match(r.stdout, /DEMA REALM · WORLD MAP/);
      assert.doesNotMatch(r.stdout, /\x1b\[[0-9;]*m/);
    } finally {
      rmSync(home, { recursive: true, force: true });
    }
  });
});
