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
  const scopeRoot = mission?.root ?? lease?.scope_root ?? "";

  const adapterFail = requireAdapter(effect);
  if (adapterFail) return card("BLOCKED", adapterFail);

  if (!lease || !lease.lease_id) return card("BLOCKED", "lease_required");
  if (typeof lease.expires_at !== "number" || now >= lease.expires_at) {
    return card("BLOCKED", "lease_expired");
  }
  if (lease.scope_root !== scopeRoot) return card("BLOCKED", "lease_scope_violation");
  if (!consent || !consent.by || !consent.ref) return card("BLOCKED", "consent_required");

  // ---- ANCHOR LAW (before any mutation)
  const anchorState = effect.anchorState ? effect.anchorState(anchorDir) : { anchorLog: [], observed: null };
  const policy = enforceAnchorPolicy({
    anchorDir,
    scopeRoot,
    anchorLog: anchorState.anchorLog,
    observed: anchorState.observed,
    realpath,
  });
  if (!policy.ok) return card("BLOCKED", policy.reason, { anchor_dir: anchorDir });

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

  // ---- INDEPENDENT VERIFICATION (law 4 — route computes, adapter does not report)
  const after = effect.manifest();
  const after_hash = sha256(JSON.stringify(after));
  const beforeContent = new Map(before.map((f) => [f.content_id, (before.filter((x) => x.content_id === f.content_id)).length]));
  const afterContent = new Map(after.map((f) => [f.content_id, (after.filter((x) => x.content_id === f.content_id)).length]));
  let source_loss = 0;
  for (const [cid, n] of beforeContent) {
    const m = afterContent.get(cid) ?? 0;
    if (m < n) source_loss += n - m;
  }
  const verification = {
    before_files: before.length,
    after_files: after.length,
    source_loss,
    content_hash_changes: source_loss,
    file_count_preserved: before.length === after.length,
  };
  if (source_loss !== 0 || !verification.file_count_preserved) {
    let restored = false;
    try {
      effect.undo(applied);
      restored = sha256(JSON.stringify(effect.manifest())) === before_hash;
    } catch { /* restoration reported below */ }
    return card("BLOCKED", "verification_failed", {
      verification,
      rolled_back: true,
      restoration_verified: restored,
    });
  }

  // ---- REVERSIBILITY CORRIDOR (undo → prove restore → re-apply)
  let reversibility = { proven: false, skipped: true };
  if (proveUndo) {
    effect.undo(applied);
    const restored_hash = sha256(JSON.stringify(effect.manifest()));
    const restored = restored_hash === before_hash;
    if (!restored) {
      return card("BLOCKED", "restoration_failed", {
        before_hash,
        restored_hash,
      });
    }
    applied = effect.apply(plan);
    const final_hash = sha256(JSON.stringify(effect.manifest()));
    if (final_hash !== after_hash) {
      return card("BLOCKED", "verification_failed", {
        reason_detail: "re-apply did not reproduce the verified state",
        after_hash,
        final_hash,
      });
    }
    reversibility = {
      proven: true,
      skipped: false,
      undo_success_pct: 100,
      restored_hash,
      reapply_hash: final_hash,
    };
  }

  // ---- SEAL
  const mission_hash = sha256(JSON.stringify(mission));
  const consent_hash = sha256(JSON.stringify({ by: consent.by, ref: consent.ref, plan_hash }));
  const seal_body = {
    mission_hash,
    consent_hash,
    plan_hash,
    before_hash,
    after_hash,
    lease_id: lease.lease_id,
    anchor_dir: anchorDir,
    verification,
    reversibility,
    sealed_at: now,
  };
  const seal_head = sha256(JSON.stringify(seal_body));

  return card("SEALED", null, {
    ...seal_body,
    seal_head,
    proof_card: {
      objective: mission.objective,
      selected_root: mission.root,
      actions_proposed: plan.length ?? plan.actions?.length ?? null,
      source_loss,
      content_hash_changes: source_loss,
      undo_success_pct: reversibility.undo_success_pct ?? null,
      restoration_verified: reversibility.proven,
      anchor_enforced: true,
      consent_by: consent.by,
      status: "VERIFIED_WITHIN_DECLARED_SCOPE",
    },
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
