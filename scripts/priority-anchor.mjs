#!/usr/bin/env node
// scripts/priority-anchor.mjs
//
// BIZRA Priority Anchor v1 — bizra.priority-anchor.v1
//
// Builds a deterministic SHA-256 Merkle root over a set of input files.
// The root is the artifact intended for OpenTimestamps anchoring; the
// stamp itself is NOT performed by this script — it is a halt-gated
// follow-up step.
//
// Algorithm (see docs/PRIORITY_ANCHOR.md):
//   leaf = sha256("BIZRA-PRIORITY-LEAF-v1\0" + filename + "\0" + size + "\0" + file_sha256_hex)
//   node = sha256("BIZRA-PRIORITY-NODE-v1\0" + left_hex + "\0" + right_hex)
//   tree_order: filename ascending lexicographic (Unicode code-point)
//   odd-leaf rule: duplicate the trailing leaf at each layer
//
// Zero runtime deps. Node ≥20 stdlib only.

import { createHash } from "node:crypto";
import { createReadStream, statSync, promises as fsp } from "node:fs";
import { resolve, basename, dirname, isAbsolute } from "node:path";
import { pipeline } from "node:stream/promises";

export const ALGORITHM_ID = "bizra.priority-anchor.v1";
export const LEAF_DOMAIN = "BIZRA-PRIORITY-LEAF-v1";
export const NODE_DOMAIN = "BIZRA-PRIORITY-NODE-v1";
export const TREE_ORDER = "filename_ascending_lexicographic";

async function sha256File(path) {
  const hash = createHash("sha256");
  await pipeline(createReadStream(path), hash);
  return hash.digest("hex");
}

export function leafHash({ filename, size, file_sha256 }) {
  const input = `${LEAF_DOMAIN}\0${filename}\0${size}\0${file_sha256}`;
  return createHash("sha256").update(input).digest("hex");
}

export function nodeHash(left, right) {
  const input = `${NODE_DOMAIN}\0${left}\0${right}`;
  return createHash("sha256").update(input).digest("hex");
}

export function buildMerkleTree(leafHashesHex) {
  if (leafHashesHex.length === 0) {
    throw new Error("Cannot build Merkle tree with zero leaves.");
  }
  const layers = [leafHashesHex.slice()];
  while (layers[layers.length - 1].length > 1) {
    const prev = layers[layers.length - 1];
    const next = [];
    for (let i = 0; i < prev.length; i += 2) {
      const left = prev[i];
      const right = i + 1 < prev.length ? prev[i + 1] : prev[i];
      next.push(nodeHash(left, right));
    }
    layers.push(next);
  }
  return { root: layers[layers.length - 1][0], layers };
}

async function entriesFromInputs(inputs) {
  const out = [];
  for (const p of inputs) {
    let stat;
    try {
      stat = statSync(p);
    } catch {
      throw new Error(`Input does not exist or is not readable: ${p}`);
    }
    if (!stat.isFile()) {
      throw new Error(`Input is not a regular file: ${p}`);
    }
    const filename = basename(p);
    const file_sha256 = await sha256File(p);
    out.push({ filename, file_size_bytes: stat.size, file_sha256 });
  }
  return out;
}

export async function buildManifest(inputPaths) {
  const entries = await entriesFromInputs(inputPaths);

  entries.sort((a, b) =>
    a.filename < b.filename ? -1 : a.filename > b.filename ? 1 : 0
  );

  const filesWithLeaves = entries.map((e) => ({
    filename: e.filename,
    file_size_bytes: e.file_size_bytes,
    file_sha256: e.file_sha256,
    leaf_hash: leafHash({
      filename: e.filename,
      size: e.file_size_bytes,
      file_sha256: e.file_sha256
    })
  }));

  const tree = buildMerkleTree(filesWithLeaves.map((e) => e.leaf_hash));

  return {
    algorithm_id: ALGORITHM_ID,
    domain: { leaf: LEAF_DOMAIN, node: NODE_DOMAIN },
    tree_order: TREE_ORDER,
    duplicate_odd_leaf: true,
    created_at: new Date().toISOString(),
    input_files: filesWithLeaves.map((e) => e.filename),
    files: filesWithLeaves,
    root_hash: tree.root,
    layers: tree.layers
  };
}

export function verifyManifest(manifest) {
  if (manifest.algorithm_id !== ALGORITHM_ID) {
    return { ok: false, reason: `unknown algorithm_id: ${manifest.algorithm_id}` };
  }
  if (manifest.tree_order !== TREE_ORDER) {
    return { ok: false, reason: `unexpected tree_order: ${manifest.tree_order}` };
  }
  // Re-derive each leaf from the per-file metadata.
  for (const f of manifest.files) {
    const recomputedLeaf = leafHash({
      filename: f.filename,
      size: f.file_size_bytes,
      file_sha256: f.file_sha256
    });
    if (recomputedLeaf !== f.leaf_hash) {
      return {
        ok: false,
        reason: `leaf_hash mismatch for ${f.filename}: manifest=${f.leaf_hash} recomputed=${recomputedLeaf}`
      };
    }
  }
  // Re-derive the root from the leaves.
  const recomputedRoot = buildMerkleTree(manifest.files.map((f) => f.leaf_hash)).root;
  if (recomputedRoot !== manifest.root_hash) {
    return {
      ok: false,
      reason: `root_hash mismatch: manifest=${manifest.root_hash} recomputed=${recomputedRoot}`
    };
  }
  return { ok: true, root: recomputedRoot };
}

