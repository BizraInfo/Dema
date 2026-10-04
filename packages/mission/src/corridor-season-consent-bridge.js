// NODE0-CORRIDOR-SEASON-CONSENT-BRIDGE-1A — authoritative Season → root-bound consent.
//
// WHAT THIS IS: the pure composition that carries an AUTHORITATIVE, verified
// Season State and an INDEPENDENTLY MEASURED executing-repository binding into
// the EXISTING root-bound corridor consent evaluator, and stops there.
//
// ── THE CORRECTION THIS SLICE CARRIES ──
// The superseded attempt passed `state.repository_commit` as the EXPECTED commit
// while the same state supplied the CLAIMED commit. `verifyRepositoryBinding`
// compares `state.repository_commit !== repositoryCommit`, so that is `x !== x`
// — always false, always ok. The binding check could not fail on the product
// route. Here the two facts come from two independent sources:
//
//     CLAIMED   ← seasonLoad.state.repository_commit / .repository_tree
//     EXECUTING ← executingRepository.commit / .tree  (git, measured)
//
// and they are compared against each other BEFORE eligibility is evaluated.
//
// ── WHAT THIS IS NOT ──
// It is NOT a FATE policy decision. `packages/fate/src/fate.js` is an
// exact-phrase consent helper; invoking it here would only add a second phrase
// comparison in front of one that already binds payload, scope, roots, action
// class, nonce and expiry. This module therefore does not import it, and claims
// no independent FATE policy contract. The root-bound corridor consent evaluator
// remains the canonical consent owner.
//
// `PERMIT_PREVIEW` here means EXACT CONTEXT-BOUND CONSENT VERIFIED. It does not
// mean FATE permitted, execution authorized, a transaction may run, a nonce was
// claimed, or an effect occurred.

import {
  evaluateSeasonActionAuthority as defaultEvaluateAuthority,
} from "../../core/src/node0-minimum-season-save-resume.js";
import {
  buildCorridorConsentContext as defaultBuildConsentContext,
  evaluateCorridorWriteConsent as defaultEvaluateConsent,
} from "./mission-corridor.js";

export const CORRIDOR_SEASON_CONSENT_BRIDGE_SCHEMA =
  "bizra.dema.corridor_season_consent_bridge.v0.1";

export const BRIDGE_STAGES = Object.freeze([
  "SEASON_LOAD",
  "REPOSITORY_BINDING",
  "SEASON_AUTHORITY",
  "CONSENT_CONTEXT",
  "CONSENT_REQUIRED",
  "CONSENT_EVALUATION",
]);

export const BRIDGE_VERDICTS = Object.freeze([
  "REFUSED",
  "CONSENT_REQUIRED",
  "BLOCK",
  "PERMIT_PREVIEW",
]);

/** Deep-freeze so no consumer can mutate a returned verdict into a stronger one. */
export function deepFreeze(value) {
  if (value === null || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const k of Object.getOwnPropertyNames(value)) deepFreeze(value[k]);
  return value;
}

// Every result carries the full contract. The non-grant fields are literals with
// no code path that can set them true — that is what makes them checkable.
function result(over = {}) {
  return deepFreeze({
    schema: CORRIDOR_SEASON_CONSENT_BRIDGE_SCHEMA,
    stage: null,
    verdict: "REFUSED",
    ok: false,
    season_id: null,
    authoritative_sequence: null,
    season_state_verified: false,
    executing_repository_commit: null,
    executing_repository_tree: null,
    claimed_repository_commit: null,
    claimed_repository_tree: null,
    repository_binding_valid: false,
    season_authority_verdict: null,
    canonical_action: null,
    consent_context_hash: null,
    required_phrase: null,
    consent_presented: false,
    consent_verified: false,
    authority_delta: 0,
    grants_execution: false,
    nonce_claimed: false,
    pending_effect_created: false,
    transaction_prepared: false,
    effect_executed: false,
    blocked_by: Object.freeze([]),
    reason: null,
    ...over,
  });
}

/**
 * The bridge.
 *
 * `seasonLoad` is the result of the authoritative store loader (loadSeasonHead);
 * `executingRepository` is the result of the trusted git seam. Both are injected
 * so this module stays pure — it performs no disk, process, network or clock
 * access of its own.
 */
