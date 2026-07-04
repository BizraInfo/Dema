# Dema Node0 Space Index 1A Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `dema node0-index --root <path> --json`, a consent-bound Node0 onboarding census that indexes local metadata by default and hashes file contents only after an exact root-bound consent phrase.

**Architecture:** Add one focused core builder in `packages/core/src/node0-space-index.js` with injected filesystem effects, deterministic ordering, checkpoint support under `DEMA_HOME`, and honest boundary fields. Add a thin CLI wrapper in `apps/cli/src/commands/node0-index.js` that renders JSON or a human summary and wires the command into the dispatcher, consent matrix, docs, and tests.

**Tech Stack:** Node.js ESM, stdlib only (`node:fs`, `node:fs/promises`, `node:path`, `node:crypto`, `node:os`), native `node:test`, existing Dema CLI patterns.

## Global Constraints

- No new dependencies.
- Default mode is metadata-only and must never open regular file bytes.
- Content hashing requires exact phrase: `I CONSENT: HASH NODE0 SPACE <root_hash>`.
- Metadata-mode envelope and human CLI output must print the exact ready-to-copy hash-consent phrase for the scanned root.
- Metadata mode emits weak duplicate candidates from same-size files only; content-confirmed duplicates require hash mode.
- Secret-pattern paths are recorded as `secret_metadata_only` and never opened, even in hash mode.
- Symlinks are recorded and never followed.
- Exclude `$DEMA_HOME/node0-index/` from traversal when the scanned root contains it.
- Scanned root is never mutated. Checkpoints may write only under `$DEMA_HOME/node0-index/checkpoints/`.
- No network, model call, upload, federation, token mint, wallet, dedup apply, delete, hardlink, or move.

---

## File Structure

- Create `packages/core/src/node0-space-index.js`: core constants, classifiers, iterative index builder, optional hash streamer, checkpoint read/write helpers, verifier, human renderer.
- Create `apps/cli/src/commands/node0-index.js`: argument parsing, CLI error shape, builder invocation, JSON/human output.
- Modify `apps/cli/src/index.js`: import and wire `node0-index`, add help text.
- Modify `packages/core/src/cli-consent-matrix-entries.js`: add `node0-index` as `read_only`, `preview_only`, `content_read`, `local_write` with exact consent detail.
- Create `tests/node0-space-index.test.js`: core and CLI tests for metadata, hashing, secrets, symlinks, checkpointing, weak/strong duplicate candidates, boundary truth.
- Modify `tests/cli-command-table.test.js`: include `node0-index`.
- Modify `docs/ARCHITECTURE.md`, `docs/TESTING.md`, and `docs/CURRENT_LIMITS.md`: document the measured local command and its non-effects.

## Interfaces

Core exports:

```js
export const NODE0_SPACE_INDEX_SCHEMA =
  "bizra.dema.node0_space_index.v0.1";
export const NODE0_SPACE_INDEX_TRUTH_LABEL = "NODE0_LOCAL_SEED";

export function buildNode0HashConsentPhrase(rootHash) {}
export function classifyNode0Content({ name, relativePath, kind }) {}
export async function buildNode0SpaceIndex(options) {}
export function verifyNode0SpaceIndex(envelope) {}
export function renderNode0SpaceIndexSummary(envelope) {}
```

Builder options:

```js
{
  root: string,
  hashContent?: boolean,
  consentPhrase?: string,
  demaHome?: string,
  checkpoint?: boolean,
  now?: Date,
  limits?: {
    maxDepth?: number,
    maxEntries?: number,
    maxBytesToHash?: number,
    maxMillis?: number
  },
  fs?: {
    lstat,
    readdir,
    mkdir,
    readFile,
    writeFile,
    rename,
    chmod,
    createReadStream
  }
}
```

Envelope fields:

```js
{
  schema,
  truth_label,
  mode: "metadata_only_index" | "content_hash_index",
  generated_at_iso,
  root: {
    display,
    normalized_path_hash,
    hash_consent_phrase
  },
  limits,
  checkpoint,
  summary,
  content_classes,
  records,
  denied,
  warnings,
  duplicate_candidate_groups,
  consent,
  blocked_effects,
  boundary
}
```

## Task 1: Core Constants, Classifier, Consent Phrase

**Files:**
- Create: `packages/core/src/node0-space-index.js`
- Create: `tests/node0-space-index.test.js`

**Interfaces:**
- Produces: `NODE0_SPACE_INDEX_SCHEMA`, `NODE0_SPACE_INDEX_TRUTH_LABEL`, `buildNode0HashConsentPhrase(rootHash)`, `classifyNode0Content({ name, relativePath, kind })`.

- [ ] **Step 1: Write failing classifier and consent tests**

Add to `tests/node0-space-index.test.js`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  NODE0_SPACE_INDEX_SCHEMA,
  NODE0_SPACE_INDEX_TRUTH_LABEL,
  buildNode0HashConsentPhrase,
  classifyNode0Content,
} from "../packages/core/src/node0-space-index.js";

test("Node0 index constants and consent phrase are exact", () => {
  assert.equal(NODE0_SPACE_INDEX_SCHEMA, "bizra.dema.node0_space_index.v0.1");
  assert.equal(NODE0_SPACE_INDEX_TRUTH_LABEL, "NODE0_LOCAL_SEED");
  assert.equal(
    buildNode0HashConsentPhrase("sha256:abc123"),
    "I CONSENT: HASH NODE0 SPACE sha256:abc123",
  );
});

