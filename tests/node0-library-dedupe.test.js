import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

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

test("empty root_priority is refused — containment cannot be skipped by omission", () => {
  assert.throws(
    () => planQuarantine(setOf(["/a/x", "/b/x"]), { quarantine_root: "/q" }),
    /ROOT_PRIORITY_REQUIRED/,
  );
});

test("trailing slash on quarantine_root does not produce a double-slash destination", () => {
  const plan = planQuarantine(setOf(["/a/x", "/b/x"]), {
    root_priority: ["/a"], quarantine_root: "/q/",
  });
  assert.equal(plan.atoms[0].to, "/q/b/x");
  assert.ok(!plan.atoms[0].to.includes("//"), plan.atoms[0].to);
});

test("segment-aware containment: a sibling path sharing a prefix is outside, not inside", () => {
  const plan = planQuarantine(setOf(["/demo/corpus/x", "/other/x"]), {
    root_priority: ["/demo/corpus"],
    quarantine_root: "/demo/corpus-secret",
  });
  assert.equal(plan.atoms.length, 1);
});

test("segment-aware containment: a true subpath of a source root is refused", () => {
  assert.throws(
    () => planQuarantine(setOf(["/demo/corpus/x", "/other/x"]), {
      root_priority: ["/demo/corpus"],
      quarantine_root: "/demo/corpus/quarantine",
    }),
    /QUARANTINE_INSIDE_SOURCE_ROOT/,
  );
});

test("normalizeAbsDir strips trailing slashes without polynomial backtracking", () => {
  const sets = confirmDuplicateSets([{ size: 100, paths: ["/demo/corpus/a", "/demo/corpus/b"] }], {
    "/demo/corpus/a": "a".repeat(64),
    "/demo/corpus/b": "a".repeat(64),
  });
  const plain = planQuarantine(sets, {
    root_priority: ["/demo/corpus"],
    quarantine_root: "/demo/quarantine",
  });
  const slashed = planQuarantine(sets, {
    root_priority: ["/demo/corpus"],
    quarantine_root: "/demo/quarantine///",
  });
  assert.deepEqual(slashed, plain, "trailing slashes must not change the plan");

  const pathological = "/".repeat(50_000) + "x";
  const started = process.hrtime.bigint();
  try {
    planQuarantine(sets, { root_priority: ["/demo/corpus"], quarantine_root: pathological });
  } catch {
    // a refusal is a fine outcome — it just must not take quadratic time to reach
  }
  const elapsedMs = Number(process.hrtime.bigint() - started) / 1e6;
  assert.ok(elapsedMs < 250, `trailing-slash strip must stay linear, took ${elapsedMs}ms`);
});

/* ── CLI safety correction: measurement must never become an executable job ─ */

const CLI = fileURLToPath(new URL("../apps/cli/src/index.js", import.meta.url));

function library(args) {
  const result = spawnSync(process.execPath, [CLI, "library", ...args], {
    encoding: "utf8",
    env: { ...process.env, NODE_ENV: "test", DEMA_NO_TUI: "1" },
  });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    /* asserted by each JSON-path test */
  }
  return { ...result, json };
}

function makeDuplicateCorpus() {
  const root = mkdtempSync(join(tmpdir(), "library-dedupe-cli-"));
  mkdirSync(join(root, "a"));
  mkdirSync(join(root, "b"));
  writeFileSync(join(root, "a", "original.txt"), "same immutable bytes\n");
  writeFileSync(join(root, "b", "original-copy.txt"), "same immutable bytes\n");
  writeFileSync(join(root, "unique.txt"), "unique bytes\n");
  return root;
}

function visibleTree(root) {
  const walk = (dir, prefix = "") => {
    const rows = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) rows.push(...walk(join(dir, entry.name), relative));
      else rows.push({ path: relative, content: readFileSync(join(dir, entry.name), "utf8") });
    }
    return rows;
  };
  return walk(root).sort((a, b) => a.path.localeCompare(b.path));
}

test("library dedupe CLI emits measurement only and no executable steward job", () => {
  const root = makeDuplicateCorpus();
  try {
    const before = visibleTree(root);
    const result = library(["dedupe", "--root", root, "--json"]);

    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.ok(result.json, "stdout must be a JSON measurement");
    assert.equal(result.json.schema, "bizra.dema.node0_library_duplicate_measurement.v0.2");
    assert.equal(result.json.truth_label, "LOCAL_DUPLICATE_MEASUREMENT_NOT_ACTION_PLAN");
    assert.equal(result.json.status, "BLOCKED_PENDING_AUTHORITATIVE_SAFE_PLAN");
    assert.equal(result.json.mutation_performed, false);
    assert.equal(result.json.duplicate_sets, 1);
    assert.equal(result.json.duplicate_copies, 1);
    assert.ok(result.json.duplicate_bytes_identified > 0);
    assert.equal(result.json.next_authority_surface, "NODE0_LIBRARY_AUTHORITATIVE_COMPLETION_1A_REQUIRED");
    assert.equal(result.json.boundary.filesystem_mutation, false);
    assert.equal(result.json.boundary.source_path_removed, false);
    assert.equal(result.json.boundary.executable_job_emitted, false);
    assert.equal("steward_job" in result.json, false);
    assert.deepEqual(visibleTree(root), before, "measurement must not mutate the corpus");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("library dedupe CLI no longer requires or advertises a quarantine path", () => {
  const root = makeDuplicateCorpus();
  try {
    const result = library(["dedupe", "--root", root, "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.doesNotMatch(result.stdout, /steward_job|--quarantine/);

    const help = library([]);
    assert.equal(help.status, 0, help.stderr || help.stdout);
    assert.ok(help.json, "help must be JSON");
    assert.doesNotMatch(help.json.subcommands.dedupe, /--quarantine/);
    assert.match(help.json.dedupe_note, /emits no executable move job/i);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("library dedupe CLI --out writes the same non-executable measurement", () => {
  const root = makeDuplicateCorpus();
  const artifactDir = mkdtempSync(join(tmpdir(), "library-dedupe-artifact-"));
  const out = join(artifactDir, "measurement.json");
  try {
    const result = library(["dedupe", "--root", root, "--out", out, "--json"]);
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(existsSync(out), true);
    const stored = JSON.parse(readFileSync(out, "utf8"));
    assert.deepEqual(stored, result.json);
    assert.equal(stored.boundary.executable_job_emitted, false);
    assert.equal("atoms" in stored, false);
    assert.equal("steward_job" in stored, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(artifactDir, { recursive: true, force: true });
  }
});
