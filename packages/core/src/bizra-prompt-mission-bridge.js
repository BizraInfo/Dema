// BIZRA-PROMPT-MISSION-BRIDGE-1A — the smallest seam from founder language to
// the existing MissionContract owner. This is a proposal compiler, not a
// conductor: no model, network, effect, consent, or authority is produced.

import {
  BIZRA_PROMPT_COMPILER_SCHEMA,
  OPERATOR_TABLE,
  PHASE_ORDER,
  compilePrompt,
} from "./bizra-prompt-compiler.js";
import {
  MISSION_CONTRACT_GO_PHRASE,
  createMissionContract,
} from "./mission-contract-state.js";
import { allocateAttention } from "./constitutional-attention-allocator.js";
import { sha256CanonicalJsonV1 } from "../../canon/src/sha256-canonical-json-v1.js";
import {
  buildEstateCapability,
  classifyConsequentialLanguage,
  isBizraEstateIntent,
} from "./founder-estate-workflow.js";

export const BIZRA_PROMPT_MISSION_BRIDGE_SCHEMA =
  "bizra.dema.prompt_mission_bridge.v0.1";
export const BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL =
  "BIZRA_PROMPT_MISSION_BRIDGE_PROPOSAL_ONLY";
export const BIZRA_PROMPT_MISSION_BRIDGE_VERSION = "1A";

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const UNKNOWN = "UNKNOWN";

function isPlainObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function deepFreeze(value) {
  if (Array.isArray(value)) {
    value.forEach(deepFreeze);
    return Object.freeze(value);
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach(deepFreeze);
    return Object.freeze(value);
  }
  return value;
}

function validHash(value) {
  return typeof value === "string" && HASH_RE.test(value);
}

export function evaluateTaskRequirement(requirement, verificationNowIso) {
  const refuse = (verdict) => ({ verdict, blocked_by: [verdict] });
  if (!isPlainObject(requirement)) return refuse("PRODUCTION_REQUIREMENT_POLICY_UNBOUND");
  const owner = requirement.owner;
  const capability = requirement.capability;
  if (requirement.schema !== "bizra.dema.trusted_task_requirement.v1" ||
      typeof requirement.task_id !== "string" || !requirement.task_id.trim() ||
      !isPlainObject(owner) || typeof owner.identity !== "string" || !owner.identity.trim() ||
      !validHash(owner.hash) || owner.revision !== owner.hash ||
      typeof requirement.required_operation !== "string" || !requirement.required_operation.trim() ||
      !isPlainObject(capability) || capability.mission_id !== "BIZRA-GENESIS-LOCAL-MISSION-0" ||
      capability.version !== "bizra.genesis.mission_contract.v0.1" ||
      capability.operation !== "METADATA_INVENTORY_READ_ONLY" ||
      !validHash(capability.owner_hash) || !validHash(capability.registration_hash) ||
      requirement.execution_allowed !== false || requirement.authority_delta !== 0) {
    return refuse("TRUSTED_REQUIREMENT_INVALID");
  }
  const now = typeof verificationNowIso === "string" ? Date.parse(verificationNowIso) : NaN;
  if (!Number.isFinite(now)) return refuse("TRUSTED_VERIFICATION_TIME_REQUIRED");
  if (requirement.required_operation !== capability.operation) return refuse("BLOCKED_UNSUPPORTED_OPERATION");
  const policy = requirement.policy;
  if (!isPlainObject(policy)) return refuse("PRODUCTION_REQUIREMENT_POLICY_UNBOUND");
  if (policy.scope !== "ISOLATED_NONEXECUTING_TEST_ONLY" ||
      typeof policy.id !== "string" || !policy.id.trim() || !validHash(policy.hash) ||
      typeof policy.authority_ref !== "string" || !policy.authority_ref.trim() ||
      policy.task_id !== requirement.task_id || policy.required_operation !== requirement.required_operation ||
      typeof policy.revoked !== "boolean") return refuse("TRUSTED_REQUIREMENT_POLICY_INVALID");
  if (policy.revoked) return refuse("REQUIREMENT_APPROVAL_REVOKED");
  const from = typeof policy.valid_from === "string" ? Date.parse(policy.valid_from) : NaN;
  const until = typeof policy.expires_at === "string" ? Date.parse(policy.expires_at) : NaN;
  if (!Number.isFinite(from) || !Number.isFinite(until) || from >= until || now < from || now >= until) {
    return refuse("REQUIREMENT_APPROVAL_EXPIRED");
  }
  return { verdict: "OPERATION_MATCH_PREVIEW_ONLY", blocked_by: [] };
}

