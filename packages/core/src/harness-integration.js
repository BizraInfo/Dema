import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { buildPreviewBoundary } from "./preview-boundary.js";
import { buildProcessMiningPreview } from "./process-mining-preview.js";
import { buildSafetyReportPreview } from "./safety-report.js";
import { buildDiagnosticsMissionPlan } from "../../mission/src/diagnostics-plan.js";
import {
  validateAssumptionBoundary,
  ASSUMPTION_VALIDATOR_SCHEMA,
} from "../../receipts/src/assumption-boundary-validator.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..", "..");

const SCHEMA = "bizra.dema.harness_integration.v0.4";

// ASSUMPTION-GATE-1B · the harness's own epistemic posture, declared as a
// canon A-claim (Assumed-with-Iḥsān) and routed through the Law-of-Assumption
// gate on every build — the first live caller of validateAssumptionBoundary.
export const HARNESS_LOA_SELF_DECLARATION = Object.freeze({
  claim_state: "A",
  assumption:
    "This harness preview reflects the repo's current self-proactive, " +
    "self-critique, micro-compliance and micro-consent posture.",
  ground:
    "Aggregated at generated_at from safety-report + diagnostics-plan + " +
    "process-mining previews; no model call, no network.",
  boundary:
    "Does not hold if repo files change after generated_at or a source " +
    "preview is stale; this is a preview, not a runtime gate.",
  rejectable: true,
});

// Routes the self-declaration through the live gate. self_declaration_valid is
// the gate's real output (not a hardcoded flag); surfaces_declaring_vdau is the
// honest count of existing harness sub-surfaces that emit a V/D/A/U envelope —
// currently zero (this is the first), surfaced as self-critique, not hidden.
function buildLawOfAssumptionSurface() {
  const verdict = validateAssumptionBoundary(HARNESS_LOA_SELF_DECLARATION);
  return Object.freeze({
    gate_schema: ASSUMPTION_VALIDATOR_SCHEMA,
    self_declaration_valid: verdict.valid,
    self_declaration_error: verdict.error ?? null,
    surfaces_declaring_vdau: 0,
  });
}

const BEHAVIORAL_PROBES = Object.freeze([
  {
    id: "mission_probe",
    schema: "bizra.dema.mission_probe.v0.1",
    source: "packages/mission/src/mission-probe.js",
    test: "tests/mission-probe.test.js",
  },
  {
    id: "think_probe",
    schema: "bizra.dema.think_probe.v0.1",
    source: "packages/think/src/think-probe.js",
    test: "tests/think-probe.test.js",
  },
  {
    id: "proof_loop_convergence",
    schema: null,
    source: null,
    test: "tests/proof-loop-convergence.test.js",
  },
]);

const HOOK_CHECKS = [
  {
    id: "bash_blacklist",
    event: "PreToolUse",
    matcher: "Bash",
    type: "security",
  },
  {
    id: "consent_enforcer",
    event: "PreToolUse",
    matcher: "Edit|Write|MultiEdit",
    type: "consent",
  },
  {
    id: "tool_call_envelope",
    event: "PreToolUse",
    matcher: "Bash|Edit|Write|MultiEdit",
    type: "provenance",
  },
  {
    id: "output_critique",
    event: "Stop",
    matcher: null,
    type: "quality",
  },
  {
    id: "output_drift_lint",
    event: "Stop",
    matcher: null,
    type: "quality",
  },
  {
    id: "prettier_autoformat",
    event: "PostToolUse",
    matcher: "Write|Edit",
    type: "formatting",
  },
];

