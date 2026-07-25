import test from "node:test";
import assert from "node:assert/strict";

import {
  NODE0_LIBRARY_DEDUPE_SCHEMA,
  sizeCandidates,
  confirmDuplicateSets,
  planQuarantine,
} from "../packages/core/src/node0-library-dedupe.js";

const rec = (relative_path, size, over = {}) => ({
  relative_path,
  extension: relative_path.slice(relative_path.lastIndexOf(".")),
  size,
  modified_time: "2026-04-13T00:00:00.000Z",
  file_hash: "0".repeat(64),
  ...over,
});

/* ── stage 1: size buckets, so we hash ~5% instead of 756,000 files ───────── */

test("only same-size groups of 2+ are candidates", () => {
  const c = sizeCandidates([
    rec("/a/kali.7z", 3310000000),
    rec("/b/kali.7z", 3310000000),
    rec("/a/alone.pdf", 500),
  ]);
  assert.equal(c.groups.length, 1);
  assert.equal(c.groups[0].size, 3310000000);
  assert.equal(c.groups[0].paths.length, 2);
  assert.equal(c.files_to_hash, 2);
});

test("zero-byte files are never candidates — every empty file matches every other", () => {
  const c = sizeCandidates([rec("/a/x.tmp", 0), rec("/b/y.log", 0), rec("/c/z", 0)]);
  assert.equal(c.groups.length, 0);
});

test("candidate stage reports the saving it avoids, not the saving it makes", () => {
  const c = sizeCandidates([rec("/a/f", 10), rec("/b/f", 10), rec("/c/g", 20)]);
  assert.equal(c.files_total, 3);
  assert.equal(c.files_to_hash, 2);
  assert.equal(c.hash_avoided, 1);
});

/* ── stage 2: identity is the hash, never the name ────────────────────────── */

test("same size + same hash is a duplicate set", () => {
  const sets = confirmDuplicateSets([{ size: 100, paths: ["/a/x", "/b/x"] }], {
    "/a/x": "aa".repeat(32),
    "/b/x": "aa".repeat(32),
  });
  assert.equal(sets.length, 1);
  assert.equal(sets[0].paths.length, 2);
  assert.equal(sets[0].reclaimable_bytes, 100);
});

test("same size + different hash is NOT a duplicate — the requirements-copy lesson", () => {
  const sets = confirmDuplicateSets([{ size: 100, paths: ["/a/requirements.md", "/b/requirements-copy.md"] }], {
    "/a/requirements.md": "aa".repeat(32),
    "/b/requirements-copy.md": "bb".repeat(32),
  });
  assert.deepEqual(sets, []);
});

test("a missing hash drops the file from the set rather than assuming a match", () => {
  const sets = confirmDuplicateSets([{ size: 100, paths: ["/a/x", "/b/x", "/c/x"] }], {
    "/a/x": "aa".repeat(32),
    "/b/x": "aa".repeat(32),
  });
  assert.equal(sets.length, 1);
  assert.deepEqual(sets[0].paths, ["/a/x", "/b/x"]);
});

test("reclaimable counts every copy beyond the first, not the whole set", () => {
  const sets = confirmDuplicateSets([{ size: 50, paths: ["/a/x", "/b/x", "/c/x"] }], {
    "/a/x": "aa".repeat(32), "/b/x": "aa".repeat(32), "/c/x": "aa".repeat(32),
  });
  assert.equal(sets[0].reclaimable_bytes, 100);
});

/* ── stage 3: which copy survives — deterministic, never arbitrary ────────── */

const setOf = (paths) => [{ hash: "aa".repeat(32), size: 100, paths, reclaimable_bytes: 100 * (paths.length - 1) }];

test("the copy in the higher-priority root is kept", () => {
  const plan = planQuarantine(setOf(["/archive/x", "/data/bizra/x"]), {
    root_priority: ["/data/bizra", "/archive"],
    quarantine_root: "/q",
  });
  assert.equal(plan.keep[0], "/data/bizra/x");
  assert.equal(plan.atoms.length, 1);
  assert.equal(plan.atoms[0].from, "/archive/x");
});

