// FATE-AUTHORIZATION-KERNEL-1A — pure post-consent constitutional authorization gate.
//
// RULING FATE-BOUNDARY-1B (operator, 2026-08-07), superseding 1A:
//
//   "Human consent establishes permission. FATE independently determines
//    whether that permission may become executable authority."
//
// Position: AFTER exact human consent has produced an immutable consent
// receipt; BEFORE any executable authority or nonce claim exists. Only ALLOW
// authorizes atomic nonce acquisition.
//
// WHAT THIS REPLACES. `packages/fate/src/fate.js` is thirteen lines of
// `phrase === requiredPhrase`. It is a consent phrase matcher wearing the name
// FATE, and seven modules import it. The quarantined corridor-fate-integration-1a
// produced "two phrase checks, not an independent policy decision" — not from
// carelessness, but because there was no policy kernel to call. This is that
// kernel. It does not import, wrap, or re-implement the phrase helper, and a
// test asserts the absence structurally rather than trusting this comment.
//
// THE FOUR INDEPENDENCE LAWS, and how each is made mechanical:
//
//   1 · Consent cannot certify FATE. Consent answers "did the human approve
//       exactly this effect?" FATE answers "is this approved effect
//       constitutionally executable now?" Enforced structurally: no phrase
//       comparison exists in this file (FPK-01).
//   2 · FATE cannot validate a root against itself. The candidate carries only
//       OBSERVED values; every EXPECTED value comes from `authorityContext`, a
//       separate argument resolved independently. A candidate that tries to
//       nominate its own expectation is refused outright — that is the exact
//       `x !== x` defect measured in corridor-fate-integration-1a, where
//       state.repository_commit was passed as the expected commit and the
//       comparison could never fail.
//   3 · Authoritative Season state cannot be caller-selected. Any override key
//       on the candidate is refused. Tests inject fixtures through
//       `authorityContext`; a caller cannot nominate truth.
//   4 · FATE failure creates zero authority. Every verdict — including ALLOW —
//       carries effect_performed:false, authority_delta:0, mint_allowed:false.
//       This kernel decides; it never acts.
//
// ORDERING IS OBSERVABLE, therefore it is pinned. `FATE_CHECK_ORDER` is exported
// and asserted, because differential refusal is a real proof technique here:
// break two gates at once and the one that speaks is the earlier one. Silent
// reordering would invalidate every refusal test downstream.
//
// PURE: no fs, no network, no process, no clock, no randomness. `now` arrives on
// the authority context. A judge that performs IO can be starved by IO.

import { createHash } from "node:crypto";

export const FATE_AUTHORIZATION_SCHEMA = "bizra.dema.fate_authorization.v0.1";
export const FATE_TRUTH_LABEL = "FATE_AUTHORIZATION_KERNEL_LOCAL_ONLY";

// Stage 1 lives on PR #452 (packages/core/src/node0-fate-contract.js) and is NOT
// on main. This kernel does not import it — depending on an unmerged branch would
// be worse than a pinned literal. The schema and PERMIT token below were read from
// that branch via `gh api` on 2026-08-07 and are pinned by a test.
export const FATE_POLICY_SCHEMA_EXPECTED = "bizra.dema.node0_fate_contract.v0.1";
export const FATE_POLICY_PERMIT = "PERMIT";

export const FATE_AUTHORIZATION_VERDICTS = Object.freeze(["ALLOW", "DENY", "UNVERIFIABLE"]);

export const FATE_CHECK_ORDER = Object.freeze([
  "authority_context",
  "candidate_shape",
  "caller_nominated",
  "policy_evidence",
  "policy_precondition",
  "consent_evidence",
  "policy_version",
  "root",
  "season",
  "consent_binding",
  "lease",
  "scope",
  "independence",
  "risk",
]);

// A candidate may never carry its own expectation. Laws 2 and 3.
const FORBIDDEN_CANDIDATE_KEYS = Object.freeze([
  "expected_root",
  "expected_season_head",
  "expected_policy_hash",
  "season_state_override",
  "root_override",
  "policy_override",
  "authority_context",
]);

const REQUIRED_CANDIDATE_KEYS = Object.freeze([
  "mission_id", "effect_id", "plan_hash", "preview_hash", "risk_class",
  "requested_scope", "lease", "observed_root",
  "observed_season_head", "proposer_identity", "executor_identity",
  "verifier_identity", "policy_version",
]);

const ALLOWED_RISK_CLASSES = Object.freeze(["reversible_local"]);

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

// The consent receipt must bind the effect to the exact plan and preview the
// human previewed. Re-derived here — never parsed, never phrase-matched.
function consentBinding(c) {
  return sha256(`${c.effect_id}\n${c.plan_hash}\n${c.preview_hash}`);
}

const HASHED_KEYS = Object.freeze([
  ...REQUIRED_CANDIDATE_KEYS, "consent_receipt_hash", "fate_policy_verdict",
]);

function candidateHash(c) {
  return sha256(HASHED_KEYS.map((k) => `${k}=${stable(c[k])}`).join("\n"));
}

function stable(v) {
  if (v === null || v === undefined) return "";
  if (typeof v !== "object") return String(v);
  return Object.keys(v).sort().map((k) => `${k}:${stable(v[k])}`).join(",");
}