test("classifyNode0Content uses path metadata only", () => {
  assert.equal(classifyNode0Content({ name: "index.js", relativePath: "src/index.js", kind: "file" }), "code");
  assert.equal(classifyNode0Content({ name: "README.md", relativePath: "README.md", kind: "file" }), "doc");
  assert.equal(classifyNode0Content({ name: "data.jsonl", relativePath: "data/data.jsonl", kind: "file" }), "data");
  assert.equal(classifyNode0Content({ name: "clip.mp4", relativePath: "media/clip.mp4", kind: "file" }), "media");
  assert.equal(classifyNode0Content({ name: "archive.zip", relativePath: "archive.zip", kind: "file" }), "archive");
  assert.equal(classifyNode0Content({ name: "model.gguf", relativePath: "models/model.gguf", kind: "file" }), "model_artifact");
  assert.equal(classifyNode0Content({ name: ".env", relativePath: ".env", kind: "file" }), "secret_metadata_only");
  assert.equal(classifyNode0Content({ name: "blob.bin", relativePath: "blob.bin", kind: "file" }), "binary");
  assert.equal(classifyNode0Content({ name: "folder", relativePath: "folder", kind: "directory" }), "unknown");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/node0-space-index.test.js`

Expected: FAIL because `packages/core/src/node0-space-index.js` does not exist.

- [ ] **Step 3: Add minimal constants and classifier**

Create `packages/core/src/node0-space-index.js` with:

```js
import { createHash } from "node:crypto";
import { basename, extname } from "node:path";

export const NODE0_SPACE_INDEX_SCHEMA =
  "bizra.dema.node0_space_index.v0.1";
export const NODE0_SPACE_INDEX_TRUTH_LABEL = "NODE0_LOCAL_SEED";

const CODE_EXTS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".rs", ".go", ".java", ".sh"]);
const DOC_EXTS = new Set([".md", ".txt", ".pdf", ".doc", ".docx", ".rtf"]);
const DATA_EXTS = new Set([".json", ".jsonl", ".ndjson", ".csv", ".tsv", ".yaml", ".yml", ".toml", ".xml", ".sqlite", ".db", ".parquet"]);
const MEDIA_EXTS = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp3", ".wav", ".m4a", ".mp4", ".mov", ".webm"]);
const ARCHIVE_EXTS = new Set([".zip", ".tar", ".gz", ".tgz", ".7z", ".rar"]);
const MODEL_EXTS = new Set([".gguf", ".safetensors", ".onnx", ".pt", ".pth"]);
const BINARY_EXTS = new Set([".bin", ".exe", ".dll", ".so", ".dylib"]);

