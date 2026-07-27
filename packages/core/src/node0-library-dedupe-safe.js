/**
 * مكتبة نود0 · NODE0-LIBRARY-DEDUPE-SAFE-1B — protected-zone review manifest.
 *
 * The 1A planner measured 326.4 GB of byte-identical extra copies and then tried
 * to move 15,344 files out of a live git worktree. The measurement was sound; the
 * eligibility was not. This kernel separates the two, permanently:
 *
 *   measurement  — these bytes are identical.            (1A answers this)
 *   eligibility  — this copy may be safely relocated.    (1B answers this)
 *
 * A path inside an active worktree IS a duplicate. It is simply not eligible,
 * because the duplicate is structurally required by the system that made it.
 *
 * Three corrections from the 1A audit are encoded here as behaviour:
 *
 *   1. Quarantine reclaims NOTHING. Moving files within a filesystem frees zero
 *      bytes; across filesystems it temporarily needs more. `volumes` therefore
 *      reports identified / eligible / reclaimed as three separate numbers, and
 *      `immediately_reclaimed_bytes` is always 0.
 *
 *   2. A move removes the source path. `deletes_anything: false` described the
 *      bytes and hid the effect. The boundary now describes the user's world:
 *      content_destroyed false, source_path_removed TRUE, filesystem_mutation TRUE.
 *
 *   3. A deterministic coin flip is still a coin flip. Path depth alone never
 *      resolves a keeper — it returns KEEPER_UNRESOLVED and emits no atom.
 *
 * This kernel is pure and emits NO steward job. It cannot move, unlink, hardlink
 * or delete anything, and nothing downstream can mistake its output for a job.
 */

export const DEDUPE_SAFE_SCHEMA = "bizra.dema.node0_library_dedupe_safe.v0.1";

export const REVIEW_CLASSES = Object.freeze([
  "SAFE_CANDIDATE",
  "PROTECTED_STRUCTURAL_DUPLICATE",
  "RETENTION_POLICY_REQUIRED",
  "KEEPER_UNRESOLVED",
  "SOURCE_CHANGED_SINCE_SCAN",
  "UNREADABLE_OR_INCOMPLETE",
]);

/** Ordered — first match wins, so the most specific zone is tested first. */
export const PROTECTED_ZONES = Object.freeze({
  repository_object_database: {
    disposition: "forbidden",
    match: /(^|\/)\.git(\/|$)/,
    reason: "git object store; identical blobs are the storage model",
  },
  active_git_worktree: {
    disposition: "forbidden",
    contextual: "worktree_roots",
    reason: "live checkout; siblings are supposed to hold the same file",
  },
  backup_or_snapshot: {
    disposition: "forbidden",
    match: /(^|\/)([^/]*backup[^/]*|snapshots?|Backups\.backupdb|\.snapshots|time[-_]?machine)(\/|$)|\.bak$/i,
    reason: "duplicate presence encodes retention history",
  },
  virtual_machine_or_container_storage: {
    disposition: "forbidden",
    match: /\.(vmdk|vmem|vdi|qcow2|ova|vmx|vhdx?)$|(^|\/)(docker|containers|overlay2|libvirt|\.vagrant)(\/|$)/i,
    reason: "VM/container storage; relocation corrupts the guest",
  },
  model_and_dataset_store: {
    disposition: "forbidden",
    match: /\.(gguf|safetensors|ckpt|onnx|pt|pth)$|(^|\/)(ollama|\.ollama|models|huggingface|\.cache\/huggingface)(\/|$)/i,
    reason: "content-addressed model store; needs a domain policy, not a filename rule",
  },
  package_or_build_cache: {
    disposition: "regenerable_candidate",
    match: /(^|\/)(node_modules|__pycache__|site-packages|\.npm|\.pnpm-store|\.cache|\.gradle|\.m2|target|dist|build|\.next|vendor)(\/|$)/,
    reason: "regenerable by its own tool; deletion is safer than relocation",
  },
  cloud_sync_root: {
    disposition: "review_required",
    match: /(^|\/)(onedrive|gdrive|google[-_ ]?drive|dropbox|icloud|nextcloud|mega|box)[^/]*(\/|$)/i,
    reason: "a remote resync may restore or delete the local copy",
  },
  user_document_or_media_archive: {
    disposition: "candidate_after_proof",
    match: /.*/,
    reason: "ordinary authored content",
  },
});