function aggregateSelfCritique(
  safetyReport,
  diagnosticsPlan,
  behavioralProbes,
) {
  const safetyGaps = safetyReport.self_critique?.gaps ?? [];
  const diagnosticsGaps = diagnosticsPlan.self_critique?.gaps ?? [];
  const allGaps = [...safetyGaps, ...diagnosticsGaps];

  if (!behavioralProbes.all_present) {
    const missing = behavioralProbes.probes
      .filter((p) => p.status === "missing")
      .map((p) => p.id);
    allGaps.push({
      code: "behavioral_probes_missing",
      severity: "review",
      note: `Required behavioral probe source files are missing: ${missing.join(", ")}`,
      missing,
    });
  }
  const uniqueGaps = [];
  const seen = new Set();
  for (const gap of allGaps) {
    const key = gap.code ?? gap.note ?? JSON.stringify(gap);
    if (!seen.has(key)) {
      seen.add(key);
      uniqueGaps.push(gap);
    }
  }

  return Object.freeze({
    source_count: 3,
    sources: ["safety_report", "diagnostics_plan", "behavioral_probes"],
    confidence: "bounded_preview",
    total_gap_count: uniqueGaps.length,
    severity_counts: Object.freeze(
      uniqueGaps.reduce((acc, g) => {
        const sev = g.severity ?? "unclassified";
        acc[sev] = (acc[sev] || 0) + 1;
        return acc;
      }, {}),
    ),
    gaps: Object.freeze(uniqueGaps.map((g) => Object.freeze({ ...g }))),
    weakest_link: diagnosticsPlan.self_critique?.weakest_link ?? "unknown",
  });
}

function aggregateMicroCompliance(diagnosticsPlan, processMining) {
  const dc = diagnosticsPlan.micro_compliance;
  return Object.freeze({
    preview_only: true,
    deterministic: true,
    diagnostics_boundary_closed: dc.preview_boundary_closed,
    all_effecting_checks_require_consent:
      dc.all_effecting_checks_require_consent,
    no_runtime: dc.no_runtime,
    no_capability_mint: dc.no_capability_mint,
    no_receipt_mint: dc.no_receipt_mint,
    process_mining_acts_on_data:
      processMining.self_critique?.this_preview_acts_on_data === true,
    process_mining_prescribes_action:
      processMining.self_critique?.this_preview_prescribes_action === true,
    no_policy_contradiction: dc.no_policy_contradiction,
  });
}

function aggregateMicroConsent(diagnosticsPlan) {
  const mc = diagnosticsPlan.micro_consent;
  return Object.freeze({
    preview_scope: mc.preview_scope,
    status: mc.status,
    approval_recorded: mc.approval_recorded,
    exact_consent_required: mc.exact_consent_required_for_effecting_checks,
    action_authorized: mc.action_authorized_by_preview,
    broad_consent_allowed: mc.broad_consent_allowed,
  });
}

function aggregateProactiveHarness(diagnosticsPlan) {
  const ph = diagnosticsPlan.proactive_harness;
  const allGatesPass = ph.gates.every((g) => g.pass);
  return Object.freeze({
    mode: ph.mode,
    status: allGatesPass ? "all_gates_pass" : "gates_failing",
    recommended_micro_action: ph.recommended_micro_action,
    gate_count: ph.gates.length,
    gates_passing: ph.gates.filter((g) => g.pass).length,
    gates_failing: ph.gates.filter((g) => !g.pass).length,
    gates: Object.freeze(ph.gates.map((g) => Object.freeze({ ...g }))),
  });
}

// DEMA-HARNESS-INDEPENDENCE-1A. These entries describe Claude Code hooks —
// DEVELOPMENT/HARNESS PLANE, not Dema. This previously emitted `wired: true` as a
// hardcoded literal: the `~/.claude/hooks/*.sh` path was dropped and never
// checked, so a constant wore the costume of a measurement and would have kept
// reporting wired with every hook file deleted. That count reaches Dema's own
// CLEAN verdict line and mission closeout, which made provider state read as Dema
// status.
//
// The fix is NOT to existsSync the hook files. That would make Dema's status a
// function of provider files — the same plane violation, merely made accurate.
// Dema must be able to report CLEAN with no provider installed at all. So the
// inventory declares what it is, states that it measured nothing, and disclaims
// itself as evidence of Dema liveness. The provider path never leaves this module.
function buildHookInventory() {
  return Object.freeze(
    HOOK_CHECKS.map((h) =>
      Object.freeze({
        id: h.id,
        event: h.event,
        matcher: h.matcher,
        type: h.type,
        plane: "harness",
        declared: true,
        measured: false,
        dema_liveness_evidence: false,
      }),
    ),
  );
}

