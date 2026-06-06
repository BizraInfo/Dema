import { buildSafetyReportPreview } from "../../core/src/safety-report.js";
import {
  MICRO_CONSENT_SHAPE,
  sha256,
  stableStringify,
} from "../../consent/src/consent-common.js";

const SCHEMA = "bizra.dema.diagnostics_mission_plan.v0.1";

const DIAGNOSTICS_INTENT =
  "Run Dema self-diagnostics harness: inspect local model posture, ambient boundary, safety report, tests, check gate, and Node0 self-check verifier.";

const HHMM_PHASES = ["UNDERSTAND", "PLAN", "ACT", "VERIFY", "SETTLE"];

const CHECKS = [
  {
    id: "models.inventory",
    phase: "UNDERSTAND",
    command: "dema models",
    purpose: "Inventory local model surfaces without inference.",
  },
  {
    id: "ambient.boundary",
    phase: "UNDERSTAND",
    command: "dema ambient",
    purpose: "Expose allowed versus blocked ambient execution surfaces.",
  },
  {
    id: "safety.preview",
    phase: "PLAN",
    command: "dema report safety",
    purpose: "Render proof gaps, self-critique, and lighthouse safety posture.",
  },
  {
    id: "tests.formal",
    phase: "ACT",
    command: "npm test",
    purpose: "Run the formal repo test suite after explicit runtime consent.",
  },
  {
    id: "check.empirical",
    phase: "VERIFY",
    command: "npm run check",
    purpose:
      "Run CLI smoke checks and Node0 self-check verifier after explicit runtime consent.",
  },
  {
    id: "node0.self_check",
    phase: "VERIFY",
    command: "node scripts/node0-self-check.mjs --verify",
    purpose: "Verify committed self-check artifacts byte-for-byte.",
  },
];

const PERMISSIONS = [
  {
    resource_id: "repo:Dema",
    action: "read",
    purpose: "inspect Dema repo diagnostics surfaces",
    requires_human_consent: false,
  },
  {
    resource_id: "command:npm-test",
    action: "execute",
    purpose: "run formal Dema test suite",
    requires_human_consent: true,
  },
  {
    resource_id: "command:npm-run-check",
    action: "execute",
    purpose: "run Dema check gate and smoke commands",
    requires_human_consent: true,
  },
  {
    resource_id: "command:node0-self-check-verify",
    action: "execute",
    purpose: "verify Node0 self-check proof artifacts",
    requires_human_consent: true,
  },
];

const BOUNDARY = {
  scope: "read-only-preview",
  inference_invoked: false,
  approval_recorded: false,
  capability_minted: false,
  execution_enabled: false,
  mutation_performed: false,
  receipt_minted: false,
  daemon_started: false,
  network_connection_attempted: false,
  external_posting_performed: false,
};

function missionIdFor(intent) {
  return `diagnostics_${sha256(intent).slice(0, 12)}`;
}

function proofFromSafetyReport(safetyReport) {
  return Object.fromEntries(
    Object.entries(safetyReport.proof_of_truth_convergence).map(
      ([key, value]) => [
        key,
        {
          status: value.status,
          evidence_kind: value.evidence_kind,
          certifies: value.certifies,
          claim: value.claim,
        },
      ],
    ),
  );
}

function effectingPermissionsRequireConsent(permissions) {
  return permissions
    .filter((permission) => permission.action !== "read")
    .every((permission) => permission.requires_human_consent === true);
}

function previewBoundaryClosed(boundary) {
  return [
    "approval_recorded",
    "capability_minted",
    "execution_enabled",
    "mutation_performed",
    "receipt_minted",
    "daemon_started",
    "network_connection_attempted",
    "external_posting_performed",
  ].every((key) => boundary[key] === false);
}

