// Onboarding Lifecycle Preview — v0.1
//
// The 7-stage progression a new node candidate (Node1, Node2, ...) walks
// through after their in-person acceptance at the host's Node0. Inverts the
// classic SaaS onboarding shape: identity LAST, language FIRST. Comprehension
// before consent. Language before capability. Human dignity before
// configuration.
//
// Per `docs/canon/BIZRA_TOPOLOGY_CANON.md` §"Node ordinal law" + §"Seed-pattern
// invariant", every node carries the full system DNA. This lifecycle is the
// shared DNA every Node-N runs at first boot, regardless of ordinal — only
// the operator name + paired-receipt anchors differ.
//
// Pure builder. No I/O. No clock reads inside the builder. Deep-frozen.
// Deterministic given identical inputs.

import { buildPreviewBoundary } from "./preview-boundary.js";
import { buildNodeOnboardingExtension } from "./node-onboarding-extension.js";

const SCHEMA = "bizra.dema.onboarding_lifecycle.v0.1";
const TRUTH_LABEL = "NODE0_LOCAL_SEED";
const MODE = "preview_only";

// ─── Canonical stage definition ─────────────────────────────────────────────

// Seven stages. The order is canon: language MUST be stage 0, first-mission
// MUST be stage 7. Any rearrangement is a doctrine violation.
const CANONICAL_STAGES = Object.freeze([
  {
    id: "language",
    order: 0,
    title: "What language should I speak with you?",
    prompt_intent: "comprehension_before_consent",
    required_before: ["technical_level", "node_role", "purpose", "resources", "consent_constitution", "first_mission"],
    options_kind: "language_picker",
    options_default: Object.freeze([
      { code: "ar", label: "العربية" },
      { code: "en", label: "English" },
      { code: "fr", label: "Français" },
      { code: "es", label: "Español" },
      { code: "ur", label: "اردو" },
      { code: "hi", label: "हिन्दी" },
      { code: "other", label: "Other / type your language" }
    ]),
    refusal_paths: ["candidate_does_not_pick_a_language_block_all_downstream_stages"],
    boundary_note: "no action may proceed until language is set · consent is invalid if not understood"
  },
  {
    id: "technical_level",
    order: 1,
    title: "How should I explain things to you?",
    prompt_intent: "calibrate_explanation_density",
    required_before: ["consent_constitution"],
    options_kind: "technical_level_picker",
    options_default: Object.freeze([
      { level: 1, label: "Simple", note: "no technical terms" },
      { level: 2, label: "Balanced", note: "explain important terms" },
      { level: 3, label: "Technical", note: "show commands, schemas, and proof" },
      { level: 4, label: "Expert", note: "show full diagnostic surfaces" }
    ]),
    refusal_paths: ["candidate_picks_level_higher_than_their_actual_comfort_break_explanation_density"],
    boundary_note: "level adapts surface; does not adapt the discipline"
  },
  {
    id: "node_role",
    order: 2,
    title: "You are being prepared as Node{ordinal}. Do you understand what that means?",
    prompt_intent: "make_ordinal_law_real",
    required_before: ["consent_constitution"],
    options_kind: "comprehension_check",
    options_default: Object.freeze([
      { id: "yes_proceed", label: "Yes, I understand · proceed" },
      { id: "explain_more", label: "Explain more before I answer" },
      { id: "step_back", label: "I want to step back · not now" }
    ]),
    refusal_paths: [
      "candidate_does_not_understand_ordinal_meaning_halt_until_explained",
      "candidate_steps_back_record_decision_no_pressure_no_followup"
    ],
    boundary_note: "Node1 does not mean control over Node0 · Node0 does not mean ownership of Node1's data"
  },
  {
    id: "purpose",
    order: 3,
    title: "What do you want your node to help you with?",
    prompt_intent: "anchor_node_to_real_human_mission",
    required_before: ["resources", "first_mission"],
    options_kind: "purpose_picker",
    options_default: Object.freeze([
      { id: "personal_productivity", label: "Personal productivity" },
      { id: "research_and_learning", label: "Research and learning" },
      { id: "coding_and_building", label: "Coding and building" },
      { id: "business_operations", label: "Business / operations" },
      { id: "knowledge_memory", label: "Knowledge memory" },
      { id: "creative_work", label: "Creative work" },
      { id: "other", label: "Other (free text)" }
    ]),
    refusal_paths: ["candidate_unsure_record_unknown_revisit_later"],
    boundary_note: "purpose declared here shapes future mission proposals · purpose can be revised any time"
  },
  {
    id: "resources",
    order: 4,
    title: "What may your node see (resource boundaries)?",
    prompt_intent: "explicit_resource_consent_at_first_run",
    required_before: ["first_mission"],
    options_kind: "resource_multi_select",
    options_default: Object.freeze([
      { id: "local_models", label: "Local models (inventory only · no invocation)", default_selected: false },
      { id: "selected_folders", label: "Selected folders (declared explicitly)", default_selected: false },
      { id: "notes_documents", label: "Notes / documents (declared explicitly)", default_selected: false },
      { id: "chat_exports", label: "Chat exports (declared explicitly)", default_selected: false },
      { id: "calendar_tasks", label: "Calendar / tasks (declared explicitly)", default_selected: false },
      { id: "nothing_yet", label: "Nothing yet · show me first", default_selected: true }
    ]),
    safest_default: "nothing_yet",
    refusal_paths: ["candidate_picks_everything_without_understanding_each_class_halt_for_clarification"],
    boundary_note: "default is nothing_yet · operator must explicitly opt-in each class"
  },
  {
    id: "consent_constitution",
    order: 5,
    title: "How I will ask before I act",
    prompt_intent: "make_adr_005_real_at_first_run",
    required_before: ["first_mission"],
    options_kind: "constitution_acknowledgment",
    options_default: Object.freeze([
      { id: "i_understand", label: "I understand · proceed" }
    ]),
    constitution_text: Object.freeze([
      "Before I act I classify the action: read, write, model call, web call, file access, spend, node handoff, or receipt.",
      "If action is meaningful, I ask exact consent.",
      "If action is risky, I refuse or require higher proof.",
      "Exact consent means typing a specific phrase character-by-character.",
      "Fuzzy match, case-insensitive, prefix match, and clipboard paste are all forbidden.",
      "You can disengage at any time without explanation."
    ]),
    refusal_paths: ["candidate_does_not_acknowledge_constitution_halt_no_action_allowed"],
    boundary_note: "ADR-005 binding · constitution holds for every future L1+ action"
  },
  {
    id: "first_mission",
    order: 6,
    title: "Let us create your first mission together",
    prompt_intent: "honor_node_with_first_useful_act",
    required_before: [],
    options_kind: "mission_intent_capture",
    options_default: Object.freeze([
      { id: "free_text", label: "Type your first intent in your preferred language" }
    ]),
    example_intents_by_purpose: Object.freeze({
      personal_productivity: "Help me organize my goals for this week",
      research_and_learning: "Help me understand <topic> at level <my level>",
      coding_and_building: "Scan my project folder and produce a safe next-step plan",
      business_operations: "Draft a checklist for <recurring task>",
      knowledge_memory: "Help me find what I wrote about <topic>",
      creative_work: "Help me brainstorm <project>",
      other: "Tell me what you want — I'll adapt"
    }),
    refusal_paths: ["candidate_skips_first_mission_record_node_state_inactive_intent_pending"],
    boundary_note: "first mission is preview-only · proposal not execution · standard consent gating applies"
  }
]);

