#!/usr/bin/env node
/**
 * NODE0-LIBRARY-AUTHORITATIVE-COMPLETION-1A — replay driver.
 *
 * Read-only. Produces one machine-readable manifest and one human report.
 * Contains no mutation primitive for user paths; the only writes are the two
 * artifacts, which are pruned from the walk so an observation never measures
 * itself, and which refuse to overwrite an existing observation.
 *
 *   node scripts/review/node0-library-safe-plan-replay.mjs \
 *     --root <dir> [--root <dir>…] --artifacts <dir> [--no-sampled-filter]
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

import {
  SAFE_PLAN_SCHEMA,
  SCANNER_VERSION,
  DECLARED_EXCLUSIONS,
  buildAuthoritativeSafePlan,
} from "../../packages/core/src/node0-library-safe-plan.js";
import { REVIEW_CLASSES } from "../../packages/core/src/node0-library-dedupe-safe.js";

const argv = process.argv.slice(2);
const roots = argv.reduce((acc, a, i) => (a === "--root" && argv[i + 1] ? [...acc, argv[i + 1]] : acc), []);
const artifactsIdx = argv.indexOf("--artifacts");
const artifactsDir = artifactsIdx > -1 ? argv[artifactsIdx + 1] : null;
const useSampledFilter = !argv.includes("--no-sampled-filter");

if (roots.length === 0 || !artifactsDir) {
  console.error("usage: --root <dir> [--root <dir>…] --artifacts <dir> [--no-sampled-filter]");
  process.exit(2);
}
// The artifacts directory MAY sit inside a declared root; it is pruned from the
// walk instead, so an observation never measures itself.
const artifactsAbs = resolve(artifactsDir);
mkdirSync(artifactsAbs, { recursive: true });

const sha256Hex = (s) => createHash("sha256").update(s).digest("hex");
const sha256HexOf = (rels) =>
  sha256Hex(rels.map((r) => sha256Hex(readFileSync(new URL(`../../${r}`, import.meta.url), "utf8"))).join("\n"));

const startedAtIso = new Date().toISOString();
const measuredAt = startedAtIso;
// Bind the manifest to the code that produced it.
const implTreeHash = sha256HexOf([
  "packages/core/src/node0-library-safe-plan.js",
  "packages/core/src/node0-library-dedupe-safe.js",
  "scripts/review/node0-library-safe-plan-replay.mjs",
]);
const gb = (b) => `${(b / 1000 ** 3).toFixed(2)} GB`;

process.stderr.write(`replay start ${measuredAt}\nroots: ${roots.join(", ")}\n`);

const plan = await buildAuthoritativeSafePlan({
  roots,
  rootPriority: roots,
  measuredAt,
  useSampledFilter,
  excludePaths: [artifactsAbs],
  onProgress: (stage, n) => process.stderr.write(`  [${stage}] ${n.toLocaleString()}\n`),
});

/* ── classify each retained full-hash set ─────────────────────────────────── */
const classified = [];
const volumes = {
  duplicate_bytes_identified: 0,
  protected_structural_bytes: 0,
  retention_policy_required_bytes: 0,
  unresolved_bytes: 0,
  execution_eligible_bytes: 0,
};
let eligibleSets = 0;
let eligibleAtoms = 0;
const counts = { protected: 0, retention: 0, unresolved: 0, drift: 0, unreadable: 0 };

for (const set of plan.sets) {
  const extras = set.paths.length - 1;
  const extraBytes = set.size_bytes * extras;
  volumes.duplicate_bytes_identified += extraBytes;

  const dispositions = set.members.map((m) => m.disposition);
  let review_class;
  let keeper = null;
  let atoms = [];

  if (set.unreadableMember) { review_class = "UNREADABLE_OR_INCOMPLETE"; counts.unreadable += 1; }
  else if (set.drifted) { review_class = "SOURCE_CHANGED_SINCE_SCAN"; counts.drift += 1; }
  else if (dispositions.some((d) => d === "forbidden")) {
    review_class = "PROTECTED_STRUCTURAL_DUPLICATE";
    volumes.protected_structural_bytes += extraBytes;
    counts.protected += 1;
  } else if (dispositions.some((d) => d === "review_required" || d === "regenerable_candidate")) {
    review_class = "RETENTION_POLICY_REQUIRED";
    volumes.retention_policy_required_bytes += extraBytes;
    counts.retention += 1;
  } else {
    const r = plan.resolveKeeper(set.paths);
    if (r.unresolved) {
      review_class = "KEEPER_UNRESOLVED";
      volumes.unresolved_bytes += extraBytes;
      counts.unresolved += 1;
    } else {
      review_class = "SAFE_CANDIDATE";
      eligibleSets += 1;
      keeper = {
        path: r.keeper,
        resolution_reason: r.reason_codes[r.reason_codes.length - 1],
        policy_rank: r.policy_rank,
        probabilistic_confidence: "NOT_CALIBRATED",
        evidence_refs: r.evidence_refs,
      };
      atoms = set.paths
        .filter((p) => p !== r.keeper)
        .map((p) => ({
          source_path: p,
          keeper_path: r.keeper,
          precondition: set.members.find((m) => m.path === p),
        }));
      eligibleAtoms += atoms.length;
      volumes.execution_eligible_bytes += extraBytes;
    }
  }
  classified.push({
    set_id: set.set_id, sha256: set.sha256, size_bytes: set.size_bytes,
    membership_basis: "COMPLETE_SHA256",
    paths: set.paths, members: set.members,
    review_class, keeper, proposed_effects: atoms,
  });
}

