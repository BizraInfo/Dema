// NODE00-THREE-ROOT-CENSUS-0B — bounded, metadata-only census across explicitly
// declared filesystem roots, with most-specific-root ownership and privacy-preserving
// portable evidence.
//
// PURE KERNEL. No fs / network / clock / random in this file. The census walk is
// driven through an INJECTED metadata adapter:
//
//   adapter.lstat(absPath)  -> { device, inode, mode, size_bytes, mtime_ms, type }
//                              type ∈ "directory" | "file" | "symlink" | "other"
//                              throws { code } when the entry cannot be stat'ed
//   adapter.readdir(absDir) -> string[] (bare names, no paths)
//   adapter.now()           -> millisecond number (duration bound only)
//
// The adapter surface is deliberately narrow: ONLY lstat/readdir/now. This kernel
// never reads, opens, streams, resolves, or mutates anything. The real effect adapter
// lives in apps/cli/src/commands/node00-three-root-census.js, which is the ONLY fs
// surface for this slice; the external proof writer lives there too and is separate
// from this scanner.
//
// `node:path` is used only for pure string arithmetic on already-injected strings.
//
// OWNERSHIP LAW: every filesystem entry belongs to the most-specific explicitly
// declared root containing it. A parent traversal reaching an admitted child root
// records a delegation marker and does NOT descend. Root argument ordering cannot
// change ownership or the deterministic body hash.
//
// PRIVACY LAW (corrective round 0B.1 — supersedes the per-entry-hash design):
// a root declared `private` is reported in PRIVATE_AGGREGATE mode. NO per-file record
// of any kind leaves the kernel for that root — no path, no basename, no path hash,
// no exact size, no exact mtime, no device, no inode, no mode, no depth, no stable
// per-entry identifier. Only fixed-vocabulary aggregate distributions escape. An
// unsalted per-file path hash is an offline identification oracle and is therefore NOT
// emitted; exact size + device + inode would further strengthen correlation and are
// not emitted either. Extension distributions for a private root are projected onto a
// CLOSED declared vocabulary — a raw, unbounded suffix survives aggregation as an
// identifying signal, so anything undeclared buckets to "other". The only per-entry row a private root may produce is a
// delegation marker naming the child ROOT ID and nothing else.
//
// SYMLINK LAW: recorded as metadata, never resolved, never descended.
// DEVICE LAW: an entry on another device is recorded as a boundary failure and never
// descended.
// VISITATION LAW: every admitted root carries an explicit scan_state. A root never
// reached because a CENSUS-WIDE bound (max_entries / max_millis) was already exhausted
// is NOT_STARTED with a reason — never a successfully-scanned empty root. max_depth is
// a ROOT-LOCAL condition: it marks only its own root PARTIAL and must never stop a
// later, shallower, disjoint root from being scanned. Global COMPLETE requires every
// root COMPLETE.
//
// WHAT THIS DOES NOT PROVE: content identity (no bytes are read), semantic meaning,
// dedup, an asset registry, or independent authenticity — verify() binds the whole
// body but has no external anchor, so a forger controlling every field and recomputing
// the hash is not detected.
import { isAbsolute, normalize, sep } from "node:path";

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const NODE00_THREE_ROOT_CENSUS_SCHEMA = "bizra.dema.node00_three_root_census.v0.1";
export const NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL = "NODE00_THREE_ROOT_CENSUS_MEASURED_REPO";
export const NODE00_THREE_ROOT_CENSUS_GO_PHRASE = "GO: node00 three root census preview";

export const COMPLETENESS_COMPLETE = "COMPLETE";
export const COMPLETENESS_BOUNDED_PARTIAL = "BOUNDED_PARTIAL";

export const PRIVACY_PRIVATE_AGGREGATE = "PRIVATE_AGGREGATE";
export const PRIVACY_PUBLIC_PATHS = "PUBLIC_PATHS";

export const SCAN_NOT_STARTED = "NOT_STARTED";
export const SCAN_COMPLETE = "COMPLETE";
export const SCAN_PARTIAL = "PARTIAL";
export const SCAN_FAILED = "FAILED";

export const DEFAULT_CENSUS_BOUNDS = Object.freeze({
  max_depth: 24,
  max_entries: 400000,
  max_millis: 600000,
});

// --- extension / coarse-type vocabulary (concept reused from node0-space-index) ---
const CODE_EXTS = new Set([".js", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".rs", ".go", ".java", ".sh"]);
const DOC_EXTS = new Set([".md", ".txt", ".pdf", ".doc", ".docx", ".rtf"]);
const DATA_EXTS = new Set([
  ".json", ".jsonl", ".ndjson", ".csv", ".tsv", ".yaml", ".yml", ".toml", ".xml",
  ".sqlite", ".db", ".parquet",
]);
const MEDIA_EXTS = new Set([
  ".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".mp3", ".wav", ".m4a",
  ".mp4", ".mov", ".webm",
]);
const ARCHIVE_EXTS = new Set([".zip", ".tar", ".gz", ".tgz", ".7z", ".rar"]);
const MODEL_EXTS = new Set([".gguf", ".safetensors", ".onnx", ".pt", ".pth"]);
const BINARY_EXTS = new Set([".bin", ".exe", ".dll", ".so", ".dylib"]);

