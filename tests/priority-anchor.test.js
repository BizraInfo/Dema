import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import {
  ALGORITHM_ID,
  LEAF_DOMAIN,
  NODE_DOMAIN,
  TREE_ORDER,
  buildManifest,
  buildMerkleTree,
  leafHash,
  nodeHash,
  verifyManifest
} from "../scripts/priority-anchor.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../scripts/priority-anchor.mjs", import.meta.url));

test("priority-anchor algorithm constants are bound to v1", () => {
  assert.equal(ALGORITHM_ID, "bizra.priority-anchor.v1");
  assert.equal(LEAF_DOMAIN, "BIZRA-PRIORITY-LEAF-v1");
  assert.equal(NODE_DOMAIN, "BIZRA-PRIORITY-NODE-v1");
  assert.equal(TREE_ORDER, "filename_ascending_lexicographic");
});

test("leafHash is deterministic and includes filename, size, and sha256", () => {
  const a = leafHash({ filename: "x.pdf", size: 10, file_sha256: "ab".repeat(32) });
  const b = leafHash({ filename: "x.pdf", size: 10, file_sha256: "ab".repeat(32) });
  assert.equal(a, b);

  // Any field change must change the leaf hash.
  assert.notEqual(a, leafHash({ filename: "y.pdf", size: 10, file_sha256: "ab".repeat(32) }));
  assert.notEqual(a, leafHash({ filename: "x.pdf", size: 11, file_sha256: "ab".repeat(32) }));
  assert.notEqual(a, leafHash({ filename: "x.pdf", size: 10, file_sha256: "cd".repeat(32) }));
});

test("nodeHash uses domain separation and is order-sensitive", () => {
  const left = "aa".repeat(32);
  const right = "bb".repeat(32);
  assert.notEqual(nodeHash(left, right), nodeHash(right, left));
  assert.equal(nodeHash(left, right), nodeHash(left, right));
});

test("buildMerkleTree applies duplicate-odd convention", () => {
  const a = "11".repeat(32);
  const b = "22".repeat(32);
  const c = "33".repeat(32);
  const odd = buildMerkleTree([a, b, c]);
  const padded = buildMerkleTree([a, b, c, c]);
  assert.equal(odd.root, padded.root);
});

test("buildMerkleTree produces a 64-char hex root", () => {
  const tree = buildMerkleTree(["aa".repeat(32), "bb".repeat(32)]);
  assert.match(tree.root, /^[0-9a-f]{64}$/);
});

test("buildManifest sorts inputs by filename and round-trips through verifyManifest", async () => {
  const root = await mkdtemp(join(tmpdir(), "priority-anchor-"));
  await writeFile(join(root, "c.txt"), "gamma\n");
  await writeFile(join(root, "a.txt"), "alpha\n");
  await writeFile(join(root, "b.txt"), "beta\n");

  // Pass inputs in a non-sorted order; manifest must still come out sorted.
  const manifest = await buildManifest([
    join(root, "c.txt"),
    join(root, "a.txt"),
    join(root, "b.txt")
  ]);

  assert.deepEqual(manifest.input_files, ["a.txt", "b.txt", "c.txt"]);
  assert.equal(manifest.algorithm_id, "bizra.priority-anchor.v1");
  assert.equal(manifest.tree_order, "filename_ascending_lexicographic");
  assert.equal(manifest.duplicate_odd_leaf, true);
  assert.match(manifest.root_hash, /^[0-9a-f]{64}$/);

  const result = verifyManifest(manifest);
  assert.equal(result.ok, true);
  assert.equal(result.root, manifest.root_hash);
});

test("CLI build + verify round-trip on fixture files", async () => {
  const root = await mkdtemp(join(tmpdir(), "priority-anchor-cli-"));
  await writeFile(join(root, "a.txt"), "alpha\n");
  await writeFile(join(root, "b.txt"), "beta\n");
  await writeFile(join(root, "c.txt"), "gamma\n");

  const out = join(root, "out");
  await execFileAsync("node", [
    scriptPath,
    "--out",
    out,
    join(root, "a.txt"),
    join(root, "b.txt"),
    join(root, "c.txt")
  ]);

  const manifest = JSON.parse(await readFile(join(out, "manifest.json"), "utf8"));
  const rootFile = (await readFile(join(out, "merkle-root.txt"), "utf8")).trim();
  assert.equal(rootFile, manifest.root_hash);

  // Order independence: same inputs in a different CLI order produce the same root.
  const out2 = join(root, "out2");
  await execFileAsync("node", [
    scriptPath,
    "--out",
    out2,
    join(root, "c.txt"),
    join(root, "a.txt"),
    join(root, "b.txt")
  ]);
  const manifest2 = JSON.parse(await readFile(join(out2, "manifest.json"), "utf8"));
  assert.equal(manifest2.root_hash, manifest.root_hash);

  // --verify mode reproduces the root from the manifest.
  const { stdout } = await execFileAsync("node", [scriptPath, "--verify", join(out, "manifest.json")]);
  assert.match(stdout, /root_hash reproduced/);
  assert.match(stdout, new RegExp(manifest.root_hash));
});

test("verifyManifest rejects a tampered root_hash", async () => {
  const root = await mkdtemp(join(tmpdir(), "priority-anchor-tamper-"));
  await writeFile(join(root, "a.txt"), "alpha\n");
  await writeFile(join(root, "b.txt"), "beta\n");

  const manifest = await buildManifest([join(root, "a.txt"), join(root, "b.txt")]);
  const tampered = { ...manifest, root_hash: "f".repeat(64) };
  const result = verifyManifest(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /root_hash mismatch/);
});

test("verifyManifest rejects a tampered file_sha256", async () => {
  const root = await mkdtemp(join(tmpdir(), "priority-anchor-tamper2-"));
  await writeFile(join(root, "a.txt"), "alpha\n");
  await writeFile(join(root, "b.txt"), "beta\n");

  const manifest = await buildManifest([join(root, "a.txt"), join(root, "b.txt")]);
  const tampered = {
    ...manifest,
    files: [
      { ...manifest.files[0], file_sha256: "0".repeat(64) },
      manifest.files[1]
    ]
  };
  const result = verifyManifest(tampered);
  assert.equal(result.ok, false);
  assert.match(result.reason, /leaf_hash mismatch/);
});