function decide(verdict, reason, c, ctx) {
  return Object.freeze({
    schema: FATE_AUTHORIZATION_SCHEMA,
    truth_label: FATE_TRUTH_LABEL,
    verdict,
    reason,
    candidate_hash: c ? candidateHash(c) : null,
    authority_root: ctx?.root ?? null,
    authority_season_head: ctx?.season_head ?? null,
    policy_hash: ctx?.policy_hash ?? null,
    // Law 4 — no verdict, not even ALLOW, grants authority. This kernel
    // decides; the caller acts, and only after claiming a nonce.
    effect_performed: false,
    authority_delta: 0,
    mint_allowed: false,
  });
}

/**
 * @param candidate       what the proposer CLAIMS (observed values only)
 * @param authorityContext what an independent resolver DETERMINED (expected)
 */
export function evaluateFateAuthorization(candidate, authorityContext) {
  const ctx = authorityContext;

  // 1 · authority_context — fail closed on absence, never assume
  if (!ctx || typeof ctx !== "object") {
    return decide("UNVERIFIABLE", "UNVERIFIABLE_AUTHORITY_CONTEXT_ABSENT", candidate ?? null, null);
  }
  // 2 · candidate_shape
  if (!candidate || typeof candidate !== "object") {
    return decide("UNVERIFIABLE", "UNVERIFIABLE_CANDIDATE_MALFORMED", null, ctx);
  }
  for (const k of REQUIRED_CANDIDATE_KEYS) {
    if (candidate[k] === undefined || candidate[k] === null) {
      return decide("UNVERIFIABLE", "UNVERIFIABLE_CANDIDATE_MALFORMED", candidate, ctx);
    }
  }
  // 3 · caller_nominated — laws 2 and 3, before anything substantive is compared
  for (const k of FORBIDDEN_CANDIDATE_KEYS) {
    if (k in candidate) {
      return decide("DENY", "DENY_CALLER_NOMINATED_AUTHORITY", candidate, ctx);
    }
  }
  // 4 · policy_evidence
  if (!ctx.policy_hash || !ctx.policy_version || typeof ctx.now !== "number") {
    return decide("UNVERIFIABLE", "UNVERIFIABLE_POLICY_EVIDENCE_ABSENT", candidate, ctx);
  }
  // 5 · policy_precondition — LAW: a human must never be asked to approve, and
  //     FATE must never authorize, an effect the constitution already refused.
  //     Stage 1 (FATE_POLICY) must have returned PERMIT under its own schema.
  const pol = candidate.fate_policy_verdict;
  if (!pol || typeof pol !== "object"
      || pol.schema !== FATE_POLICY_SCHEMA_EXPECTED
      || pol.verdict !== FATE_POLICY_PERMIT) {
    return decide("DENY", "DENY_POLICY_PRECONDITION", candidate, ctx);
  }
  // 6 · consent_evidence — this kernel is the POST-consent gate. With no consent
  //     artifact it must not silently become the pre-consent policy layer.
  if (typeof candidate.consent_receipt_hash !== "string"
      || candidate.consent_receipt_hash.length === 0) {
    return decide("UNVERIFIABLE", "UNVERIFIABLE_CONSENT_EVIDENCE_ABSENT", candidate, ctx);
  }
  // 7 · policy_version
  if (candidate.policy_version !== ctx.policy_version) {
    return decide("DENY", "DENY_POLICY_VERSION", candidate, ctx);
  }
  // 6 · root — observed vs INDEPENDENTLY resolved
  if (candidate.observed_root !== ctx.root) {
    return decide("DENY", "DENY_ROOT_MISMATCH", candidate, ctx);
  }
  // 7 · season
  if (candidate.observed_season_head !== ctx.season_head) {
    return decide("DENY", "DENY_SEASON_MISMATCH", candidate, ctx);
  }
  // 8 · consent_binding — re-derived, not parsed
  if (candidate.consent_receipt_hash !== consentBinding(candidate)) {
    return decide("DENY", "DENY_CONSENT_BINDING", candidate, ctx);
  }
  // 9 · lease
  const lease = candidate.lease;
  if (typeof lease !== "object" || typeof lease.expires_at !== "number"
      || ctx.now >= lease.expires_at) {
    return decide("DENY", "DENY_LEASE_EXPIRED", candidate, ctx);
  }
  // 10 · scope
  if (!lease.scope_root || candidate.requested_scope !== lease.scope_root) {
    return decide("DENY", "DENY_SCOPE", candidate, ctx);
  }
  // 11 · independence — proposer ≠ certifier, executor ≠ verifier
  if (candidate.proposer_identity === candidate.verifier_identity
      || candidate.executor_identity === candidate.verifier_identity) {
    return decide("DENY", "DENY_INDEPENDENCE", candidate, ctx);
  }
  // 12 · risk
  if (!ALLOWED_RISK_CLASSES.includes(candidate.risk_class)) {
    return decide("DENY", "DENY_RISK", candidate, ctx);
  }
  return decide("ALLOW", "ALLOW", candidate, ctx);
}

/**
 * Re-derive a verdict from its inputs. A verdict whose fields were edited — most
 * importantly one flipped to ALLOW — does not survive.
 */
export function verifyFateAuthorization(verdict, candidate, authorityContext) {
  if (!verdict || typeof verdict !== "object") return false;
  const fresh = evaluateFateAuthorization(candidate, authorityContext);
  for (const k of Object.keys(fresh)) {
    if (verdict[k] !== fresh[k]) return false;
  }
  return true;
}
