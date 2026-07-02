import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import {
  chmod,
  lstat,
  mkdir,
  readdir,
  rename,
  writeFile,
} from "node:fs/promises";
import { homedir } from "node:os";
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

export const NODE0_SPACE_INDEX_SCHEMA = "bizra.dema.node0_space_index.v0.1";
export const NODE0_SPACE_INDEX_TRUTH_LABEL = "NODE0_LOCAL_SEED";

const CODE_EXTS = new Set([
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".py",
  ".rs",
  ".go",
  ".java",
  ".sh",
]);
const DOC_EXTS = new Set([".md", ".txt", ".pdf", ".doc", ".docx", ".rtf"]);
const DATA_EXTS = new Set([
  ".json",
  ".jsonl",
  ".ndjson",
  ".csv",
  ".tsv",
  ".yaml",
  ".yml",
  ".toml",
  ".xml",
  ".sqlite",
  ".db",
  ".parquet",
]);
const MEDIA_EXTS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".mp3",
  ".wav",
  ".m4a",
  ".mp4",
  ".mov",
  ".webm",
]);
const ARCHIVE_EXTS = new Set([".zip", ".tar", ".gz", ".tgz", ".7z", ".rar"]);
const MODEL_EXTS = new Set([".gguf", ".safetensors", ".onnx", ".pt", ".pth"]);
const BINARY_EXTS = new Set([".bin", ".exe", ".dll", ".so", ".dylib"]);
const CODE_MANIFESTS = new Set(["package.json", "pyproject.toml", "cargo.toml"]);
const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "target",
  "dist",
  "build",
  ".venv",
  "venv",
]);
const HEAVY_DIRS = new Set(["models", "checkpoints", "voices"]);
const BLOCKED_EFFECTS = Object.freeze([
  "dedup_apply",
  "reorg_apply",
  "delete",
  "move",
  "hardlink",
  "network",
  "model",
  "mint",
  "wallet",
  "federation",
  "sat_submission",
]);
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
  writeFile,
  rename,
  chmod,
  createReadStream,
});

export function sha256Text(value) {
  return `sha256:${createHash("sha256").update(String(value)).digest("hex")}`;
}

