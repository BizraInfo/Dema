import test from "node:test";
import assert from "node:assert/strict";

import {
  DEDUPE_SAFE_SCHEMA,
  PROTECTED_ZONES,
  REVIEW_CLASSES,
  classifyZone,
  zoneDisposition,
  resolveKeeper,
  deriveSetId,
  buildReviewManifest,
} from "../packages/core/src/node0-library-dedupe-safe.js";

const CTX = {
  worktree_roots: ["/data/bizra/Dema", "/data/bizra/repos/bizra-data-lake.worktrees/wt1"],
  root_priority: ["/data/bizra", "/data2/BIZRA-ASSET"],
  scanned_at: "2026-07-25T09:32:16.000Z",
};

const fp = (over = {}) => ({
  device: 66306, inode: 12345, size: 100, mtime_ns: "1700000000000000000",
  mode: 33188, sha256: "aa".repeat(32), ...over,
});

const dupSet = (paths, over = {}) => ({
  hash: "aa".repeat(32),
  size: 100,
  paths,
  fingerprints: Object.fromEntries(paths.map((p, i) => [p, fp({ inode: 1000 + i })])),
  ...over,
});

/* ── protected zones: byte-identical ≠ eligible ───────────────────────────── */

test("an active worktree path is classified, not excluded from measurement", () => {
  const z = classifyZone("/data/bizra/Dema/.codex/hooks/hook-lib.mjs", CTX);
  assert.equal(z, "active_git_worktree");
  assert.equal(zoneDisposition(z), "forbidden");
});

test("git object databases are forbidden", () => {
  assert.equal(zoneDisposition(classifyZone("/x/repo/.git/objects/ab/cdef", CTX)), "forbidden");
});

test("backup and snapshot trees are forbidden — duplicate presence encodes retention", () => {
  for (const p of [
    "/data/bizra/mobile-backup-2026-04-13/sdcard-full/a.jpg",
    "/vol/Backups.backupdb/2026/x",
    "/srv/snapshots/daily/x.tar",
  ]) {
    assert.equal(zoneDisposition(classifyZone(p, CTX)), "forbidden", p);
  }
});

test("VM and model stores are forbidden without domain policy", () => {
  assert.equal(zoneDisposition(classifyZone("/vm/Debian.vmdk", CTX)), "forbidden");
  assert.equal(zoneDisposition(classifyZone("/data/ollama/models/blobs/sha256-x", CTX)), "forbidden");
});

test("package and build caches are regenerable, not silently movable", () => {
  const z = classifyZone("/proj/node_modules/react/index.js", CTX);
  assert.equal(z, "package_or_build_cache");
  assert.equal(zoneDisposition(z), "regenerable_candidate");
});

test("cloud sync roots require review — a resync can restore or delete", () => {
  const z = classifyZone("/data/bizra/cloud-archive/onedrive-wizard/Desktop/x.pdf", CTX);
  assert.equal(z, "cloud_sync_root");
  assert.equal(zoneDisposition(z), "review_required");
});

test("ordinary media falls through to candidate_after_proof", () => {
  assert.equal(zoneDisposition(classifyZone("/data2/BIZRA-ASSET/05_MEDIA/images/a.jpg", CTX)), "candidate_after_proof");
});

test("every declared zone has a disposition", () => {
  for (const z of Object.keys(PROTECTED_ZONES)) {
    assert.ok(typeof zoneDisposition(z) === "string" && zoneDisposition(z).length, z);
  }
});

/* ── keeper resolution: a coin flip is not a decision ─────────────────────── */

test("a defensible keeper carries reason codes", () => {
  const r = resolveKeeper(["/data/bizra/x.csv", "/data2/BIZRA-ASSET/x-copy.csv"], CTX);
  assert.equal(r.keeper, "/data/bizra/x.csv");
  assert.ok(r.reason_codes.includes("ROOT_PRIORITY"));
  assert.equal(r.policy_rank, 100 - 20);
  assert.equal(r.probabilistic_confidence, "NOT_CALIBRATED");
});

test("path depth alone never resolves a keeper — that is a coin flip", () => {
  const r = resolveKeeper(["/data/bizra/a/deep/x.csv", "/data/bizra/b/also/x.csv"], CTX);
  assert.equal(r.unresolved, true);
  assert.equal(r.keeper, null);
  assert.ok(r.reason_codes.includes("KEEPER_UNRESOLVED"));
});

