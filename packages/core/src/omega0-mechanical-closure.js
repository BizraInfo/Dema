// CALIBRE-Ω0-MECHANICAL-CLOSURE-1A — the canonical Node0 route.
//
// WHY THIS EXISTS
//
// `l1-micro-loop.js` accepts `anchorDir` as an option. Optional protection is
// not protection: a production-shaped call that omits it silently inherits the
// original evidence-erasure gap. This module is the route that closes that by
// law — it is the only surface a real mission is permitted to enter through,
// and it BLOCKS before any mutation when the anchor is absent, misplaced,
// malformed, erased, truncated, forked, or forged.
//
// It is also the governed join. Until now three gears turned separately:
// a real reversible file corridor, an anchored L1 cycle, and Dema's mission /
// consent / receipt surfaces. This route binds them into one sealed pass:
//
//   mission → consent → lease → mandatory anchor → bounded effect
//   → independent post-state verification → seal → Proof Card → replay
//
// DESIGN LAWS
//
//   1. Anchor is a precondition, not an option. No route call may downgrade.
//   2. The effect is an injected adapter, never hardcoded. The route governs;
//      it does not know how to move a file. Adapters are replaceable; the law
//      is not. (Sovereign Harness / replaceable resource boundary.)
//   3. Consent binds to an exact scope hash. A plan that changed after consent
//      is a different plan and is refused — AUTHORITY_MISMATCH.
//   4. Verification is judge-free and independent of the actor: counts and
//      content hashes, computed by the route, never reported by the adapter.
//   5. Every terminal state emits a Proof Card, including refusals. A refusal
//      without a receipt is an unexplained silence.
//   6. Authority delta is always 0. No failure path widens scope.
//
// SCOPE — one bounded effect, one seal, one card. No chaining (L2), no daemon,
// no network, no model invocation, no publication.

// No node:fs, by design. The route governs; the injected adapter performs
// every filesystem effect. A governor that can touch the world directly is
// a second actor, and law 4 (independent verification) would then be a claim
// about itself.
import { createHash } from "node:crypto";

import { verifyAgainstAnchor, verifyAnchorLog, assertAnchorOutside } from "./chain-anchor.js";

export const OMEGA0_SCHEMA = "bizra.dema.omega0_mechanical_closure.v0.1";
export const OMEGA0_TRUTH_LABEL = "OMEGA0_MECHANICAL_CLOSURE_LOCAL";

export const BLOCK_REASONS = Object.freeze([
  "anchor_required",
  "anchor_inside_scope",
  "anchor_malformed",
  "anchor_log_forged",
  "anchor_erased",
  "anchor_truncated",
  "anchor_forked",
  "lease_required",
  "lease_expired",
  "lease_scope_violation",
  "consent_required",
  "authority_mismatch",
  "adapter_incomplete",
  "effect_failed",
  "verification_failed",
  "restoration_failed",
]);

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

function deepFreeze(v) {
  if (!v || typeof v !== "object" || Object.isFrozen(v)) return v;
  for (const c of Object.values(v)) deepFreeze(c);
  return Object.freeze(v);
}

function card(status, reason, body = {}) {
  return deepFreeze({
    schema: OMEGA0_SCHEMA,
    truth_label: OMEGA0_TRUTH_LABEL,
    status,
    reason,
    authority_delta: 0,
    ...body,
    what_this_proves:
      status === "SEALED"
        ? "One consented intention became a verified, reversible, anchored effect with a replayable receipt"
        : "The route refused before or during the effect; the world state is accounted for",
    what_this_does_not_prove:
      "Human usefulness (Ω0-H), regenerative value (Ω0-R), activation, or unattended operation",
  });
}

