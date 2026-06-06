// C4 · PAT-4 · Memory Curator (per ADR-008 §C4).
//
// Fourth of the 7 PATs. Role: classify entries in ~/.dema/memory · index
// them by category · suggest consolidations. NEVER deletes memory entries ·
// NEVER moves them across categories without consent.

import {
  buildAgentKernel,
  AGENT_KERNEL_MAX_ITERATIONS,
} from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.pat_memory_curator.v0.1";
const CLASSIFICATION_SCHEMA = "bizra.dema.memory_classification.v0.1";

const PAT4_PERSONA = Object.freeze({
  pat_number: 4,
  pat_id: "pat-4-memory-curator",
  role_name: "memory_curator",
  role_description:
    "Classifies ~/.dema/memory/* entries by canonical category · indexes by " +
    "type · suggests consolidations of duplicates. NEVER deletes memory · NEVER " +
    "moves between categories without operator consent · NEVER edits entry content.",
  primary_capabilities: Object.freeze([
    "classify_memory_entry",
    "index_by_category",
    "detect_duplicates",
    "suggest_consolidation",
  ]),
  primary_refusals: Object.freeze([
    "delete_memory_entries",
    "move_entries_without_consent",
    "edit_entry_content",
    "merge_entries_silently",
    "infer_user_intent_for_archival",
    "execute_runtime",
  ]),
});

const PAT4_EFFECT_CAP_ALLOWED = Object.freeze([
  "read_local_file",
  "list_local_directory",
  "stat_file_metadata",
  "render_terminal_output",
]);

const PAT4_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "delete_memory_entry",
  "edit_memory_entry_content",
  "move_entry_without_consent",
  "merge_entries_silently",
]);

const PAT4_CONSENT_PHRASE_TEMPLATE =
  "GO: invoke PAT-4 memory_curator to classify";

const CANONICAL_MEMORY_CATEGORIES = Object.freeze([
  "user",
  "feedback",
  "project",
  "reference",
  "uncategorized",
]);

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function inferCategoryFromName(name) {
  const n = String(name || "").toLowerCase();
  if (n.startsWith("user_") || n.startsWith("user.")) return "user";
  if (n.startsWith("feedback_")) return "feedback";
  if (n.startsWith("project_")) return "project";
  if (n.startsWith("reference_")) return "reference";
  return "uncategorized";
}

export function buildPATMemoryCuratorEffectCap() {
  return buildEffectCap({
    name: "pat_memory_curator",
    description: PAT4_PERSONA.role_description,
    allowed_effects: PAT4_EFFECT_CAP_ALLOWED,
    blocked_effects: PAT4_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: PAT4_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true,
  });
}

export function buildPATMemoryCuratorPreview({ operator_name = "Mumu" } = {}) {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: PAT4_PERSONA,
    serves_operator: safeString(operator_name, "Mumu"),
    effect_cap: buildPATMemoryCuratorEffectCap(),
    consent_phrase_template: PAT4_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${PAT4_PERSONA.pat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    canonical_memory_categories: CANONICAL_MEMORY_CATEGORIES,
    refusal_invariants: Object.freeze([
      "PAT-4 never deletes a memory entry · operator deletes manually",
      "PAT-4 never moves entries between categories without typed consent",
      "PAT-4 never edits entry content · only classifies",
      "PAT-4 never merges entries silently · suggests with operator review",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

export function buildPATMemoryCuratorKernel({
  mission_intent = "",
  max_iterations = AGENT_KERNEL_MAX_ITERATIONS,
} = {}) {
  return buildAgentKernel({
    agent_id: PAT4_PERSONA.pat_id,
    agent_role: "pat_memory_curator",
    mission_intent: safeString(mission_intent, ""),
    max_iterations,
  });
}

// Classify a memory entry: read its name + optional frontmatter type,
// suggest a canonical category, emit a classification preview.
export function classifyMemoryEntry({
  entry_name = "",
  entry_type_frontmatter = "",
  current_category = "",
} = {}) {
  const name = safeString(entry_name, "").trim();
  const typeHint = safeString(entry_type_frontmatter, "").toLowerCase();
  const current = safeString(current_category, "").toLowerCase();

  const inferred = inferCategoryFromName(name);
  const fromFrontmatter = CANONICAL_MEMORY_CATEGORIES.includes(typeHint)
    ? typeHint
    : null;

  // Frontmatter wins over name-prefix when both are present and disagree
  const suggested = fromFrontmatter || inferred;

  // Confidence heuristic: high if frontmatter says it, medium if name prefix
  // matches a canonical category, low if uncategorized.
  let confidence;
  if (fromFrontmatter && fromFrontmatter !== "uncategorized")
    confidence = "high";
  else if (inferred !== "uncategorized") confidence = "medium";
  else confidence = "low";

  const requiresConsent = current.length > 0 && current !== suggested;
  const consentPhrase = requiresConsent
    ? `GO: move '${name}' from '${current}' to '${suggested}'`
    : null;

  return Object.freeze({
    schema: CLASSIFICATION_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "draft_only",
    drafted_by: PAT4_PERSONA.pat_id,
    drafted_at: new Date().toISOString(),
    entry_name: name,
    current_category: current,
    inferred_from_name: inferred,
    inferred_from_frontmatter: fromFrontmatter,
    suggested_category: suggested,
    classification_confidence: confidence,
    requires_consent_to_apply: requiresConsent,
    consent_phrase: consentPhrase,
    canonical_categories: CANONICAL_MEMORY_CATEGORIES,
    audit_trail_required: true,
    receipt_shape_ready: name.length > 0,
    boundary: buildPreviewBoundary(),
  });
}

export function buildPATMemoryCuratorSummary(options = {}) {
  const preview = buildPATMemoryCuratorPreview(options);
  return Object.freeze({
    schema: "bizra.dema.pat_memory_curator_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    pat_number: preview.persona.pat_number,
    pat_id: preview.persona.pat_id,
    role_name: preview.persona.role_name,
    serves_operator: preview.serves_operator,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    canonical_category_count: preview.canonical_memory_categories.length,
    boundary: preview.boundary,
  });
}

export const PAT_MEMORY_CURATOR_SCHEMA_NAME = SCHEMA;
export const PAT_MEMORY_CURATOR_CLASSIFICATION_SCHEMA_NAME =
  CLASSIFICATION_SCHEMA;
export const PAT_MEMORY_CURATOR_PERSONA = PAT4_PERSONA;
export const PAT_MEMORY_CURATOR_CANONICAL_CATEGORIES =
  CANONICAL_MEMORY_CATEGORIES;
