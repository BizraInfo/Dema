// CAA-NODE0-v1 — pure attention allocation for the Genesis proposal path.
// It ranks the next question; it never authorizes, verifies, or executes it.

import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";

export const CAA_SCHEMA = "bizra.dema.constitutional_attention_allocator.v0.1";
export const CAA_POLICY_VERSION = "CAA-NODE0-v1";
export const CAA_RECEIPT_SCHEMA = "bizra.dema.constitutional_attention_allocation_receipt.v0.1";
export const CAA_REDUCER_VERSION = "CAA-REDUCER-NODE0-v1";
export const ATTENTION_DECISIONS = Object.freeze([
  "FOCUS",
  "INVESTIGATE",
  "WAIT_FOR_HUMAN",
  "DEFER",
  "SUPPRESS",
]);

const POSITIVE = Object.freeze([
  "human_intent_alignment",
  "mission_relevance",
  "risk_reduction",
  "recovery_criticality",
  "evidence_strength",
  "leverage",
  "human_burden_removed",
  "urgency",
]);
const NEGATIVE = Object.freeze([
  "speculation",
  "ambiguity",
  "cost",
  "implementation_drag",
  "blast_radius",
  "context_switching",
]);
const DEFAULT_WEIGHTS = Object.freeze({
  human_intent_alignment: 2.0,
  mission_relevance: 2.0,
  risk_reduction: 2.0,
  recovery_criticality: 2.5,
  evidence_strength: 1.0,
  leverage: 1.5,
  human_burden_removed: 1.5,
  urgency: 1.0,
  speculation: 1.5,
  ambiguity: 2.0,
  cost: 1.0,
  implementation_drag: 1.0,
  blast_radius: 2.0,
  context_switching: 1.5,
});

const RECOVERY_GATES = Object.freeze([
  "unresolved_effect_status",
  "receipt_integrity_failure",
  "authority_provenance_failure",
  "canonical_state_corruption",
]);
const HUMAN_GATES = Object.freeze([
  "consequential_scope_ambiguity",
  "conflicting_human_intents",
  "irreversible_action_proposed",
  "unresolved_privacy_boundary",
]);
const EXECUTION_BLOCKERS = Object.freeze([
  "authority_missing",
  "lease_expired",
  "context_changed",
  "verification_plan_missing",
  "recovery_contract_missing",
  "authority_delta_not_zero_without_explicit_grant",
]);