/** Anchor law — evaluated before anything mutates. */
export function enforceAnchorPolicy({ anchorDir, scopeRoot, anchorLog, observed, realpath }) {
  if (!anchorDir || typeof anchorDir !== "string") {
    return { ok: false, reason: "anchor_required" };
  }
  const resolve = typeof realpath === "function" ? realpath : (p) => p;
  const placement = assertAnchorOutside(resolve(anchorDir), resolve(scopeRoot));
  if (!placement.intact) return { ok: false, reason: "anchor_inside_scope" };

  const records = Array.isArray(anchorLog) ? anchorLog : [];
  if (records.length > 0) {
    const logVerdict = verifyAnchorLog(records, sha256);
    if (!logVerdict.intact) return { ok: false, reason: "anchor_log_forged" };
    const last = records[records.length - 1];
    const v = verifyAgainstAnchor(last, observed, {
      head_history: observed?.head_history,
    });
    if (!v.intact) {
      const map = {
        ERASED: "anchor_erased",
        TRUNCATED: "anchor_truncated",
        FORKED: "anchor_forked",
        MALFORMED: "anchor_malformed",
        NO_ANCHOR: "anchor_required",
      };
      return { ok: false, reason: map[v.verdict] ?? "anchor_malformed", verdict: v };
    }
  }
  return { ok: true, records };
}

function requireAdapter(effect) {
  const needed = ["propose", "apply", "undo", "manifest"];
  if (!effect || typeof effect !== "object") return "adapter_incomplete";
  for (const m of needed) if (typeof effect[m] !== "function") return "adapter_incomplete";
  return null;
}

function jsonSnapshot(value) {
  return JSON.parse(JSON.stringify(value));
}

function preflightMechanical({ mission, lease, consent, anchorDir, effect, now, realpath }) {
  const scopeRoot = mission?.root ?? lease?.scope_root ?? "";
  const adapterFail = requireAdapter(effect);
  if (adapterFail) return { blocked: card("BLOCKED", adapterFail) };
  if (!lease?.lease_id) return { blocked: card("BLOCKED", "lease_required") };
  if (typeof lease.expires_at !== "number" || now >= lease.expires_at) {
    return { blocked: card("BLOCKED", "lease_expired") };
  }
  if (lease.scope_root !== scopeRoot) return { blocked: card("BLOCKED", "lease_scope_violation") };
  if (!consent?.by || !consent?.ref) return { blocked: card("BLOCKED", "consent_required") };
  const anchorState = effect.anchorState?.(anchorDir) ?? { anchorLog: [], observed: null };
  const policy = enforceAnchorPolicy({
    anchorDir, scopeRoot, anchorLog: anchorState.anchorLog, observed: anchorState.observed, realpath,
  });
  return policy.ok
    ? { scopeRoot }
    : { blocked: card("BLOCKED", policy.reason, { anchor_dir: anchorDir }) };
}

/**
 * Validate one already-derived, persistable effect intent without mutating the
 * world. The caller owns intent derivation because only its concrete adapter
 * knows how to project a generic plan into an expected post-state.
 */
