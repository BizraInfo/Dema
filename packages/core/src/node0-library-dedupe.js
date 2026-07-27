/**
 * مكتبة نود0 · NODE0-LIBRARY-DEDUPE-1A — pure duplicate-set kernel.
 *
 * "No duplication, no repeats." Three stages, so that a 756,000-file corpus can
 * be de-duplicated without hashing 756,000 files:
 *
 *   1. sizeCandidates()      — group by exact byte size. Free. Two files of
 *                              different size cannot be identical, so only
 *                              same-size groups of 2+ are ever hashed.
 *   2. confirmDuplicateSets() — identity is the HASH. Never the name.
 *   3. planQuarantine()      — decide which copy survives, deterministically,
 *                              and emit a steward job that MOVES the rest.
 *
 * Two rules are load-bearing and both come from evidence, not caution:
 *
 *   · Near-identical is not identical. In the demo corpus `requirements-copy.md`
 *     looked like a duplicate of `requirements.md` and held the only accepted
 *     rollback requirement in the whole folder. Same size, different bytes,
 *     different meaning. Only a matching hash counts.
 *
 *   · Nothing is deleted. The plan quarantines into a directory outside every
 *     source root, and runs through `dema steward` — which backs up, writes undo
 *     receipts, and rolls back the whole job if any single atom fails.
 */

import { isWithinRoot } from "./first-encounter-admission.js";

export const NODE0_LIBRARY_DEDUPE_SCHEMA = "bizra.dema.node0_library_dedupe.v0.1";

class DedupeError extends Error {
  constructor(code, detail) {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "DedupeError";
    this.code = code;
  }
}

/** Strip trailing slashes so `/q/` + `/a/x` never becomes `/q//a/x`. Root `/` stays `/`. */
function normalizeAbsDir(p) {
  if (typeof p !== "string" || !p.startsWith("/")) return p;
  if (p === "/") return "/";
  return p.replace(/\/+$/, "");
}

/**
 * Stage 1 — size buckets. Zero-byte files are excluded: every empty file is
 * byte-identical to every other, which is true and useless.
 */
export function sizeCandidates(records) {
  if (!Array.isArray(records)) throw new DedupeError("INVALID_RECORDS");
  const bySize = new Map();
  for (const r of records) {
    if (!r || typeof r.size !== "number" || r.size <= 0) continue;
    if (!bySize.has(r.size)) bySize.set(r.size, []);
    bySize.get(r.size).push(r.relative_path);
  }
  const groups = [];
  let filesToHash = 0;
  for (const [size, paths] of [...bySize.entries()].sort((a, b) => b[0] - a[0])) {
    if (paths.length < 2) continue;
    const sorted = [...paths].sort();
    groups.push(Object.freeze({ size, paths: Object.freeze(sorted) }));
    filesToHash += sorted.length;
  }
  return Object.freeze({
    files_total: records.length,
    files_to_hash: filesToHash,
    hash_avoided: records.length - filesToHash,
    groups: Object.freeze(groups),
  });
}

/**
 * Stage 2 — confirm by hash. A path with no hash is dropped from its group
 * rather than assumed to match; an unhashable file is not evidence of anything.
 */
export function confirmDuplicateSets(candidateGroups, hashesByPath) {
  if (!Array.isArray(candidateGroups)) throw new DedupeError("INVALID_GROUPS");
  const hashes = hashesByPath ?? {};
  const sets = [];
  for (const group of candidateGroups) {
    const byHash = new Map();
    for (const p of group.paths) {
      const h = hashes[p];
      if (typeof h !== "string" || h.length === 0) continue;
      if (!byHash.has(h)) byHash.set(h, []);
      byHash.get(h).push(p);
    }
    for (const [hash, paths] of [...byHash.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1))) {
      if (paths.length < 2) continue;
      const sorted = [...paths].sort();
      sets.push(
        Object.freeze({
          hash,
          size: group.size,
          paths: Object.freeze(sorted),
          reclaimable_bytes: group.size * (sorted.length - 1),
        }),
      );
    }
  }
  return Object.freeze(sets);
}

/**
 * Filenames the copying tool itself marked as the copy. Found by running the
 * planner on the demo corpus: it kept `metrics-export-copy.csv` and quarantined
 * `metrics-export.csv`, because `-copy` sorts before `.csv` lexically. At scale
 * that systematically keeps the wrong file — Google Drive names duplicates
 * `photo (1).jpg`, macOS writes ` copy`, Windows writes ` - Copy`.
 */
