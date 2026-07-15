// NODE0-ROLE-MODEL-BINDING-REGISTRY-1A — SHADOW-only fail-closed role-model binding registry: roles bind to models only through evidence-bearing capability records that satisfy an independently versioned role-and-lane acceptance policy (metric, direction, threshold, evaluation identity); stale, contradicted, superseded, over-budget, under-threshold, or independence-violating bindings are rejected or abstained; missing/inapplicable policy and design-family contradictions surface as REQUIRES_HUMAN.
//
// Pure kernel: no fs / network / process / clock / random. Time is injected via
// `as_of_iso`; every decision is deterministically re-derivable from its input,
// which is what verify() uses as its independent anchor. The boundary is all-false:
// this kernel cannot activate a role, invoke a model, mutate canon, or widen
// authority — modes other than SHADOW/CANDIDATE are rejected.
//
// Design: docs/06-adr/ADR-045-role-model-binding-registry-1a.md. The registry
// decouples logical role contracts (agent-role-contract.js — preserved as
// historical design evidence, never rewritten here) from model families: a
// binding exists only through a capability record whose evidence hash
// (format-checked, NOT content-verified against the source bytes — syntactic
// validity of a SHA-256 field proves NOTHING about the authenticity of the
// source evidence), freshness, verification state, budget, privacy class, and
// consent ref pass fail-closed checks. Adequacy invariant: a route can bind
// ONLY when an independently versioned role-and-lane acceptance policy
// (metric, direction, threshold, evaluation identity) is supplied and the
// evidence satisfies it; without an applicable policy the kernel returns
// REQUIRES_HUMAN, never BOUND — structural validity, freshness, and a
// "measured" label alone are never sufficient to bind.
// A record whose family contradicts the role contract's designed family is never
// silently bound OR silently dropped — it surfaces as REQUIRES_HUMAN
// (spec_reopen_required), which is exactly the measured gemma/deepseek
// contradiction the C1 campaign is halted on.
//
// M5.1B: hash-bearing slices use the ONE canonical byte contract — no local
// serializer copy. Unsupported values (undefined, NaN, sparse arrays,
// accessors, ...) fail closed inside packages/canon with registered error
// codes. The scaffold auto-registers this kernel's path in
// CANONICAL_JSON_V1_REGISTERED_CONSUMERS (scripts/review/canonical-json-v1-check.mjs);
// review that one-line diff in this slice's PR.
import { CANONICAL_JSON_V1_ALGORITHM } from "../../canon/src/canonical-json-v1.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import { validateAgentRoleContract } from "./agent-role-contract.js";

export const NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA = "bizra.dema.node0_role_model_binding_registry.v0.1";
export const NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL = "NODE0_ROLE_MODEL_BINDING_REGISTRY_MEASURED_REPO";
export const NODE0_ROLE_MODEL_BINDING_REGISTRY_GO_PHRASE = "GO: node0 role model binding registry preview";

export const CAPABILITY_RECORD_SCHEMA = "bizra.node0.role_capability_record.v0.1";
export const BINDING_DECISION_SCHEMA = "bizra.node0.role_model_binding_decision.v0.1";
// Independently versioned: the policy carries its own schema/id/version and is
// supplied separately from the records it judges — a record can never smuggle
// in the bar it is measured against.
export const ACCEPTANCE_POLICY_SCHEMA = "bizra.node0.role_lane_acceptance_policy.v0.1";

export const REGISTRY_MODES = Object.freeze(["SHADOW", "CANDIDATE"]);

// The eight Node0 workload lanes (mission NODE0-HCF §6). A capability measured
// in one lane proves nothing about another; bindings are per-lane by design.
export const WORKLOAD_LANES = Object.freeze([
  "short_sat_judgment",
  "pat_collaborative_reasoning",
  "foundry_long_context_ingestion",
  "code_and_reproduction",
  "external_research",
  "deep_synthesis",
  "burst_expert_mission",
  "background_bounded_batch",
]);

// Authority separation encoded as lanes: SAT judges and never operates the
// mission; PAT operates and never takes SAT's judgment authority.
export const SAT_ALLOWED_LANES = Object.freeze(["short_sat_judgment"]);

export const VERIFICATION_STATES = Object.freeze([
  "MEASURED_CURRENT",
  "MEASURED_LOCAL",
  "V_HISTORICAL",
  "DESIGN_ONLY",
  "UNKNOWN",
]);
export const ELIGIBLE_VERIFICATION_STATES = Object.freeze([
  "MEASURED_CURRENT",
  "MEASURED_LOCAL",
]);