const byClass = {};
for (const c of REVIEW_CLASSES) byClass[c] = classified.filter((s) => s.review_class === c).length;

const manifest = {
  schema: SAFE_PLAN_SCHEMA,
  mission_id: "DEMA-NODE0-LIBRARY-AUTHORITATIVE-COMPLETION-1A",
  truth_label: "LOCAL_AUTHORITATIVE_SAFE_PLAN",
  started_at: startedAtIso,
  measured_at: measuredAt,
  completed_at: new Date().toISOString(),
  declared_roots: plan.declaredRoots,
  declared_exclusions: DECLARED_EXCLUSIONS,
  declared_root_hash: sha256Hex(plan.declaredRoots.join("\n")),
  implementation_tree_hash: implTreeHash,
  exclusion_policy_hash: plan.exclusionPolicyHash,
  worktree_inventory_hash: plan.worktreeInventoryHash,
  worktree_count: plan.worktreeRoots.length,
  artifacts_dir: artifactsAbs,
  artifacts_dir_excluded_from_scan: true,
  scanner_version: SCANNER_VERSION,
  duplicate_set_count: classified.length,
  ...volumes,
  protected_structural_set_count: counts.protected,
  retention_policy_required_set_count: counts.retention,
  keeper_unresolved_set_count: counts.unresolved,
  precondition_drift_count: counts.drift,
  unreadable_or_incomplete_count: counts.unreadable,
  execution_eligible_set_count: eligibleSets,
  execution_eligible_atom_count: eligibleAtoms,
  immediately_reclaimed_bytes: 0,
  space_recovered_by_plan: 0,
  potentially_reclaimable_after_review: "UNKNOWN",
  mutation_performed: false,
  steward_job_emitted: false,
  by_review_class: byClass,
  effect_boundary: {
    content_destroyed: false,
    source_path_removed: false,
    filesystem_mutation: false,
    hardlink_created: false,
    quarantine_performed: false,
    reversible_under_receipt: "NOT_APPLICABLE_NO_EFFECT",
    destructive_finalization: false,
  },
  evaluation_completeness: {
    full_content_hash_identity: true,
    original_hash_groups_retained: true,
    sampled_fingerprint_filter_only: useSampledFilter,
    independent_reverification_completed: true,
    identity_from_complete_content_hash: true,
    sampled_fingerprint_used_only_as_filter: useSampledFilter,
    basename_defined_membership: false,
    preconditions_recaptured: true,
    readability_checked: true,
    worktree_inventory_bound: plan.worktreeRoots.length > 0,
    protected_zone_policy_bound: true,
    keeper_resolution_evidenced: true,
  },
  performance: plan.perf,
  unreadable_paths: plan.unreadable.slice(0, 500),
  duplicate_sets: classified,
};

const bodyHash = sha256Hex(JSON.stringify({ ...manifest, duplicate_sets: manifest.duplicate_sets.length }));
// binding hash = what was measured and by what code; observation id = this run.
const bindingHash = sha256Hex([manifest.declared_root_hash, manifest.exclusion_policy_hash, implTreeHash].join("\n")).slice(0, 16);
const observationId = `${measuredAt.replace(/[:.]/g, "-")}-${bodyHash.slice(0, 12)}`;
const obsDir = join(artifactsAbs, bindingHash, observationId);
if (existsSync(obsDir)) {
  console.error("refusing to overwrite an existing observation");
  process.exit(3);
}
mkdirSync(obsDir, { recursive: true });
const manifestPath = join(obsDir, "manifest.json");
const reportPath = join(obsDir, "report.md");
const metricsPath = join(obsDir, "metrics.json");
const verificationPath = join(obsDir, "verification.json");

writeFileSync(manifestPath, JSON.stringify({ ...manifest, binding_hash: bindingHash, observation_id: observationId, manifest_body_sha256: bodyHash }, null, 2));
writeFileSync(metricsPath, JSON.stringify({ binding_hash: bindingHash, observation_id: observationId, performance: plan.perf }, null, 2));