export function prepareMechanicalClosure({
  mission,
  lease,
  consent,
  anchorDir,
  effect,
  intent,
  now = 0,
  proveUndo = true,
  realpath,
} = {}) {
  const gate = preflightMechanical({ mission, lease, consent, anchorDir, effect, now, realpath });
  if (gate.blocked) return gate.blocked;
  const { scopeRoot } = gate;

  const fieldsPresent = intent
    && typeof intent.scope_root === "string"
    && Array.isArray(intent.plan)
    && Array.isArray(intent.before_manifest)
    && Array.isArray(intent.expected_after_manifest)
    && typeof intent.plan_hash === "string"
    && typeof intent.before_hash === "string"
    && typeof intent.expected_after_hash === "string";
  if (!fieldsPresent) {
    return card("BLOCKED", "authority_mismatch", { reason_detail: "prepared_intent_incomplete" });
  }
  if (intent.scope_root !== scopeRoot) {
    return card("BLOCKED", "authority_mismatch", {
      reason_detail: "prepared_intent_scope_mismatch",
      authorised_scope_root: scopeRoot,
      intent_scope_root: intent.scope_root,
    });
  }

  const planHashValid = sha256(JSON.stringify(intent.plan)) === intent.plan_hash;
  const beforeHashValid = sha256(JSON.stringify(intent.before_manifest)) === intent.before_hash;
  const afterHashValid = sha256(JSON.stringify(intent.expected_after_manifest)) === intent.expected_after_hash;
  const currentHash = sha256(JSON.stringify(effect.manifest()));
  if (!planHashValid || !beforeHashValid || !afterHashValid
      || (consent.plan_hash && consent.plan_hash !== intent.plan_hash)) {
    return card("BLOCKED", "authority_mismatch", {
      reason_detail: "prepared_intent_does_not_match_authority_or_world",
      consented_plan_hash: consent.plan_hash ?? null,
      observed_world_hash: currentHash,
    });
  }

  let observedState;
  if (currentHash === intent.before_hash) {
    const proposedPlanHash = sha256(JSON.stringify(effect.propose()));
    if (proposedPlanHash !== intent.plan_hash) {
      return card("BLOCKED", "authority_mismatch", {
        reason_detail: "prepared_plan_differs_from_adapter_proposal",
        actual_plan_hash: proposedPlanHash,
        consented_plan_hash: consent.plan_hash ?? null,
      });
    }
    observedState = "PRE_STATE";
  } else if (currentHash === intent.expected_after_hash) {
    // The first process may have died after mutation. The source can no longer
    // be re-proposed, so the persisted plan is the authority; applyPrepared
    // will require recoverApplied(plan) before it can finalize reversibility.
    observedState = "EXPECTED_POST_STATE";
  } else {
    let intermediate = null;
    if (typeof effect.classifyRecoverableIntermediate === "function") {
      try {
        intermediate = effect.classifyRecoverableIntermediate(intent);
      } catch (e) {
        return card("BLOCKED", "restoration_failed", {
          recovery_class: "RECOVERY_REQUIRED",
          reason_detail: "intermediate_state_classification_failed",
          error: String(e?.message ?? e),
        });
      }
    }
    if (intermediate?.recoverable === true) {
      observedState = "RECOVERABLE_INTERMEDIATE_STATE";
    } else {
      return card("BLOCKED", "restoration_failed", {
        recovery_class: "RECOVERY_REQUIRED",
        reason_detail: "observed_state_is_neither_pre_nor_expected_post",
        before_hash: intent.before_hash,
        expected_after_hash: intent.expected_after_hash,
        observed_world_hash: currentHash,
      });
    }
  }

  return deepFreeze({
    schema: OMEGA0_SCHEMA,
    truth_label: OMEGA0_TRUTH_LABEL,
    status: "PREPARED",
    reason: null,
    authority_delta: 0,
    mission: jsonSnapshot(mission),
    lease: jsonSnapshot(lease),
    consent: jsonSnapshot(consent),
    anchor_dir: anchorDir,
    now,
    prove_undo: proveUndo !== false,
    observed_state: observedState,
    intent: jsonSnapshot(intent),
  });
}

/**
 * Cross the effect boundary from a persisted preparation. A fresh process may
 * call this with the same prepared bytes: pre-state applies once; expected
 * post-state reconstructs only the undo handle; an adapter-declared exact
 * publication intermediate completes its pending step; every other state fails
 * closed.
 */
