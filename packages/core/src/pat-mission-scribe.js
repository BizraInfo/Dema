// C4 · PAT-1 · Mission Scribe (per ADR-008 §C4).
//
// First of the 7 Private Agents serving the operator's mission. Role:
// intent capture · proposal drafting · consent phrase authoring.
//
// PAT-1 is a CONFIG-AND-HELPERS layer on top of C3 (agent kernel) and
// C2 (EffectCap). It does NOT itself invoke LLMs or execute tools ·
// those are done by callers (future C6 orchestrator) using PAT-1's
// persona + kernel + cap descriptors.
//
// Per Key Maker discipline: every claim PAT-1 makes about its role is
// schema-tagged and frozen · the persona is canon-as-data.

import {
  buildAgentKernel,
  AGENT_KERNEL_MAX_ITERATIONS,
} from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.pat_mission_scribe.v0.1";
const PROPOSAL_SCHEMA = "bizra.dema.mission_proposal.v0.1";

const PAT1_PERSONA = Object.freeze({
  pat_number: 1,
  pat_id: "pat-1-mission-scribe",
  role_name: "mission_scribe",
  role_description:
    "Captures operator intent · drafts structured mission proposals · authors " +
    "consent phrases that match BIZRA's exact-string discipline. Never executes. " +
    "Never mints receipts. Never advances chain.",
  primary_capabilities: Object.freeze([
    "intent_capture",
    "proposal_drafting",
    "consent_phrase_authoring",
    "mission_scope_naming",
  ]),
  primary_refusals: Object.freeze([
    "execute_runtime",
    "mint_receipts",
    "advance_chain",
    "connect_external_nodes",
    "approve_consent_on_behalf_of_operator",
    "infer_consent_from_implicit_signals",
  ]),
});

const PAT1_EFFECT_CAP_ALLOWED = Object.freeze(["render_terminal_output"]);

const PAT1_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "approve_consent_on_behalf_of_operator",
  "fuzzy_match_consent_phrase",
  "auto_approve_proposal",
]);

const PAT1_CONSENT_PHRASE_TEMPLATE =
  "GO: invoke PAT-1 mission_scribe to draft proposal";

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

// PAT-1's EffectCap descriptor.
export function buildPATMissionScribeEffectCap() {
  return buildEffectCap({
    name: "pat_mission_scribe",
    description: PAT1_PERSONA.role_description,
    allowed_effects: PAT1_EFFECT_CAP_ALLOWED,
    blocked_effects: PAT1_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: PAT1_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true,
  });
}

// PAT-1's persona descriptor · the "who am I" surface for inspection.
export function buildPATMissionScribePreview({ operator_name = "Mumu" } = {}) {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: PAT1_PERSONA,
    serves_operator: safeString(operator_name, "Mumu"),
    effect_cap: buildPATMissionScribeEffectCap(),
    consent_phrase_template: PAT1_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${PAT1_PERSONA.pat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    refusal_invariants: Object.freeze([
      "PAT-1 never executes runtime · only drafts",
      "PAT-1 never mints receipts · only suggests proposal shapes",
      "PAT-1 never advances chain · only emits proposal-shape objects",
      "PAT-1 never approves consent · only authors consent phrases for operator review",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

// PAT-1's kernel · pre-configured for the mission_scribe role.
export function buildPATMissionScribeKernel({
  mission_intent = "",
  max_iterations = AGENT_KERNEL_MAX_ITERATIONS,
} = {}) {
  return buildAgentKernel({
    agent_id: PAT1_PERSONA.pat_id,
    agent_role: "pat_mission_scribe",
    mission_intent: safeString(mission_intent, ""),
    max_iterations,
  });
}

// PAT-1's specific role helper: given operator intent, draft a structured
// mission proposal. This is the DRAFT only · not an invocation. Pure
// function · deterministic · no I/O.
//
// The proposal includes:
//   - intent (verbatim · operator's words preserved)
//   - normalized_scope (stripped to key nouns/verbs for proposal title)
//   - suggested_allowed_effects (proposal · operator may amend)
//   - suggested_blocked_effects (operator must NOT REMOVE)
//   - consent_phrase_template (what operator types to authorize)
//   - boundary (canonical 16-key all-false · this is a draft, not execution)
export function draftMissionProposal({
  operator_intent = "",
  suggested_allowed_effects = ["render_terminal_output"],
  always_blocked_effects = [
    "execute_runtime",
    "mint_receipts",
    "advance_chain",
    "federation_invocation",
    "connect_external_nodes",
  ],
} = {}) {
  const intent = safeString(operator_intent, "").trim();
  const allowed = Array.isArray(suggested_allowed_effects)
    ? suggested_allowed_effects.filter(
        (e) => typeof e === "string" && e.length > 0,
      )
    : [];
  const blocked = Array.isArray(always_blocked_effects)
    ? always_blocked_effects.filter(
        (e) => typeof e === "string" && e.length > 0,
      )
    : [];

  const normalizedScope =
    intent.length > 0
      ? intent.split(/\s+/).filter(Boolean).slice(0, 8).join(" ")
      : "<empty-intent>";

  // Compute proposal-specific consent phrase
  const proposalConsentPhrase =
    intent.length > 0
      ? `GO: act on proposal '${normalizedScope}'`
      : "GO: act on proposal '<empty>'";

  // Validation
  const valid = intent.length > 0 && allowed.length > 0 && blocked.length > 0;
  const refusal_reason = !valid
    ? intent.length === 0
      ? "empty_intent · cannot draft proposal"
      : allowed.length === 0
        ? "no_allowed_effects · proposal would have nothing to do"
        : "no_blocked_effects · proposal must declare what it will NOT do"
    : null;

  return Object.freeze({
    schema: PROPOSAL_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_by: PAT1_PERSONA.pat_id,
    drafted_at: new Date().toISOString(),
    operator_intent_verbatim: intent,
    intent_length_chars: intent.length,
    normalized_scope: normalizedScope,
    suggested_allowed_effects: Object.freeze([...new Set(allowed)]),
    always_blocked_effects: Object.freeze([...new Set(blocked)]),
    proposal_consent_phrase: proposalConsentPhrase,
    requires_typed_go: true,
    valid,
    refusal_reason,
    audit_trail_required: true,
    receipt_shape_ready: valid,
    boundary: buildPreviewBoundary(),
  });
}

// Summary view of PAT-1.
export function buildPATMissionScribeSummary(options = {}) {
  const preview = buildPATMissionScribePreview(options);
  return Object.freeze({
    schema: "bizra.dema.pat_mission_scribe_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    pat_number: preview.persona.pat_number,
    pat_id: preview.persona.pat_id,
    role_name: preview.persona.role_name,
    serves_operator: preview.serves_operator,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    consent_phrase_template: preview.consent_phrase_template,
    memory_file_path: preview.memory_file_path,
    boundary: preview.boundary,
  });
}

export const PAT_MISSION_SCRIBE_SCHEMA_NAME = SCHEMA;
export const PAT_MISSION_SCRIBE_PROPOSAL_SCHEMA_NAME = PROPOSAL_SCHEMA;
export const PAT_MISSION_SCRIBE_CONSENT_PHRASE_TEMPLATE =
  PAT1_CONSENT_PHRASE_TEMPLATE;
export const PAT_MISSION_SCRIBE_PERSONA = PAT1_PERSONA;