export function evaluateCorridorSeasonConsentBridge({
  seasonLoad,
  executingRepository,
  actionId,
  corridorContext,
  presentedPhrase,
  presentedConsentContextHash,
  now,
  usedNonces = [],
  evaluateAuthority = defaultEvaluateAuthority,
  buildConsentContext = defaultBuildConsentContext,
  evaluateConsentFn = defaultEvaluateConsent,
} = {}) {
  // ── 1. Authoritative Season State ──
  if (!seasonLoad || typeof seasonLoad !== "object") {
    return result({ stage: "SEASON_LOAD", reason: "season_load_missing" });
  }
  if (seasonLoad.ok !== true) {
    return result({ stage: "SEASON_LOAD", reason: `season_load_refused:${seasonLoad.reason ?? "unknown"}` });
  }
  if (seasonLoad.outcome !== "OK") {
    // EMPTY means no authoritative HEAD — orphan objects are never authority.
    return result({ stage: "SEASON_LOAD", reason: `season_not_authoritative:${seasonLoad.outcome ?? "unknown"}` });
  }
  const state = seasonLoad.state;
  if (!state || typeof state !== "object") {
    return result({ stage: "SEASON_LOAD", reason: "season_state_missing" });
  }

  const seasonId = seasonLoad.season_id ?? null;
  const sequence = typeof state.state_sequence === "number" ? state.state_sequence : null;
  const base = {
    season_id: seasonId,
    authoritative_sequence: sequence,
    season_state_verified: true,
    claimed_repository_commit: state.repository_commit ?? null,
    claimed_repository_tree: state.repository_tree ?? null,
  };

  // ── 2. Independent repository binding — the correction ──
  if (!executingRepository || typeof executingRepository !== "object") {
    return result({ ...base, stage: "REPOSITORY_BINDING", reason: "executing_repository_missing" });
  }
  if (executingRepository.ok !== true) {
    return result({
      ...base,
      stage: "REPOSITORY_BINDING",
      reason: `executing_repository_unresolved:${executingRepository.reason ?? "unknown"}`,
    });
  }
  const execCommit = executingRepository.commit;
  const execTree = executingRepository.tree;
  const bound = { ...base, executing_repository_commit: execCommit, executing_repository_tree: execTree };

  if (state.repository_commit !== execCommit) {
    return result({
      ...bound,
      stage: "REPOSITORY_BINDING",
      reason: "repository_commit_mismatch",
      blocked_by: Object.freeze(["repository_commit_mismatch"]),
    });
  }
  if (state.repository_tree !== execTree) {
    return result({
      ...bound,
      stage: "REPOSITORY_BINDING",
      reason: "repository_tree_mismatch",
      blocked_by: Object.freeze(["repository_tree_mismatch"]),
    });
  }
  const verified = { ...bound, repository_binding_valid: true };

  // ── 3. Season action eligibility, against the EXECUTING repository ──
  const authority = evaluateAuthority({
    actionId,
    seasonState: state,
    repositoryCommit: execCommit,
    repositoryTree: execTree,
  });
  if (!authority || authority.ok !== true) {
    return result({
      ...verified,
      stage: "SEASON_AUTHORITY",
      season_authority_verdict: authority?.verdict ?? null,
      canonical_action: authority?.canonical_action ?? null,
      reason: `season_authority_refused:${authority?.reason ?? "unknown"}`,
    });
  }
  const eligible = {
    ...verified,
    season_authority_verdict: authority.verdict,
    canonical_action: authority.canonical_action,
  };

  // ── 4. The EXISTING corridor consent context ──
  if (!corridorContext || typeof corridorContext !== "object") {
    return result({ ...eligible, stage: "CONSENT_CONTEXT", reason: "corridor_context_missing" });
  }
  const ctx = buildConsentContext({
    kind: corridorContext.kind,
    mission_id: corridorContext.mission_id,
    contract_hash: corridorContext.contract_hash,
    permitted_actions: corridorContext.permitted_actions,
    mission_root: corridorContext.mission_root,
    nonce: corridorContext.nonce,
    expires_at: corridorContext.expires_at,
    requested_state: corridorContext.requested_state,
    prepared_intent_hash: corridorContext.prepared_intent_hash,
  });
  if (!ctx || ctx.ok !== true) {
    return result({
      ...eligible,
      stage: "CONSENT_CONTEXT",
      reason: "consent_context_blocked",
      blocked_by: Object.freeze([...(ctx?.blocked_by ?? [])]),
    });
  }
  const withCtx = {
    ...eligible,
    consent_context_hash: ctx.envelope.consent_context_hash,
    required_phrase: ctx.envelope.required_phrase,
  };

  // ── 5. No phrase yet: expose what must be typed. Nothing is written. ──
  if (typeof presentedPhrase !== "string" || presentedPhrase.length === 0) {
    return result({
      ...withCtx,
      stage: "CONSENT_REQUIRED",
      verdict: "CONSENT_REQUIRED",
      ok: false,
      reason: "consent_required",
    });
  }

  // ── 6. The EXISTING root-bound consent evaluator is the consent owner ──
  const consent = evaluateConsentFn({
    kind: corridorContext.kind,
    mission_id: corridorContext.mission_id,
    contract_hash: corridorContext.contract_hash,
    permitted_actions: corridorContext.permitted_actions,
    mission_root: corridorContext.mission_root,
    phrase: presentedPhrase,
    nonce: corridorContext.nonce,
    expires_at: corridorContext.expires_at,
    consent_context_hash: presentedConsentContextHash,
    now,
    used_nonces: usedNonces,
    requested_state: corridorContext.requested_state,
    prepared_intent_hash: corridorContext.prepared_intent_hash,
  });

  if (!consent || typeof consent !== "object" || !BRIDGE_VERDICTS.includes(consent.verdict)) {
    return result({ ...withCtx, stage: "CONSENT_EVALUATION", consent_presented: true, reason: "consent_result_malformed" });
  }
  if (consent.ok !== true) {
    return result({
      ...withCtx,
      stage: "CONSENT_EVALUATION",
      verdict: "BLOCK",
      consent_presented: true,
      reason: "root_bound_consent_blocked",
      blocked_by: Object.freeze([...(consent.blocked_by ?? [])]),
    });
  }

  // Consent verified. The route STOPS here: no nonce claim, no transaction, no
  // pending effect, no mutation. Those remain later, separately consented acts.
  return result({
    ...withCtx,
    stage: "CONSENT_EVALUATION",
    verdict: "PERMIT_PREVIEW",
    ok: true,
    consent_presented: true,
    consent_verified: true,
    reason: "exact_context_bound_consent_verified",
    means: "EXACT_CONTEXT_BOUND_CONSENT_VERIFIED",
  });
}