test("a copy marker resolves only when nothing stronger disagrees", () => {
  const r = resolveKeeper(["/data/bizra/a/photo.jpg", "/data/bizra/a/photo (1).jpg"], CTX);
  assert.equal(r.keeper, "/data/bizra/a/photo.jpg");
  assert.ok(r.reason_codes.includes("COPY_MARKER"));
});

test("a keeper inside a forbidden zone is preferred — the structural copy stays put", () => {
  const r = resolveKeeper(["/data/bizra/Dema/x.mjs", "/data2/BIZRA-ASSET/x.mjs"], CTX);
  assert.equal(r.keeper, "/data/bizra/Dema/x.mjs");
  assert.ok(r.reason_codes.includes("PROTECTED_ZONE"));
});

/* ── the review manifest ──────────────────────────────────────────────────── */

test("a set touching a forbidden zone is PROTECTED_STRUCTURAL_DUPLICATE and yields no atom", () => {
  const m = buildReviewManifest([dupSet(["/data/bizra/Dema/a.mjs", "/data2/BIZRA-ASSET/a.mjs"])], CTX);
  assert.equal(m.sets[0].review_class, "PROTECTED_STRUCTURAL_DUPLICATE");
  assert.equal(m.atoms.length, 0);
});

test("an unresolved keeper yields no atom", () => {
  const m = buildReviewManifest([dupSet(["/data/bizra/a/deep/x.csv", "/data/bizra/b/also/x.csv"])], CTX);
  assert.equal(m.sets[0].review_class, "KEEPER_UNRESOLVED");
  assert.equal(m.atoms.length, 0);
});

test("a cloud-sync set is RETENTION_POLICY_REQUIRED, not a safe candidate", () => {
  const m = buildReviewManifest(
    [dupSet(["/data/bizra/cloud-archive/onedrive-wizard/x.pdf", "/data2/BIZRA-ASSET/x-copy.pdf"])],
    CTX,
  );
  assert.equal(m.sets[0].review_class, "RETENTION_POLICY_REQUIRED");
  assert.equal(m.atoms.length, 0);
});

test("a clean set is SAFE_CANDIDATE and its atom carries a full precondition fingerprint", () => {
  const m = buildReviewManifest(
    [dupSet(["/data2/BIZRA-ASSET/05_MEDIA/img/a.jpg", "/data2/BIZRA-ASSET/05_MEDIA/img/a (1).jpg"])],
    CTX,
  );
  assert.equal(m.sets[0].review_class, "SAFE_CANDIDATE");
  assert.equal(m.atoms.length, 1);
  const pre = m.atoms[0].precondition;
  for (const k of ["device", "inode", "size", "mtime_ns", "mode", "sha256"]) {
    assert.ok(pre[k] !== undefined, `missing ${k}`);
  }
});

test("a set missing a fingerprint is UNREADABLE_OR_INCOMPLETE and yields no atom", () => {
  const s = dupSet(["/data2/BIZRA-ASSET/m/a.jpg", "/data2/BIZRA-ASSET/m/a (1).jpg"]);
  delete s.fingerprints["/data2/BIZRA-ASSET/m/a (1).jpg"];
  const m = buildReviewManifest([s], CTX);
  assert.equal(m.sets[0].review_class, "UNREADABLE_OR_INCOMPLETE");
  assert.equal(m.atoms.length, 0);
});

test("every review class the kernel can emit is declared", () => {
  const m = buildReviewManifest(
    [
      dupSet(["/data/bizra/Dema/a.mjs", "/data2/BIZRA-ASSET/a.mjs"]),
      dupSet(["/data2/BIZRA-ASSET/m/a.jpg", "/data2/BIZRA-ASSET/m/a (1).jpg"]),
    ],
    CTX,
  );
  for (const s of m.sets) assert.ok(REVIEW_CLASSES.includes(s.review_class), s.review_class);
});

/* ── truth accounting the audit demanded ──────────────────────────────────── */

