function workflowAuthorizationLabel(workflow) {
  if (workflow.worktree_changes_authorized) return "explicit";
  if (workflow.worktree_changes.length > 0) return "required";
  return "not_required";
}

export function formatReleaseReadinessReport(report) {
  const lines = [
    "DEMA Release Readiness",
    "",
    `Mode: ${report.mode}`,
    `Readiness score: ${report.readiness_score}/100`,
    "",
    "Management BoK:",
    `  domains: ${report.management_bok.domains.join(", ")}`,
    `  rule: ${report.management_bok.operating_rule}`,
    "",
    "CI/CD:",
    `  workflow: ${report.ci.workflow.path}`,
    `  node matrix: ${report.ci.matrix.join(", ")}`,
    `  cd status: ${report.pipeline.cd_status}`,
    `  maturity: ${report.ci_cd_maturity.current_level.id} (${report.ci_cd_maturity.current_level.label})`,
    `  workflow worktree: ${report.ci.workflow.worktree_changes.length > 0 ? "dirty" : "clean"}`,
    `  workflow authorization: ${workflowAuthorizationLabel(report.ci.workflow)}`,
  ];

  if (report.ci.workflow.worktree_changes.length > 0) {
    lines.push("Workflow worktree changes:");
    for (const change of report.ci.workflow.worktree_changes) {
      lines.push(`  - ${change.status} ${change.path}`);
    }
  }

  lines.push("");
  lines.push("Quality gates:");
  for (const gate of report.pipeline.gates) {
    lines.push(`  - ${gate.command}`);
  }

  lines.push("");
  lines.push("Performance QA:");
  lines.push(`  ${report.performance_qa.posture}`);
  for (const mechanism of report.performance_qa.mechanisms) {
    lines.push(`  - ${mechanism.status}: ${mechanism.id}`);
  }
  lines.push("");
  lines.push("World-class gate posture:");
  lines.push(`  ${report.world_class_quality_gates.posture}`);
  for (const gate of report.world_class_quality_gates.gates) {
    lines.push(
      `  - ${gate.currently_enforced ? "observed" : "advisory"}: ${gate.id}`,
    );
  }
  lines.push("");
  lines.push("Rollout / rollback:");
  lines.push(`  rollout: ${report.rollout_rollback.posture}`);
  lines.push(`  rollback: ${report.rollout_rollback.rollback.strategy}`);
  lines.push("");
  lines.push("Traceability evidence:");
  lines.push(`  scope: ${report.traceability.evidence_scope}`);
  lines.push(`  files: ${report.traceability.observed_files.length}`);
  lines.push("");
  lines.push("Installer artifacts:");
  for (const artifact of report.installer_artifacts.required) {
    lines.push(
      `  - ${artifact.exists ? "present" : "missing"}: ${artifact.path}`,
    );
  }
  lines.push(
    `  capabilities: ${report.installer_artifacts.capabilities.join(", ") || "none"}`,
  );

  lines.push("");
  lines.push("Risks:");
  for (const risk of report.risks) {
    lines.push(`  - ${risk.severity}: ${risk.code} - ${risk.note}`);
  }

  lines.push("");
  lines.push("Next actions:");
  for (const action of report.next_actions) lines.push(`  - ${action}`);
  lines.push("");
  lines.push("Boundary: read-only audit; no deployment; no secrets accessed.");

  return lines.join("\n");
}