// The CLOSED extension vocabulary. Anything outside it is an unbounded, potentially
// bespoke suffix (.kdbx, .ovpn, a proprietary tag) and is an identifying signal that
// survives aggregation — so a PRIVATE root never reports it verbatim.
export const DECLARED_EXTENSIONS = Object.freeze(
  [...CODE_EXTS, ...DOC_EXTS, ...DATA_EXTS, ...MEDIA_EXTS, ...ARCHIVE_EXTS, ...MODEL_EXTS, ...BINARY_EXTS].sort(),
);
const DECLARED_EXTENSION_SET = new Set(DECLARED_EXTENSIONS);
export const EXTENSION_VOCABULARY = Object.freeze([...DECLARED_EXTENSIONS, "none", "other"]);

// Extension key permitted to escape for a given privacy mode. A public root may report
// the observed extension; a private root is projected onto the closed vocabulary.
export function extensionKeyFor(extension, privacyMode) {
  const key = extension === "" ? "none" : extension;
  if (privacyMode !== PRIVACY_PRIVATE_AGGREGATE) return key;
  if (key === "none") return "none";
  return DECLARED_EXTENSION_SET.has(key) ? key : "other";
}

export function coarseTypeForExtension(extension) {
  if (typeof extension !== "string" || extension === "") return "none";
  if (CODE_EXTS.has(extension)) return "code";
  if (DOC_EXTS.has(extension)) return "document";
  if (DATA_EXTS.has(extension)) return "data";
  if (MEDIA_EXTS.has(extension)) return "media";
  if (ARCHIVE_EXTS.has(extension)) return "archive";
  if (MODEL_EXTS.has(extension)) return "model";
  if (BINARY_EXTS.has(extension)) return "binary";
  return "other";
}

// Declared bucket vocabularies. Private roots report DISTRIBUTIONS over these labels —
// never an exact byte count or timestamp.
export const SIZE_BUCKETS = Object.freeze([
  "0B", "1B_1KiB", "1KiB_10KiB", "10KiB_100KiB", "100KiB_1MiB",
  "1MiB_10MiB", "10MiB_100MiB", "100MiB_1GiB", "1GiB_PLUS",
]);

export function sizeBucket(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return "unknown";
  if (bytes === 0) return "0B";
  if (bytes < 1024) return "1B_1KiB";
  if (bytes < 10 * 1024) return "1KiB_10KiB";
  if (bytes < 100 * 1024) return "10KiB_100KiB";
  if (bytes < 1024 * 1024) return "100KiB_1MiB";
  if (bytes < 10 * 1024 * 1024) return "1MiB_10MiB";
  if (bytes < 100 * 1024 * 1024) return "10MiB_100MiB";
  if (bytes < 1024 * 1024 * 1024) return "100MiB_1GiB";
  return "1GiB_PLUS";
}

export const MTIME_BUCKETS = Object.freeze([
  "under_1d", "under_7d", "under_30d", "under_90d", "under_365d", "under_3y", "over_3y", "unknown",
]);

const DAY_MS = 86400000;

export function mtimeBucket(mtimeMs, referenceMs) {
  if (!Number.isFinite(mtimeMs) || !Number.isFinite(referenceMs)) return "unknown";
  const age = referenceMs - mtimeMs;
  if (age < 0) return "unknown";
  if (age < DAY_MS) return "under_1d";
  if (age < 7 * DAY_MS) return "under_7d";
  if (age < 30 * DAY_MS) return "under_30d";
  if (age < 90 * DAY_MS) return "under_90d";
  if (age < 365 * DAY_MS) return "under_365d";
  if (age < 3 * 365 * DAY_MS) return "under_3y";
  return "over_3y";
}

function extensionOf(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot).toLowerCase();
}

export function hashText(value) {
  return sha256CanonicalJsonV1(String(value));
}

// The canonical byte contract caps a single array at 1024 elements (a deliberate
// fail-closed bound in packages/canon). A real census carries hundreds of thousands of
// rows, so a collection is digested as a CHUNKED MERKLE FOLD: hash each row, fold the
// row hashes in blocks, repeat until one root hash remains. Every level uses the ONE
// canonical contract; the fold binds row order and row count.
export const DIGEST_FOLD_WIDTH = 512;

