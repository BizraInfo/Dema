// DEMA-MISSION-CONTRACT-1A — Content-addressed immutable mission contract: canonical-json-v1 hash identity, fail-closed field validation, worker-channel amendment rejection.
//
// RED-FIRST kernel scaffold. `plan` and `build...Payload` are real (consent gate +
// content addressing are universal); the slice-specific `verify` / `run` bodies
// throw `not_implemented` until you build them. Turn the mirrored test green
// before any commit — do not weaken the test to match an empty kernel.
//
// Pure kernel: no fs / network / process / clock / random unless injected and
// documented in this header. Every claim here is a preview; the boundary is all-false.

// M5.1B: hash-bearing slices use the ONE canonical byte contract — no local
// serializer copy. Unsupported values (undefined, NaN, sparse arrays,
// accessors, ...) fail closed inside packages/canon with registered error
// codes. The scaffold auto-registers this kernel's path in
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS (scripts/review/canonical-json-v1-check.mjs);
// review that one-line diff in this slice's PR.
import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const DEMA_MISSION_CONTRACT_SCHEMA = "bizra.dema.dema_mission_contract.v0.1";
export const DEMA_MISSION_CONTRACT_TRUTH_LABEL = "DEMA_MISSION_CONTRACT_MEASURED_REPO";
export const DEMA_MISSION_CONTRACT_GO_PHRASE = "GO: dema mission contract preview";

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function demaMissionContractBoundary() {
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

// Contract ontology (spec: MISSION_RUNTIME_0A_SPEC_v0_1 phase_01 FR-1). Every
// field positively validated; a mission that cannot be judged (no acceptance
// criteria) or cannot terminate (no positive budget) is invalid at creation.
const ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}

function isArrayOfNonEmptyStrings(v, { allowEmpty = false } = {}) {
  if (!Array.isArray(v)) return false;
  if (!allowEmpty && v.length === 0) return false;
  return v.every((s) => isNonEmptyString(s));
}