export const DECISION_STATUSES = Object.freeze([
  "BOUND_SHADOW",
  "BOUND_CANDIDATE",
  "REJECTED",
  "ABSTAIN",
  "REQUIRES_HUMAN",
]);

// v0.1 privacy floor: only local-only capability evidence may bind.
const PRIVACY_CLASSES = Object.freeze(["LOCAL_ONLY"]);

const INPUT_KEYS = Object.freeze([
  "mode",
  "as_of_iso",
  "max_age_days",
  "role_contract",
  "lane",
  "records",
  "budget",
  "pat_bound_families",
  "acceptance_policy",
]);

const POLICY_KEYS = Object.freeze([
  "schema",
  "policy_id",
  "policy_version",
  "role_id",
  "lane",
  "metric",
  "direction",
  "threshold",
  "evaluation_id",
]);

export const METRIC_DIRECTIONS = Object.freeze(["higher_is_better", "lower_is_better"]);

const RECORD_KEYS = Object.freeze([
  "schema",
  "record_id",
  "role_id",
  "lane",
  "model_id",
  "backend_id",
  "family",
  "evidence",
  "limitations",
  "resource_envelope",
  "privacy_class",
  "consent_ref",
  "verification_state",
  "superseded_by",
  "contradicted_by",
]);

const SHA256_HEX = /^[a-f0-9]{64}$/;
// UTC-only by design (fail-closed tightening): offsets multiply the forgery
// surface for no local-first benefit.
const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;
const MS_PER_DAY = 86_400_000;

function isNonEmptyString(v) {
  return typeof v === "string" && v.trim().length > 0;
}
function isFiniteNonNegative(v) {
  return typeof v === "number" && Number.isFinite(v) && v >= 0;
}
function isIso(v) {
  if (typeof v !== "string" || !ISO_RE.test(v)) return false;
  const ms = Date.parse(v);
  if (!Number.isFinite(ms)) return false;
  // Round-trip guard: Date.parse silently rolls invalid calendar dates
  // (2026-02-30 → 2026-03-02); a rolled date is a forged date.
  return new Date(ms).toISOString().slice(0, 19) === v.slice(0, 19);
}
function isStringArray(v) {
  return Array.isArray(v) && v.every((s) => typeof s === "string");
}

// All-false boundary invariant. These keys mirror the capability-truth-registry
// row boundary — keep them all false; flipping any one is an execution claim.
export function node0RoleModelBindingRegistryBoundary() {
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

// Fail-closed capability-record validator. Absence of a block is never
// validation: every field must positively prove its shape.
export function validateCapabilityRecord(r) {
  const blocked_by = [];
  if (!r || typeof r !== "object" || Array.isArray(r)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["record_not_object"]) });
  }
  for (const k of Object.keys(r)) {
    if (!RECORD_KEYS.includes(k)) blocked_by.push(`record_unknown_key:${k}`);
  }
  if (r.schema !== CAPABILITY_RECORD_SCHEMA) blocked_by.push("record_schema_invalid");
  if (!isNonEmptyString(r.record_id)) blocked_by.push("record_id_invalid");
  if (!isNonEmptyString(r.role_id)) blocked_by.push("record_role_id_invalid");
  if (!WORKLOAD_LANES.includes(r.lane)) blocked_by.push("record_lane_unknown");
  if (!isNonEmptyString(r.model_id)) blocked_by.push("record_model_id_invalid");
  if (!isNonEmptyString(r.backend_id)) blocked_by.push("record_backend_id_invalid");
  if (!isNonEmptyString(r.family)) blocked_by.push("record_family_invalid");
  const e = r.evidence;
  if (!e || typeof e !== "object" || Array.isArray(e)) blocked_by.push("evidence_missing");
  else {
    if (!isNonEmptyString(e.source_path)) blocked_by.push("evidence_source_path_invalid");
    if (typeof e.sha256 !== "string" || !SHA256_HEX.test(e.sha256)) blocked_by.push("evidence_sha256_invalid");
    if (!isIso(e.measured_at_iso)) blocked_by.push("evidence_measured_at_invalid");
    if (!isNonEmptyString(e.metric)) blocked_by.push("evidence_metric_invalid");
    if (typeof e.value !== "number" || !Number.isFinite(e.value)) blocked_by.push("evidence_value_invalid");
    // The evaluation identity names WHICH evaluation produced the value; the
    // acceptance policy pins it so a value from a different dataset can never
    // satisfy the policy's threshold.
    if (!isNonEmptyString(e.evaluation_id)) blocked_by.push("evidence_evaluation_id_invalid");
  }
  if (!isStringArray(r.limitations)) blocked_by.push("limitations_invalid");
  const env = r.resource_envelope;
  if (!env || typeof env !== "object" || Array.isArray(env) || !isFiniteNonNegative(env.vram_gb_est) || !isFiniteNonNegative(env.ram_gb_est)) {
    blocked_by.push("resource_envelope_invalid");
  }
  if (!isNonEmptyString(r.privacy_class)) blocked_by.push("privacy_class_missing");
  else if (!PRIVACY_CLASSES.includes(r.privacy_class)) blocked_by.push("privacy_class_not_local_only");
  if (!isNonEmptyString(r.consent_ref)) blocked_by.push("consent_ref_missing");
  if (!VERIFICATION_STATES.includes(r.verification_state)) blocked_by.push("verification_state_unknown");
  if (r.superseded_by !== null && !isNonEmptyString(r.superseded_by)) blocked_by.push("superseded_by_invalid");
  if (!isStringArray(r.contradicted_by)) blocked_by.push("contradicted_by_invalid");
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