export function foldDigest(items) {
  if (items.length === 0) return sha256CanonicalJsonV1([]);
  let level = items.map((item) => sha256CanonicalJsonV1(item));
  while (level.length > 1) {
    const next = [];
    for (let i = 0; i < level.length; i += DIGEST_FOLD_WIDTH) {
      next.push(sha256CanonicalJsonV1(level.slice(i, i + DIGEST_FOLD_WIDTH)));
    }
    level = next;
  }
  return level[0];
}

export function node00ThreeRootCensusBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

const BOUNDARY_KEYS = Object.freeze(Object.keys(node00ThreeRootCensusBoundary()).sort());

// Fields that must NEVER appear on any row attributed to a PRIVATE_AGGREGATE root.
export const PRIVATE_FORBIDDEN_ENTRY_FIELDS = Object.freeze([
  "relative_path", "relative_path_hash", "basename", "basename_hash", "entry_id",
  "size_bytes", "mtime_ms", "mtime_iso", "device", "inode", "mode", "depth",
]);

function normalizedRootPath(value) {
  const normalized = normalize(value);
  if (normalized.length > 1 && normalized.endsWith(sep)) return normalized.slice(0, -1);
  return normalized;
}

function joinPath(dir, name) {
  return dir === sep ? `${sep}${name}` : `${dir}${sep}${name}`;
}

function isStrictlyInside(parent, child) {
  return child !== parent && child.startsWith(parent === sep ? sep : parent + sep);
}

export function privacyModeFor(visibility) {
  return visibility === "private" ? PRIVACY_PRIVATE_AGGREGATE : PRIVACY_PUBLIC_PATHS;
}

// Fail-closed plan. Absence of a block is never validation.
export function planNode00ThreeRootCensus({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE00_THREE_ROOT_CENSUS_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
    return frozenPlan(blocked_by);
  }
  const { roots, adapter, bounds, implementation_worktree, reference_time_ms } = input;

  let hasPrivate = false;
  if (!Array.isArray(roots) || roots.length === 0) blocked_by.push("roots_not_declared");
  else {
    const ids = new Set();
    const implPath =
      typeof implementation_worktree === "string" && implementation_worktree !== ""
        ? normalizedRootPath(implementation_worktree)
        : null;
    for (const root of roots) {
      if (!root || typeof root !== "object") { blocked_by.push("root_not_object"); continue; }
      if (typeof root.id !== "string" || root.id === "") blocked_by.push("root_id_missing");
      else if (ids.has(root.id)) blocked_by.push("root_id_duplicated");
      else ids.add(root.id);
      if (typeof root.path !== "string" || !isAbsolute(root.path)) blocked_by.push("root_path_not_absolute");
      if (root.visibility !== "private" && root.visibility !== "public") blocked_by.push("root_visibility_undeclared");
      if (root.visibility === "private") hasPrivate = true;

      // The build environment is NEVER a census subject. Substituting it for the real
      // subject is what invalidated the first live run.
      if (implPath && typeof root.path === "string" && normalizedRootPath(root.path) === implPath) {
        blocked_by.push("dema_repo_subject_equals_implementation_worktree");
      }
      // A root marked as requiring provenance must carry an explicit binding.
      if (root.requires_binding === true) {
        const b = root.binding;
        if (!b || typeof b !== "object" || typeof b.binding_source !== "string" || b.binding_source === "") {
          blocked_by.push("root_binding_unresolved");
        }
      }
    }
  }

  if (!adapter || typeof adapter !== "object") blocked_by.push("adapter_missing");
  else {
    for (const fn of ["lstat", "readdir", "now"]) {
      if (typeof adapter[fn] !== "function") blocked_by.push(`adapter_${fn}_missing`);
    }
  }

  // A private root reports mtime DISTRIBUTIONS, which need a declared reference time.
  if (hasPrivate && !Number.isFinite(reference_time_ms)) blocked_by.push("reference_time_ms_required_for_private_root");

  if (bounds !== undefined) {
    if (!bounds || typeof bounds !== "object") blocked_by.push("bounds_not_object");
    else {
      for (const key of ["max_depth", "max_entries", "max_millis"]) {
        const value = bounds[key];
        if (value !== undefined && !(Number.isInteger(value) && value > 0)) {
          blocked_by.push(`bounds_${key}_invalid`);
        }
      }
    }
  }
  return frozenPlan(blocked_by);
}

function frozenPlan(blocked_by) {
  return Object.freeze({
    schema: NODE00_THREE_ROOT_CENSUS_SCHEMA,
    truth_label: NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze([...blocked_by]),
  });
}

export class CensusRootAdmissionError extends Error {
  constructor(code, rootId) {
    super(`${code}:${rootId}`); // rootId is a declared label, never a filesystem path
    this.name = "CensusRootAdmissionError";
    this.code = code;
    this.root_id = rootId;
  }
}