function buildBehavioralProbeAwareness(repoRoot = REPO_ROOT) {
  const probes = BEHAVIORAL_PROBES.map((p) => {
    const sourceExists = p.source ? existsSync(join(repoRoot, p.source)) : null;
    const testExists = existsSync(join(repoRoot, p.test));
    return Object.freeze({
      id: p.id,
      schema: p.schema,
      source_exists: sourceExists,
      test_exists: testExists,
      status:
        (sourceExists === null || sourceExists) && testExists
          ? "present"
          : "missing",
    });
  });

  const allPresent = probes.every((p) => p.status === "present");

  return Object.freeze({
    probe_count: probes.length,
    all_present: allPresent,
    status: allPresent ? "all_probes_present" : "probes_missing",
    note: "sync source-exists check only; probes are async and not executed here",
    probes: Object.freeze(probes),
  });
}

export function buildHarnessIntegration({ now = new Date(), repoRoot } = {}) {
  const safetyReport = buildSafetyReportPreview({ now });
  const diagnosticsPlan = buildDiagnosticsMissionPlan({ now });
  const processMining = buildProcessMiningPreview();

  const microCompliance = aggregateMicroCompliance(
    diagnosticsPlan,
    processMining,
  );
  const microConsent = aggregateMicroConsent(diagnosticsPlan);
  const proactiveHarness = aggregateProactiveHarness(diagnosticsPlan);
  const hookInventory = buildHookInventory();
  const behavioralProbes = buildBehavioralProbeAwareness(repoRoot);
  const selfCritique = aggregateSelfCritique(
    safetyReport,
    diagnosticsPlan,
    behavioralProbes,
  );

  const allGatesPass = proactiveHarness.status === "all_gates_pass";
  const complianceClean =
    microCompliance.diagnostics_boundary_closed &&
    microCompliance.no_policy_contradiction;
  const noBlockerGaps =
    (selfCritique.severity_counts.launch_blocker ?? 0) === 0;
  const probesPresent = behavioralProbes.all_present;

  const verdictInputs = Object.freeze({
    all_gates_pass: allGatesPass,
    compliance_clean: complianceClean,
    no_blocker_gaps: noBlockerGaps,
    behavioral_probes_all_present: probesPresent,
  });

  return Object.freeze({
    schema: SCHEMA,
    generated_at: now.toISOString(),
    mode: "PREVIEW_ONLY",
    verdict:
      allGatesPass && complianceClean && noBlockerGaps && probesPresent
        ? "CLEAN"
        : "REVIEW",
    verdict_inputs: verdictInputs,
    self_proactive_harness: proactiveHarness,
    self_critique: selfCritique,
    micro_compliance: microCompliance,
    micro_consent: microConsent,
    law_of_assumption: buildLawOfAssumptionSurface(),
    behavioral_probes: behavioralProbes,
    hook_inventory: hookInventory,
    boundary: buildPreviewBoundary(),
  });
}

export function buildHarnessIntegrationSummary(options = {}) {
  const full = buildHarnessIntegration(options);
  return Object.freeze({
    schema: "bizra.dema.harness_integration_summary.v0.4",
    verdict: full.verdict,
    law_of_assumption_valid: full.law_of_assumption.self_declaration_valid,
    proactive_status: full.self_proactive_harness.status,
    gates: `${full.self_proactive_harness.gates_passing}/${full.self_proactive_harness.gate_count} passing`,
    critique_gaps: full.self_critique.total_gap_count,
    critique_blockers: full.self_critique.severity_counts.launch_blocker ?? 0,
    compliance_clean:
      full.micro_compliance.diagnostics_boundary_closed &&
      full.micro_compliance.no_policy_contradiction,
    consent_status: full.micro_consent.status,
    probes_present: full.behavioral_probes.all_present,
    probe_count: full.behavioral_probes.probe_count,
    hooks_wired: full.hook_inventory.length,
    boundary: full.boundary,
  });
}

