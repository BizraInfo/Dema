import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  NODE0_SPACE_INDEX_SCHEMA,
  NODE0_SPACE_INDEX_TRUTH_LABEL,
  buildNode0HashConsentPhrase,
  buildNode0SpaceIndex,
  classifyNode0Content,
  verifyNode0SpaceIndex,
} from "../packages/core/src/node0-space-index.js";

const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));
const FIXED_NOW = new Date("2026-07-02T00:00:00.000Z");

test("Node0 index constants and consent phrase are exact", () => {
  assert.equal(NODE0_SPACE_INDEX_SCHEMA, "bizra.dema.node0_space_index.v0.1");
  assert.equal(NODE0_SPACE_INDEX_TRUTH_LABEL, "NODE0_LOCAL_SEED");
  assert.equal(
    buildNode0HashConsentPhrase("sha256:abc123"),
    "I CONSENT: HASH NODE0 SPACE sha256:abc123",
  );
});

test("classifyNode0Content uses path metadata only", () => {
  assert.equal(
    classifyNode0Content({ name: "index.js", relativePath: "src/index.js", kind: "file" }),
    "code",
  );
  assert.equal(
    classifyNode0Content({ name: "README.md", relativePath: "README.md", kind: "file" }),
    "doc",
  );
  assert.equal(
    classifyNode0Content({ name: "data.jsonl", relativePath: "data/data.jsonl", kind: "file" }),
    "data",
  );
  assert.equal(
    classifyNode0Content({ name: "clip.mp4", relativePath: "media/clip.mp4", kind: "file" }),
    "media",
  );
  assert.equal(
    classifyNode0Content({ name: "archive.zip", relativePath: "archive.zip", kind: "file" }),
    "archive",
  );
  assert.equal(
    classifyNode0Content({ name: "model.gguf", relativePath: "models/model.gguf", kind: "file" }),
    "model_artifact",
  );
  assert.equal(
    classifyNode0Content({ name: ".env", relativePath: ".env", kind: "file" }),
    "secret_metadata_only",
  );
  assert.equal(
    classifyNode0Content({ name: "blob.bin", relativePath: "blob.bin", kind: "file" }),
    "binary",
  );
  assert.equal(
    classifyNode0Content({ name: "folder", relativePath: "folder", kind: "directory" }),
    "unknown",
  );
});

test("metadata-only index emits envelope, weak size groups, and ready hash consent phrase", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-index-"));
  await mkdir(join(root, "docs"));
  await writeFile(join(root, "docs", "a.md"), "same-size-a\n");
  await writeFile(join(root, "docs", "b.md"), "same-size-b\n");
  await writeFile(join(root, ".env"), "MUST_NOT_OPEN\n");
  await symlink(join(root, "docs", "a.md"), join(root, "link-to-a"));

  const out = await buildNode0SpaceIndex({
    root,
    checkpoint: false,
    now: FIXED_NOW,
  });

  assert.equal(out.schema, NODE0_SPACE_INDEX_SCHEMA);
  assert.equal(out.truth_label, NODE0_SPACE_INDEX_TRUTH_LABEL);
  assert.equal(out.mode, "metadata_only_index");
  assert.match(out.root.normalized_path_hash, /^sha256:/);
  assert.equal(
    out.root.hash_consent_phrase,
    `I CONSENT: HASH NODE0 SPACE ${out.root.normalized_path_hash}`,
  );
  assert.equal(out.boundary.file_content_read, false);
  assert.equal(out.boundary.content_hash_performed, false);
  assert.equal(out.boundary.scanned_root_mutated, false);
  assert.equal(out.boundary.network_used, false);
  assert.ok(out.records.some((r) => r.kind === "symlink" && r.symlink_followed === false));
  assert.ok(out.denied.some((d) => d.content_class === "secret_metadata_only"));
  assert.ok(
    out.duplicate_candidate_groups.some(
      (g) => g.group_type === "size_collision_weak" && g.content_confirmed === false,
    ),
  );
  assert.deepEqual(verifyNode0SpaceIndex(out), { ok: true, errors: [] });
});

test("hash mode rejects broad consent before opening file bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-index-consent-"));
  await writeFile(join(root, "a.txt"), "same\n");
  const out = await buildNode0SpaceIndex({
    root,
    hashContent: true,
    consentPhrase: "GO",
    checkpoint: false,
    now: FIXED_NOW,
  });
  assert.equal(out.mode, "metadata_only_index");
  assert.equal(out.error, "hash_consent_phrase_mismatch");
  assert.equal(out.boundary.file_content_read, false);
  assert.equal(out.boundary.content_hash_performed, false);
});