const ZONE_ORDER = Object.freeze(Object.keys(PROTECTED_ZONES));

export function classifyZone(path, ctx = {}) {
  if (typeof path !== "string") return "user_document_or_media_archive";
  for (const zone of ZONE_ORDER) {
    const def = PROTECTED_ZONES[zone];
    if (def.contextual === "worktree_roots") {
      const roots = ctx.worktree_roots ?? [];
      if (roots.some((r) => path === r || path.startsWith(`${r}/`))) return zone;
      continue;
    }
    if (def.match?.test(path)) return zone;
  }
  return "user_document_or_media_archive";
}

export function zoneDisposition(zone) {
  return PROTECTED_ZONES[zone]?.disposition ?? "candidate_after_proof";
}

const COPY_MARKER = /(\(\d+\)|[-_ ]cop(y|ie)|[-_ ]duplicate|[-_ ]dup)(\.[^./]+)?$/i;
const basename = (p) => p.slice(p.lastIndexOf("/") + 1);

/**
 * Resolves which copy is canonical, or refuses. Reason codes are ordered by the
 * strength of the evidence that decided it. Path depth is deliberately NOT a
 * resolver — it is recorded only when something stronger already decided.
 */
/**
 * Ordinal policy strength, NOT probability. These are constitutional priority
 * rules; nothing here has been calibrated against observed correctness data, so
 * calling the old 0.95 / 0.90 / 0.75 values "confidence" implied a probabilistic
 * basis that does not exist. Higher rank wins; the scale has no units.
 */
export const KEEPER_POLICY_RANK = Object.freeze({
  PROTECTED_ZONE: 100,
  ROOT_PRIORITY: 80,
  COPY_MARKER: 60,
  KEEPER_UNRESOLVED: 0,
});

export function resolveKeeper(paths, ctx = {}) {
  const rootPriority = ctx.root_priority ?? [];
  const reason_codes = [];
  const decided = (reason, keeper, evidence_refs) =>
    Object.freeze({
      keeper,
      unresolved: false,
      reason_codes: Object.freeze([...reason_codes, reason]),
      policy_rank: KEEPER_POLICY_RANK[reason],
      probabilistic_confidence: "NOT_CALIBRATED",
      evidence_refs: Object.freeze(evidence_refs),
    });

  // 1. a copy sitting in a forbidden zone must stay where it is
  const protectedPaths = paths.filter((p) => zoneDisposition(classifyZone(p, ctx)) === "forbidden");
  if (protectedPaths.length === 1) {
    return decided("PROTECTED_ZONE", protectedPaths[0], [
      `zone=${classifyZone(protectedPaths[0], ctx)}`,
    ]);
  }

  // 2. declared root priority
  const rank = (p) => {
    const i = rootPriority.findIndex((r) => p === r || p.startsWith(`${r}/`));
    return i === -1 ? rootPriority.length : i;
  };
  const ranks = paths.map(rank);
  const best = Math.min(...ranks);
  const atBest = paths.filter((_, i) => ranks[i] === best);
  if (atBest.length === 1) {
    return decided("ROOT_PRIORITY", atBest[0], [`root=${rootPriority[best] ?? "(unranked)"}`]);
  }
  if (atBest.length < paths.length) reason_codes.push("ROOT_PRIORITY_PARTIAL");

  // 3. copy markers written by the tool that made the copy
  const unmarked = atBest.filter((p) => !COPY_MARKER.test(basename(p)));
  if (unmarked.length === 1) {
    return decided("COPY_MARKER", unmarked[0], [
      `marked=${atBest.filter((p) => COPY_MARKER.test(basename(p))).map(basename).join(",")}`,
    ]);
  }

  // Nothing defensible remains. Depth and lexical order are not evidence.
  return Object.freeze({
    keeper: null,
    unresolved: true,
    reason_codes: Object.freeze([...reason_codes, "KEEPER_UNRESOLVED"]),
    policy_rank: 0,
    probabilistic_confidence: "NOT_CALIBRATED",
    evidence_refs: Object.freeze([]),
    candidates: Object.freeze([...atBest].sort()),
  });
}