export function buildNode0HashConsentPhrase(rootHash) {
  return `I CONSENT: HASH NODE0 SPACE ${rootHash}`;
}

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
  return `{${keys.map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

function defaultDemaHome() {
  return process.env.DEMA_HOME || join(homedir(), ".dema");
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

function secretLike(name, relativePath) {
  const raw = `${relativePath || ""}/${name || ""}`.toLowerCase();
  const base = basename(raw);
  return (
    raw.includes("/.ssh/") ||
    raw.includes("/.gnupg/") ||
    raw.includes("secret") ||
    raw.includes("credential") ||
    raw.includes("password") ||
    raw.includes("token") ||
    base === ".env" ||
    base.startsWith(".env.") ||
    /\.(pem|key|p12|pfx)$/i.test(raw) ||
    /^id_(rsa|ed25519)/i.test(base)
  );
}

export function classifyNode0Content({ name = "", relativePath = "", kind = "" } = {}) {
  if (secretLike(name, relativePath)) return "secret_metadata_only";
  if (kind !== "file") return "unknown";
  const ext = extname(name).toLowerCase();
  const lower = name.toLowerCase();
  if (CODE_EXTS.has(ext) || CODE_MANIFESTS.has(lower)) return "code";
  if (DOC_EXTS.has(ext)) return "doc";
  if (DATA_EXTS.has(ext)) return "data";
  if (MEDIA_EXTS.has(ext)) return "media";
  if (ARCHIVE_EXTS.has(ext)) return "archive";
  if (MODEL_EXTS.has(ext)) return "model_artifact";
  if (BINARY_EXTS.has(ext)) return "binary";
  return "unknown";
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
    model_loaded: false,
    delete_or_move_performed: false,
    hardlink_performed: false,
    receipt_mint_performed: false,
    token_minted: false,
    wallet_accessed: false,
    federation_invoked: false,
    urp_submission_performed: false,
    symlink_followed: false,
  });
}

function buildDenied({ reason, absPath, root, kind }) {
  const relativePath = relative(root, absPath).split(sep).join("/");
  const name = basename(absPath);
  const contentClass = classifyNode0Content({ name, relativePath, kind });
  return freezeDeep({
    reason,
    relative_path: relativePath,
    kind,
    content_class: contentClass,
    path_hash: sha256Text(resolve(absPath)),
  });
}

function shouldExcludeDirectory({ absPath, name, root, demaHome }) {
  const lower = name.toLowerCase();
  if (EXCLUDED_DIRS.has(lower)) return "excluded_directory";
  if (HEAVY_DIRS.has(lower)) return "excluded_heavy_directory";
  const node0State = resolve(demaHome, "node0-index");
  if (absPath === node0State || pathInside(absPath, node0State)) {
    return "dema_node0_index_state";
  }
  if (!pathInside(absPath, root)) return "outside_root";
  return null;
}

function buildWeakSizeGroups(records) {
  const groups = new Map();
  for (const record of records) {
    if (record.kind !== "file" || record.size_bytes <= 0) continue;
    const key = String(record.size_bytes);
    const members = groups.get(key) || [];
    members.push(record.relative_path);
    groups.set(key, members);
  }
  return freezeDeep(
    [...groups.entries()]
      .filter(([, members]) => members.length > 1)
      .map(([size, members]) => ({
        group_type: "size_collision_weak",
        confidence: "weak",
        content_confirmed: false,
        size_bytes: Number(size),
        members: members.sort(),
      })),
  );
}

function buildStrongHashGroups(records) {
  const groups = new Map();
  for (const record of records) {
    if (!record.content_hash) continue;
    const members = groups.get(record.content_hash) || [];
    members.push(record.relative_path);
    groups.set(record.content_hash, members);
  }
  return freezeDeep(
    [...groups.entries()]
      .filter(([, members]) => members.length > 1)
      .map(([hash, members]) => ({
        group_type: "content_hash_match",
        confidence: "strong",
        content_confirmed: true,
        content_hash: hash,
        members: members.sort(),
      })),
  );
}

function summarize(records, denied, duplicateGroups, truncated) {
  const contentClasses = {};
  for (const record of records) {
    contentClasses[record.content_class] = (contentClasses[record.content_class] || 0) + 1;
  }
  for (const entry of denied) {
    contentClasses[entry.content_class] = (contentClasses[entry.content_class] || 0) + 1;
  }
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

function assembleEnvelope({
  truthLabel = NODE0_SPACE_INDEX_TRUTH_LABEL,
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
    truth_label: truthLabel,
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
    blocked_effects: BLOCKED_EFFECTS,
    boundary: node0Boundary({
      checkpointWrite,
      hashContent: hashContent === true && consentAccepted === true,
    }),
    ...(error ? { error } : {}),
  });
}

function buildErrorEnvelope({ rootInput = null, absRoot = "", now, limits, error }) {
  const rootHash = sha256Text(absRoot || rootInput || "");
  return assembleEnvelope({
    truthLabel: "NODE0_LOCAL_SEED_UNAVAILABLE",
    rootInput,
    rootHash,
    now,
    limits,
    checkpointInfo: {
      enabled: false,
      resumed: false,
      complete: false,
      path_hash: null,
      checkpoint_hash: null,
    },
    summary: {
      records_count: 0,
      files_count: 0,
      dirs_count: 0,
      symlinks_count: 0,
      denied_count: 0,
      duplicate_candidate_group_count: 0,
      total_indexed_bytes: 0,
      truncated: false,
    },
    contentClasses: {},
    records: [],
    denied: [],
    warnings: [{ reason: error }],
    duplicateGroups: [],
    mode: "metadata_only_index",
    hashContent: false,
    consentRequired: buildNode0HashConsentPhrase(rootHash),
    consentProvided: "",
    consentAccepted: false,
    checkpointWrite: false,
    error,
  });
}

async function buildMetadataRecords({ fs, absRoot, demaHome, limits }) {
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
      const relativePath = relative(absRoot, absPath).split(sep).join("/");
      const contentClass = classifyNode0Content({
        name: entry.name,
        relativePath,
        kind,
      });
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
      records.push(
        freezeDeep({
          relative_path: relativePath,
          kind,
          size_bytes: kind === "file" ? stat.size : 0,
          mtime_iso: safeIso(stat),
          extension: kind === "file" ? extname(entry.name).toLowerCase() : "",
          content_class: contentClass,
          path_hash: sha256Text(absPath),
          content_hash: null,
          hash_status: "not_requested",
          symlink_followed: false,
        }),
      );
      if (kind === "directory" && current.depth < limits.maxDepth) {
        queue.push({ absPath, depth: current.depth + 1 });
      }
    }
  }

  return {
    records: records.slice().sort((a, b) => a.relative_path.localeCompare(b.relative_path)),
    denied: denied.slice().sort((a, b) => a.relative_path.localeCompare(b.relative_path)),
    warnings: warnings.slice(),
    truncated,
  };
}

async function maybeWithCheckpoint({ fs, demaHome, rootHash, envelope, checkpoint }) {
  if (checkpoint === false) return envelope;
  const checkpointInfo = await writeCheckpoint({ fs, demaHome, rootHash, envelope });
  return freezeDeep({
    ...envelope,
    checkpoint: checkpointInfo,
    boundary: node0Boundary({
      checkpointWrite: true,
      hashContent: envelope.mode === "content_hash_index",
    }),
  });
}

export async function buildNode0SpaceIndex(options = {}) {
  const fs = { ...DEFAULT_FS, ...(options.fs || {}) };
  const rootInput = options.root;
  const now = options.now || new Date();
  const demaHome = resolve(options.demaHome || defaultDemaHome());
  const limits = freezeDeep({ ...DEFAULT_LIMITS, ...(options.limits || {}) });
  if (!rootInput) return buildErrorEnvelope({ rootInput, now, limits, error: "root_missing" });
  const absRoot = resolve(rootInput);
  const rootHash = sha256Text(absRoot);

  let rootStat;
  try {
    rootStat = await fs.lstat(absRoot);
  } catch (err) {
    return buildErrorEnvelope({
      rootInput,
      absRoot,
      now,
      limits,
      error: err?.code === "EACCES" ? "permission_denied" : "root_missing",
    });
  }
  if (!rootStat.isDirectory()) {
    return buildErrorEnvelope({ rootInput, absRoot, now, limits, error: "root_not_directory" });
  }

  const { records, denied, warnings, truncated } = await buildMetadataRecords({
    fs,
    absRoot,
    demaHome,
    limits,
  });
  const weakGroups = buildWeakSizeGroups(records);
  const { contentClasses, summary } = summarize(records, denied, weakGroups, truncated);
  const consentRequired = buildNode0HashConsentPhrase(rootHash);
  const checkpointInfo = {
    enabled: options.checkpoint !== false,
    resumed: false,
    complete: false,
    path_hash: null,
    checkpoint_hash: null,
  };
  const metadataEnvelope = assembleEnvelope({
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
    duplicateGroups: weakGroups,
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

  if (options.hashContent !== true) {
    return maybeWithCheckpoint({
      fs,
      demaHome,
      rootHash,
      envelope: metadataEnvelope,
      checkpoint: options.checkpoint,
    });
  }

  const hashedRecords = [];
  for (const record of records) {
    if (record.kind !== "file" || record.content_class === "secret_metadata_only") {
      hashedRecords.push(record);
      continue;
    }
    const absPath = resolve(join(absRoot, record.relative_path));
    try {
      hashedRecords.push(
        freezeDeep({
          ...record,
          content_hash: await sha256File({ absPath, fs, maxBytes: limits.maxBytesToHash }),
          hash_status: "hashed",
        }),
      );
    } catch {
      hashedRecords.push(freezeDeep({ ...record, content_hash: null, hash_status: "unavailable" }));
    }
  }
  const strongGroups = buildStrongHashGroups(hashedRecords);
  const hashedSummary = summarize(hashedRecords, denied, strongGroups, truncated);
  const hashedEnvelope = assembleEnvelope({
    rootInput,
    rootHash,
    now,
    limits,
    checkpointInfo,
    summary: hashedSummary.summary,
    contentClasses: hashedSummary.contentClasses,
    records: hashedRecords,
    denied,
    warnings,
    duplicateGroups: strongGroups,
    mode: "content_hash_index",
    hashContent: true,
    consentRequired,
    consentProvided: options.consentPhrase,
    consentAccepted: true,
    checkpointWrite: false,
  });

  return maybeWithCheckpoint({
    fs,
    demaHome,
    rootHash,
    envelope: hashedEnvelope,
    checkpoint: options.checkpoint,
  });
}

export function verifyNode0SpaceIndex(envelope) {
  const errors = [];
  if (envelope?.schema !== NODE0_SPACE_INDEX_SCHEMA) errors.push("schema_mismatch");
  if (!String(envelope?.truth_label || "").startsWith("NODE0_LOCAL_SEED")) {
    errors.push("truth_label_mismatch");
  }
  if (!["metadata_only_index", "content_hash_index"].includes(envelope?.mode)) {
    errors.push("mode_invalid");
  }
  if (
    !envelope?.root?.hash_consent_phrase?.startsWith("I CONSENT: HASH NODE0 SPACE sha256:")
  ) {
    errors.push("consent_phrase_missing");
  }
  if (envelope?.root?.hash_consent_phrase !== buildNode0HashConsentPhrase(envelope?.root?.normalized_path_hash)) {
    errors.push("consent_phrase_not_root_bound");
  }
  if (envelope?.boundary?.scanned_root_mutated !== false) errors.push("scanned_root_mutated_not_false");
  if (envelope?.boundary?.network_used !== false) errors.push("network_used_not_false");
  if (envelope?.boundary?.delete_or_move_performed !== false) errors.push("delete_or_move_not_false");
  if (envelope?.boundary?.token_minted !== false) errors.push("token_minted_not_false");
  if (envelope?.boundary?.federation_invoked !== false) errors.push("federation_invoked_not_false");
  if (envelope?.mode === "metadata_only_index" && envelope?.boundary?.file_content_read !== false) {
    errors.push("metadata_mode_content_read");
  }
  return freezeDeep({ ok: errors.length === 0, errors });
}

export function renderNode0SpaceIndexSummary(envelope) {
  if (!envelope || envelope.schema !== NODE0_SPACE_INDEX_SCHEMA) {
    return "DEMA NODE0 SPACE INDEX\nstatus: invalid";
  }
  const weakCount = envelope.duplicate_candidate_groups.filter(
    (g) => g.group_type === "size_collision_weak",
  ).length;
  const strongCount = envelope.duplicate_candidate_groups.filter(
    (g) => g.group_type === "content_hash_match",
  ).length;
  return [
    "DEMA NODE0 SPACE INDEX",
    `truth: ${envelope.truth_label} · mode: ${envelope.mode}`,
    `records: ${envelope.summary.records_count} · files: ${envelope.summary.files_count} · dirs: ${envelope.summary.dirs_count} · symlinks: ${envelope.summary.symlinks_count}`,
    `denied: ${envelope.summary.denied_count} · bytes: ${envelope.summary.total_indexed_bytes}`,
    `Weak duplicate candidates: ${weakCount}`,
    `Strong duplicate candidates: ${strongCount}`,
    `Hash consent phrase: ${envelope.root.hash_consent_phrase}`,
    "Boundary: scanned root unmutated · symlinks not followed · no network · no model · no mint",
    envelope.error ? `error: ${envelope.error}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}