export function admitCensusRoots({ roots, adapter }) {
  const admitted = [];
  const byIdentity = new Map();
  for (const declared of roots) {
    const path = normalizedRootPath(declared.path);
    const id = declared.id;
    let stat;
    try {
      stat = adapter.lstat(path);
    } catch {
      throw new CensusRootAdmissionError("root_not_found", id);
    }
    if (stat.type === "symlink") throw new CensusRootAdmissionError("root_is_symlink", id);
    if (stat.type !== "directory") throw new CensusRootAdmissionError("root_not_directory", id);
    assertNoSymlinkAncestor(path, id, adapter);
    const identity = `${stat.device}:${stat.inode}`;
    if (byIdentity.has(identity)) throw new CensusRootAdmissionError("duplicate_root_identity", id);
    byIdentity.set(identity, id);
    admitted.push(
      Object.freeze({
        id,
        visibility: declared.visibility,
        privacy_mode: privacyModeFor(declared.visibility),
        binding: declared.binding ? Object.freeze({ ...declared.binding }) : null,
        path,
        normalized_path_hash: hashText(path),
        device: stat.device,
        inode: stat.inode,
        mode: stat.mode,
      }),
    );
  }
  return Object.freeze([...admitted].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0)));
}

function assertNoSymlinkAncestor(path, rootId, adapter) {
  let current = path;
  for (;;) {
    const parent = normalizedRootPath(current.slice(0, current.lastIndexOf(sep)) || sep);
    if (parent === current) return;
    let stat;
    try {
      stat = adapter.lstat(parent);
    } catch {
      throw new CensusRootAdmissionError("root_ancestor_unreadable", rootId);
    }
    if (stat.type === "symlink") throw new CensusRootAdmissionError("root_ancestor_symlink", rootId);
    current = parent;
  }
}

export function deriveCensusTopology(admitted) {
  const containment = [];
  const disjoint = [];
  for (let i = 0; i < admitted.length; i += 1) {
    for (let j = 0; j < admitted.length; j += 1) {
      if (i === j) continue;
      if (isStrictlyInside(admitted[i].path, admitted[j].path)) {
        containment.push(Object.freeze({ parent: admitted[i].id, child: admitted[j].id }));
      }
    }
  }
  for (let i = 0; i < admitted.length; i += 1) {
    for (let j = i + 1; j < admitted.length; j += 1) {
      const a = admitted[i];
      const b = admitted[j];
      if (!isStrictlyInside(a.path, b.path) && !isStrictlyInside(b.path, a.path)) {
        disjoint.push(Object.freeze([a.id, b.id].sort()));
      }
    }
  }
  return Object.freeze({
    containment: Object.freeze(
      containment.sort((x, y) => `${x.parent}/${x.child}`.localeCompare(`${y.parent}/${y.child}`)),
    ),
    disjoint: Object.freeze(disjoint.sort((x, y) => x.join("/").localeCompare(y.join("/")))),
  });
}

function emptySummary() {
  return {
    files_count: 0,
    directories_count: 0,
    symlinks_count: 0,
    other_count: 0,
    inaccessible_count: 0,
    delegated_root_count: 0,
    device_boundary_count: 0,
    extension_distribution: {},
    coarse_type_distribution: {},
    size_bucket_distribution: {},
    mtime_bucket_distribution: {},
  };
}

function bump(dist, key) {
  dist[key] = (dist[key] ?? 0) + 1;
}

function sortedDistribution(dist) {
  return Object.freeze(
    Object.fromEntries(Object.entries(dist).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))),
  );
}

function freezeSummary(summary) {
  return Object.freeze({
    ...summary,
    extension_distribution: sortedDistribution(summary.extension_distribution),
    coarse_type_distribution: sortedDistribution(summary.coarse_type_distribution),
    size_bucket_distribution: sortedDistribution(summary.size_bucket_distribution),
    mtime_bucket_distribution: sortedDistribution(summary.mtime_bucket_distribution),
  });
}