export function sha256Text(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

export function buildNode0HashConsentPhrase(rootHash) {
  return `I CONSENT: HASH NODE0 SPACE ${rootHash}`;
}

function secretLike(name, relativePath) {
  const raw = `${relativePath || ""}/${name || ""}`.toLowerCase();
  return (
    raw.includes("/.ssh/") ||
    raw.includes("/.gnupg/") ||
    raw.includes("secret") ||
    raw.includes("credential") ||
    raw.includes("password") ||
    raw.includes("token") ||
    basename(raw) === ".env" ||
    basename(raw).startsWith(".env.") ||
    /\.(pem|key|p12|pfx)$/i.test(raw) ||
    /^id_(rsa|ed25519)/i.test(basename(raw))
  );
}

export function classifyNode0Content({ name = "", relativePath = "", kind = "" } = {}) {
  if (secretLike(name, relativePath)) return "secret_metadata_only";
  if (kind !== "file") return "unknown";
  const ext = extname(name).toLowerCase();
  const lower = name.toLowerCase();
  if (CODE_EXTS.has(ext) || ["package.json", "pyproject.toml", "cargo.toml"].includes(lower)) return "code";
  if (DOC_EXTS.has(ext)) return "doc";
  if (DATA_EXTS.has(ext)) return "data";
  if (MEDIA_EXTS.has(ext)) return "media";
  if (ARCHIVE_EXTS.has(ext)) return "archive";
  if (MODEL_EXTS.has(ext)) return "model_artifact";
  if (BINARY_EXTS.has(ext)) return "binary";
  return "unknown";
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/node0-space-index.test.js`

Expected: PASS for the first two tests.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/node0-space-index.js tests/node0-space-index.test.js
git commit -m "feat: start Node0 space index kernel"
```

## Task 2: Metadata-Only Index Builder

**Files:**
- Modify: `packages/core/src/node0-space-index.js`
- Modify: `tests/node0-space-index.test.js`

**Interfaces:**
- Consumes: classifier and consent helper from Task 1.
- Produces: `buildNode0SpaceIndex(options)` in metadata mode and `verifyNode0SpaceIndex(envelope)`.

- [ ] **Step 1: Write failing metadata-mode tests**

Append:

```js
import { mkdtemp, mkdir, writeFile, symlink } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

import {
  buildNode0SpaceIndex,
  verifyNode0SpaceIndex,
} from "../packages/core/src/node0-space-index.js";

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
    now: new Date("2026-07-02T00:00:00.000Z"),
  });

  assert.equal(out.schema, "bizra.dema.node0_space_index.v0.1");
  assert.equal(out.truth_label, "NODE0_LOCAL_SEED");
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
  assert.ok(out.duplicate_candidate_groups.some((g) => g.group_type === "size_collision_weak" && g.content_confirmed === false));
  assert.deepEqual(verifyNode0SpaceIndex(out), { ok: true, errors: [] });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/node0-space-index.test.js`

Expected: FAIL because `buildNode0SpaceIndex` is missing.

- [ ] **Step 3: Implement metadata walk**

Extend `packages/core/src/node0-space-index.js` with:

```js
import { lstat, readdir, mkdir, readFile, writeFile, rename, chmod } from "node:fs/promises";
import { createReadStream } from "node:fs";
import { homedir } from "node:os";
import { dirname, isAbsolute, join, relative, resolve, sep } from "node:path";

const DEFAULT_LIMITS = Object.freeze({
  maxDepth: 30,
  maxEntries: 100000,
  maxBytesToHash: 512 * 1024 * 1024,
  maxMillis: 120000,
});

const DEFAULT_FS = Object.freeze({
  lstat,
  readdir,
  mkdir,
  readFile,
  writeFile,
  rename,
  chmod,
  createReadStream,
});

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function stableStringify(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const keys = Object.keys(value).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(",")}}`;
}

function pathInside(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function kindFromStat(stat) {
  if (stat.isSymbolicLink()) return "symlink";
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "file";
  return "other";
}

function safeIso(stat) {
  return stat?.mtime instanceof Date ? stat.mtime.toISOString() : null;
}

function node0Boundary({ checkpointWrite = false, hashContent = false } = {}) {
  return freezeDeep({
    filesystem_write_performed: checkpointWrite,
    checkpoint_write_performed: checkpointWrite,
    scanned_root_mutated: false,
    file_content_read: hashContent,
    content_hash_performed: hashContent,
    network_used: false,
    model_invocation_performed: false,
    delete_or_move_performed: false,
    receipt_mint_performed: false,
    federation_invoked: false,
  });
}

function defaultDemaHome() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

function buildDenied({ reason, absPath, root, kind }) {
  const rel = relative(root, absPath).split(sep).join("/");
  const name = basename(absPath);
  const contentClass = classifyNode0Content({ name, relativePath: rel, kind });
  return freezeDeep({
    reason,
    relative_path: rel,
    kind,
    content_class: contentClass,
    path_hash: sha256Text(resolve(absPath)),
  });
}

function shouldExcludeDirectory({ absPath, name, root, demaHome }) {
  const lower = name.toLowerCase();
  if ([".git", "node_modules", "target", "dist", "build", ".venv", "venv"].includes(lower)) {
    return "excluded_directory";
  }
  if (["models", "checkpoints", "voices"].includes(lower)) return "excluded_heavy_directory";
  const node0State = resolve(demaHome, "node0-index");
  if (pathInside(absPath, node0State) || absPath === node0State) {
    return "dema_node0_index_state";
  }
  if (!pathInside(absPath, root)) return "outside_root";
  return null;
}

function buildWeakSizeGroups(records) {
  const groups = new Map();
  for (const r of records) {
    if (r.kind !== "file" || r.size_bytes <= 0) continue;
    const key = `${r.size_bytes}`;
    const members = groups.get(key) || [];
    members.push(r.relative_path);
    groups.set(key, members);
  }
  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([size, members]) => freezeDeep({
      group_type: "size_collision_weak",
      confidence: "weak",
      content_confirmed: false,
      size_bytes: Number(size),
      members: members.sort(),
    }));
}

function summarize(records, denied, duplicateGroups, truncated) {
  const contentClasses = {};
  for (const r of records) contentClasses[r.content_class] = (contentClasses[r.content_class] || 0) + 1;
  for (const d of denied) contentClasses[d.content_class] = (contentClasses[d.content_class] || 0) + 1;
  return {
    contentClasses,
    summary: {
      records_count: records.length,
      files_count: records.filter((r) => r.kind === "file").length,
      dirs_count: records.filter((r) => r.kind === "directory").length,
      symlinks_count: records.filter((r) => r.kind === "symlink").length,
      denied_count: denied.length,
      duplicate_candidate_group_count: duplicateGroups.length,
      total_indexed_bytes: records.reduce((sum, r) => sum + (r.size_bytes || 0), 0),
      truncated,
    },
  };
}

export async function buildNode0SpaceIndex(options = {}) {
  const fs = { ...DEFAULT_FS, ...(options.fs || {}) };
  const rootInput = options.root;
  const now = options.now || new Date();
  const demaHome = resolve(options.demaHome || defaultDemaHome());
  const limits = Object.freeze({ ...DEFAULT_LIMITS, ...(options.limits || {}) });
  if (!rootInput) return buildErrorEnvelope({ rootInput, now, demaHome, limits, error: "root_missing" });
  const absRoot = resolve(rootInput);
  const rootHash = sha256Text(absRoot);

  let rootStat;
  try {
    rootStat = await fs.lstat(absRoot);
  } catch (err) {
    return buildErrorEnvelope({ rootInput, absRoot, now, demaHome, limits, error: err?.code === "EACCES" ? "permission_denied" : "root_missing" });
  }
  if (!rootStat.isDirectory()) {
    return buildErrorEnvelope({ rootInput, absRoot, now, demaHome, limits, error: "root_not_directory" });
  }

  const records = [];
  const denied = [];
  const warnings = [];
  const queue = [{ absPath: absRoot, depth: 0 }];
  const started = Date.now();
  let truncated = false;

  while (queue.length && !truncated) {
    const current = queue.shift();
    let entries = [];
    try {
      entries = await fs.readdir(current.absPath, { withFileTypes: true });
    } catch {
      warnings.push({ reason: "directory_read_failed", path_hash: sha256Text(current.absPath) });
      continue;
    }
    entries = entries.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (records.length + denied.length >= limits.maxEntries || Date.now() - started > limits.maxMillis) {
        truncated = true;
        break;
      }
      const absPath = resolve(join(current.absPath, entry.name));
      if (!pathInside(absPath, absRoot)) {
        denied.push(buildDenied({ reason: "outside_root", absPath, root: absRoot, kind: "other" }));
        continue;
      }
      let stat;
      try {
        stat = await fs.lstat(absPath);
      } catch {
        warnings.push({ reason: "entry_vanished", path_hash: sha256Text(absPath) });
        continue;
      }
      const kind = kindFromStat(stat);
      const rel = relative(absRoot, absPath).split(sep).join("/");
      const contentClass = classifyNode0Content({ name: entry.name, relativePath: rel, kind });
      const denyReason =
        contentClass === "secret_metadata_only"
          ? "secret_metadata_only"
          : kind === "directory"
            ? shouldExcludeDirectory({ absPath, name: entry.name, root: absRoot, demaHome })
            : null;
      if (denyReason) {
        denied.push(buildDenied({ reason: denyReason, absPath, root: absRoot, kind }));
        continue;
      }
      records.push(freezeDeep({
        relative_path: rel,
        kind,
        size_bytes: kind === "file" ? stat.size : 0,
        mtime_iso: safeIso(stat),
        extension: kind === "file" ? extname(entry.name).toLowerCase() : "",
        content_class: contentClass,
        path_hash: sha256Text(absPath),
        content_hash: null,
        hash_status: "not_requested",
        symlink_followed: false,
      }));
      if (kind === "directory" && current.depth < limits.maxDepth) {
        queue.push({ absPath, depth: current.depth + 1 });
      }
    }
  }

  const orderedRecords = records.slice().sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  const duplicateGroups = buildWeakSizeGroups(orderedRecords);
  const { contentClasses, summary } = summarize(orderedRecords, denied, duplicateGroups, truncated);
  return freezeDeep({
    schema: NODE0_SPACE_INDEX_SCHEMA,
    truth_label: NODE0_SPACE_INDEX_TRUTH_LABEL,
    mode: "metadata_only_index",
    generated_at_iso: now.toISOString(),
    root: {
      display: rootInput,
      normalized_path_hash: rootHash,
      hash_consent_phrase: buildNode0HashConsentPhrase(rootHash),
    },
    limits,
    checkpoint: { enabled: false, resumed: false, path_hash: null, checkpoint_hash: null },
    summary,
    content_classes: contentClasses,
    records: orderedRecords,
    denied,
    warnings,
    duplicate_candidate_groups: duplicateGroups,
    consent: {
      content_hash_required: false,
      required_phrase: buildNode0HashConsentPhrase(rootHash),
      provided: false,
      accepted: false,
    },
    blocked_effects: ["dedup_apply", "reorg_apply", "delete", "move", "network", "model", "mint", "federation"],
    boundary: node0Boundary(),
  });
}

