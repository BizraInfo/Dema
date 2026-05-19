import {
  MICRO_CONSENT_SHAPE,
  PREVIEW_BOUNDARY,
  PREVIEW_PROOF_OF_TRUTH,
  SCHEMA,
  sha256,
  stableStringify
} from "./consent-common.js";
import {
  buildAnalogicalNotes,
  extractIntentShape
} from "./consent-extract.js";

export { formatConsentPlanPreview } from "./consent-format.js";

const ACTUATOR_DECISION_CODES = {
  bash: ["bash_like_actuator"],
  filesystem_mutation: ["filesystem_mutation_requires_exact_consent"],
  external_call: ["audit_external_delivery", "external_call_requires_review"],
  gui: ["gui_actuator_requires_runtime_handoff"],
  mobile_agent: ["mobile_agent_blocked_until_node_handoff_gates"],
  spend: ["economic_channel_closed"]
};

function decisionCodes(policyPreview) {
  return new Set(policyPreview.decisions.map((decision) => decision.code));
}

function policyCoversDetectedActuators(actuatorClasses, policyPreview) {
  const codes = decisionCodes(policyPreview);
  return actuatorClasses.every((actuatorClass) => (
    (ACTUATOR_DECISION_CODES[actuatorClass] ?? []).some((code) => codes.has(code))
  ));
}

function hasNoPolicyContradiction(actuatorClasses, policyPreview) {
  return !(actuatorClasses.length > 0 && decisionCodes(policyPreview).has("no_effecting_actuator_detected"));
}

function recommendedMicroAction(policyPreview) {
  if (policyPreview.decisions.some((decision) => decision.verdict === "deny")) {
    return "narrow_or_refuse_scope";
  }
  if (policyPreview.runtime_handoff_required) {
    return "prepare_governed_runtime_handoff_preview";
  }
  if (policyPreview.decisions.some((decision) => (
    ["requires_exact_consent", "requires_human_review"].includes(decision.verdict)
  ))) {
    return "draft_exact_micro_consent_scope";
  }
  return "narrow_intent_before_approval";
}

function buildMicroCompliance({ actuatorClasses, policyPreview }) {
  const policyCoverage = policyCoversDetectedActuators(actuatorClasses, policyPreview);
  const noContradiction = hasNoPolicyContradiction(actuatorClasses, policyPreview);
  return {
    preview_only: true,
    deterministic: true,
    no_runtime: true,
    no_federation: true,
    no_node_connection: true,
    no_capability_mint: true,
    no_receipt_mint: true,
    no_approval_recorded: policyPreview.approval_recorded === false,
    policy_covers_detected_actuators: policyCoverage,
    no_policy_contradiction: noContradiction
  };
}

function buildSelfProactiveHarness({ policyPreview, microCompliance }) {
  return {
    mode: "DETERMINISTIC_CONSENT_POLICY_PREVIEW",
    recommended_micro_action: recommendedMicroAction(policyPreview),
    gates: [
      { gate: "policy_covers_detected_actuators", pass: microCompliance.policy_covers_detected_actuators },
      { gate: "no_policy_contradiction", pass: microCompliance.no_policy_contradiction },
      { gate: "approval_not_recorded", pass: microCompliance.no_approval_recorded },
      { gate: "effect_capability_not_minted", pass: true },
      { gate: "runtime_boundary_closed", pass: microCompliance.no_runtime }
    ]
  };
}

function buildSelfCritique({ actuatorClasses, policyPreview }) {
  return {
    confidence: "bounded_preview",
    weakest_link: "lexical_intent_classifier",
    limitation: "Actuator classes are inferred from local lexical rules; this preview is a narrowing aid, not consent or runtime authority.",
    open_risk_count: policyPreview.decisions.filter((decision) => decision.verdict !== "preview_only").length,
    actuator_classes_observed: actuatorClasses.length
  };
}

function buildAnalogicalModel() {
  return {
    model: "permission_slip_not_key",
    mapping: "The plan is a labeled permission slip showing what would need approval; it is not the key that opens execution."
  };
}

export function buildConsentPlanPreview({ intent, now = new Date() } = {}) {
  const naturalLanguage = String(intent ?? "").trim();
  if (!naturalLanguage) {
    throw new Error("Consent planning requires a non-empty intent.");
  }

  const shape = extractIntentShape(naturalLanguage);
  const effectCapability = {
    status: "not_minted_preview_only",
    minted: false,
    reason: "Dema drafts consent only; governed runtime must mint EffectCap."
  };
  const microCompliance = buildMicroCompliance({
    actuatorClasses: shape.actuator_classes,
    policyPreview: shape.policy_preview
  });
  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    mission_draft: {
      natural_language: naturalLanguage,
      category: shape.category,
      risk_level: shape.risk_level
    },
    permissions: shape.permissions,
    unsafe_file_references: shape.unsafe_file_references,
    actuator_classes: shape.actuator_classes,
    policy_preview: shape.policy_preview,
    effect_capability: effectCapability,
    self_proactive_harness: buildSelfProactiveHarness({
      policyPreview: shape.policy_preview,
      microCompliance
    }),
    self_critique: buildSelfCritique({
      actuatorClasses: shape.actuator_classes,
      policyPreview: shape.policy_preview
    }),
    micro_compliance: microCompliance,
    analogical_notes: buildAnalogicalNotes(
      naturalLanguage,
      shape.permissions,
      shape.unsafe_file_references
    ),
    analogical_model: buildAnalogicalModel(),
    commitment_hash: sha256(stableStringify(shape.permissions)),
    micro_consent: {
      preview_scope: "consent_plan_preview_only",
      status: "draft_only",
      approval_recorded: false,
      exact_consent_required: true,
      exact_string_required_for_gated_actions: true,
      consent_observed_in_preview: false,
      action_authorized_by_preview: false,
      reusable_authorization_created: false,
      broad_consent_allowed: false,
      minimum_shape: MICRO_CONSENT_SHAPE
    },
    proof_of_truth: PREVIEW_PROOF_OF_TRUTH,
    boundary: PREVIEW_BOUNDARY
  };
}