function object(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function list(value) {
  return Array.isArray(value) ? value : [];
}

function clamp(value) {
  return Number.isFinite(value) ? Math.max(0, Math.min(5, value)) : 0;
}

function text(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function metric(candidate, key) {
  const impact = object(candidate.impact);
  const urgency = object(candidate.urgency);
  const cost = object(candidate.cost);
  const source = object(candidate.source);
  const direct = candidate[key];
  if (Number.isFinite(direct)) return clamp(direct);
  if (Number.isFinite(impact[key])) return clamp(impact[key]);
  if (Number.isFinite(urgency[key])) return clamp(urgency[key]);
  if (key === "human_intent_alignment") {
    return source.human_requested === true || source.origin === "HUMAN" ? 5 : 0;
  }
  if (key === "recovery_criticality") return urgency.recovery_blocking === true ? 5 : 0;
  if (key === "cost") return clamp(cost.score);
  return 0;
}

function metrics(candidate) {
  return Object.freeze(Object.fromEntries([...POSITIVE, ...NEGATIVE].map((key) => [key, metric(candidate, key)])));
}

function sourceRefs(candidate) {
  const source = object(candidate.source);
  return list(source.source_refs).length ? source.source_refs : list(candidate.source_refs);
}

function gateSet(candidate) {
  const urgency = object(candidate.urgency);
  const authority = object(candidate.authority);
  return new Set([
    ...list(candidate.hard_gates),
    ...list(candidate.gates),
    ...list(candidate.blocked_by),
    ...list(urgency.hard_gates),
    ...list(authority.hard_gates),
    ...(urgency.recovery_blocking === true ? ["unresolved_effect_status"] : []),
    ...(candidate.human_decision_required === true ? ["consequential_scope_ambiguity"] : []),
  ]);
}

function validLineage(candidate) {
  return candidate.lineage_valid === true || sourceRefs(candidate).length > 0;
}

function scoreOf(candidate, weights) {
  const values = metrics(candidate);
  const positive = POSITIVE.reduce((sum, key) => sum + values[key] * weights[key], 0);
  const negative = NEGATIVE.reduce((sum, key) => sum + values[key] * weights[key], 0);
  return Number((positive - negative).toFixed(4));
}

function effectiveWeights(policy) {
  const supplied = object(policy.weights);
  return Object.freeze(Object.fromEntries(
    [...POSITIVE, ...NEGATIVE].map((key) => [
      key,
      Number.isFinite(supplied[key]) && supplied[key] >= 0 ? supplied[key] : DEFAULT_WEIGHTS[key],
    ]),
  ));
}

function conditions(candidate) {
  const gates = gateSet(candidate);
  return {
    recovery: RECOVERY_GATES.filter((gate) => gates.has(gate)),
    human: HUMAN_GATES.filter((gate) => gates.has(gate)),
    execution: EXECUTION_BLOCKERS.filter((gate) => gates.has(gate)),
  };
}

function freeze(value) {
  if (Array.isArray(value)) return Object.freeze(value.map(freeze));
  if (value && typeof value === "object") {
    for (const child of Object.values(value)) freeze(child);
    return Object.freeze(value);
  }
  return value;
}

function compare(a, b) {
  return b.score - a.score || a.candidate_id.localeCompare(b.candidate_id);
}

function candidateId(candidate, index) {
  return text(candidate.candidate_id) ?? text(candidate.id) ?? `#${index}`;
}

/**
 * Produce one deterministic, proposal-only attention allocation.
 * No clock, random value, model, network, filesystem, authority, or effect.
 */
export function allocateAttention({ mission = {}, current_state: currentState = {}, candidates = [], policy = {} } = {}) {
  const weights = effectiveWeights(policy);
  const items = Array.isArray(candidates) ? candidates : [];
  const seen = new Set();
  const rows = items.map((candidate, index) => {
    const source = object(candidate);
    const id = candidateId(source, index);
    const duplicate = seen.has(id);
    seen.add(id);
    const superseded = source.superseded === true || object(source.lifecycle).state === "SUPERSEDED";
    const lineage = validLineage(source);
    const gates = conditions(source);
    const denied = duplicate || superseded || !lineage;
    const scoreComponents = metrics(source);
    const score = scoreOf(source, weights);
    const evidenceClass = text(object(source.claim).evidence_class) ?? "UNKNOWN";
    const localDecision = denied
      ? "SUPPRESS"
      : gates.recovery.length
        ? "FOCUS"
        : gates.human.length
          ? "WAIT_FOR_HUMAN"
          : scoreComponents.evidence_strength < 2
            ? "INVESTIGATE"
            : "FOCUS";
    return {
      candidate_id: id,
      mission_id: text(source.mission_id) ?? text(mission.mission_id),
      score,
      score_components: scoreComponents,
      decision: localDecision,
      hard_gates: Object.freeze({
        deny_attention: duplicate ? ["candidate_is_duplicate"] : superseded ? ["candidate_is_superseded"] : !lineage ? ["candidate_has_invalid_lineage"] : [],
        recovery: gates.recovery,
        force_human_attention: gates.human,
        block_execution: gates.execution,
      }),
      evidence_class: evidenceClass,
      execution_blocked: gates.execution.length > 0 || object(source.authority).action_required === true,
      human_requested: object(source.source).human_requested === true || object(source.source).origin === "HUMAN",
      selected: false,
      reason: denied
        ? duplicate
          ? "duplicate_candidate"
          : superseded
            ? "superseded_candidate"
            : "invalid_lineage"
        : gates.recovery.length
          ? `recovery_required:${gates.recovery.join(",")}`
          : gates.human.length
            ? `human_decision_required:${gates.human.join(",")}`
            : localDecision === "INVESTIGATE"
              ? "evidence_insufficient_for_default_focus"
              : "eligible_attention_candidate",
      revisit_condition: text(source.revisit_condition) ?? "frontier_changed_or_new_evidence",
    };
  });

  const eligible = rows.filter((row) => row.decision !== "SUPPRESS").sort(compare);
  const activeMissionId = text(object(mission).active_human_mission_id) ?? text(object(mission).mission_id);
  const recovery = eligible.filter((row) => row.hard_gates.recovery.length > 0);
  const activeHuman = eligible.filter((row) => row.human_requested && row.mission_id === activeMissionId);
  const pool = recovery.length ? recovery : activeHuman.length ? activeHuman : eligible;
  const frontier = [...pool].sort(compare)[0] ?? null;

  const ranked = rows
    .map((row) => {
      if (row.candidate_id === frontier?.candidate_id && row.decision !== "SUPPRESS") {
        return { ...row, selected: true };
      }
      if (row.decision === "SUPPRESS") return row;
      return {
        ...row,
        decision: "DEFER",
        reason: "dominant_frontier_selected",
      };
    })
    .sort((a, b) => b.score - a.score || a.candidate_id.localeCompare(b.candidate_id));

  const inputState = {
    mission: object(mission),
    current_state: object(currentState),
    candidates: items,
    policy_version: CAA_POLICY_VERSION,
    weights,
  };
  const inputStateHash = sha256CanonicalJsonV1(inputState);
  const proposal = {
    schema: CAA_SCHEMA,
    truth_label: "CONSTITUTIONAL_ATTENTION_ALLOCATION_PROPOSAL_ONLY",
    policy_version: CAA_POLICY_VERSION,
    weights,
    input_state_hash: inputStateHash,
    allocation_id: `ALLOC-${inputStateHash.slice("sha256:".length, "sha256:".length + 16)}`,
    frontier: frontier?.candidate_id ?? null,
    frontier_decision: frontier ? frontier.decision : "DEFER",
    ranked_candidates: ranked,
    deferred: ranked
      .filter((row) => row.decision === "DEFER")
      .map((row) => ({
        candidate_id: row.candidate_id,
        reason: row.reason,
        revisit_condition: row.revisit_condition,
      })),
    authority: {
      authority: "NONE",
      authority_delta: 0,
      execution_allowed: false,
    },
    effects_started: 0,
    claim_ceiling: "ATTENTION_PROPOSAL_ONLY",
  };
  return freeze({ ...proposal, allocation_proposal_hash: sha256CanonicalJsonV1(proposal) });
}

/**
 * Reduce one verified allocation proposal into a durable, non-authorizing
 * receipt. The reducer is pure; filesystem persistence belongs to the adapter.
 */
export function reduceAttentionAllocation(proposal) {
  const blockedBy = [];
  if (!proposal || typeof proposal !== "object" || Array.isArray(proposal)) {
    return freeze({ ok: false, blocked_by: ["allocation_proposal_not_object"] });
  }
  if (proposal.schema !== CAA_SCHEMA) blockedBy.push("allocation_schema_invalid");
  if (typeof proposal.allocation_proposal_hash !== "string") {
    blockedBy.push("allocation_proposal_hash_missing");
  } else {
    const { allocation_proposal_hash: ignored, ...body } = proposal;
    if (sha256CanonicalJsonV1(body) !== proposal.allocation_proposal_hash) {
      blockedBy.push("allocation_proposal_hash_mismatch");
    }
  }
  if (proposal.authority?.authority !== "NONE") blockedBy.push("allocation_authority_not_none");
  if (proposal.authority?.authority_delta !== 0) blockedBy.push("allocation_authority_delta_nonzero");
  if (proposal.authority?.execution_allowed !== false) blockedBy.push("allocation_execution_boundary_open");
  if (proposal.effects_started !== 0) blockedBy.push("allocation_effect_boundary_open");
  if (blockedBy.length) return freeze({ ok: false, blocked_by: [...new Set(blockedBy)] });

  const receiptBody = {
    schema: CAA_RECEIPT_SCHEMA,
    truth_label: "CONSTITUTIONAL_ATTENTION_ALLOCATION_RECORDED",
    reducer_version: CAA_REDUCER_VERSION,
    allocation_id: proposal.allocation_id,
    allocation_proposal_hash: proposal.allocation_proposal_hash,
    input_state_hash: proposal.input_state_hash,
    policy_version: proposal.policy_version,
    frontier: proposal.frontier,
    frontier_decision: proposal.frontier_decision,
    ranked_candidates: proposal.ranked_candidates,
    deferred: proposal.deferred,
    authority: proposal.authority,
    effects_started: 0,
    applied: false,
    claim_ceiling: "ATTENTION_ALLOCATION_RECEIPT_ONLY",
  };
  const receipt = freeze({
    ...receiptBody,
    allocation_receipt_hash: sha256CanonicalJsonV1(receiptBody),
  });
  return freeze({ ok: true, blocked_by: [], receipt });
}

export function verifyAttentionAllocationReceipt(receipt) {
  if (!receipt || typeof receipt !== "object" || Array.isArray(receipt)) {
    return freeze({ ok: false, blocked_by: ["allocation_receipt_not_object"] });
  }
  const { allocation_receipt_hash: ignored, ...body } = receipt;
  const blockedBy = [];
  if (receipt.schema !== CAA_RECEIPT_SCHEMA) blockedBy.push("allocation_receipt_schema_invalid");
  if (receipt.applied !== false) blockedBy.push("allocation_receipt_applied");
  if (receipt.authority?.authority !== "NONE") blockedBy.push("allocation_receipt_authority_not_none");
  if (receipt.authority?.authority_delta !== 0) blockedBy.push("allocation_receipt_authority_delta_nonzero");
  if (receipt.effects_started !== 0) blockedBy.push("allocation_receipt_effect_boundary_open");
  if (typeof receipt.allocation_receipt_hash !== "string") blockedBy.push("allocation_receipt_hash_missing");
  else if (sha256CanonicalJsonV1(body) !== receipt.allocation_receipt_hash) blockedBy.push("allocation_receipt_hash_mismatch");
  return freeze({ ok: blockedBy.length === 0, blocked_by: [...new Set(blockedBy)] });
}
