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

export const BIZRA_PROMPT_MISSION_BRIDGE_SCHEMA =
  "bizra.dema.prompt_mission_bridge.v0.1";
export const BIZRA_PROMPT_MISSION_BRIDGE_TRUTH_LABEL =
  "BIZRA_PROMPT_MISSION_BRIDGE_PROPOSAL_ONLY";
export const BIZRA_PROMPT_MISSION_BRIDGE_VERSION = "1A";

const HASH_RE = /^sha256:[0-9a-f]{64}$/;
const UNKNOWN = "UNKNOWN";

// The bridge is intentionally conservative. A token that may cause a
// consequential effect becomes a human decision, never an inferred permit.
const CONSEQUENTIAL_ACTIONS = Object.freeze([
  ["transfer", /\b(?:transfer|send|pay|withdraw)\b/gi],
  ["purchase", /\b(?:purchase|buy|sell)\b/gi],
  ["delete", /\b(?:delete|remove|destroy)\b/gi],
  ["publish", /\b(?:publish|post|deploy)\b/gi],
  ["repository_write", /\b(?:push|merge)\b/gi],
  ["key_operation", /\b(?:sign|rotate\s+(?:the\s+)?key|mint)\b/gi],
  ["execute", /\b(?:execute|run)\b/gi],
]);
const UNKNOWN_CONSEQUENTIAL =
  /\b(?:irreversible|external\s+side\s+effect|real[- ]world\s+action)\b/gi;

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

function findConsequentialActions(text) {
  const matches = [];
  for (const [action, expression] of CONSEQUENTIAL_ACTIONS) {
    expression.lastIndex = 0;
    for (const match of text.matchAll(expression)) {
      matches.push({
        action,
        token: match[0],
        index: match.index ?? 0,
        consent_required: true,
      });
    }
  }
  UNKNOWN_CONSEQUENTIAL.lastIndex = 0;
  for (const match of text.matchAll(UNKNOWN_CONSEQUENTIAL)) {
    matches.push({
      action: "unknown_consequential_action",
      token: match[0],
      index: match.index ?? 0,
      consent_required: true,
    });
  }
  return matches.sort((a, b) => a.index - b.index || a.action.localeCompare(b.action));
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
 * @param {{text?: unknown, context?: unknown, now_iso?: unknown, compiler_code_hash?: unknown}} input
 */
export function compileMissionProposal({
  text,
  context = {},
  now_iso: nowIso,
  compiler_code_hash: compilerCodeHash,
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
  const actions = findConsequentialActions(sourceText);
  const missionId = `MISSION-${sourceIntentHash.slice("sha256:".length, "sha256:".length + 16)}`;

  const missionContract = createMissionContract({
    fields: buildMissionFields({
      missionId,
      text: sourceText,
      nowIso,
      actions,
    }),
    consent: MISSION_CONTRACT_GO_PHRASE,
  });

  const blockedBy = actions.length > 0 ? ["exact_consequential_consent_required"] : [];
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
    compiler: {
      ...identity,
      identity_hash: identityHash,
      compiled_prompt_hash: compiledPrompt.content_hash,
      compiled_prompt: compiledPrompt,
      boundary: compiledPrompt.boundary,
    },
    context_snapshot: contextSnapshot,
    context_hash: contextHash,
    mission_id: missionId,
    mission_contract: missionContract,
    attention,
    requested_actions: actions,
    decision: actions.length > 0 ? "WAIT_FOR_HUMAN" : "PROPOSE_ONLY",
    what_i_understood: {
      objective: sourceText,
      recognized_operators: compiledPrompt.operators,
    },
    what_i_know: [
      "The existing Prompt Compiler produced a deterministic typed structure.",
      "The existing MissionContract owner accepted a proposal-only contract.",
      "No model, network, or effect was used by this bridge.",
    ],
    what_i_am_inferencing: [
      "Compilation is structure, not proof that the mission will succeed.",
    ],
    what_i_still_need: [
      "Human review of the proposal before any consequential action.",
      ...(contextSnapshot.node_story.status === UNKNOWN ? ["A consent-bound Node Story if personal context is needed."] : []),
      ...(contextSnapshot.current_state.status === UNKNOWN ? ["Current human state if the mission depends on it."] : []),
    ],
    proposed_next_step: actions.length
      ? "Show the request and wait for exact human consent; do not execute."
      : "Show the proposal to the human and wait for bounded planning or consent.",
    authority: {
      requested_effects: actions.map(({ action, token }) => ({ action, token })),
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
    claim_ceiling: "LOCAL_PROPOSAL_ONLY",
  };
  return deepFreeze({ ...body, bridge_hash: sha256CanonicalJsonV1(body) });
}

/**
 * @param {unknown} proposal
 * @param {{expected_compiler_code_hash?: unknown, expected_context?: unknown}} options
 */
export function verifyMissionProposal(proposal, {
  expected_compiler_code_hash: expectedCompilerCodeHash,
  expected_context,
} = {}) {
  const blockedBy = [];
  if (!isPlainObject(proposal)) {
    return Object.freeze({ ok: false, blocked_by: ["proposal_not_object"], recomputed_bridge_hash: null });
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
  });
}
