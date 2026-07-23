// NODE00-THREE-ROOT-CENSUS-0B — bounded, metadata-only census across explicitly
// declared filesystem roots, with most-specific-root ownership and a
// privacy-preserving portable body.
//
// PURE KERNEL. No fs / network / clock / random in this file. The census walk is
// driven through an INJECTED metadata adapter:
//
//   adapter.lstat(absPath)  -> { device, inode, mode, size_bytes, mtime_ms, type }
//                              type ∈ "directory" | "file" | "symlink" | "other"
//                              throws { code } when the entry cannot be stat'ed
//   adapter.readdir(absDir) -> string[] (bare names, no paths)
//   adapter.now()           -> monotonic-ish millisecond number (duration bound only)
//
// The adapter surface is deliberately narrow: ONLY lstat/readdir/now. This kernel
// never reads, opens, streams, resolves, or mutates anything. It cannot: the
// forbidden operations (readFile, open, createReadStream, stat, realpath,
// writeFile, rename, mkdir, chmod, rm, unlink, copyFile) appear nowhere in this
// module and are not reachable through the adapter contract. The real effect
// adapter lives in apps/cli/src/commands/node00-three-root-census.js, which is the
// ONLY fs surface for this slice; the external proof writer lives there too and is
// deliberately separate from this scanner.
//
// `node:path` is used only for pure string arithmetic on already-injected strings.
//
// OWNERSHIP LAW: every filesystem entry belongs to the most-specific explicitly
// declared root containing it. When a parent traversal reaches a directory that is
// itself an admitted root, the traversal records a `delegated_root` marker and does
// NOT descend — the child root owns its own subtree. Root argument ordering cannot
// change ownership or the deterministic body hash: roots are canonically ordered
// before traversal and all emitted collections are sorted by a stable, privacy-safe
// key.
//
// SYMLINK LAW: a symlink is recorded as metadata and never resolved, never
// descended. DEVICE LAW: an entry on a different device than its owning root is
// recorded as a boundary failure and never descended.
//
// PRIVACY LAW: a root declared `visibility: "private"` never emits a raw path or
// basename anywhere — not in the body, not in entries, not in warnings, not in
// thrown error messages. Only `relative_path_hash`, `extension` and `coarse_type`
// escape. Roots declared `visibility: "public"` (repository roots) may emit
// normalized repository-relative paths.
//
// Extension/category vocabulary is REUSED AS A CONCEPT from node0-space-index.js
// (reviewed there), deliberately re-declared here rather than imported: that module
// carries an fs surface including mkdir/writeFile/rename/chmod/createReadStream,
// none of which may be reachable from this slice.
//
// WHAT THIS DOES NOT PROVE: content identity (no bytes are read), semantic meaning,
// deduplication, an asset registry, or authenticity against a forger who controls
// every field and recomputes the hash — verify() proves internal body consistency
// only, not independent authenticity. There is no external anchor in this slice.
//
// M5.1B: hash-bearing slices use the ONE canonical byte contract — no local
// serializer copy.
import { isAbsolute, normalize, sep } from "node:path";

import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const NODE00_THREE_ROOT_CENSUS_SCHEMA = "bizra.dema.node00_three_root_census.v0.1";
export const NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL = "NODE00_THREE_ROOT_CENSUS_MEASURED_REPO";
export const NODE00_THREE_ROOT_CENSUS_GO_PHRASE = "GO: node00 three root census preview";

export const COMPLETENESS_COMPLETE = "COMPLETE";
export const COMPLETENESS_BOUNDED_PARTIAL = "BOUNDED_PARTIAL";

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

// Pure basename/extension arithmetic on an already-injected name string.
function extensionOf(name) {
  const dot = name.lastIndexOf(".");
  if (dot <= 0 || dot === name.length - 1) return "";
  return name.slice(dot).toLowerCase();
}

export function hashText(value) {
  return sha256CanonicalJsonV1(String(value));
}

// The canonical byte contract caps a single array at 1024 elements (a deliberate
// fail-closed bound in packages/canon). A real census carries hundreds of thousands
// of rows, so a collection is digested as a CHUNKED MERKLE FOLD: hash each row, fold
// the row hashes in blocks, and repeat until one root hash remains. Every level uses
// the ONE canonical contract — no local serializer, no giant intermediate string, and
// the result is order-dependent (rows are canonically sorted before folding).
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

