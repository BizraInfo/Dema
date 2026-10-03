// BIZRA-GENESIS-NODE0-URP-LOCAL-IGNITION-1A · GENESIS_RUNTIME_SPINE_1A.0
//
// I/O TIER — BIZRA-GENESIS-LOCAL-MISSION-0's bounded, metadata-only gatherer.
//
// It may: lstat entries, count them, total their sizes, classify by NAME, and
// record what it skipped.
// It may not: open a file, hash a file, follow a symlink, mutate anything, touch
// the network, or leave the canonical root.
//
// Everything is lstat-based. `statSync` is deliberately never imported: the one
// primitive that would follow a symlink is absent from this module, so "symlinks
// not followed" is a structural property, not a promise.

import { createHash } from "node:crypto";
import { lstatSync, readdirSync, realpathSync } from "node:fs";
import { join, resolve, sep } from "node:path";

import { classifyEntryName, MISSION_SKIP_REASONS, MISSION_TYPE_CATEGORIES } from "../../packages/genesis/src/urp0-mission-kernel.js";

// Resolve the operator's selected root to its real path. The realpath IS the
// canonical root: consent is bound to it, so a symlinked root cannot smuggle the
// walk somewhere the operator never saw.
export function canonicaliseRoot(rawRoot) {
  const abs = resolve(rawRoot);
  let real;
  try {
    real = realpathSync(abs);
  } catch {
    return { ok: false, blocked_by: ["root_unresolvable"], canonical_root: null };
  }
  let st;
  try {
    st = lstatSync(real);
  } catch {
    return { ok: false, blocked_by: ["root_unreadable"], canonical_root: null };
  }
  if (!st.isDirectory()) return { ok: false, blocked_by: ["root_not_a_directory"], canonical_root: null };
  return { ok: true, blocked_by: [], canonical_root: real };
}

function containedIn(root, path) {
  return path === root || path.startsWith(root + sep);
}

function emptyCounters() {
  const type_histogram = {};
  for (const k of MISSION_TYPE_CATEGORIES) type_histogram[k] = 0;
  const skipped_reasons = {};
  for (const k of MISSION_SKIP_REASONS) skipped_reasons[k] = 0;
  return { type_histogram, skipped_reasons };
}

// One bounded walk. `visit` receives (path, lstat result, depth) for every entry
// that passes containment. Returns the ceiling-compliance facts.
function walk(root, limits, visit, now = () => Date.now()) {
  const deadline = now() + limits.wall_clock_seconds * 1000;
  const started = now();
  let entries = 0;
  let outside = 0;
  const skips = { permission_denied: 0, depth_cap: 0, entry_cap: 0, deadline: 0, outside_root: 0, unreadable: 0 };
  let capped = false;

  const stack = [{ dir: root, depth: 0 }];
  while (stack.length > 0) {
    if (now() > deadline) { skips.deadline += 1; capped = true; break; }
    const { dir, depth } = stack.pop();
    let names;
    try {
      names = readdirSync(dir);
    } catch (error) {
      if (error?.code === "EACCES" || error?.code === "EPERM") skips.permission_denied += 1;
      else skips.unreadable += 1;
      continue;
    }
    for (const name of names) {
      if (entries >= limits.max_entries) { skips.entry_cap += 1; capped = true; break; }
      const path = join(dir, name);
      // Containment is checked on every single entry, before any syscall that
      // could act on it.
      if (!containedIn(root, path)) { outside += 1; skips.outside_root += 1; continue; }
      let st;
      try {
        st = lstatSync(path);
      } catch (error) {
        if (error?.code === "EACCES" || error?.code === "EPERM") skips.permission_denied += 1;
        else skips.unreadable += 1;
        continue;
      }
      entries += 1;
      visit(path, name, st, depth + 1);
      // A symlink is COUNTED and never traversed — that is the whole rule.
      if (st.isDirectory()) {
        if (depth + 1 >= limits.max_depth) skips.depth_cap += 1;
        else stack.push({ dir: path, depth: depth + 1 });
      }
    }
    if (capped) break;
  }
  return { entries, outside, skips, capped, elapsed_ms: Math.max(0, now() - started) };
}

// Metadata-only fingerprint of the source tree. Names, types, sizes, mtimes and
// modes — never contents. Taken before and after the mission so SAT-4 can prove
// the source was not touched.
export function fingerprintTree(root, limits) {
  const hash = createHash("sha256");
  const lines = [];
  walk(root, limits, (path, _name, st) => {
    const kind = st.isSymbolicLink() ? "l" : st.isDirectory() ? "d" : st.isFile() ? "f" : "o";
    lines.push(`${kind}\t${path.slice(root.length)}\t${st.size}\t${st.mtimeMs}\t${(st.mode & 0o7777).toString(8)}`);
  });
  for (const line of lines.sort()) hash.update(line, "utf8");
  return `sha256:${hash.digest("hex")}`;
}

// The mission itself. Returns the folded observation the pure kernel consumes —
// counters only, never a per-entry list, so no path inventory can leak into a
// receipt and the canonical array cap is structurally unreachable.
export function scanMetadataOnly({ canonical_root, limits }) {
  const { type_histogram, skipped_reasons } = emptyCounters();
  let files = 0;
  let directories = 0;
  let symlinks = 0;
  let total_file_bytes = 0;

  const w = walk(canonical_root, limits, (_path, name, st) => {
    if (st.isSymbolicLink()) {
      symlinks += 1;
      return;
    }
    if (st.isDirectory()) {
      directories += 1;
      return;
    }
    if (st.isFile()) {
      files += 1;
      total_file_bytes += st.size;
      type_histogram[classifyEntryName(name)] += 1;
    }
  });

  for (const [reason, count] of Object.entries(w.skips)) skipped_reasons[reason] += count;
  const skipped = Object.values(skipped_reasons).reduce((a, b) => a + b, 0);

  return {
    root_realpath: canonical_root,
    counts: { files, directories, symlinks, skipped },
    total_file_bytes,
    type_histogram,
    skipped_reasons,
    limits_honored: !w.capped,
    entries_outside_root: w.outside,
    symlinks_followed: 0,
    contents_read: false,
    contents_hashed: false,
    network_used: false,
    source_mutated: false,
    elapsed_ms: w.elapsed_ms,
  };
}