/**
 * Stable content identity for a duplicate set. Derived from the content hash and
 * size — never from a basename or traversal order, so the same set gets the same
 * id across runs, machines and orderings.
 */
export function deriveSetId(sha256, sizeBytes, hashHex) {
  if (typeof hashHex !== "function") throw new Error("HASH_FN_REQUIRED");
  return hashHex(`duplicate-set-v1 ${sha256} ${sizeBytes}`);
}

function classifySet(set, ctx) {
  const paths = set.paths ?? [];
  const fingerprints = set.fingerprints ?? {};

  if (paths.length < 2) return { review_class: "UNREADABLE_OR_INCOMPLETE", keeper: null, reason_codes: ["SINGLETON"] };
  if (paths.some((p) => !fingerprints[p])) {
    return { review_class: "UNREADABLE_OR_INCOMPLETE", keeper: null, reason_codes: ["MISSING_FINGERPRINT"] };
  }
  if (paths.some((p) => fingerprints[p].changed_since_scan === true)) {
    return { review_class: "SOURCE_CHANGED_SINCE_SCAN", keeper: null, reason_codes: ["PRECONDITION_DRIFT"] };
  }

  const zones = paths.map((p) => classifyZone(p, ctx));
  const dispositions = zones.map(zoneDisposition);

  if (dispositions.some((d) => d === "forbidden")) {
    return {
      review_class: "PROTECTED_STRUCTURAL_DUPLICATE",
      keeper: null,
      reason_codes: [...new Set(zones.filter((z) => zoneDisposition(z) === "forbidden"))],
    };
  }
  if (dispositions.some((d) => d === "review_required" || d === "regenerable_candidate")) {
    return {
      review_class: "RETENTION_POLICY_REQUIRED",
      keeper: null,
      reason_codes: [...new Set(zones)],
    };
  }

  const r = resolveKeeper(paths, ctx);
  if (r.unresolved) {
    return { review_class: "KEEPER_UNRESOLVED", keeper: null, reason_codes: r.reason_codes, policy_rank: 0, evidence_refs: [] };
  }
  return {
    review_class: "SAFE_CANDIDATE",
    keeper: r.keeper,
    reason_codes: r.reason_codes,
    policy_rank: r.policy_rank,
    evidence_refs: r.evidence_refs,
  };
}