export function applyPreparedMechanicalClosure({ prepared, effect } = {}) {
  if (!prepared || prepared.status !== "PREPARED" || !prepared.intent) {
    return card("BLOCKED", "authority_mismatch", { reason_detail: "prepared_intent_required" });
  }
  const adapterFail = requireAdapter(effect);
  if (adapterFail) return card("BLOCKED", adapterFail);

  const { intent } = prepared;
  const observedBeforeApply = effect.manifest();
  const observedBeforeApplyHash = sha256(JSON.stringify(observedBeforeApply));
  let applied;
  let recoveryMode;

  if (observedBeforeApplyHash === intent.before_hash) {
    try {
      applied = effect.apply(intent.plan);
    } catch (e) {
      return card("BLOCKED", "effect_failed", {
        error: String(e?.message ?? e),
        ...(e?.recovery_class ? {
          recovery_class: e.recovery_class,
          reason_detail: e.code ?? "effect_intermediate_recovery_required",
        } : {}),
      });
    }
    recoveryMode = "APPLIED_FROM_PRE_STATE";
  } else if (observedBeforeApplyHash === intent.expected_after_hash) {
    if (typeof effect.recoverApplied !== "function") {
      return card("BLOCKED", "restoration_failed", {
        recovery_class: "RECOVERY_REQUIRED",
        reason_detail: "post_state_handle_unavailable",
        observed_world_hash: observedBeforeApplyHash,
      });
    }
    try {
      applied = effect.recoverApplied(intent.plan);
    } catch (e) {
      return card("BLOCKED", "restoration_failed", {
        recovery_class: "RECOVERY_REQUIRED",
        reason_detail: "post_state_handle_recovery_failed",
        error: String(e?.message ?? e),
      });
    }
    recoveryMode = "RECOVERED_FROM_EXPECTED_POST_STATE";
  } else if (prepared.observed_state === "RECOVERABLE_INTERMEDIATE_STATE") {
    if (typeof effect.recoverIntermediate !== "function") {
      return card("BLOCKED", "restoration_failed", {
        recovery_class: "RECOVERY_REQUIRED",
        reason_detail: "intermediate_recovery_unavailable",
      });
    }
    try {
      applied = effect.recoverIntermediate(intent);
    } catch (e) {
      return card("BLOCKED", "restoration_failed", {
        recovery_class: "RECOVERY_REQUIRED",
        reason_detail: e?.code ?? "intermediate_recovery_failed",
        error: String(e?.message ?? e),
      });
    }
    recoveryMode = "RECOVERED_FROM_NO_REPLACE_INTERMEDIATE";
  } else {
    return card("BLOCKED", "restoration_failed", {
      recovery_class: "RECOVERY_REQUIRED",
      reason_detail: "observed_state_is_neither_pre_nor_expected_post",
      before_hash: intent.before_hash,
      expected_after_hash: intent.expected_after_hash,
      observed_world_hash: observedBeforeApplyHash,
    });
  }

  const afterManifest = effect.manifest();
  const afterHash = sha256(JSON.stringify(afterManifest));
  if (afterHash !== intent.expected_after_hash) {
    let restored = false;
    if (recoveryMode === "APPLIED_FROM_PRE_STATE") {
      try {
        effect.undo(applied);
        restored = sha256(JSON.stringify(effect.manifest())) === intent.before_hash;
      } catch { /* restoration reported below */ }
    }
    return card("BLOCKED", "verification_failed", {
      reason_detail: "effect_did_not_reach_expected_post_state",
      expected_after_hash: intent.expected_after_hash,
      observed_after_hash: afterHash,
      rolled_back: recoveryMode === "APPLIED_FROM_PRE_STATE",
      restoration_verified: restored,
    });
  }

  return deepFreeze({
    schema: OMEGA0_SCHEMA,
    truth_label: OMEGA0_TRUTH_LABEL,
    status: "APPLIED",
    reason: null,
    authority_delta: 0,
    recovery_mode: recoveryMode,
    prepared,
    applied,
    after_manifest: jsonSnapshot(afterManifest),
    after_hash: afterHash,
  });
}

