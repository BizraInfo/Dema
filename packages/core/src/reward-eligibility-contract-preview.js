// REWARD-ELIGIBILITY-CONTRACT-PREVIEW-1A — Preview-only reward-eligibility contract: classifies a DEMA lifecycle outcome as reward-eligible or reward-ineligible from evidence refs, monitor state, and claim flags — inert output with no score, no authority signal, no action-permission field; forbidden claims and monitor-hiding are dominant refusals; evidence refs mandatory.
//
// RED-FIRST kernel scaffold. `plan` and `build...Payload` are real (consent gate +
// content addressing are universal); the slice-specific `verify` / `run` bodies
// throw `not_implemented` until you build them. Turn the mirrored test green
// before any commit — do not weaken the test to match an empty kernel.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.

import { createHash } from "node:crypto";

export const REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA = "bizra.dema.reward_eligibility_contract_preview.v0.1";
export const REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL = "REWARD_ELIGIBILITY_CONTRACT_PREVIEW_MEASURED_REPO";
export const REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE = "GO: evaluate reward eligibility";

// Outcomes that CAN be reward-eligible when all evidence/claim gates pass.
export const REWARD_ELIGIBLE_OUTCOME_KINDS = Object.freeze([
  "monitor_detected_real_drift",
  "false_positive_corrected_with_tests",
  "real_drift_repaired",
  "monitor_all_clear_after_repair",
  "gates_green",
  "registry_count_not_inflated",
]);

// Outcomes that describe bad behavior — intrinsically ineligible, no evidence
// can rescue them. `monitor_weakened_to_hide_drift` is the dominant negative.
export const REWARD_INELIGIBLE_OUTCOME_KINDS = Object.freeze([
  "forged_clean_verdict",
  "monitor_weakened_to_hide_drift",
  "unsupported_reward_claim",
]);

// Claim flags that, if asserted true, make an outcome ineligible. Exact-name
// map from a flag to its refusal code — these are the riba/zann/authority tripwires.
export const REWARD_FORBIDDEN_CLAIM_CODES = Object.freeze({
  mint_claim: "mint_claimed",
  wallet_claim: "wallet_claimed",
  urp_live_claim: "urp_live_claimed",
  federation_claim: "federation_claimed",
  public_safe_claim: "public_safe_claimed",
  authority_delta_nonzero: "authority_delta_claimed",
  cost_called_value: "cost_called_value",
  simulated_impact_as_real: "simulated_impact_as_real",
});

// Outcome kinds that assert a specific monitor state; the asserted state must
// match the supplied monitor_state or the outcome is incoherent (not eligible).
const OUTCOME_REQUIRES_ALL_CLEAR = "monitor_all_clear_after_repair";

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function isBool(v) {
  return typeof v === "boolean";
}

function isCount(v) {
  return Number.isInteger(v) && v >= 0;
}

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

