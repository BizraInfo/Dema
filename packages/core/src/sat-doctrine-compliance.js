// C5 · SAT-3 · Doctrine Compliance (per ADR-008 §C5).
//
// Third of the 5 SATs. Role: run Key Maker compliance check against
// artifacts that make claims · flag any of the 5 invariants that fail ·
// surface the failed_invariants explicitly. Integrates with existing
// C1.5-era key-maker-compliance.js · uses it as the verification engine.

import { buildAgentKernel, AGENT_KERNEL_MAX_ITERATIONS } from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  buildKeyMakerCompliancePreview,
  KEY_MAKER_INVARIANT_NAMES
} from "./key-maker-compliance.js";

const SCHEMA = "bizra.dema.sat_doctrine_compliance.v0.1";
const VERDICT_SCHEMA = "bizra.dema.doctrine_compliance_verdict.v0.1";

const SAT3_PERSONA = Object.freeze({
  sat_number: 3,
  sat_id: "sat-3-doctrine-compliance",
  role_name: "doctrine_compliance",
  role_description:
    "Verifies artifacts that make claims against the 5 Key Maker invariants " +
    "(assumption_declaration · certainty_mapping · constructive_reading · " +
    "opposing_view_search · boundary_marker). Flags any failed invariant. " +
    "NEVER waives an invariant · NEVER approves non-compliant outputs.",
  primary_capabilities: Object.freeze([
    "run_key_maker_compliance_check",
    "identify_failed_invariants",
    "classify_severity_per_invariant",
    "report_compliance_score"
  ]),
  primary_refusals: Object.freeze([
    "waive_invariant",
    "approve_non_compliant_output",
    "soften_failed_invariant_to_warning",
    "infer_implicit_compliance",
    "execute_runtime"
  ])
});

const SAT3_EFFECT_CAP_ALLOWED = Object.freeze(["render_terminal_output", "compute_hash"]);
const SAT3_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "waive_invariant",
  "approve_non_compliant",
  "soften_invariant_to_warning"
]);
const SAT3_CONSENT_PHRASE_TEMPLATE = "GO: invoke SAT-3 doctrine_compliance to audit";

function safeObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

export function buildSATDoctrineComplianceEffectCap() {
  return buildEffectCap({
    name: "sat_doctrine_compliance",
    description: SAT3_PERSONA.role_description,
    allowed_effects: SAT3_EFFECT_CAP_ALLOWED,
    blocked_effects: SAT3_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: SAT3_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true
  });
}

export function buildSATDoctrineCompliancePreview() {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: SAT3_PERSONA,
    effect_cap: buildSATDoctrineComplianceEffectCap(),
    consent_phrase_template: SAT3_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${SAT3_PERSONA.sat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    audited_invariants: KEY_MAKER_INVARIANT_NAMES,
    refusal_invariants: Object.freeze([
      "SAT-3 never waives an invariant · all 5 must pass",
      "SAT-3 never approves a non-compliant output",
      "SAT-3 never softens a failed invariant to warning · pass or fail only",
      "SAT-3 never infers implicit compliance · explicit declaration required"
    ]),
    boundary: buildPreviewBoundary()
  });
}

export function buildSATDoctrineComplianceKernel({ mission_intent = "", max_iterations = AGENT_KERNEL_MAX_ITERATIONS } = {}) {
  return buildAgentKernel({
    agent_id: SAT3_PERSONA.sat_id,
    agent_role: "sat_doctrine_compliance",
    mission_intent: typeof mission_intent === "string" ? mission_intent : "",
    max_iterations
  });
}

// Audit an artifact's claims against the 5 Key Maker invariants.
//
// Inputs: a claims-bearing artifact with optional V/D/A/U declaration
// shape. The audit constructs a KeyMakerCompliance envelope from the
// artifact and reads its overall_compliant + failed_invariants.
export function auditArtifactDoctrine({
  artifact = null,
  claims_door = "",
  known_claims = [],
  uncertain_claims = [],
  assumed_with_ihsan_claims = [],
  unknown_claims = [],
  boundary_marker = "",
  opposing_view_examined = null,
  opposing_view_truth_found = null,
  constructive_reading_applied = true
} = {}) {
  const safeArtifact = safeObject(artifact);

  // Build the compliance envelope using the existing module
  const envelope = buildKeyMakerCompliancePreview({
    door: claims_door,
    known: known_claims,
    uncertain: uncertain_claims,
    assumed_with_ihsan: assumed_with_ihsan_claims,
    unknown: unknown_claims,
    boundary_marker,
    opposing_view_examined,
    opposing_view_truth_found,
    constructive_reading_applied
  });

  const compliance = envelope.invariant_compliance;
  const failedInvariants = compliance.failed_invariants;
  const passed = compliance.overall_compliant;

  // Severity classification: invariant 5 (boundary_marker) is HIGH if
  // failed because it indicates unmarked uncertainty.
  const severities = {};
  for (const inv of KEY_MAKER_INVARIANT_NAMES) {
    if (compliance[inv] === true) severities[inv] = "passed";
    else severities[inv] = inv === "boundary_marker" || inv === "constructive_reading" ? "high" : "medium";
  }

  // Compliance score (0-5)
  const passCount = KEY_MAKER_INVARIANT_NAMES.filter((n) => compliance[n] === true).length;

  return Object.freeze({
    schema: VERDICT_SCHEMA,
    truth_label: passed ? "MEASURED" : "DOCTRINE_VIOLATION",
    mode: "verdict",
    audited_by: SAT3_PERSONA.sat_id,
    audited_at: new Date().toISOString(),
    artifact_schema: safeArtifact?.schema || null,
    compliance_score: passCount,
    max_score: KEY_MAKER_INVARIANT_NAMES.length,
    invariant_results: Object.freeze({ ...compliance }),
    failed_invariants: failedInvariants,
    severities: Object.freeze(severities),
    passed,
    verdict: passed ? "doctrine_compliant" : "doctrine_violated",
    source_envelope_schema: envelope.schema,
    audit_trail_required: true,
    receipt_shape_ready: passed,
    boundary: buildPreviewBoundary()
  });
}

export function buildSATDoctrineComplianceSummary() {
  const preview = buildSATDoctrineCompliancePreview();
  return Object.freeze({
    schema: "bizra.dema.sat_doctrine_compliance_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    sat_number: preview.persona.sat_number,
    role_name: preview.persona.role_name,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    invariants_audited: preview.audited_invariants,
    boundary: preview.boundary
  });
}

export const SAT_DOCTRINE_COMPLIANCE_SCHEMA_NAME = SCHEMA;
export const SAT_DOCTRINE_COMPLIANCE_VERDICT_SCHEMA_NAME = VERDICT_SCHEMA;
export const SAT_DOCTRINE_COMPLIANCE_PERSONA = SAT3_PERSONA;
