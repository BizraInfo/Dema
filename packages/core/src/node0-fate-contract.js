// NODE0-FATE-CONTRACT-1A — the independent constitutional policy decision.
//
// ── THE FOUR QUESTIONS, AND WHY THIS IS THE THIRD ──
// The corridor asks four genuinely distinct questions. Collapsing any two is
// how a gate stops meaning anything:
//
//   1. Season authority  — "may this action be REQUESTED at all?"
//                          (policy over continuation state; evaluateSeasonActionAuthority)
//   2. FATE policy       — "is this EFFECT constitutionally permissible?"   <-- THIS FILE
//                          (policy over the effect's SHAPE: reversible? bounded? delta-free?)
//   3. Root-bound consent— "did the human authorize this exact context?"
//                          (evaluateCorridorWriteConsent; the human)
//   4. Nonce claim       — "is this the single use?"
//                          (claimConsentNonce; atomicity)
//
// A previous attempt (research commit ea003519, refused and quarantined) called
// packages/fate/src/fate.js `evaluateConsent` and labelled the result a FATE
// decision. That function compares a typed phrase against a required phrase —
// it is question 3, not question 2. Invoking it ahead of the root-bound
// evaluator produced two phrase checks and zero policy. This kernel does NOT
// import it, does NOT modify it, and does NOT reimplement it.
//
// ── THE PROPERTY THAT MAKES THIS INDEPENDENT ──
// FATE must be able to REFUSE an effect the human has already consented to.
// If every human-approved effect passes, this layer is decoration. The policy
// therefore evaluates facts consent cannot see: whether the effect is provably
// reversible, whether its blast radius is bounded, and whether it carries any
// authority delta. Consent is about WHO approved; FATE is about WHAT may be done.
//
// PURE: no fs, process, network, clock or randomness. All facts injected.

export const NODE0_FATE_CONTRACT_SCHEMA = "bizra.dema.node0_fate_contract.v0.1";
export const FATE_POLICY_VERSION = "v0.1";

export const FATE_VERDICTS = Object.freeze(["PERMIT", "REFUSE"]);

// A PERMIT means exactly this and nothing more.
export const FATE_PERMIT_MEANS = "EFFECT_CONSTITUTIONALLY_PERMISSIBLE";

// Effect kinds this policy is competent to judge. An unknown kind is REFUSED —
// the policy never permits what it cannot reason about.
export const PERMITTED_EFFECT_KINDS = Object.freeze(["bounded_local_rename"]);

// Every reason this kernel can emit. Enumerated so a caller can exhaustively
// handle them and a test can prove none is unreachable.
export const FATE_REFUSAL_REASONS = Object.freeze([
  "season_authority_missing",
  "season_authority_not_eligible",
  "effect_missing",
  "effect_kind_unknown",
  "effect_not_reversible",
  "effect_before_state_unbound",
  "effect_scope_unbounded",
  "effect_scope_escapes_root",
  "authority_delta_nonzero",
  "policy_version_mismatch",
  "repository_binding_unverified",
]);

// The shipped corridor emits a BARE 64-hex digest (`sha256(JSON.stringify(before))`
// in corridor-closure-gatherer.js:426), while Season State uses the tagged
// `sha256:<hex>` form. Both are legitimate on-disk formats in this tree, so the
// policy accepts either. Narrowing to one would have refused real, provably
// reversible effects — production code outranks a validator's assumption.
const SHA256_HEX_RE = /^(sha256:)?[0-9a-f]{64}$/;

function isNonEmptyString(v) {
  return typeof v === "string" && v.length > 0;
}

function decision(over = {}) {
  return Object.freeze({
    schema: NODE0_FATE_CONTRACT_SCHEMA,
    policy_version: FATE_POLICY_VERSION,
    verdict: "REFUSE",
    ok: false,
    // What FATE judged.
    action_id: null,
    canonical_action: null,
    effect_kind: null,
    // The policy findings, individually inspectable rather than collapsed
    // into one boolean — a caller must be able to see WHICH invariant held.
    reversible: false,
    before_state_bound: false,
    scope_bounded: false,
    // Non-grants. No code path sets these true.
    authority_delta: 0,
    grants_consent: false,
    grants_execution: false,
    consent_still_required: true,
    nonce_still_required: true,
    effect_executed: false,
    means: null,
    reason: null,
    blocked_by: Object.freeze([]),
    ...over,
  });
}

/**
 * Is the declared effect provably reversible?
 *
 * Reversibility is not a promise the caller makes — it is a property the intent
 * must CARRY. A rename is reversible only if the pre-state is recorded well
 * enough to recompute and verify the restoration: a before-manifest, a
 * before-hash to compare the restoration against, and a declared inverse.
 * Absent any of those the effect may still succeed, but it cannot be UNDONE
 * with proof, and an unprovable undo is not reversibility.
 */
