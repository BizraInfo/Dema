// B1A · Dema Local Asset Awareness inventory scanner.
//
// Metadata-only. Reads directory entries and lstat metadata, never file
// contents, never follows symlinks, never mutates the scanned root. The only
// write path is the explicit inventory artifact under DEMA_HOME.

import {
  chmod,
  lstat,
  mkdir,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import {
  basename,
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from "node:path";
import { homedir } from "node:os";
import { createHash } from "node:crypto";

export const LOCAL_ASSET_INVENTORY_SCHEMA =
  "bizra.dema.local_asset_awareness_inventory.v0.1";

export const LOCAL_ASSET_INVENTORY_WRITE_RESULT_SCHEMA =
  "bizra.dema.local_asset_awareness_write_result.v0.1";

const DEFAULT_MAX_DEPTH = 2;
const DEFAULT_MAX_ENTRIES = 5000;

const DEFAULT_FS = Object.freeze({
  lstat,
  readdir,
  mkdir,
  writeFile,
  rename,
  chmod,
});

const DENY_DIR_NAMES = new Set([
  ".git",
  ".svn",
  ".hg",
  "node_modules",
  ".venv",
  "venv",
  "target",
  "dist",
  "build",
  ".ssh",
  ".gnupg",
]);

const CODE_MANIFESTS = new Set(["package.json", "pyproject.toml", "cargo.toml"]);
const DOCUMENT_EXTS = new Set([".md", ".txt", ".pdf", ".docx", ".csv", ".xlsx"]);
const MEDIA_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".mp4",
  ".mov",
  ".mp3",
  ".wav",
]);
const ARCHIVE_EXTS = new Set([".zip", ".tar", ".gz", ".tgz", ".7z", ".rar"]);
const DATASET_EXTS = new Set([".jsonl", ".parquet", ".sqlite", ".db", ".ndjson"]);
const MODEL_EXTS = new Set([".gguf", ".safetensors", ".onnx", ".pt", ".pth", ".bin"]);

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

function defaultRoot() {
  return process.env.DEMA_LOCAL_ASSET_ROOT || join(homedir(), "Downloads");
}

function defaultDemaHome() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
}

export function defaultLocalAssetInventoryPath(demaHome = defaultDemaHome()) {
  return join(demaHome, "realm", "local-assets", "inventory-v0.1.json");
}

