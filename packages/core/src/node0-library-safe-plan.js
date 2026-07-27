/**
 * مكتبة نود0 · NODE0-LIBRARY-AUTHORITATIVE-COMPLETION-1A — read-only replay.
 *
 * The authoritative pipeline. Unlike the 1A planner, this RETAINS its full-hash
 * duplicate groups all the way to the manifest, so membership is never later
 * reconstructed from basenames.
 *
 *   FRESH CENSUS → DECLARED EXCLUSIONS → EXACT SIZE GROUPING
 *   → SAMPLED-FINGERPRINT FILTER (filter only, never proof)
 *   → COMPLETE SHA-256 CONFIRMATION → IMMUTABLE DUPLICATE SETS
 *   → PROTECTED-ZONE CLASSIFICATION → KEEPER RESOLUTION
 *   → FRESH PRECONDITION CAPTURE → READ-ONLY REVIEW MANIFEST
 *
 * Contains no mutation primitive. There is no rename, unlink, link, rm, mkdir or
 * write of user paths anywhere in this module; the only write is the operator's
 * own artifact, performed by the CLI, outside the declared roots.
 */

import { createHash } from "node:crypto";
import { createReadStream, lstatSync, openSync, readSync, closeSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  classifyZone,
  zoneDisposition,
  resolveKeeper,
  deriveSetId,
} from "./node0-library-dedupe-safe.js";

export const SAFE_PLAN_SCHEMA = "bizra.dema.node0_library_authoritative_safe_plan.v0.1";
export const SCANNER_VERSION = "node0-library-safe-plan/1.0.0";

/** Regenerable machine trees. Excluded before hashing — declared, not silent. */
export const DECLARED_EXCLUSIONS = Object.freeze([
  "node_modules", ".git", ".next", "__pycache__", ".venv", "venv", "site-packages",
  ".gradle", "target", "dist", "build", ".npm", ".pnpm-store", ".cache",
]);

const sha256Hex = (s) => createHash("sha256").update(s).digest("hex");

/** Discover active git worktrees from real disk state. */
export function discoverWorktrees(roots, maxDepth = 5) {
  const found = [];
  const walk = (dir, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (entries.some((e) => e.name === ".git")) { found.push(dir); return; }
    for (const e of entries) {
      if (!e.isDirectory() || e.isSymbolicLink()) continue;
      if (DECLARED_EXCLUSIONS.includes(e.name)) continue;
      walk(join(dir, e.name), depth + 1);
    }
  };
  for (const r of roots) walk(resolve(r), 0);
  return found.sort();
}

/** Fresh stat. Returns null when the path became unreadable. */
function capturePrecondition(absPath) {
  try {
    const st = lstatSync(absPath, { bigint: true });
    return {
      device: Number(st.dev),
      inode: String(st.ino),
      size: Number(st.size),
      mtime_ns: String(st.mtimeNs),
      mode: Number(st.mode),
      uid_or_owner_when_available: Number(st.uid),
    };
  } catch {
    return null;
  }
}

/**
 * Sampled fingerprint: head + middle + tail regions. A FILTER only — two files
 * sharing a fingerprint are still candidates, never confirmed duplicates.
 */
function sampledFingerprint(absPath, size, sampleBytes = 16384) {
  let fd;
  try {
    fd = openSync(absPath, "r");
    const h = createHash("sha256");
    const buf = Buffer.alloc(sampleBytes);
    const offsets = size <= sampleBytes * 3
      ? [0]
      : [0, Math.floor(size / 2) - sampleBytes / 2, size - sampleBytes];
    for (const off of offsets) {
      const n = readSync(fd, buf, 0, Math.min(sampleBytes, size), Math.max(0, Math.floor(off)));
      h.update(buf.subarray(0, n));
    }
    h.update(String(size));
    return h.digest("hex");
  } catch {
    return null;
  } finally {
    if (fd !== undefined) try { closeSync(fd); } catch { /* already closed */ }
  }
}