// Bounded, metadata-only traversal honouring ownership, symlink, device, bound,
// visitation and privacy laws.
export function censusRoots({ roots, adapter, bounds = {}, reference_time_ms = null }) {
  const admitted = admitCensusRoots({ roots, adapter });
  const limits = { ...DEFAULT_CENSUS_BOUNDS, ...bounds };
  const rootByPath = new Map(admitted.map((root) => [root.path, root]));
  const entries = [];
  const publicWarnings = [];
  const privateWarningCounts = new Map(); // `${root_id} ${code}` -> count
  const summaries = new Map();
  const scan = new Map();
  const state = { count: 0, truncated: null, started: adapter.now() };
  const partialRoots = [];

  for (const root of admitted) {
    summaries.set(root.id, emptySummary());
    scan.set(root.id, { scan_state: SCAN_NOT_STARTED, reason: null, visited_entries: 0 });
  }

  for (const root of admitted) {
    // A census-wide bound already exhausted means this root is NEVER VISITED. It must
    // not be reported as a successfully-scanned empty root.
    if (state.truncated) {
      scan.set(root.id, {
        scan_state: SCAN_NOT_STARTED,
        reason: "GLOBAL_BOUND_EXHAUSTED",
        visited_entries: 0,
      });
      continue;
    }
    const before = state.count;
    let failure = null;
    let localTruncation = null;
    try {
      localTruncation = walkRoot(root, rootByPath, adapter, limits, entries, {
        publicWarnings,
        privateWarningCounts,
        summary: summaries.get(root.id),
        reference_time_ms,
      }, state);
    } catch (err) {
      failure = err && typeof err.code === "string" ? err.code : "walk_failed";
    }
    const visited = state.count - before;
    if (failure) {
      scan.set(root.id, { scan_state: SCAN_FAILED, reason: failure, visited_entries: visited });
      state.truncated = state.truncated ?? "root_failed";
    } else if (state.truncated) {
      scan.set(root.id, { scan_state: SCAN_PARTIAL, reason: state.truncated, visited_entries: visited });
    } else if (localTruncation) {
      // Root-local truncation (max_depth): THIS root is PARTIAL, the census continues.
      scan.set(root.id, { scan_state: SCAN_PARTIAL, reason: localTruncation, visited_entries: visited });
      partialRoots.push(root.id);
    } else {
      scan.set(root.id, { scan_state: SCAN_COMPLETE, reason: null, visited_entries: visited });
    }
  }

  // Revalidate every root identity AFTER traversal.
  for (const root of admitted) {
    let stat = null;
    try {
      stat = adapter.lstat(root.path);
    } catch {
      stat = null;
    }
    if (!stat || stat.device !== root.device || stat.inode !== root.inode) {
      recordWarning(root, "ROOT_SUBSTITUTED_DURING_SCAN", null, null, { publicWarnings, privateWarningCounts });
      const prev = scan.get(root.id);
      scan.set(root.id, { ...prev, scan_state: SCAN_FAILED, reason: "ROOT_SUBSTITUTED_DURING_SCAN" });
      state.truncated = state.truncated ?? "root_substituted";
    }
  }

  const warnings = [
    ...publicWarnings,
    ...[...privateWarningCounts.entries()].map(([key, count]) => {
      const [root_id, code] = key.split(" ");
      return Object.freeze({ root_id, code, aggregate: true, count });
    }),
  ];

  entries.sort(entryOrder);
  warnings.sort(warningOrder);

  const perRootScan = admitted.map((root) =>
    Object.freeze({ root_id: root.id, ...scan.get(root.id) }),
  );
  const allComplete = perRootScan.every((r) => r.scan_state === SCAN_COMPLETE);

  return Object.freeze({
    admitted,
    limits: Object.freeze({ ...limits }),
    reference_time_ms,
    entries: Object.freeze(entries),
    warnings: Object.freeze(warnings),
    summaries: Object.freeze(
      Object.fromEntries(admitted.map((r) => [r.id, freezeSummary(summaries.get(r.id))])),
    ),
    scan_states: Object.freeze(perRootScan),
    completeness: allComplete && !state.truncated ? COMPLETENESS_COMPLETE : COMPLETENESS_BOUNDED_PARTIAL,
    truncation_reason: state.truncated ?? (partialRoots.length > 0 ? "root_local_max_depth" : null),
  });
}

function recordWarning(root, code, relativePath, errorCode, sinks) {
  if (root.privacy_mode === PRIVACY_PRIVATE_AGGREGATE) {
    // Aggregate by stable reason code — never a path-addressable record.
    const key = `${root.id} ${code}`;
    sinks.privateWarningCounts.set(key, (sinks.privateWarningCounts.get(key) ?? 0) + 1);
    return;
  }
  sinks.publicWarnings.push(
    Object.freeze({
      root_id: root.id,
      code,
      aggregate: false,
      error_code: errorCode,
      relative_path: relativePath,
    }),
  );
}