function safeStatus(value) {
  return typeof value === "string" && value.trim() ? value.trim() : UNKNOWN;
}

function safeFact(value) {
  const source = isPlainObject(value) ? value : {};
  const out = { status: safeStatus(source.status) };
  if (validHash(source.hash)) out.hash = source.hash;
  if (typeof source.source === "string" && source.source.trim()) out.source = source.source.trim();
  if (typeof source.confidence === "number" && Number.isFinite(source.confidence)) {
    out.confidence = Math.max(0, Math.min(1, source.confidence));
  }
  if (typeof source.user_confirmed === "boolean") out.user_confirmed = source.user_confirmed;
  if (typeof source.reason === "string" && source.reason.trim() && source.reason.length <= 256) {
    out.reason = source.reason.trim();
  }
  if (out.status === "BOUND" && !out.hash) {
    out.status = UNKNOWN;
    out.reason = "bound_status_requires_sha256_hash";
  }
  return out;
}

function safeNamedFact(value) {
  const out = safeFact(value);
  const source = isPlainObject(value) ? value : {};
  if (typeof source.value === "string" && source.value.trim() && source.value.length <= 120) {
    out.value = source.value.trim();
  }
  return out;
}

function normalizeContextCapsule(input) {
  const source = isPlainObject(input) ? input : {};
  const compassSource = isPlainObject(source.human_compass) ? source.human_compass : {};
  const identitySource = isPlainObject(source.human_identity) ? source.human_identity : {};
  return deepFreeze({
    schema: "bizra.dema.context_capsule.proposal.v0.1",
    root_dna: safeFact(source.root_dna),
    node_story: safeFact(source.node_story),
    current_state: safeFact(source.current_state),
    human_identity: {
      display_name: safeNamedFact(identitySource.display_name),
    },
    human_compass: {
      financial_freedom: safeStatus(compassSource.financial_freedom),
      mind_clarity: safeStatus(compassSource.mind_clarity),
      peace_of_heart: safeStatus(compassSource.peace_of_heart),
    },
  });
}

function buildMissionFields({ missionId, text, nowIso, actions }) {
  return {
    mission_id: missionId,
    purpose: "Translate one human intent into a proposal-only governed mission",
    scope: "HUMAN-0 local DEMA proposal; no external effect",
    acceptance_contract: {
      required_output_keys: ["plan", "verification"],
      forbidden_substrings: ["UNSUPPORTED_CLAIM"],
    },
    acceptance_criteria: [
      "DEMA displays what was understood and what remains unknown",
      "source intent, compiler, context, and contract hashes remain bound",
      "compilation creates no authority and starts no effect",
    ],
    prohibited_outcomes: [
      "unauthorized_effect",
      "secret_access",
      "external_egress",
      "financial_or_token_action",
      "consent_inference",
    ],
    authority_ceiling: "NONE_AT_COMPILATION",
    iteration_budget: 1,
    completion_conditions: [
      "proposal is verified or held for human review",
      "no consequential action proceeds without exact consent",
    ],
    escalation_rule: actions.length
      ? "hold_and_request_exact_consequential_consent"
      : "hold_for_human_review_before_any_effect",
    created_at_iso: nowIso,
  };
}

function compilerIdentity({ compilerCodeHash, ontologyHash }) {
  return {
    schema: BIZRA_PROMPT_COMPILER_SCHEMA,
    version: BIZRA_PROMPT_MISSION_BRIDGE_VERSION,
    phase_order_hash: sha256CanonicalJsonV1(PHASE_ORDER),
    ontology_hash: ontologyHash,
    code_hash: compilerCodeHash,
  };
}