function buildMicroCompliance({ permissions, boundary }) {
  const allEffectingChecksRequireConsent =
    effectingPermissionsRequireConsent(permissions);
  const boundaryClosed = previewBoundaryClosed(boundary);
  const noRuntime =
    boundary.execution_enabled === false && boundary.daemon_started === false;
  const noNetwork = boundary.network_connection_attempted === false;
  const noExternalPosting = boundary.external_posting_performed === false;

  return {
    preview_only: true,
    deterministic: true,
    no_runtime: noRuntime,
    no_federation: noNetwork && noExternalPosting,
    no_node_connection: noNetwork,
    no_capability_mint: boundary.capability_minted === false,
    no_receipt_mint: boundary.receipt_minted === false,
    no_approval_recorded: boundary.approval_recorded === false,
    all_effecting_checks_require_consent: allEffectingChecksRequireConsent,
    preview_boundary_closed: boundaryClosed,
    no_policy_contradiction: allEffectingChecksRequireConsent && boundaryClosed,
  };
}

function buildProactiveHarness({ microCompliance }) {
  return {
    mode: "DETERMINISTIC_DIAGNOSTICS_POLICY_PREVIEW",
    status: "planned",
    trigger:
      "before lighthouse installs, Node0 activation attempts, or public trust claims",
    recommended_micro_action:
      "narrow_diagnostics_scope_then_request_exact_consent",
    gates: [
      {
        gate: "all_effecting_checks_require_consent",
        pass: microCompliance.all_effecting_checks_require_consent,
      },
      {
        gate: "preview_boundary_closed",
        pass: microCompliance.preview_boundary_closed,
      },
      {
        gate: "approval_not_recorded",
        pass: microCompliance.no_approval_recorded,
      },
      {
        gate: "effect_capability_not_minted",
        pass: microCompliance.no_capability_mint,
      },
      {
        gate: "runtime_boundary_closed",
        pass: microCompliance.no_runtime,
      },
    ],
    next_action:
      "operator reviews this plan, narrows scope, then separately authorizes any governed runtime handoff",
  };
}

function buildMicroConsent() {
  return {
    preview_scope: "diagnostics_plan_preview_only",
    status: "draft_only",
    approval_recorded: false,
    exact_consent_required_for_effecting_checks: true,
    consent_observed_in_preview: false,
    action_authorized_by_preview: false,
    reusable_authorization_created: false,
    broad_consent_allowed: false,
    minimum_shape: MICRO_CONSENT_SHAPE,
  };
}

function buildSelfCritique(safetyReport) {
  return {
    ...safetyReport.self_critique,
    confidence: "bounded_preview",
    weakest_link: "operator_scope_selection",
    limitation:
      "Diagnostics planning can name checks and consent requirements, but it cannot certify results until the operator authorizes execution and verification reads actual traces.",
    open_risk_count: safetyReport.self_critique.gaps.length,
  };
}

export function buildDiagnosticsMissionPlan({ now = new Date() } = {}) {
  const safetyReport = buildSafetyReportPreview({ now });
  const mission = {
    id: missionIdFor(DIAGNOSTICS_INTENT),
    natural_language: DIAGNOSTICS_INTENT,
    category: "self_diagnostics",
    risk_level: "high",
    current_phase: "DRAFT_INTENT",
    hhmm_phases: HHMM_PHASES,
  };
  const consentScopePreview = {
    schema: "bizra.dema.diagnostics_consent_scope_preview.v0.1",
    status: "draft_only",
    approval_recorded: false,
    permissions: PERMISSIONS,
    commitment_hash: sha256(stableStringify(PERMISSIONS)),
  };
  const microCompliance = buildMicroCompliance({
    permissions: PERMISSIONS,
    boundary: BOUNDARY,
  });

  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    mission,
    checks: CHECKS,
    consent_scope_preview: consentScopePreview,
    mission_commitment_hash: sha256(stableStringify(mission)),
    proof_of_truth_convergence: proofFromSafetyReport(safetyReport),
    proactive_harness: buildProactiveHarness({ microCompliance }),
    self_critique: buildSelfCritique(safetyReport),
    micro_compliance: microCompliance,
    micro_consent: buildMicroConsent(),
    phase_gate: {
      current_phase: "DRAFT_INTENT",
      next_phase: "CONSENT_NEGOTIATION",
      requirement:
        "human reviews diagnostics permissions before any check command can execute",
      consent_scope_committed: false,
      effect_caps_minted: false,
    },
    boundary: BOUNDARY,
  };
}