function entryOrder(a, b) {
  if (a.root_id !== b.root_id) return a.root_id < b.root_id ? -1 : 1;
  const ka = a.relative_path ?? a.delegated_to ?? "";
  const kb = b.relative_path ?? b.delegated_to ?? "";
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

function warningOrder(a, b) {
  if (a.root_id !== b.root_id) return a.root_id < b.root_id ? -1 : 1;
  if (a.code !== b.code) return a.code < b.code ? -1 : 1;
  const ka = a.relative_path ?? "";
  const kb = b.relative_path ?? "";
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

// Returns a PER-ROOT truncation reason (or null). `state.truncated` is reserved for
// CENSUS-WIDE bounds only: max_depth is a root-local condition and must never stop a
// later, shallower, disjoint root from being scanned.
function walkRoot(root, rootByPath, adapter, limits, entries, sinks, state) {
  const isPrivate = root.privacy_mode === PRIVACY_PRIVATE_AGGREGATE;
  const summary = sinks.summary;
  let localTruncation = null;
  const queue = [{ absPath: root.path, relativePath: "", depth: 0 }];
  while (queue.length > 0) {
    if (state.truncated) return localTruncation;
    const dir = queue.shift();
    let names;
    try {
      names = adapter.readdir(dir.absPath);
    } catch (err) {
      summary.inaccessible_count += 1;
      recordWarning(root, "DIRECTORY_UNREADABLE", isPrivate ? null : dir.relativePath,
        err && typeof err.code === "string" ? err.code : "unknown", sinks);
      continue;
    }
    for (const name of [...names].sort()) {
      if (state.truncated) return localTruncation;
      if (state.count >= limits.max_entries) { state.truncated = "max_entries"; return localTruncation; }
      if (adapter.now() - state.started >= limits.max_millis) { state.truncated = "max_millis"; return localTruncation; }

      const absPath = joinPath(dir.absPath, name);
      const relativePath = dir.relativePath === "" ? name : `${dir.relativePath}/${name}`;
      let stat;
      try {
        stat = adapter.lstat(absPath);
      } catch (err) {
        summary.inaccessible_count += 1;
        recordWarning(root, "ENTRY_VANISHED_OR_UNREADABLE", isPrivate ? null : relativePath,
          err && typeof err.code === "string" ? err.code : "unknown", sinks);
        continue;
      }

      const extension = stat.type === "file" ? extensionOf(name) : "";
      const coarse = stat.type === "file" ? coarseTypeForExtension(extension) : "none";
      const delegated = stat.type === "directory" ? rootByPath.get(absPath) : undefined;
      const isDelegation = Boolean(delegated) && delegated.id !== root.id;
      const crossesDevice = stat.device !== root.device;

      state.count += 1;
      if (stat.type === "file") summary.files_count += 1;
      else if (stat.type === "directory") summary.directories_count += 1;
      else if (stat.type === "symlink") summary.symlinks_count += 1;
      else summary.other_count += 1;
      if (crossesDevice) summary.device_boundary_count += 1;
      if (isDelegation) summary.delegated_root_count += 1;
      if (stat.type === "file") {
        bump(summary.extension_distribution, extensionKeyFor(extension, root.privacy_mode));
        bump(summary.coarse_type_distribution, coarse);
        bump(summary.size_bucket_distribution, sizeBucket(stat.size_bytes));
        bump(summary.mtime_bucket_distribution, mtimeBucket(stat.mtime_ms, sinks.reference_time_ms));
      }

      if (isPrivate) {
        // PRIVATE_AGGREGATE: the ONLY per-entry row a private root may produce is a
        // delegation marker naming the child ROOT ID — no path, no hash, no metadata.
        if (isDelegation) {
          entries.push(
            Object.freeze({
              root_id: root.id,
              entry_type: "delegated_root",
              delegated_to: delegated.id,
              ownership_state: "DELEGATED_ROOT",
            }),
          );
        }
      } else {
        entries.push(
          Object.freeze({
            root_id: root.id,
            relative_path: relativePath,
            basename: name,
            entry_type: stat.type,
            extension,
            coarse_type: coarse,
            size_bytes: stat.type === "file" ? stat.size_bytes : null,
            depth: dir.depth + 1,
            device: stat.device,
            inode: stat.inode,
            mode: stat.mode,
            delegated_root: isDelegation ? delegated.id : null,
            ownership_state: isDelegation ? "DELEGATED_ROOT" : "OWNED",
            device_boundary: crossesDevice,
          }),
        );
      }

      if (stat.type !== "directory") continue; // symlink: recorded, never resolved
      if (isDelegation) continue;              // ownership delegated to the child root
      if (crossesDevice) {
        recordWarning(root, "DEVICE_BOUNDARY_NOT_CROSSED", isPrivate ? null : relativePath, null, sinks);
        continue;
      }
      if (dir.depth + 1 >= limits.max_depth) {
        // PER-ROOT: this root is depth-truncated; other roots are unaffected.
        localTruncation = "max_depth";
        continue;
      }
      queue.push({ absPath, relativePath, depth: dir.depth + 1 });
    }
  }
  return localTruncation;
}

// Deterministic body. Volatile run metadata lives OUTSIDE the hashed body.
export function buildNode00ThreeRootCensusPayload(census) {
  const privateRoots = census.admitted.filter((root) => root.privacy_mode === PRIVACY_PRIVATE_AGGREGATE);
  // A PUBLIC root nested inside a PRIVATE root would disclose the private root's
  // absolute path as its own prefix.
  const disclosable = (root) =>
    root.privacy_mode === PRIVACY_PUBLIC_PATHS &&
    !privateRoots.some((p) => isStrictlyInside(p.path, root.path));

  const scanById = new Map(census.scan_states.map((s) => [s.root_id, s]));

  const perRoot = census.admitted.map((root) => {
    const scan = scanById.get(root.id);
    const summary = census.summaries[root.id];
    const base = {
      root_id: root.id,
      visibility: root.visibility,
      privacy_mode: root.privacy_mode,
      scan_state: scan.scan_state,
      scan_reason: scan.reason,
      visited_entries: scan.visited_entries,
      binding_source: root.binding?.binding_source ?? null,
      summary,
    };
    if (root.privacy_mode === PRIVACY_PRIVATE_AGGREGATE) {
      // No path, no path hash, no device/inode/mode: none of it may escape.
      return Object.freeze({ ...base, path: null, normalized_path_hash: null, device: null, inode: null, mode: null });
    }
    return Object.freeze({
      ...base,
      path: disclosable(root) ? root.path : null,
      normalized_path_hash: root.normalized_path_hash,
      device: root.device,
      inode: root.inode,
      mode: root.mode,
    });
  });

  const totals = census.admitted.reduce(
    (acc, root) => {
      const s = census.summaries[root.id];
      acc.files += s.files_count;
      acc.directories += s.directories_count;
      acc.symlinks += s.symlinks_count;
      acc.other += s.other_count;
      acc.inaccessible += s.inaccessible_count;
      acc.delegated_roots += s.delegated_root_count;
      return acc;
    },
    { roots: census.admitted.length, files: 0, directories: 0, symlinks: 0, other: 0, inaccessible: 0, delegated_roots: 0 },
  );

  const body = {
    schema: NODE00_THREE_ROOT_CENSUS_SCHEMA,
    truth_label: NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    completeness: census.completeness,
    truncation_reason: census.truncation_reason,
    bounds: census.limits,
    reference_time_ms: census.reference_time_ms,
    size_bucket_vocabulary: SIZE_BUCKETS,
    mtime_bucket_vocabulary: MTIME_BUCKETS,
    private_extension_vocabulary: EXTENSION_VOCABULARY,
    topology: deriveCensusTopology(census.admitted),
    per_root: Object.freeze(perRoot),
    totals: Object.freeze({ ...totals, entries: census.entries.length, warnings: census.warnings.length }),
    entries_digest: foldDigest(census.entries),
    warnings_digest: foldDigest(census.warnings),
    digest_fold_width: DIGEST_FOLD_WIDTH,
    boundary: node00ThreeRootCensusBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// Portable-artifact privacy verifier. Fails closed if ANY private per-entry object
// appears in a portable artifact. This is enforced at verification, not merely at
// generation — a forged artifact set must be refused too.
export function verifyPortableArtifacts({ payload, entries = [], warnings = [] }) {
  const reasons = [];
  const modeById = new Map((payload?.per_root ?? []).map((r) => [r.root_id, r.privacy_mode]));
  for (const row of entries) {
    if (modeById.get(row.root_id) !== PRIVACY_PRIVATE_AGGREGATE) continue;
    if (row.entry_type !== "delegated_root") {
      reasons.push("private_per_entry_row_emitted");
      continue;
    }
    for (const field of PRIVATE_FORBIDDEN_ENTRY_FIELDS) {
      if (row[field] !== undefined && row[field] !== null) reasons.push(`private_field_emitted:${field}`);
    }
    const allowed = new Set(["root_id", "entry_type", "delegated_to", "ownership_state"]);
    if (Object.keys(row).some((k) => !allowed.has(k))) reasons.push("private_delegation_marker_has_extra_field");
  }
  for (const row of warnings) {
    if (modeById.get(row.root_id) !== PRIVACY_PRIVATE_AGGREGATE) continue;
    if (row.aggregate !== true) reasons.push("private_warning_not_aggregated");
    if (row.relative_path != null || row.basename != null) reasons.push("private_warning_discloses_path");
  }
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}

// Body-bound re-derivation. DECLARED LIMIT: internal consistency only — no external
// anchor, so a forger controlling every field and recomputing the hash is NOT detected.
export function verifyNode00ThreeRootCensus(payload) {
  const reasons = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, reasons: Object.freeze(["payload_not_object"]) });
  }
  const { content_hash, ...body } = payload;
  if (typeof content_hash !== "string") reasons.push("content_hash_missing");
  else if (sha256CanonicalJsonV1(body) !== content_hash) reasons.push("content_hash_mismatch");

  if (body.schema !== NODE00_THREE_ROOT_CENSUS_SCHEMA) reasons.push("schema_mismatch");
  if (body.truth_label !== NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL) reasons.push("truth_label_mismatch");
  if (body.completeness !== COMPLETENESS_COMPLETE && body.completeness !== COMPLETENESS_BOUNDED_PARTIAL) {
    reasons.push("completeness_not_declared");
  }
  if (body.completeness === COMPLETENESS_COMPLETE && body.truncation_reason !== null) {
    reasons.push("complete_with_truncation_reason");
  }
  if (typeof body.entries_digest !== "string") reasons.push("entries_digest_missing");
  if (typeof body.warnings_digest !== "string") reasons.push("warnings_digest_missing");

  const boundary = body.boundary;
  if (!boundary || typeof boundary !== "object") reasons.push("boundary_missing");
  else {
    const keys = Object.keys(boundary).sort();
    if (keys.length !== BOUNDARY_KEYS.length || keys.some((k, i) => k !== BOUNDARY_KEYS[i])) {
      reasons.push("boundary_key_set_mismatch");
    }
    if (BOUNDARY_KEYS.some((k) => boundary[k] !== false)) reasons.push("boundary_not_all_false");
  }

  const perRoot = body.per_root ?? [];
  const visibilityOf = new Map(perRoot.map((root) => [root.root_id, root.visibility]));
  const validScanStates = new Set([SCAN_NOT_STARTED, SCAN_COMPLETE, SCAN_PARTIAL, SCAN_FAILED]);
  for (const root of perRoot) {
    if (!validScanStates.has(root.scan_state)) reasons.push("root_scan_state_undeclared");
    if (root.scan_state !== SCAN_COMPLETE && root.scan_reason === null) reasons.push("non_complete_root_without_reason");
    if (root.privacy_mode === PRIVACY_PRIVATE_AGGREGATE) {
      for (const field of ["path", "normalized_path_hash", "device", "inode", "mode"]) {
        if (root[field] !== null) reasons.push(`private_root_${field}_disclosed`);
      }
      // A raw suffix outside the declared vocabulary is an identifying signal.
      for (const key of Object.keys(root.summary?.extension_distribution ?? {})) {
        if (!EXTENSION_VOCABULARY.includes(key)) reasons.push("private_root_extension_outside_vocabulary");
      }
      for (const key of Object.keys(root.summary?.size_bucket_distribution ?? {})) {
        if (!SIZE_BUCKETS.includes(key) && key !== "unknown") reasons.push("private_root_size_bucket_outside_vocabulary");
      }
      for (const key of Object.keys(root.summary?.mtime_bucket_distribution ?? {})) {
        if (!MTIME_BUCKETS.includes(key)) reasons.push("private_root_mtime_bucket_outside_vocabulary");
      }
    } else if (root.visibility === "private") {
      reasons.push("private_root_not_in_aggregate_mode");
    }
  }
  // A global COMPLETE requires EVERY root COMPLETE — an unvisited root can never be
  // laundered into a successful census.
  if (body.completeness === COMPLETENESS_COMPLETE && perRoot.some((r) => r.scan_state !== SCAN_COMPLETE)) {
    reasons.push("complete_with_non_complete_root");
  }
  for (const edge of body.topology?.containment ?? []) {
    if (visibilityOf.get(edge.parent) !== "private") continue;
    const child = perRoot.find((root) => root.root_id === edge.child);
    if (child && child.path !== null) reasons.push("nested_root_discloses_private_parent_path");
  }
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze([...new Set(reasons)]) });
}

