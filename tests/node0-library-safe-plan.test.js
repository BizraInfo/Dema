import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  SAFE_PLAN_SCHEMA,
  DECLARED_EXCLUSIONS,
  discoverWorktrees,
  buildAuthoritativeSafePlan,
} from "../packages/core/src/node0-library-safe-plan.js";

const REPLAY = fileURLToPath(new URL("../scripts/review/node0-library-safe-plan-replay.mjs", import.meta.url));

/** A throwaway corpus with known, adversarial structure. */
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), "node0-safeplan-"));
  const w = (rel, body) => {
    const p = join(dir, rel);
    mkdirSync(join(p, ".."), { recursive: true });
    writeFileSync(p, body);
    return p;
  };
  // same content, different names → one set
  w("a/alpha.txt", "IDENTICAL-CONTENT-PAYLOAD");
  w("b/completely-different-name.txt", "IDENTICAL-CONTENT-PAYLOAD");
  // same name, different content, SAME SIZE → never one set
  w("c/same.txt", "AAAAAAAAAAAAAAAAAAAAAAAAA");
  w("d/same.txt", "BBBBBBBBBBBBBBBBBBBBBBBBB");
  // duplicate inside a live worktree → protected
  mkdirSync(join(dir, "repo", ".git"), { recursive: true });
  w("repo/tracked.bin", "WORKTREE-PAYLOAD-XYZ");
  w("loose/tracked.bin", "WORKTREE-PAYLOAD-XYZ");
  // duplicate inside an excluded machine tree → excluded before hashing
  w("proj/node_modules/pkg/index.js", "IDENTICAL-CONTENT-PAYLOAD");
  return dir;
}

const RUN = async (dir, extra = {}) =>
  buildAuthoritativeSafePlan({
    roots: [dir], rootPriority: [dir], measuredAt: "2026-07-25T00:00:00.000Z", ...extra,
  });