export function formatHarnessIntegration(harness) {
  const lines = [
    "DEMA Harness Integration v0.4",
    "",
    `Verdict: ${harness.verdict}`,
    `Generated: ${harness.generated_at}`,
    "",
    "Verdict Inputs:",
    `  all_gates_pass:                 ${harness.verdict_inputs.all_gates_pass}`,
    `  compliance_clean:               ${harness.verdict_inputs.compliance_clean}`,
    `  no_blocker_gaps:                ${harness.verdict_inputs.no_blocker_gaps}`,
    `  behavioral_probes_all_present:  ${harness.verdict_inputs.behavioral_probes_all_present}`,
    "",
    "Self-Proactive Harness:",
    `  mode: ${harness.self_proactive_harness.mode}`,
    `  status: ${harness.self_proactive_harness.status}`,
    `  gates: ${harness.self_proactive_harness.gates_passing}/${harness.self_proactive_harness.gate_count} passing`,
    `  recommended: ${harness.self_proactive_harness.recommended_micro_action}`,
  ];

  for (const gate of harness.self_proactive_harness.gates) {
    lines.push(`    ${gate.pass ? "PASS" : "FAIL"} ${gate.gate}`);
  }

  lines.push("");
  lines.push("Self-Critique:");
  lines.push(`  confidence: ${harness.self_critique.confidence}`);
  lines.push(
    `  gaps: ${harness.self_critique.total_gap_count} (${JSON.stringify(harness.self_critique.severity_counts)})`,
  );
  lines.push(`  weakest_link: ${harness.self_critique.weakest_link}`);

  lines.push("");
  lines.push("Micro-Compliance:");
  for (const [key, value] of Object.entries(harness.micro_compliance)) {
    lines.push(`  ${key}: ${value}`);
  }

  lines.push("");
  lines.push("Micro-Consent:");
  lines.push(`  scope: ${harness.micro_consent.preview_scope}`);
  lines.push(`  status: ${harness.micro_consent.status}`);
  lines.push(
    `  exact_consent_required: ${harness.micro_consent.exact_consent_required}`,
  );
  lines.push(`  action_authorized: ${harness.micro_consent.action_authorized}`);

  lines.push("");
  lines.push("Behavioral Probes:");
  lines.push(`  status: ${harness.behavioral_probes.status}`);
  lines.push(`  probe_count: ${harness.behavioral_probes.probe_count}`);
  lines.push(`  all_present: ${harness.behavioral_probes.all_present}`);
  for (const probe of harness.behavioral_probes.probes) {
    lines.push(
      `    ${probe.status === "present" ? "PRESENT" : "MISSING"} ${probe.id}${probe.schema ? ` (${probe.schema})` : ""}`,
    );
  }

  lines.push("");
  lines.push("Hook Inventory:");
  for (const hook of harness.hook_inventory) {
    lines.push(
      `  ${hook.type}: ${hook.id} (${hook.event}${hook.matcher ? ` → ${hook.matcher}` : ""})`,
    );
  }

  lines.push("");
  lines.push(
    "Boundary: preview-only; no execution; no mutation; no receipt minted.",
  );

  return lines.join("\n");
}

export function formatHarnessIntegrationSummary(summary) {
  return [
    "DEMA Harness Summary",
    `  Verdict:    ${summary.verdict}`,
    `  Gates:      ${summary.gates}`,
    `  Hooks:      ${summary.hooks_wired} wired`,
    `  Probes:     ${summary.probe_count} (all_present: ${summary.probes_present})`,
    `  Gaps:       ${summary.critique_gaps} (blockers: ${summary.critique_blockers})`,
    "Boundary: preview-only; no execution; no mutation; no receipt minted.",
  ].join("\n");
}

export const HARNESS_HOOK_CHECKS = HOOK_CHECKS;
// Exported so the harness-independence gate can assert the plane labelling
// directly rather than inferring it from a rendered summary string.
export const buildHarnessHookInventory = buildHookInventory;
export const HARNESS_BEHAVIORAL_PROBES = BEHAVIORAL_PROBES;