// Fail-closed acceptance-policy validator. The policy is the ONLY thing that
// can make evidence adequate: it defines the metric, direction, threshold, and
// evaluation identity a binding must satisfy for one role+lane.
export function validateAcceptancePolicy(p) {
  const blocked_by = [];
  if (!p || typeof p !== "object" || Array.isArray(p)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["policy_not_object"]) });
  }
  for (const k of Object.keys(p)) {
    if (!POLICY_KEYS.includes(k)) blocked_by.push(`policy_unknown_key:${k}`);
  }
  if (p.schema !== ACCEPTANCE_POLICY_SCHEMA) blocked_by.push("policy_schema_invalid");
  if (!isNonEmptyString(p.policy_id)) blocked_by.push("policy_id_invalid");
  if (!isNonEmptyString(p.policy_version)) blocked_by.push("policy_version_invalid");
  if (!isNonEmptyString(p.role_id)) blocked_by.push("policy_role_id_invalid");
  if (!WORKLOAD_LANES.includes(p.lane)) blocked_by.push("policy_lane_unknown");
  if (!isNonEmptyString(p.metric)) blocked_by.push("policy_metric_invalid");
  if (!METRIC_DIRECTIONS.includes(p.direction)) blocked_by.push("policy_direction_invalid");
  if (typeof p.threshold !== "number" || !Number.isFinite(p.threshold)) blocked_by.push("policy_threshold_invalid");
  if (!isNonEmptyString(p.evaluation_id)) blocked_by.push("policy_evaluation_id_invalid");
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

// Structural input blocks shared by plan() and resolveRoleModelBinding().
function collectInputBlocks(input) {
  const blocked_by = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return ["input_not_object"];
  }
  for (const k of Object.keys(input)) {
    if (!INPUT_KEYS.includes(k)) blocked_by.push(`input_unknown_key:${k}`);
  }
  if (!REGISTRY_MODES.includes(input.mode)) blocked_by.push("mode_not_shadow_or_candidate");
  if (!isIso(input.as_of_iso)) blocked_by.push("as_of_iso_invalid");
  if (!Number.isInteger(input.max_age_days) || input.max_age_days <= 0) blocked_by.push("max_age_days_invalid");
  if (!validateAgentRoleContract(input.role_contract).ok) blocked_by.push("role_contract_invalid");
  if (!WORKLOAD_LANES.includes(input.lane)) blocked_by.push("lane_unknown");
  if (!Array.isArray(input.records)) blocked_by.push("records_not_array");
  else {
    // A receipt must identify exactly which evidence record was bound; a
    // duplicate id would make chosen_record_id ambiguous (agent-role-contract
    // enforces the same guard on role_id).
    const ids = input.records
      .filter((r) => r && typeof r === "object" && typeof r.record_id === "string")
      .map((r) => r.record_id);
    if (new Set(ids).size !== ids.length) blocked_by.push("record_id_duplicate");
  }
  const b = input.budget;
  if (!b || typeof b !== "object" || Array.isArray(b) || !isFiniteNonNegative(b.vram_gb_max) || !isFiniteNonNegative(b.ram_gb_max)) {
    blocked_by.push("budget_invalid");
  }
  if (input.pat_bound_families !== undefined && !isStringArray(input.pat_bound_families)) {
    blocked_by.push("pat_bound_families_invalid");
  }
  // A MISSING policy is not a structural defect — resolve() routes it to
  // REQUIRES_HUMAN. A malformed policy is a structural defect and rejects.
  if (input.acceptance_policy !== undefined && !validateAcceptancePolicy(input.acceptance_policy).ok) {
    blocked_by.push("acceptance_policy_invalid");
  }
  return blocked_by;
}