function buildErrorEnvelope({ rootInput = null, absRoot = "", now, demaHome, limits, error }) {
  const rootHash = sha256Text(absRoot || rootInput || "");
  return freezeDeep({
    schema: NODE0_SPACE_INDEX_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED_UNAVAILABLE",
    mode: "metadata_only_index",
    generated_at_iso: now.toISOString(),
    root: {
      display: rootInput,
      normalized_path_hash: rootHash,
      hash_consent_phrase: buildNode0HashConsentPhrase(rootHash),
    },
    limits,
    checkpoint: { enabled: false, resumed: false, path_hash: null, checkpoint_hash: null },
    summary: { records_count: 0, files_count: 0, dirs_count: 0, symlinks_count: 0, denied_count: 0, duplicate_candidate_group_count: 0, total_indexed_bytes: 0, truncated: false },
    content_classes: {},
    records: [],
    denied: [],
    warnings: [{ reason: error }],
    duplicate_candidate_groups: [],
    consent: { content_hash_required: false, required_phrase: buildNode0HashConsentPhrase(rootHash), provided: false, accepted: false },
    blocked_effects: ["dedup_apply", "reorg_apply", "delete", "move", "network", "model", "mint", "federation"],
    boundary: node0Boundary(),
    error,
  });
}

export function verifyNode0SpaceIndex(envelope) {
  const errors = [];
  if (envelope?.schema !== NODE0_SPACE_INDEX_SCHEMA) errors.push("schema_mismatch");
  if (!String(envelope?.truth_label || "").startsWith("NODE0_LOCAL_SEED")) errors.push("truth_label_mismatch");
  if (!["metadata_only_index", "content_hash_index"].includes(envelope?.mode)) errors.push("mode_invalid");
  if (!envelope?.root?.hash_consent_phrase?.startsWith("I CONSENT: HASH NODE0 SPACE sha256:")) errors.push("consent_phrase_missing");
  if (envelope?.boundary?.scanned_root_mutated !== false) errors.push("scanned_root_mutated_not_false");
  if (envelope?.boundary?.network_used !== false) errors.push("network_used_not_false");
  return freezeDeep({ ok: errors.length === 0, errors });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/node0-space-index.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/node0-space-index.js tests/node0-space-index.test.js
git commit -m "feat: build metadata-only Node0 space index"
```

## Task 3: Exact Consent Hash Mode And Strong Duplicate Groups

**Files:**
- Modify: `packages/core/src/node0-space-index.js`
- Modify: `tests/node0-space-index.test.js`

**Interfaces:**
- Consumes: `buildNode0SpaceIndex`.
- Produces: content hash mode with exact phrase validation and strong duplicate groups.

- [ ] **Step 1: Write failing consent and hash tests**

Append:

```js
test("hash mode rejects broad consent before opening file bytes", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-index-consent-"));
  await writeFile(join(root, "a.txt"), "same\n");
  const out = await buildNode0SpaceIndex({
    root,
    hashContent: true,
    consentPhrase: "GO",
    checkpoint: false,
    now: new Date("2026-07-02T00:00:00.000Z"),
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
    now: new Date("2026-07-02T00:00:00.000Z"),
  });
  assert.equal(out.mode, "content_hash_index");
  assert.equal(out.consent.accepted, true);
  assert.equal(out.boundary.file_content_read, true);
  assert.equal(out.boundary.content_hash_performed, true);
  assert.ok(out.records.filter((r) => r.content_hash).length >= 2);
  assert.ok(out.denied.some((d) => d.reason === "secret_metadata_only"));
  assert.ok(out.duplicate_candidate_groups.some((g) => g.group_type === "content_hash_match" && g.confidence === "strong" && g.content_confirmed === true));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/node0-space-index.test.js`

Expected: FAIL because hash mode currently returns metadata output.

- [ ] **Step 3: Add hash-mode validation and stream hashing**

Extend the core:

```js
async function sha256File({ absPath, fs, maxBytes }) {
  const hash = createHash("sha256");
  let bytes = 0;
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = fs.createReadStream(absPath);
    stream.on("data", (chunk) => {
      bytes += chunk.length;
      if (bytes > maxBytes) {
        stream.destroy(new Error("hash_byte_limit_exceeded"));
        return;
      }
      hash.update(chunk);
    });
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
  });
  return `sha256:${hash.digest("hex")}`;
}