function validateContractFields(input) {
  const blocked_by = [];
  if (!isNonEmptyString(input.purpose)) blocked_by.push("purpose_missing");
  if (!isNonEmptyString(input.scope)) blocked_by.push("scope_missing");
  if (!isArrayOfNonEmptyStrings(input.acceptance_criteria)) {
    blocked_by.push("acceptance_criteria_empty");
  }
  if (!isArrayOfNonEmptyStrings(input.prohibited_outcomes, { allowEmpty: true })) {
    blocked_by.push("prohibited_outcomes_not_string_list");
  }
  if (!isNonEmptyString(input.authority_ceiling)) blocked_by.push("authority_ceiling_missing");
  if (!Number.isInteger(input.iteration_budget) || input.iteration_budget < 1) {
    blocked_by.push("iteration_budget_not_positive_integer");
  }
  if (!isArrayOfNonEmptyStrings(input.completion_conditions)) {
    blocked_by.push("completion_conditions_empty");
  }
  if (!isNonEmptyString(input.escalation_rule)) blocked_by.push("escalation_rule_missing");
  if (typeof input.created_at_iso !== "string" || !ISO_UTC_PATTERN.test(input.created_at_iso)) {
    blocked_by.push("created_at_iso_not_utc_iso");
  }
  return blocked_by;
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
// Absence of a block is NEVER validation: push a block until you can POSITIVELY
// prove the input is well-formed for this slice's ontology.
export function planDemaMissionContract({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== DEMA_MISSION_CONTRACT_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    blocked_by.push("input_not_object");
  } else {
    for (const code of validateContractFields(input)) blocked_by.push(code);
  }
  return Object.freeze({
    schema: DEMA_MISSION_CONTRACT_SCHEMA,
    truth_label: DEMA_MISSION_CONTRACT_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed payload. Reshape `body` to carry the real fields
// this slice attests; the content_hash binds the whole body.
export function buildDemaMissionContractPayload(input) {
  const body = {
    schema: DEMA_MISSION_CONTRACT_SCHEMA,
    truth_label: DEMA_MISSION_CONTRACT_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    input,
    boundary: demaMissionContractBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier (REQUIRED by the core-kernels rule).
// Recompute the hash over the body MINUS its hash field and reject any mismatch,
// then add the slice-specific field checks. Body-bound, not seed-bound: a forged
// field with a recomputed hash must still fail because verify binds the WHOLE body
// against an independent anchor (e.g. a signature or an externally supplied hash).
export function verifyDemaMissionContract(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  if (payload.schema !== DEMA_MISSION_CONTRACT_SCHEMA) blocked_by.push("schema_mismatch");
  if (payload.truth_label !== DEMA_MISSION_CONTRACT_TRUTH_LABEL) blocked_by.push("truth_label_mismatch");
  // Vacuous-boundary trap: deep-equal against the canonical key set, all false —
  // a missing key or an extra key is as fatal as a true value.
  const canonical = demaMissionContractBoundary();
  const b = payload.boundary;
  const boundaryOk =
    b && typeof b === "object" &&
    Object.keys(canonical).length === Object.keys(b).length &&
    Object.entries(canonical).every(([k, v]) => b[k] === v);
  if (!boundaryOk) blocked_by.push("boundary_not_all_false_canonical");
  if (typeof payload.content_hash !== "string") {
    blocked_by.push("content_hash_missing");
  } else {
    const { content_hash, ...body } = payload;
    let recomputed;
    try {
      recomputed = sha256CanonicalJsonV1(body);
    } catch {
      blocked_by.push("body_not_canonicalizable");
    }
    if (recomputed !== undefined && recomputed !== content_hash) {
      blocked_by.push("content_hash_mismatch");
    }
  }
  if (blocked_by.length === 0 && validateContractFields(payload.input ?? {}).length > 0) {
    blocked_by.push("contract_fields_invalid");
  }
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

// Amendment seam (spec phase_01 FR-2). There is no in-place edit path: an
// accepted amendment is a NEW content-addressed contract; the prior contract
// object is never mutated. Any non-operator channel is rejected fail-closed —
// worker proposals carry no mutation authority.
export const DEMA_MISSION_CONTRACT_OPERATOR_CHANNEL = "operator_consented";

export function proposeDemaMissionContractAmendment({ contract, changes, channel, consent } = {}) {
  const blocked_by = [];
  if (channel !== DEMA_MISSION_CONTRACT_OPERATOR_CHANNEL) {
    blocked_by.push("contract_mutation_rejected");
  }
  if (consent !== DEMA_MISSION_CONTRACT_GO_PHRASE) blocked_by.push("consent_phrase_mismatch");
  if (!changes || typeof changes !== "object" || Array.isArray(changes)) {
    blocked_by.push("changes_not_object");
  }
  const priorVerdict = verifyDemaMissionContract(contract);
  if (!priorVerdict.ok) blocked_by.push("prior_contract_verify_failed");
  if (blocked_by.length > 0) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(blocked_by) });
  }
  const nextInput = { ...contract.input, ...changes };
  const fieldBlocks = validateContractFields(nextInput);
  if (fieldBlocks.length > 0) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(fieldBlocks) });
  }
  const next = buildDemaMissionContractPayload(nextInput);
  return Object.freeze({
    ok: true,
    blocked_by: Object.freeze([]),
    contract: next,
    superseded_content_hash: contract.content_hash,
  });
}

// Orchestrator the review gate consumes. Run plan -> build -> verify -> tamper-reject
// and return the proof envelope: { ok, schema, truth_label, content_hash, boundary,
// blocked_by }. Push a named block on any failure so the gate fails closed.
export function runDemaMissionContract({ consent, input } = {}) {
  const blocked_by = [];
  const plan = planDemaMissionContract({ consent, input });
  if (!plan.eligible) {
    return Object.freeze({
      ok: false,
      schema: DEMA_MISSION_CONTRACT_SCHEMA,
      truth_label: DEMA_MISSION_CONTRACT_TRUTH_LABEL,
      boundary: demaMissionContractBoundary(),
      blocked_by: plan.blocked_by,
    });
  }
  const payload = buildDemaMissionContractPayload(input);
  const verdict = verifyDemaMissionContract(payload);
  if (!verdict.ok) for (const code of verdict.blocked_by) blocked_by.push(code);
  // Determinism probe: identical input must re-derive the identical hash.
  if (buildDemaMissionContractPayload(input).content_hash !== payload.content_hash) {
    blocked_by.push("content_hash_not_deterministic");
  }
  // Tamper probe: a forged field with a stale hash must be rejected.
  if (verifyDemaMissionContract({ ...payload, truth_label: "FORGED" }).ok !== false) {
    blocked_by.push("tamper_not_rejected");
  }
  // Mutation probe: a worker-channel amendment must be rejected.
  const mutation = proposeDemaMissionContractAmendment({
    contract: payload,
    changes: { scope: "widened" },
    channel: "worker_proposal",
    consent,
  });
  if (mutation.ok !== false || !mutation.blocked_by.includes("contract_mutation_rejected")) {
    blocked_by.push("worker_mutation_not_rejected");
  }
  return Object.freeze({
    ok: blocked_by.length === 0,
    schema: DEMA_MISSION_CONTRACT_SCHEMA,
    truth_label: DEMA_MISSION_CONTRACT_TRUTH_LABEL,
    content_hash: payload.content_hash,
    boundary: demaMissionContractBoundary(),
    blocked_by: Object.freeze(blocked_by),
  });
}