function decision(input, status, reasons, chosen_record_id, evaluated) {
  return Object.freeze({
    schema: BINDING_DECISION_SCHEMA,
    status,
    mode: input && typeof input === "object" && !Array.isArray(input) ? (input.mode ?? null) : null,
    lane: input && typeof input === "object" && !Array.isArray(input) ? (input.lane ?? null) : null,
    role_id: input?.role_contract?.role_id ?? null,
    reasons: Object.freeze([...reasons]),
    chosen_record_id,
    evaluated: Object.freeze(evaluated.map((x) => Object.freeze({ record_id: x.record_id, reasons: Object.freeze([...x.reasons]) }))),
  });
}

// Deterministic, fail-closed binding resolution. Same input → same decision;
// verify() exploits this as the independent anchor (decision re-derivation).
export function resolveRoleModelBinding(input) {
  const blocks = collectInputBlocks(input);
  if (blocks.length > 0) return decision(input, "REJECTED", blocks, null, []);

  const contract = input.role_contract;
  const team = contract.team;
  if (team === "SAT" && !SAT_ALLOWED_LANES.includes(input.lane)) {
    return decision(input, "REJECTED", ["sat_lane_forbidden_mission_operation"], null, []);
  }
  if (team === "PAT" && SAT_ALLOWED_LANES.includes(input.lane)) {
    return decision(input, "REJECTED", ["pat_lane_forbidden_sat_authority"], null, []);
  }
  // Verifier independence is only checkable against the PAT-bound family set;
  // without it a SAT binding cannot prove independence → ABSTAIN, never a pass.
  if (team === "SAT" && input.pat_bound_families === undefined) {
    return decision(input, "ABSTAIN", ["independence_unverifiable"], null, []);
  }
  // Adequacy invariant: without an applicable acceptance policy there is no
  // bar for the evidence to clear, so nothing may bind — the decision is the
  // operator's, represented and escalated, never silently taken. Structural
  // validity + freshness + a "measured" label are NOT adequacy.
  const policy = input.acceptance_policy;
  if (policy === undefined) {
    return decision(input, "REQUIRES_HUMAN", ["acceptance_policy_missing"], null, []);
  }
  if (policy.role_id !== contract.role_id || policy.lane !== input.lane) {
    return decision(input, "REQUIRES_HUMAN", ["acceptance_policy_not_applicable"], null, []);
  }

  const asOfMs = Date.parse(input.as_of_iso);
  const sorted = [...input.records].sort((a, b) => {
    const ai = a && typeof a === "object" ? String(a.record_id ?? "") : "";
    const bi = b && typeof b === "object" ? String(b.record_id ?? "") : "";
    return ai < bi ? -1 : ai > bi ? 1 : 0;
  });

  const evaluated = [];
  const eligible = [];
  const familyContradicting = [];
  for (const r of sorted) {
    // Hard reasons kill a record outright. Family reasons on an otherwise
    // clean record are the operator's spec-reopen fork — they must surface
    // as REQUIRES_HUMAN, never be buried inside a generic rejection. This is
    // exactly the measured gemma-vs-deepseek SAT-judge case: gemma is both
    // PAT-bound AND the design-contradicting measured-best family, and only
    // the human may reassign families (C1 contract, Path B).
    const hard = [];
    const familyReasons = [];
    const shape = validateCapabilityRecord(r);
    if (!shape.ok) hard.push(...shape.blocked_by);
    else {
      if (r.role_id !== contract.role_id || r.lane !== input.lane) hard.push("record_role_lane_mismatch");
      const measuredMs = Date.parse(r.evidence.measured_at_iso);
      if (measuredMs > asOfMs) hard.push("evidence_from_future");
      else if ((asOfMs - measuredMs) / MS_PER_DAY > input.max_age_days) hard.push("evidence_stale");
      if (!ELIGIBLE_VERIFICATION_STATES.includes(r.verification_state)) hard.push("verification_state_ineligible");
      if (r.superseded_by !== null) hard.push("record_superseded");
      if (r.contradicted_by.length > 0) hard.push("record_contradicted");
      if (r.resource_envelope.vram_gb_est > input.budget.vram_gb_max || r.resource_envelope.ram_gb_est > input.budget.ram_gb_max) {
        hard.push("budget_exceeded");
      }
      // Evidence must be judged by the policy's own metric and evaluation
      // identity; a value from a different metric or dataset is meaningless
      // against the threshold, so it never even reaches the threshold check.
      const metricOk = r.evidence.metric === policy.metric;
      const evalOk = r.evidence.evaluation_id === policy.evaluation_id;
      if (!metricOk) hard.push("evidence_metric_mismatch_policy");
      if (!evalOk) hard.push("evidence_evaluation_id_mismatch_policy");
      if (metricOk && evalOk) {
        const meets = policy.direction === "higher_is_better"
          ? r.evidence.value >= policy.threshold
          : r.evidence.value <= policy.threshold;
        if (!meets) hard.push("capability_threshold_not_met");
      }
      const matchesDesign = r.family === contract.base_class.family;
      const sharedWithPat = team === "SAT" && input.pat_bound_families.includes(r.family);
      if (!matchesDesign) {
        familyReasons.push("family_contradicts_design_contract");
        if (sharedWithPat) familyReasons.push("sat_family_shared_with_pat");
      } else if (sharedWithPat) {
        // Design-consistent independence violation: the fleet itself is
        // misconfigured (base_family_shared_across_teams) — hard reject.
        hard.push("sat_family_shared_with_pat");
      }
    }
    const reasons = [...hard, ...familyReasons];
    if (hard.length === 0 && familyReasons.length === 0) eligible.push(r);
    else if (hard.length === 0) familyContradicting.push(familyReasons);
    evaluated.push({ record_id: r && typeof r === "object" && typeof r.record_id === "string" ? r.record_id : "unknown", reasons });
  }

  if (eligible.length === 1) {
    return decision(input, input.mode === "SHADOW" ? "BOUND_SHADOW" : "BOUND_CANDIDATE", [], eligible[0].record_id, evaluated);
  }
  if (eligible.length > 1) {
    // ponytail: single-eligible rule; a measured ranking policy is a later slice.
    return decision(input, "REJECTED", ["ambiguous_multiple_eligible_records"], null, evaluated);
  }
  if (familyContradicting.length > 0) {
    // The measured-family-vs-designed-family fork is the operator's
    // spec-reopen decision — never resolved in code, never silently dropped.
    const reasonSet = new Set(familyContradicting.flat());
    reasonSet.add("spec_reopen_required");
    return decision(input, "REQUIRES_HUMAN", [...reasonSet].sort(), null, evaluated);
  }
  // Threshold failure is surfaced at the top level by mandate: a record that
  // fails its policy bar is REJECTED as capability_threshold_not_met, not
  // buried inside a generic no-eligible rejection.
  const thresholdFailed = evaluated.some((x) => x.reasons.includes("capability_threshold_not_met"));
  return decision(
    input,
    "REJECTED",
    thresholdFailed ? ["capability_threshold_not_met", "no_eligible_capability_record"] : ["no_eligible_capability_record"],
    null,
    evaluated,
  );
}