const COPY_MARKER = /(\(\d+\)|[-_ ]cop(y|ie)|[-_ ]duplicate|[-_ ]dup)(\.[^./]+)?$/i;

/**
 * Which copy survives, in strict order:
 *   1. highest-priority root (caller's order — canonical location wins)
 *   2. NOT marked as a copy by the tool that made it
 *   3. shallowest path (a file at the top is more likely the original)
 *   4. lexical order (a tie-break that is stable, not arbitrary)
 */
function pickKeeper(paths, rootPriority) {
  const rank = (p) => {
    const i = rootPriority.findIndex((root) => p === root || p.startsWith(`${root}/`));
    return i === -1 ? rootPriority.length : i;
  };
  const isCopy = (p) => (COPY_MARKER.test(p.slice(p.lastIndexOf("/") + 1)) ? 1 : 0);
  return [...paths].sort((a, b) => {
    const ra = rank(a);
    const rb = rank(b);
    if (ra !== rb) return ra - rb;
    const ca = isCopy(a);
    const cb = isCopy(b);
    if (ca !== cb) return ca - cb;
    const da = a.split("/").length;
    const db = b.split("/").length;
    if (da !== db) return da - db;
    return a < b ? -1 : a > b ? 1 : 0;
  })[0];
}

export function planQuarantine(duplicateSets, { root_priority = [], quarantine_root } = {}) {
  if (!Array.isArray(duplicateSets)) throw new DedupeError("INVALID_SETS");
  if (typeof quarantine_root !== "string" || !quarantine_root.startsWith("/")) {
    throw new DedupeError("QUARANTINE_ROOT_REQUIRED");
  }
  // Containment is only meaningful against the scanned roots. An empty list
  // would silently skip the "outside every source root" rule.
  if (!Array.isArray(root_priority) || root_priority.length === 0) {
    throw new DedupeError("ROOT_PRIORITY_REQUIRED");
  }
  const qRoot = normalizeAbsDir(quarantine_root);
  for (const root of root_priority) {
    const r = normalizeAbsDir(root);
    if (typeof r !== "string" || !r.startsWith("/")) {
      throw new DedupeError("INVALID_ROOT_PRIORITY", String(root));
    }
    // Segment-aware: `/demo/corpus-secret` is outside `/demo/corpus`.
    if (isWithinRoot(r, qRoot)) {
      throw new DedupeError("QUARANTINE_INSIDE_SOURCE_ROOT", quarantine_root);
    }
  }

  const keep = [];
  const atoms = [];
  let reclaimable = 0;

  for (const set of duplicateSets) {
    if (!Array.isArray(set.paths) || set.paths.length < 2) {
      throw new DedupeError("SINGLETON_IS_NOT_A_DUPLICATE", set.paths?.[0] ?? "(none)");
    }
    const keeper = pickKeeper(set.paths, root_priority.map(normalizeAbsDir));
    keep.push(keeper);
    for (const p of set.paths) {
      if (p === keeper) continue;
      // Mirror the full source path under the quarantine root so a restore is
      // unambiguous and two same-named duplicates cannot collide.
      // qRoot has no trailing slash; p is absolute → `/q` + `/a/x` = `/q/a/x`.
      atoms.push(Object.freeze({ from: p, to: `${qRoot}${p}` }));
      reclaimable += set.size;
    }
  }
  atoms.sort((a, b) => (a.from < b.from ? -1 : a.from > b.from ? 1 : 0));

  return Object.freeze({
    schema: NODE0_LIBRARY_DEDUPE_SCHEMA,
    truth_label: "LOCAL_DEDUPE_PLAN",
    action: "QUARANTINE",
    deletes_anything: false,
    duplicate_sets: duplicateSets.length,
    keep: Object.freeze(keep.sort()),
    atoms: Object.freeze(atoms),
    reclaimable_bytes: reclaimable,
    steward_job: Object.freeze({
      sandbox_root: qRoot,
      max_atoms: atoms.length,
      atoms: Object.freeze(atoms.map((a) => Object.freeze({ ...a }))),
    }),
    does_not_prove: Object.freeze([
      "that a quarantined copy is unwanted — it proves only that an identical copy remains",
      "that near-identical files are duplicates — only matching hashes are counted",
      "that the kept copy is the original — priority is a declared rule, not provenance",
    ]),
  });
}
