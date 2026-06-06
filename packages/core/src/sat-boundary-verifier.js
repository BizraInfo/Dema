// C5 · SAT-1 · Boundary Verifier (per ADR-008 §C5).
//
// First of the 5 System Agents (SAT). Role: verify every Dema output
// has the canonical 16-key boundary all-false. Refuses outputs missing
// the boundary OR with any boundary key truthy.
//
// Unlike PATs (which serve the user · draft things), SATs serve the
// SYSTEM (verify · enforce policy · audit). Each SAT examines an
// artifact and emits a verdict.

import {
  buildAgentKernel,
  AGENT_KERNEL_MAX_ITERATIONS,
} from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import {
  buildPreviewBoundary,
  isCanonicalBoundary,
  isCanonicalBoundaryShape,
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
} from "./preview-boundary.js";

const SCHEMA = "bizra.dema.sat_boundary_verifier.v0.1";
const VERDICT_SCHEMA = "bizra.dema.boundary_verification_verdict.v0.1";

const SAT1_PERSONA = Object.freeze({
  sat_number: 1,
  sat_id: "sat-1-boundary-verifier",
  role_name: "boundary_verifier",
  role_description:
    "Verifies every Dema output has the canonical 16-key boundary all-false. " +
    "Emits a verdict (verified · violated · structurally_invalid) with specific " +
    "violation details. NEVER modifies the artifact being verified · NEVER " +
    "approves a non-canonical output · NEVER waives the boundary requirement.",
  primary_capabilities: Object.freeze([
    "verify_canonical_16_key_shape",
    "verify_all_keys_false",
    "verify_frozen_state",
    "report_specific_violations",
  ]),
  primary_refusals: Object.freeze([
    "modify_verified_artifact",
    "waive_boundary_requirement",
    "approve_non_canonical_output",
    "accept_partial_boundary_match",
    "execute_runtime",
  ]),
});

const SAT1_EFFECT_CAP_ALLOWED = Object.freeze([
  "render_terminal_output",
  "compute_hash",
]);
const SAT1_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "modify_verified_artifact",
  "waive_boundary_requirement",
  "approve_non_canonical",
]);
const SAT1_CONSENT_PHRASE_TEMPLATE =
  "GO: invoke SAT-1 boundary_verifier to verify";

function safeObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

export function buildSATBoundaryVerifierEffectCap() {
  return buildEffectCap({
    name: "sat_boundary_verifier",
    description: SAT1_PERSONA.role_description,
    allowed_effects: SAT1_EFFECT_CAP_ALLOWED,
    blocked_effects: SAT1_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: SAT1_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true,
  });
}

export function buildSATBoundaryVerifierPreview() {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: SAT1_PERSONA,
    effect_cap: buildSATBoundaryVerifierEffectCap(),
    consent_phrase_template: SAT1_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${SAT1_PERSONA.sat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    expected_boundary_keys: PREVIEW_BOUNDARY_CANONICAL_KEYS,
    expected_boundary_key_count: PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
    refusal_invariants: Object.freeze([
      "SAT-1 never modifies the artifact it verifies · examination is read-only",
      "SAT-1 never waives the boundary requirement · canonical is canonical",
      "SAT-1 never approves a non-canonical output · refusal is the default",
      "SAT-1 never accepts a partial match · all 16 keys or no pass",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

export function buildSATBoundaryVerifierKernel({
  mission_intent = "",
  max_iterations = AGENT_KERNEL_MAX_ITERATIONS,
} = {}) {
  return buildAgentKernel({
    agent_id: SAT1_PERSONA.sat_id,
    agent_role: "sat_boundary_verifier",
    mission_intent: typeof mission_intent === "string" ? mission_intent : "",
    max_iterations,
  });
}

// Verify an artifact's boundary. Two checks:
//   - Shape: 16 keys + all false (uses isCanonicalBoundaryShape · works
//     against JSON-recovered objects · post-deserialization)
//   - Frozen: Object.isFrozen check (uses isCanonicalBoundary · for
//     in-process emitter outputs)
//
// Returns a verdict envelope.
export function verifyArtifactBoundary({ artifact = null } = {}) {
  const safeArtifact = safeObject(artifact);
  const artifactSchema =
    typeof safeArtifact?.schema === "string" ? safeArtifact.schema : null;
  const boundary = safeArtifact?.boundary ?? null;
  const safeBoundary = safeObject(boundary);

  // Initial classification
  let verdict;
  let violations = [];
  let frozen_check_passed = false;
  let shape_check_passed = false;

  if (!safeArtifact) {
    verdict = "structurally_invalid";
    violations.push("artifact_not_an_object");
  } else if (!safeBoundary) {
    verdict = "structurally_invalid";
    violations.push("missing_boundary_field");
  } else {
    // Run both shape and frozen checks
    shape_check_passed = isCanonicalBoundaryShape(safeBoundary);
    frozen_check_passed = isCanonicalBoundary(safeBoundary);

    if (shape_check_passed && frozen_check_passed) {
      verdict = "verified";
    } else if (shape_check_passed && !frozen_check_passed) {
      // Shape OK but not frozen — acceptable post-JSON-roundtrip
      verdict = "verified_shape_only";
    } else {
      verdict = "violated";
      // Identify specific violations
      const actualKeys = Object.keys(safeBoundary).sort();
      const expectedKeys = [...PREVIEW_BOUNDARY_CANONICAL_KEYS].sort();
      const missing = expectedKeys.filter((k) => !actualKeys.includes(k));
      const extra = actualKeys.filter((k) => !expectedKeys.includes(k));
      const truthy = expectedKeys.filter(
        (k) => safeBoundary[k] !== false && safeBoundary[k] !== undefined,
      );

      if (missing.length > 0)
        violations.push(`missing_keys · ${missing.join(",")}`);
      if (extra.length > 0) violations.push(`extra_keys · ${extra.join(",")}`);
      if (truthy.length > 0)
        violations.push(
          `truthy_keys · ${truthy.map((k) => `${k}=${JSON.stringify(safeBoundary[k])}`).join(",")}`,
        );
    }
  }

  const passed = verdict === "verified" || verdict === "verified_shape_only";

  return Object.freeze({
    schema: VERDICT_SCHEMA,
    truth_label: passed ? "MEASURED" : "VERIFICATION_FAILED",
    mode: "verdict",
    verified_by: SAT1_PERSONA.sat_id,
    verified_at: new Date().toISOString(),
    artifact_schema: artifactSchema,
    verdict,
    passed,
    shape_check_passed,
    frozen_check_passed,
    violations: Object.freeze(violations),
    expected_key_count: PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
    audit_trail_required: true,
    receipt_shape_ready: passed,
    boundary: buildPreviewBoundary(),
  });
}

export function buildSATBoundaryVerifierSummary(options = {}) {
  const preview = buildSATBoundaryVerifierPreview(options);
  return Object.freeze({
    schema: "bizra.dema.sat_boundary_verifier_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    sat_number: preview.persona.sat_number,
    sat_id: preview.persona.sat_id,
    role_name: preview.persona.role_name,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    expected_boundary_key_count: preview.expected_boundary_key_count,
    boundary: preview.boundary,
  });
}

export const SAT_BOUNDARY_VERIFIER_SCHEMA_NAME = SCHEMA;
export const SAT_BOUNDARY_VERIFIER_VERDICT_SCHEMA_NAME = VERDICT_SCHEMA;
export const SAT_BOUNDARY_VERIFIER_PERSONA = SAT1_PERSONA;