// Fail-closed plan. Collect every reason the action is blocked; eligible only
// when nothing blocks. Exact GO-phrase byte match — no fuzzy / partial consent.
export function planNode0RoleModelBindingRegistry({ consent, input } = {}) {
  const blocked_by = [];
  if (consent !== NODE0_ROLE_MODEL_BINDING_REGISTRY_GO_PHRASE) {
    blocked_by.push("consent_phrase_mismatch");
  }
  blocked_by.push(...collectInputBlocks(input));
  return Object.freeze({
    schema: NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA,
    truth_label: NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL,
    eligible: blocked_by.length === 0,
    blocked_by: Object.freeze(blocked_by),
  });
}

// Canonical, content-addressed decision receipt. The body carries the full
// input and the decision derived from it; the content_hash binds the whole body.
export function buildNode0RoleModelBindingRegistryPayload(input) {
  const body = {
    schema: NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA,
    truth_label: NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL,
    canonicalization_algorithm: CANONICAL_JSON_V1_ALGORITHM,
    hash_algorithm: "sha256",
    text_encoding: "utf-8",
    input,
    decision: resolveRoleModelBinding(input),
    boundary: node0RoleModelBindingRegistryBoundary(),
  };
  const content_hash = sha256CanonicalJsonV1(body);
  return Object.freeze({ ...body, content_hash });
}