// All-false boundary invariant. Keys mirror the capability-truth-registry row.
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

function normalizedRootPath(value) {
  const normalized = normalize(value);
  if (normalized.length > 1 && normalized.endsWith(sep)) return normalized.slice(0, -1);
  return normalized;
}

function joinPath(dir, name) {
  return dir === sep ? `${sep}${name}` : `${dir}${sep}${name}`;
}

// True when `child` is strictly inside `parent` (both normalized absolute paths).
function isStrictlyInside(parent, child) {
  return child !== parent && child.startsWith(parent === sep ? sep : parent + sep);
}

// Fail-closed plan. Absence of a block is never validation: every precondition is
// POSITIVELY proven before `eligible` can be true.
export function planNode00ThreeRootCensus({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE00_THREE_ROOT_CENSUS_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
    return frozenPlan(blocked_by);
  }
  const { roots, adapter, bounds } = input;
  if (!Array.isArray(roots) || roots.length === 0) blocked_by.push("roots_not_declared");
  else {
    const ids = new Set();
    for (const root of roots) {
      if (!root || typeof root !== "object") { blocked_by.push("root_not_object"); continue; }
      if (typeof root.id !== "string" || root.id === "") blocked_by.push("root_id_missing");
      else if (ids.has(root.id)) blocked_by.push("root_id_duplicated");
      else ids.add(root.id);
      if (typeof root.path !== "string" || !isAbsolute(root.path)) blocked_by.push("root_path_not_absolute");
      if (root.visibility !== "private" && root.visibility !== "public") blocked_by.push("root_visibility_undeclared");
    }
  }
  if (!adapter || typeof adapter !== "object") blocked_by.push("adapter_missing");
  else {
    for (const fn of ["lstat", "readdir", "now"]) {
      if (typeof adapter[fn] !== "function") blocked_by.push(`adapter_${fn}_missing`);
    }
  }
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

// Root admission. Each root must exist, be a real directory, not be a symlink, have
// no symlink ancestor, and be unique by OBSERVED identity (device+inode) — an alias
// resolving to an already-admitted identity fails closed rather than double-counting.
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
        path,
        normalized_path_hash: hashText(path),
        device: stat.device,
        inode: stat.inode,
        mode: stat.mode,
      }),
    );
  }
  // Canonical order: by normalized path. Argument order cannot affect ownership,
  // traversal, or the body hash.
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

// Observed topology — derived from the admitted roots, never assumed.
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

// Privacy projection: the ONLY place a raw relative path may become an emitted field.
function projectPath(root, relativePath, name) {
  const hash = hashText(relativePath);
  if (root.visibility === "public") {
    return { relative_path: relativePath, basename: name, relative_path_hash: hash };
  }
  return { relative_path: null, basename: null, relative_path_hash: hash };
}

// Bounded, metadata-only traversal honouring the ownership, symlink and device laws.
export function censusRoots({ roots, adapter, bounds = {} }) {
  const admitted = admitCensusRoots({ roots, adapter });
  const limits = { ...DEFAULT_CENSUS_BOUNDS, ...bounds };
  const rootByPath = new Map(admitted.map((root) => [root.path, root]));
  const entries = [];
  const warnings = [];
  const state = { count: 0, truncated: null, started: adapter.now() };

  for (const root of admitted) {
    walkRoot(root, rootByPath, adapter, limits, entries, warnings, state);
  }

  // Revalidate every root identity AFTER traversal — a substituted root invalidates
  // the run outright; it can never be reported COMPLETE.
  for (const root of admitted) {
    let stat = null;
    try {
      stat = adapter.lstat(root.path);
    } catch {
      stat = null;
    }
    if (!stat || stat.device !== root.device || stat.inode !== root.inode) {
      warnings.push(
        Object.freeze({
          root_id: root.id,
          code: "ROOT_SUBSTITUTED_DURING_SCAN",
          relative_path: null,
          basename: null,
          relative_path_hash: root.normalized_path_hash,
        }),
      );
      state.truncated = state.truncated ?? "root_substituted";
    }
  }

  entries.sort(entryOrder);
  warnings.sort(warningOrder);
  return Object.freeze({
    admitted,
    limits: Object.freeze({ ...limits }),
    entries: Object.freeze(entries),
    warnings: Object.freeze(warnings),
    completeness: state.truncated ? COMPLETENESS_BOUNDED_PARTIAL : COMPLETENESS_COMPLETE,
    truncation_reason: state.truncated,
  });
}