export function assessReversibility(effect) {
  const findings = [];
  const beforeBound =
    isNonEmptyString(effect?.before_hash)
    && SHA256_HEX_RE.test(effect.before_hash)
    && effect?.before_manifest !== undefined
    && effect.before_manifest !== null;
  if (!beforeBound) findings.push("effect_before_state_unbound");

  const invertible = effect?.undoable === true && isNonEmptyString(effect?.inverse_kind);
  if (!invertible) findings.push("effect_not_reversible");

  return Object.freeze({
    reversible: invertible,
    before_state_bound: beforeBound,
    findings: Object.freeze(findings),
  });
}

/**
 * Is the blast radius bounded?
 *
 * The effect must name a root it stays inside, and both operands must be
 * relative paths that cannot climb out of it. This is a SHAPE check on declared
 * facts — it is deliberately not a filesystem check, because this kernel is
 * pure. The gatherer performs the realpath enforcement; the policy refuses
 * anything whose declared shape could not possibly be bounded.
 */
export function assessBlastRadius(effect) {
  const findings = [];
  const root = effect?.root;
  if (!isNonEmptyString(root)) {
    findings.push("effect_scope_unbounded");
    return Object.freeze({ scope_bounded: false, findings: Object.freeze(findings) });
  }
  const operands = [effect?.from, effect?.to];
  for (const operand of operands) {
    if (!isNonEmptyString(operand)) {
      findings.push("effect_scope_unbounded");
      break;
    }
    // Absolute paths and any traversal segment escape a declared root.
    const segments = operand.split("/");
    if (operand.startsWith("/") || segments.includes("..") || segments.includes("")) {
      findings.push("effect_scope_escapes_root");
      break;
    }
  }
  return Object.freeze({
    scope_bounded: findings.length === 0,
    findings: Object.freeze(findings),
  });
}

/**
 * The constitutional policy decision.
 *
 * Consumes ALREADY-VERIFIED facts: the Season authority verdict and the
 * declared effect. It re-checks the Season verdict rather than trusting a
 * caller's summary of it, then judges the effect on its own terms.
 *
 * It NEVER consults a phrase, a nonce, or an operator. Those are questions 3
 * and 4 and belong to other owners.
 */
export function evaluateFatePolicy({
  seasonAuthority,
  effect,
  policyVersion = FATE_POLICY_VERSION,
} = {}) {
  if (policyVersion !== FATE_POLICY_VERSION) {
    return decision({ reason: "policy_version_mismatch", blocked_by: Object.freeze(["policy_version_mismatch"]) });
  }

  // ── Question 1's answer is an INPUT here, re-verified, never assumed ──
  if (!seasonAuthority || typeof seasonAuthority !== "object" || Array.isArray(seasonAuthority)) {
    return decision({ reason: "season_authority_missing", blocked_by: Object.freeze(["season_authority_missing"]) });
  }
  if (seasonAuthority.ok !== true || seasonAuthority.verdict !== "ELIGIBLE_TO_REQUEST_CONSENT_AND_FATE") {
    return decision({
      action_id: seasonAuthority.action_id ?? null,
      canonical_action: seasonAuthority.canonical_action ?? null,
      reason: "season_authority_not_eligible",
      blocked_by: Object.freeze(["season_authority_not_eligible"]),
    });
  }
  if (seasonAuthority.repository_binding_valid !== true) {
    return decision({
      action_id: seasonAuthority.action_id ?? null,
      canonical_action: seasonAuthority.canonical_action ?? null,
      reason: "repository_binding_unverified",
      blocked_by: Object.freeze(["repository_binding_unverified"]),
    });
  }

  const base = {
    action_id: seasonAuthority.action_id ?? null,
    canonical_action: seasonAuthority.canonical_action ?? null,
  };

  // ── Question 2: the effect's own shape ──
  if (!effect || typeof effect !== "object" || Array.isArray(effect)) {
    return decision({ ...base, reason: "effect_missing", blocked_by: Object.freeze(["effect_missing"]) });
  }
  if (!PERMITTED_EFFECT_KINDS.includes(effect.kind)) {
    return decision({
      ...base,
      effect_kind: typeof effect.kind === "string" ? effect.kind : null,
      reason: "effect_kind_unknown",
      blocked_by: Object.freeze(["effect_kind_unknown"]),
    });
  }
  const withKind = { ...base, effect_kind: effect.kind };

  // An effect carrying any authority delta is refused outright: this program
  // permits no act that increases what the actor may do next.
  if (effect.authority_delta !== undefined && effect.authority_delta !== 0) {
    return decision({ ...withKind, reason: "authority_delta_nonzero", blocked_by: Object.freeze(["authority_delta_nonzero"]) });
  }

  const rev = assessReversibility(effect);
  const rad = assessBlastRadius(effect);
  const blocked = [...rev.findings, ...rad.findings];

  if (blocked.length > 0) {
    return decision({
      ...withKind,
      reversible: rev.reversible,
      before_state_bound: rev.before_state_bound,
      scope_bounded: rad.scope_bounded,
      reason: blocked[0],
      blocked_by: Object.freeze(blocked),
    });
  }

  return Object.freeze({
    ...decision({
      ...withKind,
      reversible: true,
      before_state_bound: true,
      scope_bounded: true,
    }),
    verdict: "PERMIT",
    ok: true,
    means: FATE_PERMIT_MEANS,
    reason: "effect_constitutionally_permissible",
  });
}