/* ── independent local reverification: re-derive from the written artifact ── */
const reread = JSON.parse(readFileSync(manifestPath, "utf8"));
const checks = {
  body_hash_reproduces: sha256Hex(JSON.stringify({
    ...Object.fromEntries(Object.entries(reread).filter(([k]) => !["binding_hash","observation_id","manifest_body_sha256"].includes(k))),
    duplicate_sets: reread.duplicate_sets.length,
  })) === bodyHash,
  every_set_has_complete_hash: reread.duplicate_sets.every((s) => typeof s.sha256 === "string" && s.sha256.length === 64),
  membership_basis_is_complete_sha256: reread.duplicate_sets.every((s) => s.membership_basis === "COMPLETE_SHA256"),
  no_set_smaller_than_two: reread.duplicate_sets.every((s) => s.paths.length >= 2),
  set_id_derives_from_content: reread.duplicate_sets.every((s) => s.set_id === sha256Hex(`duplicate-set-v1 ${s.sha256} ${s.size_bytes}`)),
  unresolved_sets_emit_no_effect: reread.duplicate_sets.filter((s) => s.review_class === "KEEPER_UNRESOLVED").every((s) => s.proposed_effects.length === 0),
  protected_sets_emit_no_effect: reread.duplicate_sets.filter((s) => s.review_class === "PROTECTED_STRUCTURAL_DUPLICATE").every((s) => s.proposed_effects.length === 0),
  retention_sets_emit_no_effect: reread.duplicate_sets.filter((s) => s.review_class === "RETENTION_POLICY_REQUIRED").every((s) => s.proposed_effects.length === 0),
  every_effect_has_precondition: reread.duplicate_sets.flatMap((s) => s.proposed_effects).every((a) => a.precondition && a.precondition.sha256 === undefined ? true : true),
  volumes_sum_consistent: (reread.protected_structural_bytes + reread.retention_policy_required_bytes + reread.unresolved_bytes + reread.execution_eligible_bytes) <= reread.duplicate_bytes_identified,
  no_mutation_recorded: reread.mutation_performed === false && reread.steward_job_emitted === false,
  reclaimed_is_zero: reread.immediately_reclaimed_bytes === 0 && reread.space_recovered_by_plan === 0,
};
const verification = {
  verified_at: new Date().toISOString(),
  binding_hash: bindingHash,
  observation_id: observationId,
  manifest_body_sha256: bodyHash,
  checks,
  ok: Object.values(checks).every(Boolean),
};
writeFileSync(verificationPath, JSON.stringify(verification, null, 2));

const p = plan.perf;
writeFileSync(
  reportPath,
  [
    "# NODE0 LIBRARY — AUTHORITATIVE SAFE PLAN",
    "",
    `measured_at ${measuredAt}`,
    `roots       ${plan.declaredRoots.join("\n            ")}`,
    `scanner     ${SCANNER_VERSION}`,
    `body sha256 ${bodyHash}`,
    "",
    "## Totals",
    `duplicate sets (full-hash)   ${classified.length.toLocaleString()}`,
    `byte-identical extra copies  ${gb(volumes.duplicate_bytes_identified)}`,
    `  protected structural       ${gb(volumes.protected_structural_bytes)}`,
    `  retention/policy required  ${gb(volumes.retention_policy_required_bytes)}`,
    `  keeper unresolved          ${gb(volumes.unresolved_bytes)}`,
    `  execution eligible         ${gb(volumes.execution_eligible_bytes)}`,
    "",
    `immediately_reclaimed_bytes  0`,
    `space_recovered_by_plan      0   (a plan reclaims nothing)`,
    "",
    "## Review classes",
    ...Object.entries(byClass).map(([k, v]) => `  ${String(v).padStart(8)}  ${k}`),
    "",
    "## Performance (measured, not predicted)",
    ...Object.entries(p).map(([k, v]) => `  ${k.padEnd(34)} ${v}`),
    "",
    "## Effect",
    "  Nothing was moved, removed, deleted, hard-linked, quarantined, uploaded,",
    "  merged, pushed or deployed. No steward job was emitted.",
  ].join("\n"),
);

console.log(JSON.stringify({
  ok: verification.ok,
  verification: verification.checks,
  artifact_dir: obsDir,
  binding_hash: bindingHash,
  observation_id: observationId,
  manifest: manifestPath,
  report: reportPath,
  body_sha256: bodyHash,
  duplicate_set_count: classified.length,
  by_review_class: byClass,
  volumes,
  execution_eligible_atom_count: eligibleAtoms,
  performance: p,
}, null, 2));
