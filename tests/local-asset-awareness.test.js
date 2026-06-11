import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import {
  existsSync,
  lstatSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

import {
  LOCAL_ASSET_INVENTORY_SCHEMA,
  buildLocalAssetInventory,
  writeLocalAssetInventory,
} from "../packages/core/src/local-asset-awareness.js";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(HERE, "..");
const CLI_PATH = join(REPO_ROOT, "apps", "cli", "src", "index.js");
const FIXED_NOW = new Date("2026-06-11T09:00:00Z");

function freshDir(name) {
  return mkdtempSync(join(tmpdir(), `${name}-`));
}

function runCli(argv, { demaHome, root } = {}) {
  return new Promise((resolveOne) => {
    const child = spawn(process.execPath, [CLI_PATH, ...argv], {
      cwd: REPO_ROOT,
      env: {
        ...process.env,
        DEMA_HOME: demaHome,
        DEMA_LOCAL_ASSET_ROOT: root,
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

function makeFixture(root) {
  mkdirSync(join(root, "app"), { recursive: true });
  mkdirSync(join(root, "proofs"), { recursive: true });
  mkdirSync(join(root, "media"), { recursive: true });
  mkdirSync(join(root, "data"), { recursive: true });
  mkdirSync(join(root, "archive"), { recursive: true });
  mkdirSync(join(root, "models"), { recursive: true });
  mkdirSync(join(root, "nested", "deep", "too-far"), { recursive: true });
  mkdirSync(join(root, ".git"), { recursive: true });
  mkdirSync(join(root, "node_modules"), { recursive: true });
  mkdirSync(join(root, "wallet-backup"), { recursive: true });

  writeFileSync(join(root, "app", "package.json"), '{"private":true}\n');
  writeFileSync(join(root, "notes.md"), "do not read this content\n");
  writeFileSync(join(root, "proofs", "impact-receipt.json"), '{"secret":false}\n');
  writeFileSync(join(root, "media", "photo.png"), "png bytes\n");
  writeFileSync(join(root, "archive", "bundle.zip"), "zip bytes\n");
  writeFileSync(join(root, "data", "events.jsonl"), '{"a":1}\n');
  writeFileSync(join(root, "models", "tiny.gguf"), "model bytes\n");
  writeFileSync(join(root, "unknown.zzz"), "unknown bytes\n");
  writeFileSync(join(root, ".env"), "SHOULD_NOT_APPEAR=true\n");
  writeFileSync(join(root, "id_ed25519_test"), "PRIVATE KEY\n");
  writeFileSync(join(root, ".git", "config"), "private\n");
  writeFileSync(join(root, "node_modules", "package.json"), "{}\n");
  writeFileSync(join(root, "wallet-backup", "seed.txt"), "seed phrase\n");
  writeFileSync(join(root, "nested", "deep", "too-far", "hidden.txt"), "x\n");
  symlinkSync(join(root, "notes.md"), join(root, "notes-link"));
}

describe("buildLocalAssetInventory", () => {
  it("builds a metadata-only schema-tagged inventory without raw secret names", async () => {
    const root = freshDir("local-asset-root");
    try {
      makeFixture(root);
      const beforeScan = lstatSync(root).mtimeMs;
      const inventory = await buildLocalAssetInventory({
        root,
        now: FIXED_NOW,
        limits: { maxDepth: 2, maxEntries: 200 },
      });

      assert.equal(inventory.schema, LOCAL_ASSET_INVENTORY_SCHEMA);
      assert.equal(inventory.truth_label, "LOCAL_METADATA_MEASURED");
      assert.equal(inventory.mode, "metadata_only");
      assert.equal(inventory.root.exists, true);
      assert.equal(inventory.boundary.file_write_performed, false);
      assert.equal(inventory.boundary.file_content_read, false);
      assert.equal(inventory.boundary.symlink_followed, false);
      assert.equal(inventory.boundary.scanned_root_mutated, false);
      assert.ok(inventory.summary.records_count > 0);
      assert.ok(inventory.summary.denied_count >= 5);

      const categories = new Set(inventory.records.map((r) => r.category));
      for (const category of [
        "code_project",
        "document",
        "receipt_or_proof",
        "media",
        "archive",
        "dataset",
        "model_artifact",
        "unknown",
      ]) {
        assert.ok(categories.has(category), `missing category ${category}`);
      }

      const symlink = inventory.records.find((r) => r.kind === "symlink");
      assert.ok(symlink);
      assert.equal(symlink.content_hash, null);
      assert.equal(symlink.content_preview, null);

      const raw = JSON.stringify(inventory);
      assert.equal(raw.includes("SHOULD_NOT_APPEAR"), false);
      assert.equal(raw.includes("PRIVATE KEY"), false);
      assert.equal(raw.includes(".env"), false);
      assert.equal(raw.includes("id_ed25519_test"), false);
      assert.equal(raw.includes("wallet-backup"), false);

      const afterScan = lstatSync(root).mtimeMs;
      assert.equal(afterScan, beforeScan);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does not call readFile and enforces max depth plus max entries", async () => {
    const root = freshDir("local-asset-depth");
    try {
      makeFixture(root);
      const inventory = await buildLocalAssetInventory({
        root,
        now: FIXED_NOW,
        limits: { maxDepth: 1, maxEntries: 6 },
        fs: {
          async readFile() {
            throw new Error("readFile must not be used");
          },
        },
      });
      assert.equal(inventory.summary.truncated, true);
      assert.equal(
        inventory.records.some((r) =>
          r.relative_path.includes("nested/deep/too-far"),
        ),
        false,
      );
      assert.equal(inventory.boundary.file_content_read, false);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("returns a schema-tagged root_missing envelope for absent roots", async () => {
    const root = join(tmpdir(), "dema-local-asset-missing-nope");
    const inventory = await buildLocalAssetInventory({ root, now: FIXED_NOW });
    assert.equal(inventory.schema, LOCAL_ASSET_INVENTORY_SCHEMA);
    assert.equal(inventory.valid, false);
    assert.equal(inventory.error, "root_missing");
    assert.equal(inventory.root.exists, false);
  });

  it("keeps record_id stable for same metadata and sensitive to material metadata", async () => {
    const root = freshDir("local-asset-stable");
    try {
      writeFileSync(join(root, "a.md"), "alpha\n");
      const first = await buildLocalAssetInventory({ root, now: FIXED_NOW });
      const second = await buildLocalAssetInventory({ root, now: FIXED_NOW });
      assert.equal(first.records[0].record_id, second.records[0].record_id);

      writeFileSync(join(root, "a.md"), "alpha beta gamma\n");
      const third = await buildLocalAssetInventory({ root, now: FIXED_NOW });
      assert.notEqual(first.records[0].record_id, third.records[0].record_id);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe("writeLocalAssetInventory", () => {
  it("writes only the DEMA_HOME inventory artifact with mode 0600", async () => {
    const root = freshDir("local-asset-write-root");
    const home = freshDir("local-asset-home");
    try {
      makeFixture(root);
      const result = await writeLocalAssetInventory({
        root,
        demaHome: home,
        now: FIXED_NOW,
      });
      const artifactPath = join(
        home,
        "realm",
        "local-assets",
        "inventory-v0.1.json",
      );
      assert.equal(result.schema, "bizra.dema.local_asset_awareness_write_result.v0.1");
      assert.equal(result.written, true);
      assert.equal(result.artifact_path, artifactPath);
      assert.equal(existsSync(artifactPath), true);
      assert.equal((lstatSync(artifactPath).mode & 0o777).toString(8), "600");

      const artifact = JSON.parse(readFileSync(artifactPath, "utf8"));
      assert.equal(artifact.schema, LOCAL_ASSET_INVENTORY_SCHEMA);
      assert.equal(artifact.boundary.file_write_performed, true);
      assert.equal(artifact.boundary.scanned_root_mutated, false);
      assert.equal(existsSync(join(root, "inventory-v0.1.json")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  });

  it("refuses an artifact path outside DEMA_HOME", async () => {
    const root = freshDir("local-asset-outside-root");
    const home = freshDir("local-asset-outside-home");
    const outside = freshDir("local-asset-outside-artifact");
    try {
      writeFileSync(join(root, "a.md"), "alpha\n");
      const result = await writeLocalAssetInventory({
        root,
        demaHome: home,
        artifactPath: join(outside, "inventory-v0.1.json"),
        now: FIXED_NOW,
      });
      assert.equal(result.written, false);
      assert.equal(result.error, "artifact_path_outside_dema_home");
      assert.equal(existsSync(join(outside, "inventory-v0.1.json")), false);
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

describe("dema assets scan CLI", () => {
  it("--json writes the inventory artifact and emits parseable write result", async () => {
    const root = freshDir("local-asset-cli-root");
    const home = freshDir("local-asset-cli-home");
    try {
      makeFixture(root);
      const r = await runCli(["assets", "scan", "--root", root, "--json"], {
        demaHome: home,
        root,
      });
      assert.equal(r.exitCode, 0, r.stderr);
      const out = JSON.parse(r.stdout);
      assert.equal(out.schema, "bizra.dema.local_asset_awareness_write_result.v0.1");
      assert.equal(out.written, true);
      assert.equal(
        out.artifact_path,
        join(home, "realm", "local-assets", "inventory-v0.1.json"),
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
      rmSync(home, { recursive: true, force: true });
    }
  });
});
