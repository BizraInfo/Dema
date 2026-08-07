// FATE-CONVERGENCE-1A — pure composer for the two-stage constitutional chain.
//
// RULING FATE-BOUNDARY-1B (operator, 2026-08-07):
//
//   Season → FATE_POLICY → preview → EXACT CONSENT → ConsentReceipt
//          → FATE_AUTHORIZATION → NONCE_ELIGIBLE
//
// and it STOPS there. This composer never claims a nonce, never executes, never
// mutates, never mints. `NONCE_ELIGIBLE` means exactly one thing:
//
//   The effect has passed stage-1 constitutional policy, exact context-bound
//   human consent, and stage-2 independent authorization, and may be PRESENTED
//   to a separate atomic nonce claimant.
//
// It does not mean execution is authorized without nonce acquisition.
//
// WHY THE STAGES ARE INJECTED. Ordering is the whole product here, and ordering
// is only provable if "stage 2 did not run" is an assertion about CALLS. A test
// that checks the terminal state alone would pass even if stage 2 ran and its
// result was thrown away. So the three stages arrive as parameters, default to
// the real implementations, and the suite counts invocations.
//
// AUTHORITY DECOMPOSITION — each stage answers one question and no other:
//   FATE_POLICY         is this effect constitutionally admissible to OFFER?
//   CONSENT             does the sovereign human approve exactly this?
//   FATE_AUTHORIZATION  may that approval become executable authority NOW?
// The composer adjudicates none of them. It sequences them and refuses to let a
// later one speak when an earlier one has already refused.
//
// The consent phrase is checked HERE, by the consent stage — never inside
// FATE_AUTHORIZATION. That separation is the correction ruling 1B was issued for:
// a phrase helper called twice is two checks and one fact.
//
// PURE: no fs, no network, no clock, no randomness. `now` arrives on the
// authority context.

import { createHash } from "node:crypto";

import { evaluateFatePolicy } from "./node0-fate-contract.js";
import { evaluateConsent } from "../../fate/src/fate.js";
import { evaluateFateAuthorization } from "../../fate/src/fate-authorization-kernel.js";

export const CONVERGENCE_SCHEMA = "bizra.dema.node0_fate_convergence.v0.1";
export const CONVERGENCE_TRUTH_LABEL = "FATE_CONVERGENCE_LOCAL_ONLY";

// Six terminal states, five semantic classes: DENIED and UNVERIFIABLE are both
// stage-2 closure failures but must never be collapsed — one is a decision, the
// other is an absence of evidence, and treating absence as denial is how a
// broken environment starts looking like a constitutional refusal.
export const CONVERGENCE_STATES = Object.freeze([
  "REFUSED_POLICY",
  "CONSENT_REQUIRED",
  "BLOCKED_CONSENT",
  "DENIED_AUTHORIZATION",
  "UNVERIFIABLE_AUTHORIZATION",
  "NONCE_ELIGIBLE",
]);

const POLICY_SCHEMA_EXPECTED = "bizra.dema.node0_fate_contract.v0.1";
const POLICY_PERMIT = "PERMIT";

function sha256(s) {
  return createHash("sha256").update(s).digest("hex");
}

// The consent receipt binds the effect to the exact plan and preview the human
// previewed. Re-derived, never parsed.
function consentBinding({ effect, plan_hash, preview_hash }) {
  return sha256(`${effect.effect_id}\n${plan_hash}\n${preview_hash}`);
}

// One sealed authority artifact over the whole constitutional chain, so the
// later nonce claimant consumes ONE object rather than five loose ones.
function convergenceHash(parts) {
  return sha256([
    parts.season_authority_hash,
    parts.fate_policy_hash,
    parts.preview_hash,
    parts.consent_receipt_hash,
    parts.fate_authorization_hash,
  ].join("\n"));
}

function result(state, reason, seal) {
  return Object.freeze({
    schema: CONVERGENCE_SCHEMA,
    truth_label: CONVERGENCE_TRUTH_LABEL,
    state,
    reason,
    nonce_eligible: state === "NONCE_ELIGIBLE",
    // Nothing here grants anything. Not even the positive path.
    nonce_claimed: false,
    effect_executed: false,
    mutation_performed: false,
    authority_delta: 0,
    mint_allowed: false,
    ...seal,
  });
}