function fullSha256(absPath) {
  return new Promise((res) => {
    const h = createHash("sha256");
    const s = createReadStream(absPath, { highWaterMark: 1024 * 1024 });
    s.on("data", (c) => h.update(c));
    s.on("end", () => res(h.digest("hex")));
    s.on("error", () => res(null));
  });
}

/**
 * Cache key binds identity, not just path: a file edited in place gets a new
 * mtime/size and therefore a new key, so a stale hash can never be reused.
 * Re-hashing 625,000 files costs an hour; a wrong cache hit costs correctness,
 * so the key is deliberately over-specified.
 */
const cacheKey = (p, st) => `${p} ${st.device} ${st.inode} ${st.size} ${st.mtime_ns}`;

export async function buildAuthoritativeSafePlan({
  roots,
  rootPriority,
  measuredAt,
  onProgress = () => {},
  useSampledFilter = true,
  // A manifest must not measure itself. The artifacts directory may live inside
  // a declared root — that is a placement detail — but it is pruned from the
  // walk so an observation never becomes part of its own observation.
  excludePaths = [],
  hashCache = new Map(),
}) {
  const declaredRoots = roots.map((r) => resolve(r));
  const pruned = excludePaths.map((p) => resolve(p));
  const isPruned = (abs) => pruned.some((x) => abs === x || abs.startsWith(`${x}/`));
  const startedAt = process.hrtime.bigint();
  const perf = {
    files_inventoried: 0, files_excluded_before_hashing: 0, size_groups: 0,
    files_sampled: 0, files_fully_hashed: 0, bytes_read: 0,
    unreadable_files: 0, changed_files: 0, cache_hits: 0,
    phase_ms: { census: 0, size_group: 0, sample: 0, hash: 0, zones: 0, precondition: 0 },
    sampled_filter_rejection_rate: null, complete_hash_confirmation_rate: null,
  };

  // ── 1. fresh census (size + path only; no content) ──────────────────────
  const files = [];
  const walk = (dir) => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { perf.unreadable_files += 1; return; }
    for (const e of entries) {
      const abs = join(dir, e.name);
      if (e.isSymbolicLink()) continue;
      if (e.isDirectory()) {
        if (DECLARED_EXCLUSIONS.includes(e.name) || isPruned(abs)) {
          perf.files_excluded_before_hashing += 1;
          continue;
        }
        walk(abs);
        continue;
      }
      if (isPruned(abs)) { perf.files_excluded_before_hashing += 1; continue; }
      if (!e.isFile()) continue;
      let st;
      try { st = lstatSync(abs); } catch { perf.unreadable_files += 1; continue; }
      if (st.size <= 0) continue;
      files.push({ path: abs, size: st.size });
      perf.files_inventoried += 1;
      if (perf.files_inventoried % 100000 === 0) onProgress("census", perf.files_inventoried);
    }
  };
  for (const r of declaredRoots) walk(r);

  // ── 2. exact size grouping ──────────────────────────────────────────────
  const bySize = new Map();
  for (const f of files) {
    if (!bySize.has(f.size)) bySize.set(f.size, []);
    bySize.get(f.size).push(f.path);
  }
  const sizeGroups = [...bySize.entries()].filter(([, ps]) => ps.length > 1);
  perf.size_groups = sizeGroups.length;

  // ── 3. sampled fingerprint filter (never proof) ─────────────────────────
  const toHash = [];
  if (useSampledFilter) {
    let sampled = 0;
    let survived = 0;
    for (const [size, paths] of sizeGroups) {
      const byFp = new Map();
      for (const p of paths) {
        const fp = sampledFingerprint(p, size);
        sampled += 1;
        const key = fp ?? `unreadable:${p}`;
        if (!byFp.has(key)) byFp.set(key, []);
        byFp.get(key).push(p);
      }
      for (const [, group] of byFp) {
        if (group.length < 2) continue;
        toHash.push({ size, paths: group });
        survived += group.length;
      }
      if (sampled % 50000 === 0) onProgress("sample", sampled);
    }
    perf.files_sampled = sampled;
    perf.sampled_filter_rejection_rate = sampled > 0 ? +(1 - survived / sampled).toFixed(4) : null;
  } else {
    for (const [size, paths] of sizeGroups) toHash.push({ size, paths });
  }

  // ── 4. complete SHA-256 confirmation — the only identity proof ──────────
  const phaseHashStart = process.hrtime.bigint();
  const sets = [];
  let hashed = 0;
  let confirmed = 0;
  const unreadable = [];
  const freshHashes = new Map();
  for (const group of toHash) {
    const byHash = new Map();
    for (const p of group.paths) {
      const st = capturePrecondition(p);
      const key = st ? cacheKey(p, st) : null;
      let h = key && hashCache.has(key) ? hashCache.get(key) : null;
      if (h) perf.cache_hits += 1;
      else {
        h = await fullSha256(p);
        hashed += 1;
        perf.bytes_read += group.size;
      }
      if (h === null) { unreadable.push(p); perf.unreadable_files += 1; continue; }
      if (key) freshHashes.set(key, h);
      if (!byHash.has(h)) byHash.set(h, []);
      byHash.get(h).push(p);
      if ((hashed + perf.cache_hits) % 25000 === 0) onProgress("hash", hashed + perf.cache_hits);
    }
    for (const [hash, paths] of byHash) {
      if (paths.length < 2) continue;
      confirmed += paths.length;
      sets.push({
        set_id: deriveSetId(hash, group.size, sha256Hex),
        sha256: hash,
        size_bytes: group.size,
        paths: [...paths].sort(),
      });
    }
  }
  perf.files_fully_hashed = hashed;
  perf.phase_ms.hash = Math.round(Number(process.hrtime.bigint() - phaseHashStart) / 1e6);
  perf.complete_hash_confirmation_rate = hashed > 0 ? +(confirmed / hashed).toFixed(4) : null;

  // ── 5. protected zones from real disk state ─────────────────────────────
  onProgress("worktrees", 0);
  const worktreeRoots = discoverWorktrees(declaredRoots);
  const ctx = { worktree_roots: worktreeRoots, root_priority: rootPriority.map((r) => resolve(r)) };

  // ── 6. keeper + fresh precondition capture + drift detection ────────────
  const enriched = [];
  for (const set of sets) {
    const members = [];
    let drifted = false;
    let unreadableMember = false;
    for (const p of set.paths) {
      const pre = capturePrecondition(p);
      // Drift is a property of THIS file. `drifted` is the set-level OR of its
      // members; reading it per member stains every sibling sorted after the
      // first one that changed.
      const memberDrifted = pre !== null && pre.size !== set.size_bytes;
      if (pre === null) { unreadableMember = true; perf.unreadable_files += 1; }
      else if (memberDrifted) { drifted = true; perf.changed_files += 1; }
      const zone = classifyZone(p, ctx);
      members.push({
        path: p,
        ...(pre ?? {}),
        protected_zone: zone,
        disposition: zoneDisposition(zone),
        readability: pre === null ? "UNREADABLE" : "READABLE",
        freshness: pre === null ? "NOT_OBSERVED" : memberDrifted ? "PRECONDITION_DRIFT" : "FRESH",
        evidence_refs: [`zone_rule=${zone}`, `stat_at=${measuredAt}`],
      });
    }
    enriched.push({ ...set, members, drifted, unreadableMember });
  }

  const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
  return {
    declaredRoots,
    worktreeRoots,
    ctx,
    sets: enriched,
    unreadable,
    perf: { ...perf, elapsed_ms: Math.round(elapsedMs) },
    freshHashes,
    exclusionPolicyHash: sha256Hex(DECLARED_EXCLUSIONS.join("\n")),
    worktreeInventoryHash: sha256Hex(worktreeRoots.join("\n")),
    resolveKeeper: (paths) => resolveKeeper(paths, ctx),
  };
}