test("hash mode streams file hashes and emits strong duplicate groups", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-index-hash-"));
  await writeFile(join(root, "a.txt"), "same\n");
  await writeFile(join(root, "b.txt"), "same\n");
  await writeFile(join(root, "secret-token.txt"), "MUST_NOT_OPEN\n");
  const preview = await buildNode0SpaceIndex({ root, checkpoint: false });
  const out = await buildNode0SpaceIndex({
    root,
    hashContent: true,
    consentPhrase: preview.root.hash_consent_phrase,
    checkpoint: false,
    now: FIXED_NOW,
  });
  assert.equal(out.mode, "content_hash_index");
  assert.equal(out.consent.accepted, true);
  assert.equal(out.boundary.file_content_read, true);
  assert.equal(out.boundary.content_hash_performed, true);
  assert.ok(out.records.filter((r) => r.content_hash).length >= 2);
  assert.ok(out.denied.some((d) => d.reason === "secret_metadata_only"));
  assert.ok(
    out.duplicate_candidate_groups.some(
      (g) =>
        g.group_type === "content_hash_match" &&
        g.confidence === "strong" &&
        g.content_confirmed === true,
    ),
  );
});

test("checkpoint writes only under DEMA_HOME and boundary reports it", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-index-root-"));
  const demaHome = await mkdtemp(join(tmpdir(), "dema-node0-index-home-"));
  await writeFile(join(root, "a.md"), "alpha\n");

  const out = await buildNode0SpaceIndex({
    root,
    demaHome,
    checkpoint: true,
    now: FIXED_NOW,
  });

  assert.equal(out.checkpoint.enabled, true);
  assert.equal(out.checkpoint.complete, true);
  assert.match(out.checkpoint.path_hash, /^sha256:/);
  assert.equal(out.boundary.filesystem_write_performed, true);
  assert.equal(out.boundary.checkpoint_write_performed, true);
  assert.equal(out.boundary.scanned_root_mutated, false);
});

test("walker excludes DEMA_HOME node0-index state when root contains it", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-index-self-"));
  const demaHome = join(root, ".dema");
  await mkdir(join(demaHome, "node0-index", "checkpoints"), { recursive: true });
  await writeFile(join(demaHome, "node0-index", "checkpoints", "state.json"), "{\"x\":1}\n");
  await writeFile(join(root, "visible.md"), "visible\n");

  const out = await buildNode0SpaceIndex({ root, demaHome, checkpoint: true });
  assert.ok(out.records.some((r) => r.relative_path === "visible.md"));
  assert.equal(
    out.records.some((r) => r.relative_path.includes("node0-index/checkpoints")),
    false,
  );
  assert.ok(out.denied.some((d) => d.reason === "dema_node0_index_state"));
});

test("CLI node0-index emits parseable JSON and copy-ready consent phrase", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-index-cli-"));
  const demaHome = await mkdtemp(join(tmpdir(), "dema-node0-index-cli-home-"));
  await writeFile(join(root, "a.md"), "alpha\n");

  const stdout = execFileSync(
    process.execPath,
    [CLI, "node0-index", "--root", root, "--json"],
    { encoding: "utf8", env: { ...process.env, DEMA_HOME: demaHome } },
  );
  const out = JSON.parse(stdout);
  assert.equal(out.schema, NODE0_SPACE_INDEX_SCHEMA);
  assert.equal(out.mode, "metadata_only_index");
  assert.equal(
    out.root.hash_consent_phrase,
    `I CONSENT: HASH NODE0 SPACE ${out.root.normalized_path_hash}`,
  );
});

test("CLI node0-index human output prints ready-to-copy hash consent phrase", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-index-cli-human-"));
  const demaHome = await mkdtemp(join(tmpdir(), "dema-node0-index-cli-home-"));
  await writeFile(join(root, "a.md"), "alpha\n");

  const stdout = execFileSync(process.execPath, [CLI, "node0-index", "--root", root], {
    encoding: "utf8",
    env: { ...process.env, DEMA_HOME: demaHome },
  });
  assert.match(stdout, /DEMA NODE0 SPACE INDEX/);
  assert.match(stdout, /I CONSENT: HASH NODE0 SPACE sha256:/);
  assert.match(stdout, /Weak duplicate candidates:/);
});