function buildStrongHashGroups(records) {
  const groups = new Map();
  for (const r of records) {
    if (!r.content_hash) continue;
    const members = groups.get(r.content_hash) || [];
    members.push(r.relative_path);
    groups.set(r.content_hash, members);
  }
  return [...groups.entries()]
    .filter(([, members]) => members.length > 1)
    .map(([hash, members]) => freezeDeep({
      group_type: "content_hash_match",
      confidence: "strong",
      content_confirmed: true,
      content_hash: hash,
      members: members.sort(),
    }));
}
```

Add a shared envelope helper before `buildNode0SpaceIndex`:

```js
function assembleEnvelope({
  rootInput,
  rootHash,
  now,
  limits,
  checkpointInfo,
  summary,
  contentClasses,
  records,
  denied,
  warnings,
  duplicateGroups,
  mode,
  hashContent,
  consentRequired,
  consentProvided,
  consentAccepted,
  checkpointWrite,
  error = null,
}) {
  return freezeDeep({
    schema: NODE0_SPACE_INDEX_SCHEMA,
    truth_label: NODE0_SPACE_INDEX_TRUTH_LABEL,
    mode,
    generated_at_iso: now.toISOString(),
    root: {
      display: rootInput,
      normalized_path_hash: rootHash,
      hash_consent_phrase: consentRequired,
    },
    limits,
    checkpoint: checkpointInfo,
    summary,
    content_classes: contentClasses,
    records,
    denied,
    warnings,
    duplicate_candidate_groups: duplicateGroups,
    consent: {
      content_hash_required: hashContent === true,
      required_phrase: consentRequired,
      provided: Boolean(consentProvided),
      accepted: consentAccepted === true,
    },
    blocked_effects: ["dedup_apply", "reorg_apply", "delete", "move", "network", "model", "mint", "federation"],
    boundary: node0Boundary({ checkpointWrite, hashContent: hashContent === true && consentAccepted === true }),
    ...(error ? { error } : {}),
  });
}
```

Then update `buildNode0SpaceIndex` after metadata records are built:

```js
const consentRequired = buildNode0HashConsentPhrase(rootHash);
const metadataEnvelope = assembleEnvelope({
  rootInput,
  rootHash,
  now,
  limits,
  checkpointInfo: { enabled: false, resumed: false, path_hash: null, checkpoint_hash: null },
  summary,
  contentClasses,
  records: orderedRecords,
  denied,
  warnings,
  duplicateGroups,
  mode: "metadata_only_index",
  hashContent: false,
  consentRequired,
  consentProvided: options.consentPhrase,
  consentAccepted: false,
  checkpointWrite: false,
});

if (options.hashContent === true && options.consentPhrase !== consentRequired) {
  return freezeDeep({
    ...metadataEnvelope,
    error: "hash_consent_phrase_mismatch",
    consent: {
      content_hash_required: true,
      required_phrase: consentRequired,
      provided: Boolean(options.consentPhrase),
      accepted: false,
    },
  });
}