function validateInputs({ text, now_iso: nowIso, compiler_code_hash: compilerCodeHash }) {
  if (typeof text !== "string" || !text.trim()) throw new TypeError("non-empty text required");
  if (typeof nowIso !== "string" || !nowIso.trim()) throw new TypeError("now_iso required");
  if (!validHash(compilerCodeHash)) throw new TypeError("compiler_code_hash must be sha256:<64 lowercase hex>");
}

/**
 * @param {{text?: unknown, context?: unknown, now_iso?: unknown, compiler_code_hash?: unknown, task_requirement?: unknown}} input
 */
export function compileMissionProposal({
  text,
  context = {},
  now_iso: nowIso,
  compiler_code_hash: compilerCodeHash,
  task_requirement,
} = {}) {
  validateInputs({ text, now_iso: nowIso, compiler_code_hash: compilerCodeHash });

  const sourceText = text.trim();
  const contextSnapshot = normalizeContextCapsule(context);
  const contextHash = sha256CanonicalJsonV1(contextSnapshot);
  const sourceIntentHash = sha256CanonicalJsonV1({ text: sourceText });
  const compiledPrompt = compilePrompt({ text: sourceText, hash: sha256CanonicalJsonV1 });
  const ontologyHash = sha256CanonicalJsonV1(OPERATOR_TABLE);
  const identity = compilerIdentity({ compilerCodeHash, ontologyHash });
  const identityHash = sha256CanonicalJsonV1(identity);
  const semantics = classifyConsequentialLanguage(sourceText);
  const actions = [...semantics.requested_actions, ...semantics.ambiguous_actions]
    .sort((a, b) => a.index - b.index || a.action.localeCompare(b.action));
  const estateCapability = isBizraEstateIntent(sourceText) ? buildEstateCapability() : null;
  const safeEstateObservation = Boolean(estateCapability && actions.length === 0);
  const requirementHash = task_requirement === undefined ? null : sha256CanonicalJsonV1(task_requirement);
  const missionIdentityHash = requirementHash === null ? sourceIntentHash :
    sha256CanonicalJsonV1({ source_intent_hash: sourceIntentHash, requirement_binding_hash: requirementHash });
  const missionId = `MISSION-${missionIdentityHash.slice("sha256:".length, "sha256:".length + 16)}`;
  const requirementDecision = requirementHash === null ? null : evaluateTaskRequirement(task_requirement, nowIso);

  const missionContract = createMissionContract({
    fields: buildMissionFields({
      missionId,
      text: sourceText,
      nowIso,
      actions,
    }),
    consent: MISSION_CONTRACT_GO_PHRASE,
  });

  const blockedBy = [
    ...(requirementDecision?.blocked_by ?? []),
    ...(actions.length > 0 ? ["exact_consequential_consent_required"] : []),
    ...(semantics.ambiguous_actions.length > 0 ? ["ambiguous_consequential_language"] : []),
  ];
  const attention = allocateAttention({
    mission: {
      mission_id: missionId,
      active_human_mission_id: missionId,
      source_intent_hash: sourceIntentHash,
    },
    current_state: {
      mission_contract: "BOUND",
      root_dna: contextSnapshot.root_dna.status,
      node_story: contextSnapshot.node_story.status,
      current_state: contextSnapshot.current_state.status,
    },
    candidates: [{
      candidate_id: missionId,
      mission_id: missionId,
      source: {
        origin: "HUMAN",
        human_requested: true,
        source_refs: [sourceIntentHash],
      },
      claim: { evidence_class: "SOURCE_BOUND" },
      impact: {
        mission_relevance: 5,
        risk_reduction: actions.length ? 3 : 2,
        evidence_strength: 3,
        leverage: 3,
        human_burden_removed: 4,
        urgency: 1,
        ambiguity: actions.length ? 2 : 1,
        blast_radius: actions.length ? 3 : 1,
        cost: 1,
      },
      human_decision_required: actions.length > 0,
      authority: {
        action_required: actions.length > 0,
        hard_gates: actions.length > 0 ? ["authority_missing"] : [],
      },
    }],
  });
  const body = {
    schema: BIZRA_PROMPT_MISSION_BRIDGE_SCHEMA,
    truth_label: BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL,
    source_text: sourceText,
    source_intent_hash: sourceIntentHash,
    ...(requirementHash === null ? {} : {
      task_requirement,
      requirement_binding_hash: requirementHash,
      requirement_verdict: requirementDecision.verdict,
    }),
    compiler: {
      ...identity,
      identity_hash: identityHash,
      compiled_prompt_hash: compiledPrompt.content_hash,
      compiled_prompt: compiledPrompt,
      boundary: compiledPrompt.boundary,
    },
    ...(estateCapability ? { capability: estateCapability } : {}),
    context_snapshot: contextSnapshot,
    context_hash: contextHash,
    mission_id: missionId,
    mission_contract: missionContract,
    attention,
    requested_actions: actions,
    decision: requirementDecision?.blocked_by.length ? "REFUSED" : actions.length > 0 ? "WAIT_FOR_HUMAN" : "PROPOSE_ONLY",
    what_i_understood: {
      objective: sourceText,
      recognized_operators: compiledPrompt.operators,
      ...(estateCapability ? {
        mission_kind: "BIZRA_ESTATE_READ_ONLY",
        capability: estateCapability.id,
      } : {}),
    },
    what_i_know: [
      "The existing Prompt Compiler produced a deterministic typed structure.",
      "The existing MissionContract owner accepted a proposal-only contract.",
      "No model, network, or effect was used by this bridge.",
      ...(estateCapability ? ["The bounded estate capability is metadata-only and read-only."] : []),
    ],
    what_i_am_inferencing: [
      "Compilation is structure, not proof that the mission will succeed.",
    ],
    what_i_still_need: [
      ...(safeEstateObservation
        ? ["Nothing consequential is requested; review the bounded scope before the read-only observation."]
        : ["Human review of the proposal before any consequential action."]),
      ...(contextSnapshot.node_story.status === UNKNOWN ? ["A consent-bound Node Story if personal context is needed."] : []),
      ...(contextSnapshot.current_state.status === UNKNOWN ? ["Current human state if the mission depends on it."] : []),
    ],
    proposed_next_step: actions.length
      ? "Show the request and wait for exact human consent; do not execute."
      : estateCapability
        ? "Show the exact estate roots and limits, then run the bounded read-only metadata observation."
        : "Show the proposal to the human and wait for bounded planning or consent.",
    authority: {
      requested_effects: actions.map(({ action, token }) => ({ action, token })),
      prohibited_effects: semantics.prohibited_actions.map(({ action, token, prohibition }) => ({ action, token, prohibition })),
      authority: "NONE",
      consent_required: actions.length > 0,
      authority_delta: 0,
    },
    boundary: {
      execution_allowed: false,
      model_invocation_performed: false,
      network_used: false,
      effect_started: false,
      receipt_minted: false,
      authority_delta: 0,
    },
    effects_started: 0,
    blocked_by: blockedBy,
    prohibited_actions: semantics.prohibited_actions,
    claim_ceiling: estateCapability ? "LOCAL_ESTATE_METADATA_PROPOSAL" : "LOCAL_PROPOSAL_ONLY",
  };
  return deepFreeze({ ...body, bridge_hash: sha256CanonicalJsonV1(body) });
}