// Pure eligibility contract. Fail-closed: collect EVERY refusal reason; an
// outcome is eligible only when nothing refuses it AND it names a positive kind
// with mandatory evidence. This function grants nothing — it only classifies.
export function deriveRewardEligibility(outcome) {
  const refusal_codes = [];
  const kind = outcome.outcome_kind;
  const known =
    REWARD_ELIGIBLE_OUTCOME_KINDS.includes(kind) || REWARD_INELIGIBLE_OUTCOME_KINDS.includes(kind);
  if (!known) refusal_codes.push("outcome_kind_not_recognized");
  if (REWARD_INELIGIBLE_OUTCOME_KINDS.includes(kind)) {
    refusal_codes.push(`outcome_intrinsically_ineligible:${kind}`);
  }

  // Evidence is mandatory — an unsupported reward claim can never be eligible.
  if (!Array.isArray(outcome.evidence_refs) || outcome.evidence_refs.length === 0) {
    refusal_codes.push("evidence_refs_missing");
  }

  // Monitor state gates. Criticals block; a monitor weakened to hide drift is
  // the dominant negative and can never be rewarded.
  const ms = outcome.monitor_state;
  if (ms.weakened_to_hide_drift === true) refusal_codes.push("monitor_weakened_to_hide_drift");
  if (ms.critical_count > 0) refusal_codes.push("monitor_criticals_present");
  // Coherence: an outcome asserting all-clear must be backed by an all-clear monitor.
  if (kind === OUTCOME_REQUIRES_ALL_CLEAR && ms.all_clear !== true) {
    refusal_codes.push("outcome_monitor_state_incoherent");
  }

  // Forbidden claims — riba/zann/authority tripwires. Each true flag refuses.
  for (const [flag, code] of Object.entries(REWARD_FORBIDDEN_CLAIM_CODES)) {
    if (outcome.claims[flag] === true) refusal_codes.push(code);
  }

  const eligible = refusal_codes.length === 0 && REWARD_ELIGIBLE_OUTCOME_KINDS.includes(kind);
  return Object.freeze({
    outcome_kind: kind,
    eligible,
    refusal_codes: Object.freeze([...new Set(refusal_codes)].sort()),
    evidence_ref_count: Array.isArray(outcome.evidence_refs) ? outcome.evidence_refs.length : 0,
    // INERT markers — this verdict is not a score, carries no authority, and
    // permits no action. A future actuator finds nothing here to read as license.
    is_score: false,
    is_actuation_signal: false,
    confers_permission: false,
    authority_delta: 0,
    mint_allowed: false,
    cost_is_not_value: true,
    simulated_is_not_real: true,
  });
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function rewardEligibilityContractPreviewBoundary() {
  return Object.freeze({
    execution_allowed: false,
    daemon_started: false,
    network_used: false,
    token_minted: false,
    wallet_accessed: false,
    live_execution_performed: false,
    file_mutation_performed: false,
    model_invocation_performed: false,
  });
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
// Absence of a block is NEVER validation: push a block until you can POSITIVELY
// prove the input is well-formed for this slice's ontology.
export function planRewardEligibilityContractPreview({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== REWARD_ELIGIBILITY_CONTRACT_PREVIEW_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object") {
    blocked_by.push("input_not_object");
  } else {
    const o = input.outcome;
    if (!o || typeof o !== "object") {
      blocked_by.push("outcome_missing");
    } else {
      if (!isNonEmptyString(o.outcome_kind)) blocked_by.push("outcome_kind_invalid");
      if (!Array.isArray(o.evidence_refs) || !o.evidence_refs.every(isNonEmptyString)) {
        blocked_by.push("evidence_refs_invalid");
      }
      const ms = o.monitor_state;
      if (
        !ms || typeof ms !== "object" || !isCount(ms.critical_count) ||
        !isBool(ms.all_clear) || !isBool(ms.weakened_to_hide_drift)
      ) {
        blocked_by.push("monitor_state_invalid");
      }
      const c = o.claims;
      if (
        !c || typeof c !== "object" ||
        !Object.keys(REWARD_FORBIDDEN_CLAIM_CODES).every((k) => isBool(c[k]))
      ) {
        blocked_by.push("claims_invalid");
      }
    }
  }
  return Object.freeze({
    schema: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA,
    truth_label: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload. Reshape `body` to carry the real fields
// this slice attests; the content_hash binds the whole body.
export function buildRewardEligibilityContractPreviewPayload(input) {
  const body = {
    schema: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA,
    truth_label: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL,
    mode: "preview_only",
    input,
    eligibility: deriveRewardEligibility(input.outcome),
    boundary: rewardEligibilityContractPreviewBoundary(),
  };
  const content_hash = `sha256:${sha256(stableStringify(body))}`;
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier (REQUIRED by the core-kernels rule).
// Recompute the hash over the body MINUS its hash field and reject any mismatch,
// then add the slice-specific field checks. Body-bound, not seed-bound: a forged
// field with a recomputed hash must still fail because verify binds the WHOLE body
// against an independent anchor (e.g. a signature or an externally supplied hash).
export function verifyRewardEligibilityContractPreview(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object") {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  const { content_hash, ...body } = payload;
  if (typeof content_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(content_hash)) {
    blocked_by.push("content_hash_missing");
  } else if (`sha256:${sha256(stableStringify(body))}` !== content_hash) {
    blocked_by.push("content_hash_mismatch");
  }
  if (body.schema !== REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA) blocked_by.push("schema_mismatch");
  if (body.truth_label !== REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  if (body.mode !== "preview_only") blocked_by.push("mode_not_preview_only");

  const canonical = rewardEligibilityContractPreviewBoundary();
  const canonicalKeys = Object.keys(canonical).sort();
  const boundaryKeys = body.boundary && typeof body.boundary === "object" ? Object.keys(body.boundary).sort() : [];
  if (
    boundaryKeys.length !== canonicalKeys.length ||
    !canonicalKeys.every((k, i) => boundaryKeys[i] === k && body.boundary[k] === false)
  ) {
    blocked_by.push("boundary_not_canonical_all_false");
  }

  // Independent anchor: eligibility is DERIVED, so verify re-derives it from the
  // input outcome. A forged eligible verdict (eligible flipped true, refusal
  // codes stripped, hash recomputed) still fails because the contract disagrees.
  let rederived = null;
  try {
    rederived = deriveRewardEligibility(body.input.outcome);
  } catch {
    blocked_by.push("outcome_not_derivable");
  }
  if (rederived && stableStringify(rederived) !== stableStringify(body.eligibility)) {
    blocked_by.push("eligibility_not_rederivable");
  }

  // Inertness is non-negotiable: the verdict must never carry authority, a
  // score, or an action permission, whatever the input said.
  const e = body.eligibility && typeof body.eligibility === "object" ? body.eligibility : {};
  if (e.is_score !== false) blocked_by.push("verdict_is_score");
  if (e.is_actuation_signal !== false) blocked_by.push("verdict_is_actuation_signal");
  if (e.confers_permission !== false) blocked_by.push("verdict_confers_permission");
  if (e.authority_delta !== 0) blocked_by.push("verdict_authority_delta_nonzero");
  if (e.mint_allowed !== false) blocked_by.push("verdict_mint_allowed");
  return Object.freeze({
    ok: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
    schema: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA,
    truth_label: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL,
    content_hash: typeof content_hash === "string" ? content_hash : null,
  });
}

// Orchestrator the review gate consumes. Run plan -> build -> verify -> tamper-reject
// and return the proof envelope: { ok, schema, truth_label, content_hash, boundary,
// blocked_by }. Push a named block on any failure so the gate fails closed.
export function runRewardEligibilityContractPreview({ consent, input } = {}) {
  const boundary = rewardEligibilityContractPreviewBoundary();
  const refuse = (codes) =>
    Object.freeze({
      ok: false,
      schema: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA,
      truth_label: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL,
      blocked_by: Object.freeze([...codes]),
      boundary,
    });

  const plan = planRewardEligibilityContractPreview({ consent, input });
  if (!plan.eligible) return refuse(plan.blocked_by);

  const payload = buildRewardEligibilityContractPreviewPayload(input);
  const verdict = verifyRewardEligibilityContractPreview(payload);
  if (!verdict.ok) return refuse(verdict.blocked_by);

  // Tamper probes — a forged "eligible" verdict must be POSITIVELY rejected.
  const hashTamper = verifyRewardEligibilityContractPreview({ ...payload, content_hash: `sha256:${"0".repeat(64)}` });
  const forgedEligible = { ...payload.eligibility, eligible: true, refusal_codes: [] };
  const { content_hash: _oldHash, ...launderBody } = { ...payload, eligibility: forgedEligible };
  const laundered = verifyRewardEligibilityContractPreview({
    ...launderBody,
    content_hash: `sha256:${sha256(stableStringify(launderBody))}`,
  });
  const alreadyEligibleWithNoCodes =
    payload.eligibility.eligible === true && payload.eligibility.refusal_codes.length === 0;
  if (hashTamper.ok || (!alreadyEligibleWithNoCodes && laundered.ok)) {
    return refuse(["tamper_probe_not_rejected"]);
  }

  return Object.freeze({
    ok: true,
    schema: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_SCHEMA,
    truth_label: REWARD_ELIGIBILITY_CONTRACT_PREVIEW_TRUTH_LABEL,
    mode: "preview_only",
    eligibility: payload.eligibility,
    content_hash: payload.content_hash,
    boundary: payload.boundary,
    blocked_by: Object.freeze([]),
  });
}