export async function verifyManifestFiles(manifest, { baseDir = process.cwd() } = {}) {
  const metadataCheck = verifyManifest(manifest);
  if (!metadataCheck.ok) return metadataCheck;

  for (const f of manifest.files) {
    if (!f.filename || basename(f.filename) !== f.filename) {
      return { ok: false, reason: `unsafe filename in manifest: ${JSON.stringify(f.filename)}` };
    }

    const path = resolve(baseDir, f.filename);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      return { ok: false, reason: `manifest file missing or unreadable: ${path}` };
    }
    if (!stat.isFile()) {
      return { ok: false, reason: `manifest input is not a regular file: ${path}` };
    }
    if (stat.size !== f.file_size_bytes) {
      return {
        ok: false,
        reason:
          `file_size mismatch for ${f.filename}: manifest=${f.file_size_bytes} ` +
          `current=${stat.size}`
      };
    }

    const actualSha256 = await sha256File(path);
    if (actualSha256 !== f.file_sha256) {
      return {
        ok: false,
        reason:
          `file_sha256 mismatch for ${f.filename}: manifest=${f.file_sha256} ` +
          `current=${actualSha256}`
      };
    }
  }

  return {
    ...metadataCheck,
    checked_files: manifest.files.length,
    base_dir: resolve(baseDir)
  };
}

function parseArgs(argv) {
  let outDir = resolve(process.cwd(), "proof-of-priority");
  let mode = "build";
  let manifestPath = null;
  let baseDir = null;
  const inputs = [];
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out") {
      const next = argv[++i];
      if (!next) throw new Error("--out requires a path");
      outDir = isAbsolute(next) ? next : resolve(process.cwd(), next);
    } else if (a === "--base-dir") {
      const next = argv[++i];
      if (!next) throw new Error("--base-dir requires a path");
      baseDir = isAbsolute(next) ? next : resolve(process.cwd(), next);
    } else if (a === "--verify") {
      mode = "verify";
      const next = argv[++i];
      if (!next) throw new Error("--verify requires a manifest path");
      manifestPath = isAbsolute(next) ? next : resolve(process.cwd(), next);
    } else if (a === "--help" || a === "-h") {
      printHelpAndExit(0);
    } else {
      inputs.push(isAbsolute(a) ? a : resolve(process.cwd(), a));
    }
  }
  if (mode === "build" && inputs.length === 0) printHelpAndExit(2);
  return { mode, inputs, outDir, manifestPath, baseDir };
}

function printHelpAndExit(code) {
  console.log(
    [
      "Usage:",
      "  priority-anchor.mjs [--out DIR] FILE [FILE...]    build manifest + root",
      "  priority-anchor.mjs --verify MANIFEST [--base-dir DIR]",
      "                                                     re-hash files + root, compare",
      "",
      "Builds (or verifies) a deterministic SHA-256 Merkle root using the",
      `${ALGORITHM_ID} algorithm. Build mode writes manifest.json,`,
      "merkle-root.txt, and merkle-tree.json into the output directory",
      "(default ./proof-of-priority).",
      "",
      "The OpenTimestamps stamp (`ots stamp merkle-root.txt`) is NOT run",
      "by this script. It is a halt-gated, identity-binding follow-up.",
      "",
      "See docs/PRIORITY_ANCHOR.md for the algorithm specification."
    ].join("\n")
  );
  process.exit(code);
}

async function runBuild(opts) {
  const manifest = await buildManifest(opts.inputs);

  const check = verifyManifest(manifest);
  if (!check.ok) {
    throw new Error(`Self-check failed: ${check.reason}`);
  }

  await fsp.mkdir(opts.outDir, { recursive: true });
  await fsp.writeFile(
    resolve(opts.outDir, "manifest.json"),
    JSON.stringify(manifest, null, 2) + "\n"
  );
  await fsp.writeFile(
    resolve(opts.outDir, "merkle-root.txt"),
    manifest.root_hash + "\n"
  );
  await fsp.writeFile(
    resolve(opts.outDir, "merkle-tree.json"),
    JSON.stringify({ layers: manifest.layers, root: manifest.root_hash }, null, 2) + "\n"
  );

  console.log(`algorithm_id: ${manifest.algorithm_id}`);
  console.log(`tree_order:   ${manifest.tree_order}`);
  console.log(`files:        ${manifest.input_files.length}`);
  for (const f of manifest.files) {
    console.log(
      `  ${f.filename}  size=${f.file_size_bytes}  sha=${f.file_sha256.slice(0, 16)}…  leaf=${f.leaf_hash.slice(0, 16)}…`
    );
  }
  console.log(`root_hash:    ${manifest.root_hash}`);
  console.log(`written:      ${resolve(opts.outDir, "manifest.json")}`);
  console.log(`              ${resolve(opts.outDir, "merkle-root.txt")}`);
  console.log(`              ${resolve(opts.outDir, "merkle-tree.json")}`);
}

async function runVerify(opts) {
  const raw = await fsp.readFile(opts.manifestPath, "utf8");
  const manifest = JSON.parse(raw);
  // Build mode writes manifests under an output directory, while files are
  // normally siblings of that directory (proof-of-priority/ -> repo root).
  const baseDir = opts.baseDir ?? resolve(dirname(opts.manifestPath), "..");
  const result = await verifyManifestFiles(manifest, { baseDir });
  if (!result.ok) {
    console.error(`✘ ${result.reason}`);
    process.exit(1);
  }
  console.log(`✔ ${manifest.algorithm_id}`);
  console.log(`✔ root_hash reproduced: ${result.root}`);
  console.log(`✔ file bytes matched manifest: ${result.checked_files} files from ${result.base_dir}`);
}

async function main() {
  const opts = parseArgs(process.argv);
  if (opts.mode === "verify") {
    await runVerify(opts);
  } else {
    await runBuild(opts);
  }
}

const invokedDirectly =
  process.argv[1] && resolve(process.argv[1]) === new URL(import.meta.url).pathname;

if (invokedDirectly) {
  main().catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