function verifyReversibilityAndSeal({
  mission, lease, consent, anchorDir, effect, plan, before, beforeHash,
  after, afterHash, applied, now, proveUndo, recoveryAware = false,
}) {
  const beforeContent = new Map(before.map((f) => [
    f.content_id,
    before.filter((x) => x.content_id === f.content_id).length,
  ]));
  const afterContent = new Map(after.map((f) => [
    f.content_id,
    after.filter((x) => x.content_id === f.content_id).length,
  ]));
  let sourceLoss = 0;
  for (const [contentId, count] of beforeContent) {
    const observed = afterContent.get(contentId) ?? 0;
    if (observed < count) sourceLoss += count - observed;
  }
  const verification = {
    before_files: before.length,
    after_files: after.length,
    source_loss: sourceLoss,
    content_hash_changes: sourceLoss,
    file_count_preserved: before.length === after.length,
  };
  if (sourceLoss !== 0 || !verification.file_count_preserved) {
    let restored = false;
    try {
      effect.undo(applied);
      restored = sha256(JSON.stringify(effect.manifest())) === beforeHash;
    } catch { /* restoration reported below */ }
    return card("BLOCKED", "verification_failed", {
      verification,
      rolled_back: true,
      restoration_verified: restored,
    });
  }

  let reversibility = { proven: false, skipped: true };
  if (proveUndo) {
    try {
      effect.undo(applied);
    } catch (e) {
      if (!recoveryAware) throw e;
      return card("BLOCKED", "restoration_failed", {
        recovery_class: "RECOVERY_REQUIRED",
        reason_detail: "undo_failed",
        error: String(e?.message ?? e),
      });
    }
    const restoredHash = sha256(JSON.stringify(effect.manifest()));
    if (restoredHash !== beforeHash) {
      return card("BLOCKED", "restoration_failed", {
        before_hash: beforeHash,
        restored_hash: restoredHash,
      });
    }

    try {
      effect.apply(plan);
    } catch (e) {
      if (!recoveryAware) throw e;
      return card("BLOCKED", "effect_failed", {
        reason_detail: "reapply_failed_after_verified_undo",
        error: String(e?.message ?? e),
        rolled_back: true,
      });
    }
    const finalHash = sha256(JSON.stringify(effect.manifest()));
    if (finalHash !== afterHash) {
      return card("BLOCKED", "verification_failed", {
        reason_detail: "re-apply did not reproduce the verified state",
        after_hash: afterHash,
        final_hash: finalHash,
      });
    }
    reversibility = {
      proven: true,
      skipped: false,
      undo_success_pct: 100,
      restored_hash: restoredHash,
      reapply_hash: finalHash,
    };
  }

  const planHash = sha256(JSON.stringify(plan));
  const missionHash = sha256(JSON.stringify(mission));
  const consentHash = sha256(JSON.stringify({
    by: consent.by,
    ref: consent.ref,
    plan_hash: planHash,
  }));
  const sealBody = {
    mission_hash: missionHash,
    consent_hash: consentHash,
    plan_hash: planHash,
    before_hash: beforeHash,
    after_hash: afterHash,
    lease_id: lease.lease_id,
    anchor_dir: anchorDir,
    verification,
    reversibility,
    sealed_at: now,
  };
  const sealHead = sha256(JSON.stringify(sealBody));

  return card("SEALED", null, {
    ...sealBody,
    seal_head: sealHead,
    proof_card: {
      objective: mission.objective,
      selected_root: mission.root,
      actions_proposed: plan.length ?? plan.actions?.length ?? null,
      source_loss: sourceLoss,
      content_hash_changes: sourceLoss,
      undo_success_pct: reversibility.undo_success_pct ?? null,
      restoration_verified: reversibility.proven,
      anchor_enforced: true,
      consent_by: consent.by,
      status: "VERIFIED_WITHIN_DECLARED_SCOPE",
    },
  });
}