function pathInside(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function displayRoot(root, absRoot) {
  const home = homedir();
  if (absRoot === join(home, "Downloads")) return "~/Downloads";
  return root;
}

function boundary(fileWritePerformed = false) {
  return Object.freeze({
    file_write_performed: fileWritePerformed,
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
  });
}

function safeIso(stat) {
  return stat?.mtime instanceof Date ? stat.mtime.toISOString() : null;
}

function kindFromStat(stat) {
  if (stat.isSymbolicLink()) return "symlink";
  if (stat.isDirectory()) return "directory";
  if (stat.isFile()) return "file";
  return "other";
}

function denyReason(name, kind) {
  const lower = name.toLowerCase();
  if (kind === "directory" && DENY_DIR_NAMES.has(lower)) {
    return "denylisted_directory";
  }
  if (kind === "directory" && /wallet/.test(lower)) {
    return "wallet_or_secret_directory";
  }
  if (lower === ".env" || lower.startsWith(".env.")) return "secret_or_key_pattern";
  if (name.startsWith(".")) {
    return kind === "directory" ? "hidden_directory_skipped" : "hidden_file_skipped";
  }
  if (/(secret|credential|password|token)/.test(lower)) {
    return "secret_or_key_pattern";
  }
  if (
    /\.(pem|key|p12|pfx)$/i.test(name) ||
    /^id_rsa/i.test(name) ||
    /^id_ed25519/i.test(name)
  ) {
    return "secret_or_key_pattern";
  }
  return null;
}

function deniedEntry(reason, absolutePath, kind) {
  return Object.freeze({
    reason,
    path_hash: `sha256:${sha256(resolve(absolutePath))}`,
    kind,
  });
}

export function classifyLocalAsset(record) {
  const rel = String(record?.relative_path || "").toLowerCase();
  const name = String(record?.name || "").toLowerCase();
  const ext = String(record?.extension || "").toLowerCase();
  if (CODE_MANIFESTS.has(name) || /\.(js|mjs|cjs|ts|tsx|py|rs|go)$/i.test(name)) {
    return "code_project";
  }
  if (/(receipt|proof|attestation)/.test(rel) && [".json", ".md", ".pdf"].includes(ext)) {
    return "receipt_or_proof";
  }
  if (MODEL_EXTS.has(ext)) return "model_artifact";
  if (DATASET_EXTS.has(ext)) return "dataset";
  if (MEDIA_EXTS.has(ext)) return "media";
  if (ARCHIVE_EXTS.has(ext)) return "archive";
  if (DOCUMENT_EXTS.has(ext)) return "document";
  return "unknown";
}

function makeRecord({ absPath, root, stat, kind }) {
  const relativePath = relative(root, absPath).split(sep).join("/");
  const name = basename(absPath);
  const extension = kind === "directory" ? "" : extname(name).toLowerCase();
  const base = {
    kind,
    name,
    relative_path: relativePath,
    extension,
    size_bytes: kind === "file" ? stat.size : 0,
    mtime_iso: safeIso(stat),
    risk_flags: [],
    content_hash: null,
    content_preview: null,
  };
  const category = classifyLocalAsset(base);
  return Object.freeze({
    record_id: `sha256:${sha256(
      stableStringify({
        relative_path: base.relative_path,
        kind: base.kind,
        extension: base.extension,
        size_bytes: base.size_bytes,
        mtime_iso: base.mtime_iso,
        category,
      }),
    )}`,
    category,
    ...base,
  });
}

function emptyInventory({
  root,
  absRoot,
  now,
  error,
  exists,
  limits,
  valid = false,
}) {
  return freezeDeep({
    schema: LOCAL_ASSET_INVENTORY_SCHEMA,
    truth_label: exists ? "LOCAL_METADATA_MEASURED" : "LOCAL_METADATA_UNAVAILABLE",
    mode: "metadata_only",
    valid,
    error,
    generated_at_iso: now.toISOString(),
    root: {
      display: displayRoot(root, absRoot),
      path_hash: `sha256:${sha256(absRoot)}`,
      exists,
    },
    limits,
    summary: {
      records_count: 0,
      files_count: 0,
      dirs_count: 0,
      symlinks_count: 0,
      denied_count: 0,
      truncated: false,
    },
    categories: {},
    records: [],
    denied: [],
    warnings: [],
    boundary: boundary(false),
  });
}

function summarize(records, denied, truncated) {
  const categories = {};
  for (const record of records) {
    categories[record.category] = (categories[record.category] ?? 0) + 1;
  }
  return {
    categories,
    summary: {
      records_count: records.length,
      files_count: records.filter((r) => r.kind === "file").length,
      dirs_count: records.filter((r) => r.kind === "directory").length,
      symlinks_count: records.filter((r) => r.kind === "symlink").length,
      denied_count: denied.length,
      truncated,
    },
  };
}

export async function buildLocalAssetInventory(options = {}) {
  const fs = { ...DEFAULT_FS, ...(options.fs || {}) };
  const root = options.root || process.env.DEMA_LOCAL_ASSET_ROOT || defaultRoot();
  const now = options.now || new Date();
  const absRoot = resolve(root);
  const limits = Object.freeze({
    max_depth: options.limits?.maxDepth ?? DEFAULT_MAX_DEPTH,
    max_entries: options.limits?.maxEntries ?? DEFAULT_MAX_ENTRIES,
    follow_symlinks: false,
  });

  let rootStat;
  try {
    rootStat = await fs.lstat(absRoot);
  } catch (err) {
    const error = err?.code === "EACCES" ? "permission_denied" : "root_missing";
    return emptyInventory({
      root,
      absRoot,
      now,
      error,
      exists: false,
      limits,
    });
  }
  if (!rootStat.isDirectory()) {
    return emptyInventory({
      root,
      absRoot,
      now,
      error: "root_not_directory",
      exists: true,
      limits,
    });
  }

  const records = [];
  const denied = [];
  const warnings = [];
  const queue = [{ path: absRoot, depth: 0 }];
  let truncated = false;

  while (queue.length > 0 && !truncated) {
    const current = queue.shift();
    let entries;
    try {
      entries = await fs.readdir(current.path, { withFileTypes: true });
    } catch (err) {
      if (current.path === absRoot && err?.code === "EACCES") {
        return emptyInventory({
          root,
          absRoot,
          now,
          error: "permission_denied",
          exists: true,
          limits,
        });
      }
      warnings.push("directory_read_failed");
      continue;
    }

    entries = entries.slice().sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      if (records.length + denied.length >= limits.max_entries) {
        truncated = true;
        break;
      }
      const absPath = resolve(join(current.path, entry.name));
      if (!pathInside(absPath, absRoot)) {
        denied.push(deniedEntry("outside_root", absPath, "other"));
        continue;
      }
      const entryKind = entry.isDirectory()
        ? "directory"
        : entry.isSymbolicLink()
          ? "symlink"
          : entry.isFile()
            ? "file"
            : "other";
      const reason = denyReason(entry.name, entryKind);
      if (reason) {
        denied.push(deniedEntry(reason, absPath, entryKind));
        continue;
      }

      let stat;
      try {
        stat = await fs.lstat(absPath);
      } catch {
        warnings.push("entry_vanished");
        continue;
      }
      const kind = kindFromStat(stat);
      const record = makeRecord({ absPath, root: absRoot, stat, kind });
      records.push(record);
      if (kind === "directory" && current.depth < limits.max_depth) {
        queue.push({ path: absPath, depth: current.depth + 1 });
      }
    }
  }

  const orderedRecords = records
    .slice()
    .sort((a, b) => a.relative_path.localeCompare(b.relative_path));
  const { categories, summary } = summarize(orderedRecords, denied, truncated);
  return freezeDeep({
    schema: LOCAL_ASSET_INVENTORY_SCHEMA,
    truth_label: "LOCAL_METADATA_MEASURED",
    mode: "metadata_only",
    valid: true,
    error: null,
    generated_at_iso: now.toISOString(),
    root: {
      display: displayRoot(root, absRoot),
      path_hash: `sha256:${sha256(absRoot)}`,
      exists: true,
    },
    limits,
    summary,
    categories,
    records: orderedRecords,
    denied,
    warnings,
    boundary: boundary(false),
  });
}