test("within one root the shallower path wins, then lexical order — no coin flips", () => {
  const a = planQuarantine(setOf(["/r/deep/nested/x", "/r/x"]), { root_priority: ["/r"], quarantine_root: "/q" });
  assert.equal(a.keep[0], "/r/x");
  const b = planQuarantine(setOf(["/r/b/x", "/r/a/x"]), { root_priority: ["/r"], quarantine_root: "/q" });
  assert.equal(b.keep[0], "/r/a/x");
});

test("the copy the tool named as a copy is the one quarantined, not the original", () => {
  // Found by running the planner on the demo corpus: `-copy` sorts before `.csv`,
  // so lexical order alone kept the copy and moved the original.
  for (const [copy, original] of [
    ["/r/ops/metrics-export-copy.csv", "/r/ops/metrics-export.csv"],
    ["/r/img/photo (1).jpg", "/r/img/photo.jpg"],
    ["/r/doc/report - Copy.docx", "/r/doc/report.docx"],
    ["/r/a/notes copy.md", "/r/a/notes.md"],
  ]) {
    const plan = planQuarantine(setOf([copy, original]), { root_priority: ["/r"], quarantine_root: "/q" });
    assert.equal(plan.keep[0], original, `kept ${plan.keep[0]}`);
    assert.equal(plan.atoms[0].from, copy);
  }
});

test("root priority still outranks the copy marker", () => {
  const plan = planQuarantine(setOf(["/archive/x.csv", "/data/x-copy.csv"]), {
    root_priority: ["/data", "/archive"],
    quarantine_root: "/q",
  });
  assert.equal(plan.keep[0], "/data/x-copy.csv");
});

test("planning the same sets twice yields identical atoms", () => {
  const opts = { root_priority: ["/data/bizra", "/archive"], quarantine_root: "/q" };
  assert.deepEqual(
    planQuarantine(setOf(["/archive/x", "/data/bizra/x"]), opts).atoms,
    planQuarantine(setOf(["/data/bizra/x", "/archive/x"]), opts).atoms,
  );
});

/* ── the safety line ──────────────────────────────────────────────────────── */

test("the plan quarantines and never deletes", () => {
  const plan = planQuarantine(setOf(["/a/x", "/b/x"]), { root_priority: ["/a"], quarantine_root: "/q" });
  assert.equal(plan.action, "QUARANTINE");
  assert.equal(plan.deletes_anything, false);
  for (const atom of plan.atoms) assert.ok(atom.to.startsWith("/q/"), atom.to);
});

test("every set keeps at least one copy — a plan that empties a set is refused", () => {
  assert.throws(
    () => planQuarantine([{ hash: "a", size: 1, paths: ["/a/x"], reclaimable_bytes: 0 }], {
      root_priority: ["/a"], quarantine_root: "/q",
    }),
    /SINGLETON_IS_NOT_A_DUPLICATE/,
  );
});

test("quarantine destination inside a source root is refused — no self-swallowing", () => {
  assert.throws(
    () => planQuarantine(setOf(["/a/x", "/b/x"]), { root_priority: ["/a"], quarantine_root: "/a/quarantine" }),
    /QUARANTINE_INSIDE_SOURCE_ROOT/,
  );
});

test("the plan is steward-job shaped so it can only run through consent + undo", () => {
  const plan = planQuarantine(setOf(["/a/x", "/b/x"]), { root_priority: ["/a"], quarantine_root: "/q" });
  assert.equal(plan.schema, NODE0_LIBRARY_DEDUPE_SCHEMA);
  assert.ok(typeof plan.steward_job.sandbox_root === "string");
  assert.ok(Array.isArray(plan.steward_job.atoms));
  assert.equal(plan.steward_job.atoms.length, plan.atoms.length);
});