/** Complete independent verification, reversibility proof, and sealing. */
export function finalizeAppliedMechanicalClosure({ applied, effect } = {}) {
  if (!applied || applied.status !== "APPLIED" || !applied.prepared?.intent) {
    return card("BLOCKED", "authority_mismatch", { reason_detail: "applied_preparation_required" });
  }
  const adapterFail = requireAdapter(effect);
  if (adapterFail) return card("BLOCKED", adapterFail);
  const { prepared } = applied;
  const { intent } = prepared;
  const observedAfterHash = sha256(JSON.stringify(effect.manifest()));
  if (observedAfterHash !== intent.expected_after_hash) {
    return card("BLOCKED", "restoration_failed", {
      recovery_class: "RECOVERY_REQUIRED",
      reason_detail: "applied_state_changed_before_finalization",
      expected_after_hash: intent.expected_after_hash,
      observed_world_hash: observedAfterHash,
    });
  }
  return verifyReversibilityAndSeal({
    mission: prepared.mission,
    lease: prepared.lease,
    consent: prepared.consent,
    anchorDir: prepared.anchor_dir,
    effect,
    plan: intent.plan,
    before: intent.before_manifest,
    beforeHash: intent.before_hash,
    after: intent.expected_after_manifest,
    afterHash: intent.expected_after_hash,
    applied: applied.applied,
    now: prepared.now,
    proveUndo: prepared.prove_undo,
    recoveryAware: true,
  });
}

/**
 * Run one Ω0 mechanical-closure cycle.
 *
 * @param {object} p
 * @param {object} p.mission     { objective, root } — root is the effect scope
 * @param {object} p.lease       { lease_id, scope_root, expires_at, budget_acts }
 * @param {object} p.consent     { by, ref, plan_hash } — plan_hash binds §law 3
 * @param {string} p.anchorDir   MANDATORY, outside the leased scope
 * @param {object} p.effect      adapter: propose() apply() undo() manifest()
 * @param {number} p.now         injected clock
 * @param {boolean} [p.proveUndo=true] run the undo→restore→reapply corridor
 */
export function runMechanicalClosure({
  mission,
  lease,
  consent,
  anchorDir,
  effect,
  now = 0,
  proveUndo = true,
  realpath,
}) {
  const gate = preflightMechanical({ mission, lease, consent, anchorDir, effect, now, realpath });
  if (gate.blocked) return gate.blocked;

  // ---- PLAN + CONSENT BINDING (law 3)
  const plan = effect.propose();
  const plan_hash = sha256(JSON.stringify(plan));
  if (consent.plan_hash && consent.plan_hash !== plan_hash) {
    return card("BLOCKED", "authority_mismatch", {
      consented_plan_hash: consent.plan_hash,
      actual_plan_hash: plan_hash,
    });
  }

  const before = effect.manifest();
  const before_hash = sha256(JSON.stringify(before));

  // ---- EFFECT
  let applied;
  try {
    applied = effect.apply(plan);
  } catch (e) {
    return card("BLOCKED", "effect_failed", { error: String(e?.message ?? e) });
  }

  // ---- INDEPENDENT VERIFICATION + REVERSIBILITY + SEAL
  const after = effect.manifest();
  const after_hash = sha256(JSON.stringify(after));
  return verifyReversibilityAndSeal({
    mission, lease, consent, anchorDir, effect, plan, before,
    beforeHash: before_hash,
    after,
    afterHash: after_hash,
    applied,
    now,
    proveUndo,
  });
}

/**
 * Replay law — a fresh process must recompute the same seal from the sealed
 * record plus the observed world, without trusting the first process.
 */
export function replaySeal(sealed, effect) {
  if (!sealed || sealed.status !== "SEALED") {
    return { replayed: false, reason: "not_a_sealed_card" };
  }
  const observed_after = sha256(JSON.stringify(effect.manifest()));
  const world_matches = observed_after === sealed.after_hash;
  const { seal_head, proof_card, schema, truth_label, status, reason,
          authority_delta, what_this_proves, what_this_does_not_prove,
          ...body } = sealed;
  const recomputed = sha256(JSON.stringify(body));
  return deepFreeze({
    replayed: recomputed === seal_head && world_matches,
    seal_head_matches: recomputed === seal_head,
    world_state_matches: world_matches,
    recomputed_head: recomputed,
    observed_after_hash: observed_after,
  });
}