export function buildReviewManifest(duplicateSets, ctx = {}) {
  if (!Array.isArray(duplicateSets)) throw new Error("INVALID_SETS");

  const sets = [];
  const atoms = [];
  let identified = 0;
  let eligible = 0;

  for (const set of duplicateSets) {
    const extras = Math.max(0, (set.paths?.length ?? 0) - 1);
    identified += (set.size ?? 0) * extras;

    const verdict = classifySet(set, ctx);
    sets.push(
      Object.freeze({
        set_id: set.set_id ?? null,
        sha256: set.hash,
        size_bytes: set.size,
        members: Object.freeze(
          [...(set.paths ?? [])].sort().map((p) =>
            Object.freeze({
              path: p,
              protected_zone: classifyZone(p, ctx),
              eligibility: zoneDisposition(classifyZone(p, ctx)),
              ...(set.fingerprints?.[p] ? { fingerprint: Object.freeze({ ...set.fingerprints[p] }) } : {}),
            }),
          ),
        ),
        review_class: verdict.review_class,
        keeper: verdict.keeper
          ? Object.freeze({
              path: verdict.keeper,
              resolution_reason: verdict.reason_codes?.[verdict.reason_codes.length - 1] ?? null,
              policy_rank: verdict.policy_rank ?? 0,
              probabilistic_confidence: "NOT_CALIBRATED",
              evidence_refs: Object.freeze(verdict.evidence_refs ?? []),
            })
          : null,
        keeper_reason_codes: Object.freeze(verdict.reason_codes ?? []),
      }),
    );

    if (verdict.review_class !== "SAFE_CANDIDATE") continue;
    for (const p of set.paths) {
      if (p === verdict.keeper) continue;
      atoms.push(
        Object.freeze({
          source_path: p,
          keeper_path: verdict.keeper,
          // Bound so the executor can refuse a file edited since the scan.
          precondition: Object.freeze({ ...set.fingerprints[p] }),
        }),
      );
      eligible += set.size ?? 0;
    }
  }
  atoms.sort((a, b) => (a.source_path < b.source_path ? -1 : 1));

  // A count of 0 is only truthful if the check actually ran. The 1B
  // reconstruction pass reported SOURCE_CHANGED_SINCE_SCAN: 0 and
  // UNREADABLE_OR_INCOMPLETE: 0 without ever re-statting a file — a missing
  // observation reported as zero. Classes whose evidence was not gathered now
  // read NOT_EVALUATED instead of a number.
  const freshness = ctx.freshness ?? {};
  const evaluated = {
    SOURCE_CHANGED_SINCE_SCAN: freshness.preconditions_recaptured === true,
    UNREADABLE_OR_INCOMPLETE: freshness.readability_checked === true,
  };
  const byClass = {};
  for (const c of REVIEW_CLASSES) {
    const n = sets.filter((s) => s.review_class === c).length;
    byClass[c] = evaluated[c] === false && n === 0 ? "NOT_EVALUATED" : n;
  }

  return Object.freeze({
    schema: DEDUPE_SAFE_SCHEMA,
    truth_label: "LOCAL_DEDUPE_REVIEW_MANIFEST",
    mutation_performed: false,
    scanned_at: ctx.scanned_at ?? null,
    sets: Object.freeze(sets),
    by_review_class: Object.freeze(byClass),
    evaluation_completeness: Object.freeze({
      identity_from_full_content_hash: ctx.freshness?.identity_from_full_hash === true,
      basename_defined_membership: ctx.freshness?.basename_membership === true,
      preconditions_recaptured: ctx.freshness?.preconditions_recaptured === true,
      readability_checked: ctx.freshness?.readability_checked === true,
      worktree_inventory_bound: Array.isArray(ctx.worktree_roots) && ctx.worktree_roots.length > 0,
    }),
    atoms: Object.freeze(atoms),
    volumes: Object.freeze({
      duplicate_bytes_identified: identified,
      execution_eligible_bytes: eligible,
      immediately_reclaimed_bytes: 0,
      space_recovered_by_quarantine: 0,
      potentially_reclaimable_after_review: "UNKNOWN",
    }),
    // What relocation would do to the user's world — not merely to the bytes.
    effect: Object.freeze({
      content_destroyed: false,
      source_path_removed: true,
      filesystem_mutation: true,
      reversible_under_receipt: true,
      destructive_finalization: false,
    }),
    does_not_prove: Object.freeze([
      "that quarantine frees disk space — moving within a filesystem reclaims zero bytes, and across one it temporarily needs more",
      "that an eligible copy is unwanted — only that an identical copy remains and no protected zone objects",
      "that the keeper is the original — priority and copy markers are declared rules, not provenance",
      "that a protected duplicate is waste — its duplication is required by the system that made it",
    ]),
    next_authority_required: Object.freeze([
      "human scope approval of the SAFE_CANDIDATE set",
      "fresh precondition re-verification immediately before any move",
      "a separate, later consent for destruction — quarantine never implies deletion",
    ]),
  });
}