if (options.hashContent === true) {
  const hashedRecords = [];
  for (const record of orderedRecords) {
    if (record.kind !== "file" || record.content_class === "secret_metadata_only") {
      hashedRecords.push(record);
      continue;
    }
    const absPath = resolve(join(absRoot, record.relative_path));
    try {
      hashedRecords.push(freezeDeep({
        ...record,
        content_hash: await sha256File({ absPath, fs, maxBytes: limits.maxBytesToHash }),
        hash_status: "hashed",
      }));
    } catch {
      hashedRecords.push(freezeDeep({ ...record, content_hash: null, hash_status: "unavailable" }));
    }
  }
  const strongGroups = buildStrongHashGroups(hashedRecords);
  const hashedSummaryParts = summarize(hashedRecords, denied, strongGroups, summary.truncated);
  return assembleEnvelope({
    rootInput,
    rootHash,
    now,
    limits,
    checkpointInfo: { enabled: false, resumed: false, path_hash: null, checkpoint_hash: null },
    summary: hashedSummaryParts.summary,
    contentClasses: hashedSummaryParts.contentClasses,
    mode: "content_hash_index",
    records: hashedRecords,
    denied,
    warnings,
    duplicateGroups: strongGroups,
    hashContent: true,
    consentRequired,
    consentProvided: options.consentPhrase,
    consentAccepted: true,
    checkpointWrite: false,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/node0-space-index.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/node0-space-index.js tests/node0-space-index.test.js
git commit -m "feat: add consent-bound Node0 content hashing"
```

## Task 4: Checkpoint Persistence And Resume Guard

**Files:**
- Modify: `packages/core/src/node0-space-index.js`
- Modify: `tests/node0-space-index.test.js`

**Interfaces:**
- Produces checkpoint write/read under `$DEMA_HOME/node0-index/checkpoints/`.
- Checkpoint compatibility binds schema, mode, root hash, and consent phrase.

- [ ] **Step 1: Write failing checkpoint tests**

Append:

```js
test("checkpoint writes only under DEMA_HOME and boundary reports it", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-index-root-"));
  const demaHome = await mkdtemp(join(tmpdir(), "dema-node0-index-home-"));
  await writeFile(join(root, "a.md"), "alpha\n");

  const out = await buildNode0SpaceIndex({
    root,
    demaHome,
    checkpoint: true,
    now: new Date("2026-07-02T00:00:00.000Z"),
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
  assert.equal(out.records.some((r) => r.relative_path.includes("node0-index/checkpoints")), false);
  assert.ok(out.denied.some((d) => d.reason === "dema_node0_index_state"));
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/node0-space-index.test.js`

Expected: FAIL because checkpoint fields are not persisted.

- [ ] **Step 3: Implement checkpoint writer**

Add:

```js
function checkpointPath({ demaHome, rootHash, mode }) {
  const safe = rootHash.replace(/^sha256:/, "");
  return join(demaHome, "node0-index", "checkpoints", `${mode}-${safe}.json`);
}

async function writeCheckpoint({ fs, demaHome, rootHash, envelope }) {
  const path = checkpointPath({ demaHome, rootHash, mode: envelope.mode });
  const checkpoint = freezeDeep({
    schema: "bizra.dema.node0_space_index_checkpoint.v0.1",
    root_hash: rootHash,
    mode: envelope.mode,
    consent_phrase: envelope.consent.required_phrase,
    complete: true,
    records_count: envelope.records.length,
    denied_count: envelope.denied.length,
    envelope_hash: sha256Text(stableStringify({ ...envelope, checkpoint: null })),
  });
  await fs.mkdir(dirname(path), { recursive: true, mode: 0o700 });
  const tmp = `${path}.${process.pid}.tmp`;
  await fs.writeFile(tmp, `${JSON.stringify(checkpoint, null, 2)}\n`, "utf8");
  await fs.chmod(tmp, 0o600);
  await fs.rename(tmp, path);
  await fs.chmod(path, 0o600);
  return freezeDeep({
    enabled: true,
    resumed: false,
    complete: true,
    path_hash: sha256Text(path),
    checkpoint_hash: sha256Text(stableStringify(checkpoint)),
  });
}
```

In `buildNode0SpaceIndex`, when `options.checkpoint !== false`, write the checkpoint after assembling the envelope, then return a copy with:

```js
checkpoint: checkpointResult,
boundary: node0Boundary({
  checkpointWrite: true,
  hashContent: finalEnvelope.mode === "content_hash_index",
})
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/node0-space-index.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/node0-space-index.js tests/node0-space-index.test.js
git commit -m "feat: checkpoint Node0 space index progress"
```

## Task 5: CLI Command And Dispatcher Wiring

**Files:**
- Create: `apps/cli/src/commands/node0-index.js`
- Modify: `apps/cli/src/index.js`
- Modify: `packages/core/src/cli-consent-matrix-entries.js`
- Modify: `tests/node0-space-index.test.js`
- Modify: `tests/cli-command-table.test.js`

**Interfaces:**
- Consumes: core builder and renderer.
- Produces: `dema node0-index --root <path> [--hash-content --consent "..."] [--json]`.

- [ ] **Step 1: Write failing CLI tests**

Append:

```js
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

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
  assert.equal(out.schema, "bizra.dema.node0_space_index.v0.1");
  assert.equal(out.mode, "metadata_only_index");
  assert.equal(out.root.hash_consent_phrase, `I CONSENT: HASH NODE0 SPACE ${out.root.normalized_path_hash}`);
});

test("CLI node0-index human output prints ready-to-copy hash consent phrase", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-index-cli-human-"));
  const demaHome = await mkdtemp(join(tmpdir(), "dema-node0-index-cli-home-"));
  await writeFile(join(root, "a.md"), "alpha\n");

  const stdout = execFileSync(
    process.execPath,
    [CLI, "node0-index", "--root", root],
    { encoding: "utf8", env: { ...process.env, DEMA_HOME: demaHome } },
  );
  assert.match(stdout, /DEMA NODE0 SPACE INDEX/);
  assert.match(stdout, /I CONSENT: HASH NODE0 SPACE sha256:/);
  assert.match(stdout, /Weak duplicate candidates:/);
});
```

Update `tests/cli-command-table.test.js`:

```js
// Add "node0-index" to COMMAND_SURFACE.
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/node0-space-index.test.js tests/cli-command-table.test.js`

Expected: FAIL because the CLI command is not wired.

- [ ] **Step 3: Add CLI command**

Create `apps/cli/src/commands/node0-index.js`:

```js
import {
  buildNode0SpaceIndex,
  renderNode0SpaceIndexSummary,
} from "../../../../packages/core/src/node0-space-index.js";
import { wantsJson } from "../../../../packages/core/src/output-mode.js";

function argValue(argv, name) {
  const index = argv.indexOf(name);
  return index >= 0 ? argv[index + 1] : undefined;
}

function fail(argv, message) {
  const payload = {
    schema: "bizra.dema.node0_space_index_cli_error.v0.1",
    truth_label: "NODE0_LOCAL_SEED_UNAVAILABLE",
    error: message,
  };
  if (wantsJson(argv)) console.log(JSON.stringify(payload, null, 2));
  else console.error(`Dema node0-index: ${message}`);
  process.exitCode = 1;
  process.exit(process.exitCode);
}

export async function cmd_node0_index(ctx) {
  const argv = ctx.argv || [];
  const root = argValue(argv, "--root");
  if (!root) fail(argv, "missing_root");

  const out = await buildNode0SpaceIndex({
    root,
    hashContent: argv.includes("--hash-content"),
    consentPhrase: argValue(argv, "--consent") || "",
    demaHome: process.env.DEMA_HOME,
    checkpoint: !argv.includes("--no-checkpoint"),
  });

  if (wantsJson(argv)) console.log(JSON.stringify(out, null, 2));
  else console.log(renderNode0SpaceIndexSummary(out));

  process.exitCode = out.error ? 1 : 0;
  process.exit(process.exitCode);
}
```

Add renderer to core:

```js
export function renderNode0SpaceIndexSummary(envelope) {
  if (!envelope || envelope.schema !== NODE0_SPACE_INDEX_SCHEMA) {
    return "DEMA NODE0 SPACE INDEX\nstatus: invalid";
  }
  return [
    "DEMA NODE0 SPACE INDEX",
    `truth: ${envelope.truth_label} · mode: ${envelope.mode}`,
    `records: ${envelope.summary.records_count} · files: ${envelope.summary.files_count} · dirs: ${envelope.summary.dirs_count} · symlinks: ${envelope.summary.symlinks_count}`,
    `denied: ${envelope.summary.denied_count} · bytes: ${envelope.summary.total_indexed_bytes}`,
    `Weak duplicate candidates: ${envelope.duplicate_candidate_groups.filter((g) => g.group_type === "size_collision_weak").length}`,
    `Hash consent phrase: ${envelope.root.hash_consent_phrase}`,
    "Boundary: scanned root unmutated · symlinks not followed · no network · no model · no mint",
  ].join("\n");
}
```

Wire `apps/cli/src/index.js`:

```js
import { cmd_node0_index } from "./commands/node0-index.js";
```

Add help block:

```text
Node0 onboarding:
  dema node0-index --root <path> [--json]
                    Metadata-only Node0 space census. Prints exact hash-consent
                    phrase for optional --hash-content deep scan.
```

Add command table row:

```js
"node0-index": cmd_node0_index,
```

Update `packages/core/src/cli-consent-matrix-entries.js`:

```js
row(
  "node0-index",
  ["read_only", "preview_only", "content_read", "local_write"],
  "exact_phrase",
  "Metadata-only index is default; --hash-content requires I CONSENT: HASH NODE0 SPACE <root_hash>; checkpoints write only under DEMA_HOME/node0-index/checkpoints",
  ["tests/node0-space-index.test.js"],
),
```

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/node0-space-index.test.js tests/cli-command-table.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/cli/src/commands/node0-index.js apps/cli/src/index.js packages/core/src/cli-consent-matrix-entries.js tests/node0-space-index.test.js tests/cli-command-table.test.js packages/core/src/node0-space-index.js
git commit -m "feat: add node0-index CLI"
```

## Task 6: Documentation, Review Gate, And Full Verification

**Files:**
- Modify: `docs/ARCHITECTURE.md`
- Modify: `docs/TESTING.md`
- Modify: `docs/CURRENT_LIMITS.md`
- Create: `scripts/review/node0-space-index-check.mjs`
- Modify: `scripts/check.mjs`

**Interfaces:**
- Produces a review gate that validates fixture behavior and command wiring without scanning the real Node0 root.

- [ ] **Step 1: Write review gate**

Create `scripts/review/node0-space-index-check.mjs`:

```js
#!/usr/bin/env node
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildNode0SpaceIndex,
  verifyNode0SpaceIndex,
} from "../../packages/core/src/node0-space-index.js";

export async function runNode0SpaceIndexCheck() {
  const root = await mkdtemp(join(tmpdir(), "dema-node0-space-index-check-"));
  const demaHome = await mkdtemp(join(tmpdir(), "dema-node0-space-index-home-"));
  await mkdir(join(root, "docs"));
  await writeFile(join(root, "docs", "a.md"), "same\n");
  await writeFile(join(root, "docs", "b.md"), "same\n");
  await writeFile(join(root, ".env"), "SECRET=never-read\n");

  const metadata = await buildNode0SpaceIndex({ root, demaHome });
  const hashed = await buildNode0SpaceIndex({
    root,
    demaHome,
    hashContent: true,
    consentPhrase: metadata.root.hash_consent_phrase,
  });
  const failures = [];
  if (!verifyNode0SpaceIndex(metadata).ok) failures.push("metadata_verify_failed");
  if (metadata.boundary.file_content_read !== false) failures.push("metadata_read_content");
  if (!metadata.root.hash_consent_phrase.includes(metadata.root.normalized_path_hash)) failures.push("consent_phrase_not_bound");
  if (!metadata.duplicate_candidate_groups.some((g) => g.group_type === "size_collision_weak")) failures.push("weak_size_group_missing");
  if (hashed.mode !== "content_hash_index") failures.push("hash_mode_missing");
  if (!hashed.duplicate_candidate_groups.some((g) => g.group_type === "content_hash_match")) failures.push("strong_hash_group_missing");
  if (!hashed.denied.some((d) => d.content_class === "secret_metadata_only")) failures.push("secret_denial_missing");

  return {
    gate: "DEMA-NODE0-SPACE-INDEX-1A",
    status: failures.length ? "FAIL" : "PASS",
    failures,
    metadata_records: metadata.summary.records_count,
    weak_duplicate_groups: metadata.duplicate_candidate_groups.length,
    strong_duplicate_groups: hashed.duplicate_candidate_groups.length,
    no_network: metadata.boundary.network_used === false && hashed.boundary.network_used === false,
    no_mint: metadata.boundary.receipt_mint_performed === false && hashed.boundary.receipt_mint_performed === false,
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  runNode0SpaceIndexCheck()
    .then((report) => {
      console.log(JSON.stringify(report, null, 2));
      process.exit(report.status === "PASS" ? 0 : 1);
    })
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
```

- [ ] **Step 2: Wire review gate and docs**

Add to `scripts/check.mjs`:

```js
["node", ["scripts/review/node0-space-index-check.mjs"]],
```

Add to `docs/ARCHITECTURE.md` command table:

```markdown
| `dema node0-index --root <path>` | `packages/core/src/node0-space-index.js` + `apps/cli/src/commands/node0-index.js` | DEMA-NODE0-SPACE-INDEX-1A local Node0 onboarding census (`bizra.dema.node0_space_index.v0.1`, `NODE0_LOCAL_SEED`); metadata-only by default, prints exact content-hash consent phrase, emits weak size-collision duplicate candidates, optionally hashes contents after exact consent; no scan-root mutation, symlink follow, network, model, mint, dedup apply, delete, or move. |
```

Add to `docs/TESTING.md`:

```markdown
| `tests/node0-space-index.test.js` | DEMA-NODE0-SPACE-INDEX-1A Node0 onboarding census: metadata-only index by default, exact root-hash consent for content hashing, weak size-collision duplicate candidates, strong hash duplicate candidates only after consent, checkpoint writes under `DEMA_HOME/node0-index/checkpoints`, secret paths never opened, symlinks never followed, CLI JSON/human outputs, command-table coverage. |
```

Add to `docs/CURRENT_LIMITS.md`:

```markdown
| Node0 space index onboarding census (DEMA-NODE0-SPACE-INDEX-1A) | `packages/core/src/node0-space-index.js` + `tests/node0-space-index.test.js` | Local-only metadata census; optional content hashing requires exact root-bound consent. It does not delete, move, reorganize, upload, summarize content, invoke SAT, mint, connect nodes, or mutate the scanned root. |
```

- [ ] **Step 3: Run full verification**

Run:

```bash
node --test tests/node0-space-index.test.js
node scripts/review/node0-space-index-check.mjs
npm run llm:guidance
git diff --check
npm test
npm run check
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit**

```bash
git add docs/ARCHITECTURE.md docs/TESTING.md docs/CURRENT_LIMITS.md scripts/check.mjs scripts/review/node0-space-index-check.mjs
git commit -m "docs: document Node0 space index proof"
```

## Self-Review

Spec coverage:

- Metadata-only default: Task 2.
- Exact hash consent and copy-ready phrase: Tasks 1, 3, and 5.
- Weak size-collision candidates in metadata mode: Task 2.
- Strong content-hash duplicate groups only after consent: Task 3.
- Secret metadata-only denial: Tasks 1, 2, 3, and 6.
- Symlinks recorded and not followed: Task 2.
- `$DEMA_HOME/node0-index/` traversal exclusion: Task 4.
- Checkpoint writes under DEMA_HOME only: Task 4.
- CLI command, matrix, and docs: Tasks 5 and 6.
- No network/model/mint/delete/move/reorg/SAT: boundary and docs in Tasks 2, 5, and 6.

Placeholder scan target:

```bash
rg -n -e 'TB''D|TO''DO|implement ''later|fill ''in|appropriate ''error|place''holder|similar ''to Task' docs/superpowers/plans/2026-07-02-dema-node0-space-index-1a.md
```

Expected: no matches.

Type consistency:

- `buildNode0SpaceIndex(options)` returns an envelope used by CLI, tests, and review gate.
- `root.normalized_path_hash` is the exact string embedded by `root.hash_consent_phrase`.
- `duplicate_candidate_groups[].group_type` is either `size_collision_weak` or `content_hash_match`.
- `boundary.file_content_read` and `boundary.content_hash_performed` are true only in accepted hash mode.

Execution note:

After this plan is approved, execute Task 1 first and stop after each commit-level task if focused verification fails. Do not run the command on the real Node0 root until fixture tests and the review gate are green.