// ─── Refuse-as-product taxonomy ─────────────────────────────────────────────

const PRIMARY_REFUSALS = Object.freeze([
  "refuse_to_advance_to_stage_N_without_completing_stage_N_minus_1",
  "refuse_to_advance_past_language_stage_without_language_set",
  "refuse_to_collect_consent_before_consent_constitution_acknowledged",
  "refuse_to_propose_mission_before_purpose_declared",
  "refuse_to_default_to_select_all_on_resource_consent_safest_default_is_nothing_yet",
  "refuse_to_skip_node_role_comprehension_check",
  "refuse_to_advance_past_acknowledged_decline_or_step_back",
  "refuse_to_record_stage_completion_without_explicit_candidate_response"
]);

const BLOCKED_EFFECTS = Object.freeze([
  "advance_to_next_stage_without_completing_current_stage",
  "skip_language_stage",
  "skip_consent_constitution_stage",
  "auto_select_all_resources",
  "infer_consent_from_passive_acceptance",
  "execute_first_mission_during_onboarding_preview",
  "federation",
  "network_used",
  "node_connection",
  "receipt_mint"
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

function isValidLanguageCode(s) {
  // Permissive: ISO 639-1 two-letter, or canon "other" sentinel
  return typeof s === "string" && (s.length === 2 || s === "other");
}

function classifyCurrentStage(progress) {
  // Determine the current stage based on which completions are present.
  // The stage with the smallest order whose `id` is NOT in completed array
  // is the current stage. If all 7 are complete, return null.
  const completed = new Set(Array.isArray(progress?.completed) ? progress.completed : []);
  for (const stage of CANONICAL_STAGES) {
    if (!completed.has(stage.id)) return stage;
  }
  return null;
}

function shouldAllowStage(stage, progress) {
  // Per refuse-as-product, a stage cannot be entered if its `required_before`
  // dependency is unmet. (Note: required_before for stage X lists what comes
  // AFTER stage X, so the gate is: every prior stage with X in their
  // required_before must be completed.)
  const completed = new Set(Array.isArray(progress?.completed) ? progress.completed : []);
  for (const candidate of CANONICAL_STAGES) {
    if (candidate.order >= stage.order) continue;
    if ((candidate.required_before ?? []).includes(stage.id)) {
      if (!completed.has(candidate.id)) {
        return { allowed: false, reason: `requires_completion_of_${candidate.id}` };
      }
    }
  }
  return { allowed: true, reason: null };
}

function freezeStage(stage, candidateOrdinal) {
  // Format the stage title with the candidate's ordinal substituted in.
  const title = String(stage.title).replace("{ordinal}", String(candidateOrdinal));
  return Object.freeze({
    id: stage.id,
    order: stage.order,
    title,
    prompt_intent: stage.prompt_intent,
    options_kind: stage.options_kind,
    options: stage.options_default,
    constitution_text: stage.constitution_text ?? null,
    example_intents_by_purpose: stage.example_intents_by_purpose ?? null,
    safest_default: stage.safest_default ?? null,
    refusal_paths: stage.refusal_paths,
    boundary_note: stage.boundary_note,
    required_before: stage.required_before
  });
}

// ─── Main builder ───────────────────────────────────────────────────────────

export function buildOnboardingLifecyclePreview({
  candidate_name = null,
  candidate_ordinal = null,
  progress = null,
  language = null,
  technical_level = null,
  // ADR-011 extension inputs — all optional; builder applies canonical defaults
  adr011 = {}
} = {}) {
  const ordinal = (typeof candidate_ordinal === "number" && Number.isInteger(candidate_ordinal) && candidate_ordinal >= 0)
    ? candidate_ordinal
    : null;

  const stages = CANONICAL_STAGES.map((s) => freezeStage(s, ordinal ?? "N"));

  const current = classifyCurrentStage(progress);
  const currentStageId = current ? current.id : null;
  const currentStageOrder = current ? current.order : null;
  const allowanceCheck = current ? shouldAllowStage(current, progress) : { allowed: true, reason: null };

  const completed = Array.isArray(progress?.completed) ? [...progress.completed] : [];
  const completion_ratio = completed.length / CANONICAL_STAGES.length;

  // ADR-011 extension: build the 5 schema blocks (pure, no I/O)
  const ext = buildNodeOnboardingExtension(
    Object.assign({ candidate_ordinal }, adr011)
  );

  return Object.freeze({
    schema: SCHEMA,
    truth_label: TRUTH_LABEL,
    mode: MODE,
    candidate: Object.freeze({
      name: typeof candidate_name === "string" ? candidate_name : null,
      ordinal,
      node_label: ordinal !== null ? `Node${ordinal}` : null
    }),
    language: isValidLanguageCode(language) ? language : null,
    technical_level: (typeof technical_level === "number" && technical_level >= 1 && technical_level <= 4) ? technical_level : null,
    stages: Object.freeze(stages),
    stage_count: CANONICAL_STAGES.length,
    current_stage: Object.freeze({
      id: currentStageId,
      order: currentStageOrder,
      allowed_to_enter: allowanceCheck.allowed,
      block_reason: allowanceCheck.reason
    }),
    progress: Object.freeze({
      completed: Object.freeze(completed),
      completion_ratio,
      lifecycle_complete: currentStageId === null
    }),
    operating_law: Object.freeze({
      comprehension_before_consent: true,
      language_before_capability: true,
      human_dignity_before_configuration: true,
      safest_default_on_resource_consent: "nothing_yet",
      consent_form: "exact_string_typed_character_by_character"
    }),
    primary_refusals: PRIMARY_REFUSALS,
    blocked_effects: BLOCKED_EFFECTS,
    consent: Object.freeze({
      exact_string_required: true,
      fuzzy_match_allowed: false,
      case_insensitive_allowed: false,
      prefix_match_allowed: false,
      paste_allowed: false,
      adr_005_anchor: "docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md"
    }),
    canon_anchors: Object.freeze({
      ordinal_law: "docs/canon/BIZRA_TOPOLOGY_CANON.md#node-ordinal-law",
      seed_pattern: "docs/canon/BIZRA_TOPOLOGY_CANON.md#seed-pattern-invariant-fractality",
      adr_005: "docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md",
      adr_009_poi: "docs/06-adr/ADR-009-poi-proof-of-impact-design.md",
      node_registry_preview: "packages/core/src/node-registry-preview.js"
    }),
    // ADR-011 extension blocks — inline at top level (additive · existing fields unchanged)
    node_topology: ext.node_topology,
    model_readiness: ext.model_readiness,
    language_state: ext.language_state,
    candidate_lifecycle: ext.candidate_lifecycle,
    adr011_blocked_effects: ext.blocked_effects,
    boundary: buildPreviewBoundary()
  });
}

// ─── Public constants ──────────────────────────────────────────────────────

export const ONBOARDING_LIFECYCLE_SCHEMA = SCHEMA;
export const ONBOARDING_LIFECYCLE_STAGE_COUNT = CANONICAL_STAGES.length;
export const ONBOARDING_LIFECYCLE_STAGE_IDS = Object.freeze(CANONICAL_STAGES.map((s) => s.id));
export const ONBOARDING_LIFECYCLE_PRIMARY_REFUSALS = PRIMARY_REFUSALS;