function entryOrder(a, b) {
  if (a.root_id !== b.root_id) return a.root_id < b.root_id ? -1 : 1;
  const ka = a.relative_path ?? a.relative_path_hash;
  const kb = b.relative_path ?? b.relative_path_hash;
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

function warningOrder(a, b) {
  if (a.root_id !== b.root_id) return a.root_id < b.root_id ? -1 : 1;
  if (a.code !== b.code) return a.code < b.code ? -1 : 1;
  const ka = a.relative_path ?? a.relative_path_hash ?? "";
  const kb = b.relative_path ?? b.relative_path_hash ?? "";
  return ka < kb ? -1 : ka > kb ? 1 : 0;
}

function walkRoot(root, rootByPath, adapter, limits, entries, warnings, state) {
  const queue = [{ absPath: root.path, relativePath: "", depth: 0 }];
  while (queue.length > 0) {
    if (state.truncated) return;
    const dir = queue.shift();
    let names;
    try {
      names = adapter.readdir(dir.absPath);
    } catch (err) {
      warnings.push(
        Object.freeze({
          root_id: root.id,
          code: "DIRECTORY_UNREADABLE",
          error_code: err && typeof err.code === "string" ? err.code : "unknown",
          ...projectPath(root, dir.relativePath, null),
        }),
      );
      continue;
    }
    for (const name of [...names].sort()) {
      if (state.truncated) return;
      if (state.count >= limits.max_entries) { state.truncated = "max_entries"; return; }
      if (adapter.now() - state.started >= limits.max_millis) { state.truncated = "max_millis"; return; }

      const absPath = joinPath(dir.absPath, name);
      const relativePath = dir.relativePath === "" ? name : `${dir.relativePath}/${name}`;
      let stat;
      try {
        stat = adapter.lstat(absPath);
      } catch (err) {
        // A vanished or unreadable entry stays EXPLICIT evidence, never a silent omission.
        warnings.push(
          Object.freeze({
            root_id: root.id,
            code: "ENTRY_VANISHED_OR_UNREADABLE",
            error_code: err && typeof err.code === "string" ? err.code : "unknown",
            ...projectPath(root, relativePath, name),
          }),
        );
        continue;
      }

      const extension = stat.type === "file" ? extensionOf(name) : "";
      const delegated = stat.type === "directory" ? rootByPath.get(absPath) : undefined;
      const crossesDevice = stat.device !== root.device;

      state.count += 1;
      entries.push(
        Object.freeze({
          root_id: root.id,
          ...projectPath(root, relativePath, name),
          entry_type: stat.type,
          extension,
          coarse_type: stat.type === "file" ? coarseTypeForExtension(extension) : "none",
          size_bytes: stat.type === "file" ? stat.size_bytes : null,
          depth: dir.depth + 1,
          device: stat.device,
          inode: stat.inode,
          mode: stat.mode,
          delegated_root: delegated && delegated.id !== root.id ? delegated.id : null,
          device_boundary: crossesDevice,
        }),
      );

      if (stat.type !== "directory") continue; // symlink: recorded, never resolved, never descended
      if (delegated && delegated.id !== root.id) continue; // ownership delegated to the more specific root
      if (crossesDevice) {
        warnings.push(
          Object.freeze({
            root_id: root.id,
            code: "DEVICE_BOUNDARY_NOT_CROSSED",
            error_code: null,
            ...projectPath(root, relativePath, name),
          }),
        );
        continue;
      }
      if (dir.depth + 1 >= limits.max_depth) {
        state.truncated = "max_depth";
        return;
      }
      queue.push({ absPath, relativePath, depth: dir.depth + 1 });
    }
  }
}

// Deterministic body: identical for the same frozen metadata snapshot regardless of
// root argument ordering, run id, timestamp, PID or temporary path. Volatile run
// metadata lives OUTSIDE the hashed body, in the writer's receipt.
export function buildNode00ThreeRootCensusPayload(census) {
  const privateRoots = census.admitted.filter((root) => root.visibility === "private");
  // A PUBLIC root nested inside a PRIVATE root would disclose the private root's
  // absolute path as its own prefix. Containment is measured, so this is refused
  // structurally: only a public root that no private root contains may emit a path.
  const disclosable = (root) =>
    root.visibility === "public" && !privateRoots.some((p) => isStrictlyInside(p.path, root.path));

  const perRoot = census.admitted.map((root) => {
    const rows = census.entries.filter((entry) => entry.root_id === root.id);
    return Object.freeze({
      root_id: root.id,
      visibility: root.visibility,
      // A private root never emits its absolute path — only the hash. Nor does a
      // public root whose path is prefixed by a private one.
      path: disclosable(root) ? root.path : null,
      normalized_path_hash: root.normalized_path_hash,
      device: root.device,
      inode: root.inode,
      mode: root.mode,
      entries: rows.length,
      files: rows.filter((r) => r.entry_type === "file").length,
      directories: rows.filter((r) => r.entry_type === "directory").length,
      symlinks: rows.filter((r) => r.entry_type === "symlink").length,
      other: rows.filter((r) => r.entry_type === "other").length,
      delegated_roots: rows.filter((r) => r.delegated_root !== null).length,
      size_bytes_total: rows.reduce((sum, r) => sum + (r.size_bytes ?? 0), 0),
    });
  });

  const body = {
    schema: NODE00_THREE_ROOT_CENSUS_SCHEMA,
    truth_label: NODE00_THREE_ROOT_CENSUS_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    completeness: census.completeness,
    truncation_reason: census.truncation_reason,
    bounds: census.limits,
    topology: deriveCensusTopology(census.admitted),
    per_root: Object.freeze(perRoot),
    totals: Object.freeze({
      roots: census.admitted.length,
      entries: census.entries.length,
      files: census.entries.filter((r) => r.entry_type === "file").length,
      directories: census.entries.filter((r) => r.entry_type === "directory").length,
      symlinks: census.entries.filter((r) => r.entry_type === "symlink").length,
      other: census.entries.filter((r) => r.entry_type === "other").length,
      delegated_roots: census.entries.filter((r) => r.delegated_root !== null).length,
      warnings: census.warnings.length,
    }),
    entries_digest: foldDigest(census.entries),
    warnings_digest: foldDigest(census.warnings),
    digest_fold_width: DIGEST_FOLD_WIDTH,
    boundary: node00ThreeRootCensusBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation. Recomputes over the WHOLE body minus its hash field —
// never a seed or subset. DECLARED LIMIT: this proves internal consistency only. A
// forger who controls every field and recomputes the hash is NOT detected; that
// needs an independent anchor (signature or externally measured state hash), which
// this slice does not have and does not claim.
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

  // Non-vacuous boundary check: exact canonical key set, every value strictly false.
  const boundary = body.boundary;
  if (!boundary || typeof boundary !== "object") reasons.push("boundary_missing");
  else {
    const keys = Object.keys(boundary).sort();
    if (keys.length !== BOUNDARY_KEYS.length || keys.some((k, i) => k !== BOUNDARY_KEYS[i])) {
      reasons.push("boundary_key_set_mismatch");
    }
    if (BOUNDARY_KEYS.some((k) => boundary[k] !== false)) reasons.push("boundary_not_all_false");
  }

  // Privacy invariant is part of verification, not merely of generation. Checkable
  // from the body alone: a private root never discloses a path, and neither does any
  // root the measured topology places INSIDE a private one.
  const perRoot = body.per_root ?? [];
  const visibilityOf = new Map(perRoot.map((root) => [root.root_id, root.visibility]));
  for (const root of perRoot) {
    if (root.visibility === "private" && root.path !== null) reasons.push("private_root_path_disclosed");
  }
  for (const edge of body.topology?.containment ?? []) {
    if (visibilityOf.get(edge.parent) !== "private") continue;
    const child = perRoot.find((root) => root.root_id === edge.child);
    if (child && child.path !== null) reasons.push("nested_root_discloses_private_parent_path");
  }
  return Object.freeze({ ok: reasons.length === 0, reasons: Object.freeze(reasons) });
}

// Orchestrator the review gate consumes: plan -> admit -> walk -> build -> verify ->
// tamper-reject. Fails closed with a named block on every failure path.
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

  // Tamper-reject: a mutated body with a stale hash must not verify.
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