export function runNode00ThreeRootCensus({ consent, input } = {}) {
  const plan = planNode00ThreeRootCensus({ consent, input });
  if (!plan.eligible) return envelope(false, null, plan.blocked_by);

  let census;
  try {
    census = censusRoots(input);
  } catch (err) {
    const code = err instanceof CensusRootAdmissionError ? err.code : "census_failed";
    return envelope(false, null, [code]);
  }

  const payload = buildNode00ThreeRootCensusPayload(census);
  const verified = verifyNode00ThreeRootCensus(payload);
  if (!verified.ok) return envelope(false, payload.content_hash, verified.reasons);

  const portable = verifyPortableArtifacts({ payload, entries: census.entries, warnings: census.warnings });
  if (!portable.ok) return envelope(false, payload.content_hash, portable.reasons);

  const tampered = { ...payload, totals: { ...payload.totals, entries: payload.totals.entries + 1 } };
  if (verifyNode00ThreeRootCensus(tampered).ok) return envelope(false, payload.content_hash, ["tamper_not_rejected"]);

  return Object.freeze({
    ok: true,
    schema: NODE00_THREE_ROOT_CENSUS_SCHEMA,
    truth_label: NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary: node00ThreeRootCensusBoundary(),
    blocked_by: Object.freeze([]),
    payload,
    entries: census.entries,
    warnings: census.warnings,
  });
}

function envelope(ok, content_hash, blocked_by) {
  return Object.freeze({
    ok,
    schema: NODE00_THREE_ROOT_CENSUS_SCHEMA,
    truth_label: NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL,
    content_hash,
    boundary: node00ThreeRootCensusBoundary(),
    blocked_by: Object.freeze([...blocked_by]),
    payload: null,
    entries: Object.freeze([]),
    warnings: Object.freeze([]),
  });
}
