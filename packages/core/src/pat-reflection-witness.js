// C4 · PAT-7 · Reflection Witness (per ADR-008 §C4 · final PAT).
//
// Seventh and final of the 7 PATs. Role: daily activity summary · pattern
// detection across sessions · doctrine catch logging. NEVER judges the
// operator · NEVER claims a doctrine catch without evidence · NEVER
// modifies the history it observes.

import { buildAgentKernel, AGENT_KERNEL_MAX_ITERATIONS } from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.pat_reflection_witness.v0.1";
const REFLECTION_SCHEMA = "bizra.dema.daily_reflection.v0.1";

const PAT7_PERSONA = Object.freeze({
  pat_number: 7,
  pat_id: "pat-7-reflection-witness",
  role_name: "reflection_witness",
  role_description:
    "Composes daily activity summaries · detects patterns across sessions · " +
    "surfaces doctrine catches when canon is violated with operator-visible " +
    "evidence. NEVER judges · NEVER claims doctrine catch without evidence · " +
    "NEVER modifies the history it observes. Mirror, not court.",
  primary_capabilities: Object.freeze([
    "compose_daily_summary",
    "detect_repetitive_patterns",
    "surface_doctrine_catch_with_evidence",
    "compute_session_metrics"
  ]),
  primary_refusals: Object.freeze([
    "judge_the_operator",
    "claim_doctrine_catch_without_evidence",
    "modify_observed_history",
    "infer_intent_from_silence",
    "score_or_grade_the_operator",
    "extrapolate_pattern_from_n_eq_1"
  ])
});

const PAT7_EFFECT_CAP_ALLOWED = Object.freeze([
  "read_local_file",
  "list_local_directory",
  "stat_file_metadata",
  "compute_hash",
  "render_terminal_output"
]);

const PAT7_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "judge_operator",
  "modify_observed_history",
  "infer_intent_from_silence",
  "claim_pattern_from_single_instance",
  "score_operator_performance"
]);

const PAT7_CONSENT_PHRASE_TEMPLATE = "GO: invoke PAT-7 reflection_witness to compose summary";

function safeString(v, fallback = "") {
  return typeof v === "string" ? v : fallback;
}

function safeArray(v) {
  return Array.isArray(v) ? v : [];
}

function safeObject(v, fallback = {}) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : fallback;
}

export function buildPATReflectionWitnessEffectCap() {
  return buildEffectCap({
    name: "pat_reflection_witness",
    description: PAT7_PERSONA.role_description,
    allowed_effects: PAT7_EFFECT_CAP_ALLOWED,
    blocked_effects: PAT7_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: PAT7_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true
  });
}

export function buildPATReflectionWitnessPreview({ operator_name = "Mumu" } = {}) {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: PAT7_PERSONA,
    serves_operator: safeString(operator_name, "Mumu"),
    effect_cap: buildPATReflectionWitnessEffectCap(),
    consent_phrase_template: PAT7_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${PAT7_PERSONA.pat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    refusal_invariants: Object.freeze([
      "PAT-7 never judges the operator · only observes and reflects",
      "PAT-7 never claims a doctrine catch without specific evidence (file:line, sha, etc.)",
      "PAT-7 never modifies the history it observes · the past is the past",
      "PAT-7 never infers operator intent from silence",
      "PAT-7 never scores or grades · operator self-assesses",
      "PAT-7 never extrapolates from a single instance · pattern requires N≥2"
    ]),
    boundary: buildPreviewBoundary()
  });
}

export function buildPATReflectionWitnessKernel({ mission_intent = "", max_iterations = AGENT_KERNEL_MAX_ITERATIONS } = {}) {
  return buildAgentKernel({
    agent_id: PAT7_PERSONA.pat_id,
    agent_role: "pat_reflection_witness",
    mission_intent: safeString(mission_intent, ""),
    max_iterations
  });
}