function appendChecks(lines, checks) {
  for (const check of checks) {
    lines.push(
      `  - ${check.phase}: ${check.command}  purpose="${check.purpose}"`,
    );
  }
}

function appendPermissions(lines, permissions) {
  for (const permission of permissions) {
    lines.push(
      `  - ${permission.resource_id}  ${permission.action}  purpose="${permission.purpose}"`,
    );
  }
}

function appendGates(lines, gates) {
  for (const gate of gates) {
    lines.push(`  - ${gate.gate}: ${gate.pass ? "pass" : "fail"}`);
  }
}

export function formatDiagnosticsMissionPlan(plan) {
  const lines = [
    "DEMA Diagnostics Mission Plan",
    "",
    `Mode: ${plan.mode}`,
    `mission_id: ${plan.mission.id}`,
    `category: ${plan.mission.category}`,
    `risk: ${plan.mission.risk_level}`,
    `current_phase: ${plan.mission.current_phase}`,
    `phase_flow: ${plan.mission.hhmm_phases.join(" -> ")}`,
    `mission_commitment_hash: ${plan.mission_commitment_hash}`,
    `consent_commitment_hash: ${plan.consent_scope_preview.commitment_hash}`,
    "",
    "Planned checks:",
  ];

  appendChecks(lines, plan.checks);
  lines.push("");
  lines.push("Consent scope preview:");
  appendPermissions(lines, plan.consent_scope_preview.permissions);
  lines.push("");
  lines.push("Proof-of-Truth Convergence:");
  for (const [pillar, value] of Object.entries(
    plan.proof_of_truth_convergence,
  )) {
    lines.push(
      `  ${pillar}: ${value.status} (${value.evidence_kind}; certifies=${value.certifies})`,
    );
  }
  lines.push("");
  lines.push("Self-proactive harness:");
  lines.push(`  mode: ${plan.proactive_harness.mode}`);
  lines.push(
    `  recommended_micro_action: ${plan.proactive_harness.recommended_micro_action}`,
  );
  appendGates(lines, plan.proactive_harness.gates);
  lines.push("");
  lines.push("Micro-compliance:");
  for (const [key, value] of Object.entries(plan.micro_compliance)) {
    lines.push(`  - ${key}: ${value}`);
  }
  lines.push("");
  lines.push("Micro-consent:");
  lines.push(`  scope: ${plan.micro_consent.preview_scope}`);
  lines.push(`  status: ${plan.micro_consent.status}`);
  lines.push(
    `  exact_consent_required_for_effecting_checks: ${plan.micro_consent.exact_consent_required_for_effecting_checks}`,
  );
  lines.push(
    `  action_authorized_by_preview: ${plan.micro_consent.action_authorized_by_preview}`,
  );
  lines.push("");
  lines.push("Self-critique:");
  lines.push(`  confidence: ${plan.self_critique.confidence}`);
  lines.push(`  weakest_link: ${plan.self_critique.weakest_link}`);
  for (const gap of plan.self_critique.gaps) {
    lines.push(`  - ${gap.severity}: ${gap.code} - ${gap.note}`);
  }
  lines.push("");
  lines.push(`Gate: ${plan.phase_gate.requirement}`);
  lines.push(
    "Boundary: preview-only; no execution; no mutation; no receipt minted; no network; no external posting.",
  );

  return lines.join("\n");
}