/**
 * @param {unknown} proposal
 * @param {{expected_compiler_code_hash?: unknown, expected_context?: unknown, expected_task_requirement?: unknown, verification_now_iso?: unknown}} options
 */
export function verifyMissionProposal(proposal, {
  expected_compiler_code_hash: expectedCompilerCodeHash,
  expected_context,
  expected_task_requirement,
  verification_now_iso,
} = {}) {
  const blockedBy = [];
  if (!isPlainObject(proposal)) {
    return Object.freeze({ ok: false, blocked_by: ["proposal_not_object"], recomputed_bridge_hash: null });
  }
  const taskBound = Object.hasOwn(proposal, "task_requirement") ||
    Object.hasOwn(proposal, "requirement_binding_hash") || expected_task_requirement !== undefined;
  let requirementDecision = null;
  if (taskBound) {
    requirementDecision = evaluateTaskRequirement(expected_task_requirement, verification_now_iso);
    blockedBy.push(...requirementDecision.blocked_by);
    if (expected_task_requirement === undefined) blockedBy.push("independent_requirement_required");
    if (expected_context === undefined) blockedBy.push("independent_context_required");
    if (!Object.hasOwn(proposal, "task_requirement")) blockedBy.push("task_requirement_missing");
    try {
      const expectedHash = sha256CanonicalJsonV1(expected_task_requirement);
      if (proposal.requirement_binding_hash !== expectedHash ||
          sha256CanonicalJsonV1(proposal.task_requirement) !== expectedHash) {
        blockedBy.push("task_requirement_binding_mismatch");
      }
    } catch { blockedBy.push("task_requirement_unhashable"); }
  }
  if (typeof proposal.source_text !== "string" || !proposal.source_text.trim()) blockedBy.push("source_text_missing");
  if (!validHash(proposal.compiler?.code_hash)) blockedBy.push("compiler_code_hash_invalid");
  if (expectedCompilerCodeHash !== undefined && proposal.compiler?.code_hash !== expectedCompilerCodeHash) {
    blockedBy.push("compiler_code_hash_mismatch");
  }
  if (proposal.authority?.authority !== "NONE") blockedBy.push("authority_not_none");
  if (proposal.authority?.authority_delta !== 0) blockedBy.push("authority_delta_nonzero");
  if (proposal.boundary?.execution_allowed !== false) blockedBy.push("execution_boundary_open");
  if (proposal.boundary?.model_invocation_performed !== false) blockedBy.push("model_boundary_open");
  if (proposal.boundary?.network_used !== false) blockedBy.push("network_boundary_open");
  if (proposal.boundary?.effect_started !== false || proposal.effects_started !== 0) {
    blockedBy.push("effect_boundary_open");
  }

  if (validHash(proposal.bridge_hash)) {
    try {
      const { bridge_hash: ignored, ...body } = proposal;
      if (sha256CanonicalJsonV1(body) !== proposal.bridge_hash) {
        blockedBy.push("bridge_hash_mismatch");
      }
    } catch {
      blockedBy.push("proposal_unhashable");
    }
  } else {
    blockedBy.push("bridge_hash_invalid");
  }

  let rebuilt = null;
  if (blockedBy.length === 0) {
    try {
      rebuilt = compileMissionProposal({
        text: proposal.source_text,
        context: expected_context === undefined ? proposal.context_snapshot : expected_context,
        now_iso: proposal.mission_contract?.contract?.created_at_iso,
        compiler_code_hash: expectedCompilerCodeHash ?? proposal.compiler.code_hash,
        ...(taskBound ? { task_requirement: expected_task_requirement } : {}),
      });
    } catch (error) {
      blockedBy.push(`rederive_failed:${error instanceof Error ? error.message : String(error)}`);
    }
  }

  if (rebuilt) {
    if (proposal.bridge_hash !== rebuilt.bridge_hash) blockedBy.push("bridge_hash_mismatch");
    if (proposal.source_intent_hash !== rebuilt.source_intent_hash) blockedBy.push("source_intent_hash_mismatch");
    if (proposal.context_hash !== rebuilt.context_hash) blockedBy.push("context_hash_mismatch");
    if (proposal.mission_contract?.contract_hash !== rebuilt.mission_contract.contract_hash) {
      blockedBy.push("mission_contract_hash_mismatch");
    }
    if (proposal.compiler?.compiled_prompt_hash !== rebuilt.compiler.compiled_prompt_hash) {
      blockedBy.push("compiled_prompt_hash_mismatch");
    }
  }

  return Object.freeze({
    ok: blockedBy.length === 0,
    blocked_by: Object.freeze([...new Set(blockedBy)]),
    recomputed_bridge_hash: rebuilt?.bridge_hash ?? null,
    ...(taskBound ? {
      requirement_verdict: requirementDecision.blocked_by.length ? requirementDecision.verdict :
        blockedBy.length ? "TRUSTED_REQUIREMENT_BINDING_INVALID" : requirementDecision.verdict,
    } : {}),
  });
}
