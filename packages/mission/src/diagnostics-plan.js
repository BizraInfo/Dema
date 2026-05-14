import { buildSafetyReportPreview } from "../../core/src/safety-report.js";
import { sha256, stableStringify } from "../../consent/src/consent-common.js";

const SCHEMA = "bizra.dema.diagnostics_mission_plan.v0.1";

const DIAGNOSTICS_INTENT =
  "Run Dema self-diagnostics harness: inspect local model posture, ambient boundary, safety report, tests, check gate, and Node0 self-check verifier.";

const HHMM_PHASES = ["UNDERSTAND", "PLAN", "ACT", "VERIFY", "SETTLE"];

const CHECKS = [
  {
    id: "models.inventory",
    phase: "UNDERSTAND",
    command: "dema models",
    purpose: "Inventory local model surfaces without inference."
  },
  {
    id: "ambient.boundary",
    phase: "UNDERSTAND",
    command: "dema ambient",
    purpose: "Expose allowed versus blocked ambient execution surfaces."
  },
  {
    id: "safety.preview",
    phase: "PLAN",
    command: "dema report safety",
    purpose: "Render proof gaps, self-critique, and lighthouse safety posture."
  },
  {
    id: "tests.formal",
    phase: "ACT",
    command: "npm test",
    purpose: "Run the formal repo test suite after explicit runtime consent."
  },
  {
    id: "check.empirical",
    phase: "VERIFY",
    command: "npm run check",
    purpose: "Run CLI smoke checks and Node0 self-check verifier after explicit runtime consent."
  },
  {
    id: "node0.self_check",
    phase: "VERIFY",
    command: "node scripts/node0-self-check.mjs --verify",
    purpose: "Verify committed self-check artifacts byte-for-byte."
  }
];

const PERMISSIONS = [
  {
    resource_id: "repo:Dema",
    action: "read",
    purpose: "inspect Dema repo diagnostics surfaces",
    requires_human_consent: false
  },
  {
    resource_id: "command:npm-test",
    action: "execute",
    purpose: "run formal Dema test suite",
    requires_human_consent: true
  },
  {
    resource_id: "command:npm-run-check",
    action: "execute",
    purpose: "run Dema check gate and smoke commands",
    requires_human_consent: true
  },
  {
    resource_id: "command:node0-self-check-verify",
    action: "execute",
    purpose: "verify Node0 self-check proof artifacts",
    requires_human_consent: true
  }
];

const BOUNDARY = {
  scope: "read-only-preview",
  inference_invoked: false,
  approval_recorded: false,
  capability_minted: false,
  execution_enabled: false,
  mutation_performed: false,
  receipt_minted: false,
  daemon_started: false
};

function missionIdFor(intent) {
  return `diagnostics_${sha256(intent).slice(0, 12)}`;
}

function proofFromSafetyReport(safetyReport) {
  return Object.fromEntries(
    Object.entries(safetyReport.proof_of_truth_convergence).map(([key, value]) => [
      key,
      {
        status: value.status,
        evidence_kind: value.evidence_kind,
        certifies: value.certifies,
        claim: value.claim
      }
    ])
  );
}

export function buildDiagnosticsMissionPlan({ now = new Date() } = {}) {
  const safetyReport = buildSafetyReportPreview({ now });
  const mission = {
    id: missionIdFor(DIAGNOSTICS_INTENT),
    natural_language: DIAGNOSTICS_INTENT,
    category: "self_diagnostics",
    risk_level: "high",
    current_phase: "DRAFT_INTENT",
    hhmm_phases: HHMM_PHASES
  };
  const consentScopePreview = {
    schema: "bizra.dema.diagnostics_consent_scope_preview.v0.1",
    status: "draft_only",
    approval_recorded: false,
    permissions: PERMISSIONS,
    commitment_hash: sha256(stableStringify(PERMISSIONS))
  };

  return {
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    mission,
    checks: CHECKS,
    consent_scope_preview: consentScopePreview,
    mission_commitment_hash: sha256(stableStringify(mission)),
    proof_of_truth_convergence: proofFromSafetyReport(safetyReport),
    proactive_harness: {
      status: "planned",
      trigger: "before lighthouse installs, Node0 activation attempts, or public trust claims",
      next_action: "operator reviews this plan, narrows scope, then hands it to governed Node0 runtime"
    },
    self_critique: safetyReport.self_critique,
    phase_gate: {
      current_phase: "DRAFT_INTENT",
      next_phase: "CONSENT_NEGOTIATION",
      requirement: "human reviews diagnostics permissions before any check command can execute",
      consent_scope_committed: false,
      effect_caps_minted: false
    },
    boundary: BOUNDARY
  };
}

function appendChecks(lines, checks) {
  for (const check of checks) {
    lines.push(`  - ${check.phase}: ${check.command}  purpose="${check.purpose}"`);
  }
}

function appendPermissions(lines, permissions) {
  for (const permission of permissions) {
    lines.push(`  - ${permission.resource_id}  ${permission.action}  purpose="${permission.purpose}"`);
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
    "Planned checks:"
  ];

  appendChecks(lines, plan.checks);
  lines.push("");
  lines.push("Consent scope preview:");
  appendPermissions(lines, plan.consent_scope_preview.permissions);
  lines.push("");
  lines.push("Proof-of-Truth Convergence:");
  for (const [pillar, value] of Object.entries(plan.proof_of_truth_convergence)) {
    lines.push(`  ${pillar}: ${value.status} (${value.evidence_kind}; certifies=${value.certifies})`);
  }
  lines.push("");
  lines.push("Self-critique:");
  for (const gap of plan.self_critique.gaps) {
    lines.push(`  - ${gap.severity}: ${gap.code} - ${gap.note}`);
  }
  lines.push("");
  lines.push(`Gate: ${plan.phase_gate.requirement}`);
  lines.push("Boundary: preview-only; no execution; no mutation; no receipt minted.");

  return lines.join("\n");
}