export function composeFateConvergence(input, stages = {}) {
  const {
    evaluatePolicy = evaluateFatePolicy,
    evaluateConsent: consentStage = (c) => evaluateConsent({ phrase: c.phrase, requiredPhrase: c.required_phrase }),
    evaluateAuthorization = evaluateFateAuthorization,
  } = stages;

  if (!input || typeof input !== "object") {
    return result("UNVERIFIABLE_AUTHORIZATION", "UNVERIFIABLE_INPUT_MALFORMED", {});
  }
  const { effect, season_authority, preview_hash, plan_hash, consent, authority_context } = input;

  // ── stage 1 · may this even be OFFERED to the human? ────────────────────
  const policy = evaluatePolicy({ effect, season_authority, authority_context });
  const policy_ok = policy && policy.schema === POLICY_SCHEMA_EXPECTED && policy.verdict === POLICY_PERMIT;
  if (!policy_ok) {
    // A human must never be asked to approve what the constitution already
    // refused. Consent is not consulted; stage 2 is not consulted.
    return result("REFUSED_POLICY", policy?.reason ?? "REFUSED_POLICY", {
      fate_policy: policy ?? null,
    });
  }

  // ── human sovereignty ───────────────────────────────────────────────────
  if (!consent || typeof consent !== "object" || typeof consent.phrase !== "string") {
    return result("CONSENT_REQUIRED", "CONSENT_REQUIRED", { fate_policy: policy });
  }
  const consentVerdict = consentStage({ ...consent, required_phrase: consent.required_phrase });
  if (!consentVerdict || consentVerdict.accepted !== true) {
    return result("BLOCKED_CONSENT", "BLOCKED_CONSENT_PHRASE", { fate_policy: policy });
  }
  const expectedBinding = consentBinding({ effect, plan_hash, preview_hash });
  if (consent.receipt_hash !== null && consent.receipt_hash !== undefined
      && consent.receipt_hash !== expectedBinding) {
    // exact binding failure — not a generic false
    return result("BLOCKED_CONSENT", "BLOCKED_CONSENT_BINDING", { fate_policy: policy });
  }
  const consent_receipt_hash = expectedBinding;

  // ── stage 2 · may that approval become executable authority NOW? ────────
  const auth = evaluateAuthorization({
    mission_id: input.mission_id ?? "M-0",
    effect_id: effect.effect_id,
    plan_hash,
    preview_hash,
    risk_class: input.risk_class ?? "reversible_local",
    requested_scope: input.requested_scope ?? authority_context?.scope_root,
    lease: input.lease,
    observed_root: authority_context?.observed_root ?? authority_context?.root,
    observed_season_head: season_authority?.head,
    proposer_identity: input.proposer_identity,
    executor_identity: input.executor_identity,
    verifier_identity: input.verifier_identity,
    policy_version: authority_context?.policy_version,
    consent_receipt_hash,
    fate_policy_verdict: { schema: policy.schema, verdict: policy.verdict },
  }, authority_context);

  // The seal inputs travel WITH the record. A record whose hash cannot be
  // re-derived from its own contents is not a receipt, it is a decoration —
  // and a verifier that recomputes a value and never compares it is worse.
  const seal_inputs = Object.freeze({
    season_authority_hash: sha256(String(season_authority?.head ?? "")),
    fate_policy_hash: sha256(`${policy.schema}\n${policy.verdict}`),
    preview_hash: String(preview_hash ?? ""),
    consent_receipt_hash,
    fate_authorization_hash: sha256(`${auth?.verdict}\n${auth?.reason}\n${auth?.candidate_hash ?? ""}`),
  });
  const seal = {
    fate_policy: policy,
    fate_authorization: auth,
    consent_receipt_hash,
    seal_inputs,
    convergence_hash: convergenceHash(seal_inputs),
  };

  if (auth?.verdict === "ALLOW") return result("NONCE_ELIGIBLE", "ALLOW", seal);
  if (auth?.verdict === "UNVERIFIABLE") {
    return result("UNVERIFIABLE_AUTHORIZATION", auth.reason, seal);
  }
  return result("DENIED_AUTHORIZATION", auth?.reason ?? "DENY", seal);
}

/**
 * Re-derive the sealed fields. A record promoted to NONCE_ELIGIBLE, or whose
 * convergence_hash was edited, does not survive.
 */
export function verifyFateConvergence(record) {
  if (!record || typeof record !== "object" || record.schema !== CONVERGENCE_SCHEMA) return false;
  if (!CONVERGENCE_STATES.includes(record.state)) return false;
  if (record.nonce_eligible !== (record.state === "NONCE_ELIGIBLE")) return false;
  if (record.nonce_claimed !== false || record.effect_executed !== false
      || record.mutation_performed !== false || record.authority_delta !== 0
      || record.mint_allowed !== false) return false;

  if (record.state !== "NONCE_ELIGIBLE") return true;

  // Eligibility must be BACKED, not merely asserted.
  if (record.fate_authorization?.verdict !== "ALLOW") return false;
  if (record.fate_policy?.verdict !== POLICY_PERMIT) return false;
  if (record.fate_policy?.schema !== POLICY_SCHEMA_EXPECTED) return false;
  const si = record.seal_inputs;
  if (!si || typeof si !== "object") return false;
  if (si.consent_receipt_hash !== record.consent_receipt_hash) return false;
  // the two stage hashes must match the stage records they claim to seal
  if (si.fate_policy_hash !== sha256(`${record.fate_policy.schema}\n${record.fate_policy.verdict}`)) return false;
  if (si.fate_authorization_hash !== sha256(
        `${record.fate_authorization.verdict}\n${record.fate_authorization.reason}\n${record.fate_authorization.candidate_hash ?? ""}`)) return false;
  // and the seal itself must re-derive — this is the comparison, not a typeof
  return record.convergence_hash === convergenceHash(si);
}