function withWriteBoundary(inventory) {
  return freezeDeep({
    ...inventory,
    boundary: boundary(true),
  });
}

function inventoryId(inventory) {
  return `sha256:${sha256(stableStringify(inventory))}`;
}

export async function writeLocalAssetInventory(options = {}) {
  const fs = { ...DEFAULT_FS, ...(options.fs || {}) };
  const demaHome = resolve(options.demaHome || defaultDemaHome());
  const artifactPath = resolve(
    options.artifactPath || defaultLocalAssetInventoryPath(demaHome),
  );
  if (!pathInside(artifactPath, demaHome)) {
    return freezeDeep({
      schema: LOCAL_ASSET_INVENTORY_WRITE_RESULT_SCHEMA,
      truth_label: "LOCAL_ASSET_INVENTORY_NOT_WRITTEN",
      written: false,
      error: "artifact_path_outside_dema_home",
      artifact_path: artifactPath,
      boundary: boundary(false),
    });
  }

  const built = await buildLocalAssetInventory({ ...options, fs });
  if (!built.valid && options.writeFailureArtifact !== true) {
    return freezeDeep({
      schema: LOCAL_ASSET_INVENTORY_WRITE_RESULT_SCHEMA,
      truth_label: "LOCAL_ASSET_INVENTORY_NOT_WRITTEN",
      written: false,
      error: built.error,
      artifact_path: artifactPath,
      inventory: built,
      boundary: boundary(false),
    });
  }

  const inventory = withWriteBoundary(built);
  const dir = dirname(artifactPath);
  await fs.mkdir(dir, { recursive: true, mode: 0o700 });
  const tmpPath = join(dir, `.${basename(artifactPath)}.${process.pid}.tmp`);
  await fs.writeFile(tmpPath, `${JSON.stringify(inventory, null, 2)}\n`, "utf8");
  await fs.chmod(tmpPath, 0o600);
  await fs.rename(tmpPath, artifactPath);
  await fs.chmod(artifactPath, 0o600);

  return freezeDeep({
    schema: LOCAL_ASSET_INVENTORY_WRITE_RESULT_SCHEMA,
    truth_label: "LOCAL_ASSET_INVENTORY_WRITTEN",
    artifact_path: artifactPath,
    written: true,
    inventory_id: inventoryId(inventory),
    inventory,
    boundary: boundary(true),
  });
}

export function renderLocalAssetInventorySummary(result) {
  const inventory = result?.inventory || result;
  if (!inventory || inventory.schema !== LOCAL_ASSET_INVENTORY_SCHEMA) {
    return "Dema local assets: invalid inventory";
  }
  const lines = [
    "DEMA LOCAL ASSETS · INVENTORY",
    `truth: ${inventory.truth_label} · mode: ${inventory.mode}`,
    `root: ${inventory.root.display}`,
    `records: ${inventory.summary.records_count} · files: ${inventory.summary.files_count} · dirs: ${inventory.summary.dirs_count} · symlinks: ${inventory.summary.symlinks_count}`,
    `denied: ${inventory.summary.denied_count} · truncated: ${inventory.summary.truncated}`,
  ];
  const categories = Object.entries(inventory.categories)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([k, v]) => `${k}=${v}`)
    .join(", ");
  if (categories) lines.push(`categories: ${categories}`);
  if (result?.artifact_path) lines.push(`artifact: ${result.artifact_path}`);
  lines.push(
    "Boundary: metadata-only · no content · no symlink follow · no network · no scanned-root mutation",
  );
  return lines.join("\n");
}