test("identified volume and execution-eligible volume are reported separately", () => {
  const m = buildReviewManifest(
    [
      dupSet(["/data/bizra/Dema/a.mjs", "/data2/BIZRA-ASSET/a.mjs"], { size: 1000 }),
      dupSet(["/data2/BIZRA-ASSET/m/a.jpg", "/data2/BIZRA-ASSET/m/a (1).jpg"], { size: 50 }),
    ],
    CTX,
  );
  assert.equal(m.volumes.duplicate_bytes_identified, 1050);
  assert.equal(m.volumes.execution_eligible_bytes, 50);
  assert.equal(m.volumes.immediately_reclaimed_bytes, 0);
  assert.equal(m.volumes.space_recovered_by_quarantine, 0);
});

test("the effect boundary describes the user's world, not just the bytes", () => {
  const m = buildReviewManifest([dupSet(["/data2/BIZRA-ASSET/m/a.jpg", "/data2/BIZRA-ASSET/m/a (1).jpg"])], CTX);
  assert.deepEqual(m.effect, {
    content_destroyed: false,
    source_path_removed: true,
    filesystem_mutation: true,
    reversible_under_receipt: true,
    destructive_finalization: false,
  });
});

test("this rung emits a manifest and never an executable job", () => {
  const m = buildReviewManifest([dupSet(["/data2/BIZRA-ASSET/m/a.jpg", "/data2/BIZRA-ASSET/m/a (1).jpg"])], CTX);
  assert.equal(m.schema, DEDUPE_SAFE_SCHEMA);
  assert.equal(m.steward_job, undefined);
  assert.equal(m.mutation_performed, false);
  assert.equal(m.truth_label, "LOCAL_DEDUPE_REVIEW_MANIFEST");
});

test("quarantine is never described as reclaiming space", () => {
  const m = buildReviewManifest([dupSet(["/data2/BIZRA-ASSET/m/a.jpg", "/data2/BIZRA-ASSET/m/a (1).jpg"])], CTX);
  assert.ok(m.does_not_prove.some((d) => /free|reclaim/i.test(d)));
});

/* ── 1C: a missing observation is not zero ────────────────────────────────── */

test("an unevaluated class reads NOT_EVALUATED, never 0", () => {
  const m = buildReviewManifest([dupSet(["/data2/BIZRA-ASSET/m/a.jpg", "/data2/BIZRA-ASSET/m/a (1).jpg"])], CTX);
  assert.equal(m.by_review_class.SOURCE_CHANGED_SINCE_SCAN, "NOT_EVALUATED");
  assert.equal(m.by_review_class.UNREADABLE_OR_INCOMPLETE, "NOT_EVALUATED");
});

test("a genuinely fresh pass reports real zeroes", () => {
  const m = buildReviewManifest([dupSet(["/data2/BIZRA-ASSET/m/a.jpg", "/data2/BIZRA-ASSET/m/a (1).jpg"])], {
    ...CTX,
    freshness: { preconditions_recaptured: true, readability_checked: true },
  });
  assert.equal(m.by_review_class.SOURCE_CHANGED_SINCE_SCAN, 0);
  assert.equal(m.by_review_class.UNREADABLE_OR_INCOMPLETE, 0);
});

test("the manifest declares how its identity was established", () => {
  const m = buildReviewManifest([dupSet(["/a/x", "/a/x (1)"])], CTX);
  const e = m.evaluation_completeness;
  for (const k of ["identity_from_full_content_hash", "basename_defined_membership",
                   "preconditions_recaptured", "readability_checked", "worktree_inventory_bound"]) {
    assert.equal(typeof e[k], "boolean", k);
  }
  assert.equal(e.worktree_inventory_bound, true);
});

test("set_id derives from content identity, never from a basename", () => {
  const h = (s) => `h(${s})`;
  const a = deriveSetId("aa".repeat(32), 100, h);
  const b = deriveSetId("aa".repeat(32), 100, h);
  const c = deriveSetId("bb".repeat(32), 100, h);
  assert.equal(a, b);
  assert.notEqual(a, c);
  assert.ok(a.includes("duplicate-set-v1"));
});

test("keeper carries policy_rank and an explicit uncalibrated marker", () => {
  const m = buildReviewManifest([dupSet(["/data2/BIZRA-ASSET/m/a.jpg", "/data2/BIZRA-ASSET/m/a (1).jpg"])], CTX);
  const k = m.sets[0].keeper;
  assert.equal(k.probabilistic_confidence, "NOT_CALIBRATED");
  assert.equal(typeof k.policy_rank, "number");
  assert.ok(Array.isArray(k.evidence_refs));
  assert.equal(k.resolution_reason, "COPY_MARKER");
});