// Compose a daily reflection from observable signals. Pure function.
// Doctrine catches require evidence_pointer (file/sha/anchor) · without
// it, the catch is downgraded to "pattern observed without evidence" and
// marked as A-grade (assumed-with-Ihsan) not V-grade.
export function composeDailyReflection({
  date = "",
  commits_today = [],
  doctrine_catches = [],
  memory_writes_today = [],
  session_metrics = {}
} = {}) {
  const dateSafe = safeString(date, new Date().toISOString().slice(0, 10));
  const commits = safeArray(commits_today).filter((c) => c && typeof c === "object");
  const catches = safeArray(doctrine_catches).filter((c) => c && typeof c === "object");
  const writes = safeArray(memory_writes_today).filter((w) => typeof w === "string");
  const metrics = safeObject(session_metrics, {});

  // Classify catches by evidence quality
  const catchesClassified = catches.map((c) => {
    const hasEvidence = typeof c.evidence_pointer === "string" && c.evidence_pointer.length > 0;
    const claim = safeString(c.claim, "");
    return Object.freeze({
      claim,
      evidence_pointer: hasEvidence ? c.evidence_pointer : null,
      evidence_grade: hasEvidence ? "V" : "A",
      doctrine_canon_referenced: safeString(c.doctrine_canon_referenced, "")
    });
  });

  const verifiedCatches = catchesClassified.filter((c) => c.evidence_grade === "V");
  const assumedCatches = catchesClassified.filter((c) => c.evidence_grade === "A");

  // Pattern detection: only fire when N≥2 same-named patterns exist
  const patternCounts = {};
  for (const c of catchesClassified) {
    const key = c.doctrine_canon_referenced || "uncategorized";
    patternCounts[key] = (patternCounts[key] || 0) + 1;
  }
  const repeatingPatterns = Object.entries(patternCounts)
    .filter(([_, count]) => count >= 2)
    .map(([canon, count]) => ({ canon_referenced: canon, occurrences: count }));

  return Object.freeze({
    schema: REFLECTION_SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    drafted_by: PAT7_PERSONA.pat_id,
    drafted_at: new Date().toISOString(),
    date: dateSafe,
    summary: Object.freeze({
      commit_count: commits.length,
      memory_writes_count: writes.length,
      doctrine_catches_total: catchesClassified.length,
      verified_catches_count: verifiedCatches.length,
      assumed_catches_count: assumedCatches.length,
      session_metrics: Object.freeze({
        tests_pass: typeof metrics.tests_pass === "number" ? metrics.tests_pass : null,
        gates_green: metrics.gates_green === true,
        spine_surfaces: typeof metrics.spine_surfaces === "number" ? metrics.spine_surfaces : null
      })
    }),
    doctrine_catches_classified: Object.freeze(catchesClassified),
    verified_catches: Object.freeze(verifiedCatches),
    assumed_catches: Object.freeze(assumedCatches),
    repeating_patterns: Object.freeze(repeatingPatterns),
    pattern_detection_threshold: "N >= 2 same-canon catches",
    operator_judgment_offered: false,
    audit_trail_required: true,
    receipt_shape_ready: true,
    boundary: buildPreviewBoundary()
  });
}

export function buildPATReflectionWitnessSummary(options = {}) {
  const preview = buildPATReflectionWitnessPreview(options);
  return Object.freeze({
    schema: "bizra.dema.pat_reflection_witness_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    pat_number: preview.persona.pat_number,
    pat_id: preview.persona.pat_id,
    role_name: preview.persona.role_name,
    serves_operator: preview.serves_operator,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    boundary: preview.boundary
  });
}

export const PAT_REFLECTION_WITNESS_SCHEMA_NAME = SCHEMA;
export const PAT_REFLECTION_WITNESS_REFLECTION_SCHEMA_NAME = REFLECTION_SCHEMA;
export const PAT_REFLECTION_WITNESS_PERSONA = PAT7_PERSONA;
