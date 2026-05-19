// C5 · SAT-5 · Identity Verifier (per ADR-008 §C5 · final SAT).
//
// Fifth and final SAT. Verifies operator identity persistence: profile
// exists · profile fields match expected shape · profile hasn't been
// silently overwritten · session-to-session identity continuity holds.

import { buildAgentKernel, AGENT_KERNEL_MAX_ITERATIONS } from "./agent-kernel.js";
import { buildEffectCap } from "./effect-cap.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

const SCHEMA = "bizra.dema.sat_identity_verifier.v0.1";
const VERDICT_SCHEMA = "bizra.dema.identity_verdict.v0.1";

const SAT5_PERSONA = Object.freeze({
  sat_number: 5,
  sat_id: "sat-5-identity-verifier",
  role_name: "identity_verifier",
  role_description:
    "Verifies operator identity persistence: profile.json exists · contains " +
    "expected fields (name · node · stage) · matches previous session's snapshot · " +
    "no silent overwrites. NEVER modifies the profile · NEVER infers identity " +
    "from absent profile · NEVER waives identity check.",
  primary_capabilities: Object.freeze([
    "verify_profile_exists",
    "verify_profile_field_shape",
    "compare_to_previous_snapshot",
    "detect_silent_overwrites"
  ]),
  primary_refusals: Object.freeze([
    "modify_profile",
    "infer_identity_from_absent_profile",
    "waive_identity_check",
    "merge_identity_silently_across_sessions"
  ])
});

const SAT5_EFFECT_CAP_ALLOWED = Object.freeze(["read_local_file", "compute_hash", "stat_file_metadata"]);
const SAT5_EFFECT_CAP_EXTRA_BLOCKED = Object.freeze([
  "modify_profile",
  "infer_identity_from_absent_profile",
  "waive_identity_check"
]);
const SAT5_CONSENT_PHRASE_TEMPLATE = "GO: invoke SAT-5 identity_verifier to verify";

const REQUIRED_PROFILE_FIELDS = Object.freeze(["name", "node"]);

function safeObject(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? v : null;
}

function safeString(v) {
  return typeof v === "string" ? v : "";
}

export function buildSATIdentityVerifierEffectCap() {
  return buildEffectCap({
    name: "sat_identity_verifier",
    description: SAT5_PERSONA.role_description,
    allowed_effects: SAT5_EFFECT_CAP_ALLOWED,
    blocked_effects: SAT5_EFFECT_CAP_EXTRA_BLOCKED,
    consent_scope_template: SAT5_CONSENT_PHRASE_TEMPLATE,
    audit_trail_required: true
  });
}

export function buildSATIdentityVerifierPreview() {
  return Object.freeze({
    schema: SCHEMA,
    truth_label: "NODE0_LOCAL_SEED",
    mode: "preview_only",
    persona: SAT5_PERSONA,
    effect_cap: buildSATIdentityVerifierEffectCap(),
    consent_phrase_template: SAT5_CONSENT_PHRASE_TEMPLATE,
    memory_file_path: `~/.dema/agents/${SAT5_PERSONA.sat_id}/memory.json`,
    max_iterations: AGENT_KERNEL_MAX_ITERATIONS,
    required_profile_fields: REQUIRED_PROFILE_FIELDS,
    refusal_invariants: Object.freeze([
      "SAT-5 never modifies the profile · examination is read-only",
      "SAT-5 never infers identity from absent profile · honest refusal instead",
      "SAT-5 never waives identity check",
      "SAT-5 never silently merges identities across sessions"
    ]),
    boundary: buildPreviewBoundary()
  });
}

export function buildSATIdentityVerifierKernel({ mission_intent = "", max_iterations = AGENT_KERNEL_MAX_ITERATIONS } = {}) {
  return buildAgentKernel({
    agent_id: SAT5_PERSONA.sat_id,
    agent_role: "sat_identity_verifier",
    mission_intent: typeof mission_intent === "string" ? mission_intent : "",
    max_iterations
  });
}

// Verify an identity profile + optional previous snapshot for continuity.
export function verifyIdentity({ profile = null, previous_snapshot = null } = {}) {
  const safeProfile = safeObject(profile);
  const previousSnap = safeObject(previous_snapshot);
  const violations = [];

  if (!safeProfile) {
    return buildVerdict({
      verdict: "profile_absent",
      passed: false,
      violations: ["profile_missing_or_invalid"]
    });
  }

  // Check required fields
  for (const field of REQUIRED_PROFILE_FIELDS) {
    const value = safeProfile[field];
    if (typeof value !== "string" || value.length === 0) {
      violations.push(`missing_or_empty_field · '${field}'`);
    }
  }

  // Compare to previous snapshot if provided
  let continuity_check;
  if (previousSnap) {
    const driftedFields = [];
    for (const field of REQUIRED_PROFILE_FIELDS) {
      if (safeString(safeProfile[field]) !== safeString(previousSnap[field])) {
        driftedFields.push(field);
      }
    }
    continuity_check = {
      previous_snapshot_present: true,
      drifted_fields: driftedFields,
      continuity_held: driftedFields.length === 0
    };
    if (driftedFields.length > 0) {
      violations.push(`silent_identity_drift · fields: ${driftedFields.join(",")}`);
    }
  } else {
    continuity_check = { previous_snapshot_present: false, drifted_fields: [], continuity_held: null };
  }

  const passed = violations.length === 0;
  return buildVerdict({
    verdict: passed ? "identity_verified" : "identity_violation",
    passed,
    violations,
    profile_name: safeString(safeProfile.name),
    profile_node: safeString(safeProfile.node),
    continuity_check
  });
}

function buildVerdict({ verdict, passed, violations, profile_name = null, profile_node = null, continuity_check = null }) {
  return Object.freeze({
    schema: VERDICT_SCHEMA,
    truth_label: passed ? "MEASURED" : "IDENTITY_VIOLATION",
    mode: "verdict",
    verified_by: SAT5_PERSONA.sat_id,
    verified_at: new Date().toISOString(),
    profile_name,
    profile_node,
    verdict,
    passed,
    violations: Object.freeze(violations),
    continuity_check: continuity_check ? Object.freeze({
      ...continuity_check,
      drifted_fields: Object.freeze(continuity_check.drifted_fields || [])
    }) : null,
    audit_trail_required: true,
    receipt_shape_ready: passed,
    boundary: buildPreviewBoundary()
  });
}

export function buildSATIdentityVerifierSummary() {
  const preview = buildSATIdentityVerifierPreview();
  return Object.freeze({
    schema: "bizra.dema.sat_identity_verifier_summary.v0.1",
    truth_label: preview.truth_label,
    mode: "summary",
    source_schema: preview.schema,
    sat_number: preview.persona.sat_number,
    role_name: preview.persona.role_name,
    capability_count: preview.persona.primary_capabilities.length,
    refusal_count: preview.persona.primary_refusals.length,
    required_field_count: preview.required_profile_fields.length,
    boundary: preview.boundary
  });
}

export const SAT_IDENTITY_VERIFIER_SCHEMA_NAME = SCHEMA;
export const SAT_IDENTITY_VERIFIER_VERDICT_SCHEMA_NAME = VERDICT_SCHEMA;
export const SAT_IDENTITY_VERIFIER_PERSONA = SAT5_PERSONA;
export const SAT_IDENTITY_VERIFIER_REQUIRED_FIELDS = REQUIRED_PROFILE_FIELDS;