// Body-bound re-derivation verifier. Recomputes the hash over the body MINUS
// its hash field AND re-derives the decision from the embedded input. The
// proved properties are exactly two: deterministic decision re-derivation and
// receipt tamper detection — forging any decision field and recomputing
// content_hash still fails, because the forged decision no longer equals
// resolve(input). NOT proved: input authenticity. The input is caller-supplied;
// a different input yields a different receipt, and nothing here verifies that
// the input's evidence claims are true.
export function verifyNode0RoleModelBindingRegistry(payload) {
  const blocked_by = [];
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return Object.freeze({ ok: false, blocked_by: Object.freeze(["payload_not_object"]) });
  }
  if (payload.schema !== NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA) blocked_by.push("schema_invalid");
  if (payload.truth_label !== NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL) blocked_by.push("truth_label_invalid");
  if (payload.canonicalization_algorithm !== CANONICAL_JSON_V1_ALGORITHM) blocked_by.push("canonicalization_algorithm_invalid");
  if (payload.hash_algorithm !== "sha256") blocked_by.push("hash_algorithm_invalid");
  if (payload.text_encoding !== "utf-8") blocked_by.push("text_encoding_invalid");
  const expectedBoundary = node0RoleModelBindingRegistryBoundary();
  const pb = payload.boundary;
  const boundaryOk =
    pb && typeof pb === "object" && !Array.isArray(pb) &&
    Object.keys(pb).length === Object.keys(expectedBoundary).length &&
    Object.keys(expectedBoundary).every((k) => pb[k] === false);
  if (!boundaryOk) blocked_by.push("boundary_invalid");
  if (typeof payload.content_hash !== "string" || !/^sha256:[0-9a-f]{64}$/.test(payload.content_hash)) {
    blocked_by.push("content_hash_format_invalid");
  }
  const d = payload.decision;
  if (!d || typeof d !== "object" || !DECISION_STATUSES.includes(d.status)) blocked_by.push("decision_status_invalid");
  if (blocked_by.length === 0) {
    const { content_hash, ...body } = payload;
    let recomputed;
    let rederived;
    try {
      recomputed = sha256CanonicalJsonV1(body);
      rederived = sha256CanonicalJsonV1(resolveRoleModelBinding(payload.input));
    } catch {
      blocked_by.push("canonicalization_failed");
    }
    if (recomputed !== undefined && recomputed !== content_hash) blocked_by.push("content_hash_mismatch");
    if (rederived !== undefined) {
      let embedded;
      try {
        embedded = sha256CanonicalJsonV1(payload.decision);
      } catch {
        blocked_by.push("canonicalization_failed");
      }
      if (embedded !== undefined && embedded !== rederived) blocked_by.push("decision_not_rederivable");
    }
  }
  return Object.freeze({ ok: blocked_by.length === 0, blocked_by: Object.freeze(blocked_by) });
}

// Orchestrator the review gate consumes: plan -> build -> verify -> tamper-reject.
export function runNode0RoleModelBindingRegistry({ consent, input } = {}) {
  const boundary = node0RoleModelBindingRegistryBoundary();
  const plan = planNode0RoleModelBindingRegistry({ consent, input });
  const fail = (blocked_by) =>
    Object.freeze({
      ok: false,
      schema: NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA,
      truth_label: NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL,
      boundary,
      blocked_by: Object.freeze(blocked_by),
    });
  if (!plan.eligible) return fail(plan.blocked_by);
  let payload;
  try {
    payload = buildNode0RoleModelBindingRegistryPayload(input);
  } catch {
    return fail(["canonicalization_failed"]);
  }
  const fresh = verifyNode0RoleModelBindingRegistry(payload);
  if (!fresh.ok) return fail(fresh.blocked_by);
  const hashTampered = verifyNode0RoleModelBindingRegistry({ ...payload, content_hash: `sha256:${"0".repeat(64)}` });
  const fieldTampered = verifyNode0RoleModelBindingRegistry({ ...payload, truth_label: "FORGED" });
  if (hashTampered.ok || fieldTampered.ok) return fail(["tamper_not_rejected"]);
  return Object.freeze({
    ok: true,
    schema: NODE0_ROLE_MODEL_BINDING_REGISTRY_SCHEMA,
    truth_label: NODE0_ROLE_MODEL_BINDING_REGISTRY_TRUTH_LABEL,
    content_hash: payload.content_hash,
    decision_status: payload.decision.status,
    boundary,
    blocked_by: Object.freeze([]),
  });
}