test("same content with different names enters the same duplicate set", async () => {
  const dir = fixture();
  try {
    const p = await RUN(dir);
    const set = p.sets.find((s) => s.paths.some((x) => x.endsWith("alpha.txt")));
    assert.ok(set, "alpha.txt formed no set");
    assert.ok(set.paths.some((x) => x.endsWith("completely-different-name.txt")));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("same name with different content never enters the same duplicate set", async () => {
  const dir = fixture();
  try {
    const p = await RUN(dir);
    for (const s of p.sets) {
      const both = s.paths.filter((x) => x.includes("/c/same.txt") || x.includes("/d/same.txt"));
      assert.ok(both.length < 2, `same-size different-content files were grouped: ${s.paths}`);
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("basename never defines membership — sets are keyed by content hash", async () => {
  const dir = fixture();
  try {
    const p = await RUN(dir);
    for (const s of p.sets) {
      assert.equal(typeof s.sha256, "string");
      assert.equal(s.sha256.length, 64);
      assert.ok(s.set_id && s.set_id !== s.paths[0].split("/").pop());
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the sampled filter changes cost, never membership", async () => {
  const dir = fixture();
  try {
    const withFilter = await RUN(dir, { useSampledFilter: true });
    const without = await RUN(dir, { useSampledFilter: false });
    const key = (p) => p.sets.map((s) => `${s.sha256}:${s.paths.join("|")}`).sort().join("\n");
    assert.equal(key(withFilter), key(without), "sampled filter altered duplicate membership");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("declared exclusions are skipped before hashing", async () => {
  const dir = fixture();
  try {
    const p = await RUN(dir);
    const hashed = p.sets.flatMap((s) => s.paths);
    assert.ok(!hashed.some((x) => x.includes("/node_modules/")), "node_modules was hashed");
    assert.ok(DECLARED_EXCLUSIONS.includes("node_modules"));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("active worktrees are discovered from real disk state", async () => {
  const dir = fixture();
  try {
    const found = discoverWorktrees([dir]);
    assert.ok(found.some((x) => x.endsWith("/repo")), `worktree not found in ${found}`);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("every member carries a fresh precondition fingerprint", async () => {
  const dir = fixture();
  try {
    const p = await RUN(dir);
    for (const s of p.sets) {
      for (const m of s.members) {
        for (const k of ["device", "inode", "size", "mtime_ns", "mode"]) {
          assert.ok(m[k] !== undefined, `${m.path} missing ${k}`);
        }
        assert.equal(m.readability, "READABLE");
        assert.ok(["FRESH", "PRECONDITION_DRIFT", "NOT_OBSERVED"].includes(m.freshness));
      }
    }
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* ── the replay command itself ────────────────────────────────────────────── */

function runReplay(dir, artifacts) {
  const out = execFileSync("node", [REPLAY, "--root", dir, "--artifacts", artifacts], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
  });
  const r = JSON.parse(out);
  return { ...r, manifest: join(r.artifact_dir, "manifest.json") };
}

test("the replay emits no steward job and performs no mutation", () => {
  const dir = fixture();
  const art = mkdtempSync(join(tmpdir(), "node0-art-"));
  try {
    const r = runReplay(dir, art);
    const manifest = JSON.parse(readFileSync(r.manifest, "utf8"));
    assert.equal(manifest.steward_job_emitted, false);
    assert.equal(manifest.mutation_performed, false);
    assert.equal(manifest.immediately_reclaimed_bytes, 0);
    assert.equal(manifest.space_recovered_by_plan, 0);
    assert.deepEqual(manifest.effect_boundary, {
      content_destroyed: false,
      source_path_removed: false,
      filesystem_mutation: false,
      hardlink_created: false,
      quarantine_performed: false,
      reversible_under_receipt: "NOT_APPLICABLE_NO_EFFECT",
      destructive_finalization: false,
    });
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(art, { recursive: true, force: true }); }
});

test("worktree members produce no proposed atoms", () => {
  const dir = fixture();
  const art = mkdtempSync(join(tmpdir(), "node0-art-"));
  try {
    const r = runReplay(dir, art);
    const manifest = JSON.parse(readFileSync(r.manifest, "utf8"));
    const wt = manifest.duplicate_sets.find((s) => s.paths.some((x) => x.includes("/repo/tracked.bin")));
    assert.ok(wt, "worktree duplicate set missing");
    assert.equal(wt.review_class, "PROTECTED_STRUCTURAL_DUPLICATE");
    assert.deepEqual(wt.proposed_effects, []);
    assert.equal(wt.keeper, null);
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(art, { recursive: true, force: true }); }
});

test("the replay never leaves the source tree modified", () => {
  const dir = fixture();
  const art = mkdtempSync(join(tmpdir(), "node0-art-"));
  const snapshot = () =>
    readdirSync(dir, { recursive: true }).sort().join("\n");
  try {
    const before = snapshot();
    runReplay(dir, art);
    assert.equal(snapshot(), before, "the replay changed the source tree");
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(art, { recursive: true, force: true }); }
});

test("an observation artifact is never overwritten", () => {
  const dir = fixture();
  const art = mkdtempSync(join(tmpdir(), "node0-art-"));
  try {
    const a = runReplay(dir, art);
    const b = runReplay(dir, art);
    assert.notEqual(a.artifact_dir, b.artifact_dir, "second observation reused the first path");
    assert.equal(a.binding_hash, b.binding_hash, "same inputs must share a binding hash");
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(art, { recursive: true, force: true }); }
});

test("the manifest declares complete-hash identity and denies basename membership", () => {
  const dir = fixture();
  const art = mkdtempSync(join(tmpdir(), "node0-art-"));
  try {
    const r = runReplay(dir, art);
    const m = JSON.parse(readFileSync(r.manifest, "utf8"));
    assert.equal(m.schema, SAFE_PLAN_SCHEMA);
    assert.equal(m.evaluation_completeness.full_content_hash_identity, true);
    assert.equal(m.evaluation_completeness.basename_defined_membership, false);
    assert.equal(m.evaluation_completeness.preconditions_recaptured, true);
    assert.equal(m.evaluation_completeness.readability_checked, true);
    assert.equal(typeof m.manifest_body_sha256, "string");
  } finally { rmSync(dir, { recursive: true, force: true }); rmSync(art, { recursive: true, force: true }); }
});

test("an artifacts dir inside a declared root is pruned, never measured", () => {
  const dir = fixture();
  try {
    const art = join(dir, "artifacts");
    const r = runReplay(dir, art);
    const m = JSON.parse(readFileSync(r.manifest, "utf8"));
    assert.equal(m.artifacts_dir_excluded_from_scan, true);
    const measured = m.duplicate_sets.flatMap((s) => s.paths);
    assert.ok(!measured.some((x) => x.startsWith(art)), "the manifest measured itself");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("no mutation primitive for user paths is reachable from the replay module", () => {
  const src = readFileSync(
    fileURLToPath(new URL("../packages/core/src/node0-library-safe-plan.js", import.meta.url)),
    "utf8",
  );
  for (const banned of ["renameSync", "unlinkSync", "rmSync", "linkSync", "symlinkSync", "copyFileSync", "writeFileSync"]) {
    assert.ok(!src.includes(banned), `safe-plan module references ${banned}`);
  }
});

/* ── drift is a per-member fact, not a set-wide stain ─────────────────────── */

/**
 * Three byte-identical files in one set. One of them changes on disk between
 * the hash phase and the precondition recapture; the other two do not. The
 * drift label must land on the file that actually changed — wherever it sits
 * in the sorted member order.
 */
async function planWithMidRunDrift(dir, driftedMember) {
  for (const n of ["x1", "x2", "x3"]) {
    mkdirSync(join(dir, n), { recursive: true });
    writeFileSync(join(dir, n, "dup.bin"), "DRIFT-SET-PAYLOAD-0123456789");
  }
  return buildAuthoritativeSafePlan({
    roots: [dir], rootPriority: [dir], measuredAt: "2026-07-25T00:00:00.000Z",
    // "worktrees" is the last progress beat before preconditions are recaptured.
    onProgress: (phase) => {
      if (phase === "worktrees") writeFileSync(join(dir, driftedMember, "dup.bin"), "SHORT");
    },
  });
}

test("a drifting member never mislabels the clean siblings sorted after it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "node0-drift-"));
  try {
    const p = await planWithMidRunDrift(dir, "x1");
    const set = p.sets.find((s) => s.paths.length === 3);
    assert.ok(set, "the three-member set was not formed");
    const freshness = (n) => set.members.find((m) => m.path.includes(`/${n}/`)).freshness;
    assert.equal(freshness("x1"), "PRECONDITION_DRIFT", "the file that changed must be flagged");
    assert.equal(freshness("x2"), "FRESH", "an unchanged sibling sorted after the drift must stay FRESH");
    assert.equal(freshness("x3"), "FRESH", "an unchanged sibling sorted after the drift must stay FRESH");
    assert.equal(set.drifted, true, "the set as a whole must still refuse to act");
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("the drift label follows the file, not its position in the member order", async () => {
  const first = mkdtempSync(join(tmpdir(), "node0-drift-"));
  const last = mkdtempSync(join(tmpdir(), "node0-drift-"));
  try {
    const flagged = async (dirPath, member) => {
      const p = await planWithMidRunDrift(dirPath, member);
      const set = p.sets.find((s) => s.paths.length === 3);
      return set.members.filter((m) => m.freshness === "PRECONDITION_DRIFT").map((m) => m.path.split("/").at(-2));
    };
    assert.deepEqual(await flagged(first, "x1"), ["x1"], "drifting the first member stained its siblings");
    assert.deepEqual(await flagged(last, "x3"), ["x3"], "drifting the last member flagged the wrong file");
  } finally {
    rmSync(first, { recursive: true, force: true });
    rmSync(last, { recursive: true, force: true });
  }
});
