// NODE0-CI-VENDOR-AVAILABILITY-1A — classify vendor CI availability (billing lock lane).
//
// Pure compose: merges FDE dual-diagnostic billing-lock class into proof:truth
// workflows so UNKNOWN ci_matrix does not fail the empirical rail when code is
// not implicated. PREVIEW_ONLY — does not unlock remote merge policy alone.

import { diagnoseDemaFailure, verifyDemaFdeDualDiagnostic } from "./dema-fde-dual-diagnostic.js";

export const NODE0_CI_VENDOR_AVAILABILITY_SCHEMA =
  "bizra.dema.ci_vendor_availability_marker.v0.1";

export const NODE0_CI_VENDOR_AVAILABILITY_TRUTH_LABEL =
  "NODE0_CI_VENDOR_AVAILABILITY_LOCAL_ONLY";

export const CI_VENDOR_AVAILABILITY_STATES = Object.freeze([
  "AVAILABLE",
  "GITHUB_ACTIONS_BILLING_LOCK",
  "UNKNOWN",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  for (const child of Object.values(value)) freezeDeep(child);
  return Object.freeze(value);
}

export function buildCiVendorAvailabilityMarker({
  fde_report,
  operator_declared = false,
} = {}) {
  if (!fde_report || fde_report.failure_class !== "github_actions_billing_lock") {
    return freezeDeep({
      schema: NODE0_CI_VENDOR_AVAILABILITY_SCHEMA,
      truth_label: NODE0_CI_VENDOR_AVAILABILITY_TRUTH_LABEL,
      availability: "UNKNOWN",
      code_implicated: null,
      local_proof_lane: false,
      fde_diagnostic_hash: fde_report?.diagnostic_hash ?? null,
      operator_declared: operator_declared === true,
      blocked_by: Object.freeze(["not_billing_lock_classification"]),
    });
  }
  const verified = verifyDemaFdeDualDiagnostic(fde_report);
  if (!verified.ok) {
    return freezeDeep({
      schema: NODE0_CI_VENDOR_AVAILABILITY_SCHEMA,
      truth_label: NODE0_CI_VENDOR_AVAILABILITY_TRUTH_LABEL,
      availability: "UNKNOWN",
      code_implicated: null,
      local_proof_lane: false,
      fde_diagnostic_hash: fde_report.diagnostic_hash ?? null,
      operator_declared: operator_declared === true,
      blocked_by: Object.freeze(verified.blocked_by),
    });
  }
  return freezeDeep({
    schema: NODE0_CI_VENDOR_AVAILABILITY_SCHEMA,
    truth_label: NODE0_CI_VENDOR_AVAILABILITY_TRUTH_LABEL,
    availability: "GITHUB_ACTIONS_BILLING_LOCK",
    code_implicated: false,
    local_proof_lane: true,
    fde_diagnostic_hash: fde_report.diagnostic_hash,
    operator_declared: operator_declared === true,
    operator_action_required: fde_report.operator_action_required ?? "billing_unlock",
    blocked_by: Object.freeze([]),
  });
}

export function mergeCiVendorAvailabilityIntoWorkflows(workflows = {}, marker) {
  const base = workflows && typeof workflows === "object" ? { ...workflows } : {};
  if (
    !marker ||
    marker.availability !== "GITHUB_ACTIONS_BILLING_LOCK" ||
    marker.local_proof_lane !== true ||
    (marker.blocked_by && marker.blocked_by.length > 0)
  ) {
    return freezeDeep({
      merged: false,
      workflows: freezeDeep(base),
      blocked_by: Object.freeze(
        marker?.blocked_by?.length ? [...marker.blocked_by] : ["marker_not_eligible"],
      ),
    });
  }
  return freezeDeep({
    merged: true,
    workflows: freezeDeep({
      ...base,
      ci_vendor_availability: "GITHUB_ACTIONS_BILLING_LOCK",
      ci_matrix: base.ci_matrix === "PASS" ? "PASS" : "VENDOR_LOCK",
      ci_remote_seal: base.ci_remote_seal ?? "PENDING",
    }),
    blocked_by: Object.freeze([]),
  });
}

export function defaultGithubActionsBillingLockFdeFixture() {
  return freezeDeep({
    failed_command: "gh pr checks 312",
    exit_code: 1,
    stdout_excerpt: "jobs: steps=[], runner_id=0, duration 1-2s, log not found",
    stderr_excerpt:
      "The job was not started because your account is locked due to a billing issue.",
    changed_files: [],
    environment: {
      node_version: "22.x",
      os: "linux",
      branch: "feat/node0-spine-runner-cli-1a",
      ci_provider: "github_actions",
      runner_assigned: false,
      runner_id: 0,
    },
    capability_registry_row: "NODE0_CI_VENDOR_AVAILABILITY_1A",
  });
}

export function buildDefaultCiVendorAvailabilityMarker() {
  const fde_report = diagnoseDemaFailure(defaultGithubActionsBillingLockFdeFixture());
  return buildCiVendorAvailabilityMarker({ fde_report, operator_declared: true });
}

export function isLocalProofLaneActive(workflows = {}) {
  return workflows.ci_vendor_availability === "GITHUB_ACTIONS_BILLING_LOCK";
}
