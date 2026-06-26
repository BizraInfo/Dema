// NODE0-PROOF-SNAPSHOT-ATTACHMENT-1A — pure attachment kernel.
//
// Validates and summarizes a gathered proof:truth ledger for composition into
// killer-demo convergence. Structural attachment may pass while release_verdict
// remains BLOCKED (honest advisory UNKNOWN rails). Preview-only.

import {
  buildNode0ProofOfTruthControlPlane,
  verifyNode0ProofOfTruthControlPlane,
  detectEconomicOverclaim,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA,
  NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL,
} from "./node0-proof-of-truth-control-plane.js";
import { buildPreviewBoundary } from "./preview-boundary.js";

export const NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA =
  "bizra.dema.node0_proof_snapshot_attachment.v0.1";

export const NODE0_PROOF_SNAPSHOT_ATTACHMENT_TRUTH_LABEL =
  "NODE0_PROOF_SNAPSHOT_ATTACHMENT_LOCAL_ONLY";

/** Fixture mirroring default gathered audit (UNKNOWN advisory CI rails). */
export const GATHERED_ADVISORY_SNAPSHOT_INPUT = Object.freeze({
  commit: "gathered-advisory-fixture-commit-001",
  checks: Object.freeze({
    schema: true,
    invariants: true,
    fail_closed: true,
    test: true,
    coverage: true,
    check: true,
    perf: true,
    delivery: true,
    sha256: true,
    codeql: "UNKNOWN",
    gitleaks: "UNKNOWN",
    bizra_review_gate: "UNKNOWN",
    local_operator_seal: "PENDING",
    ci_remote_seal: "PENDING",
  }),
  workflows: Object.freeze({
    ci_matrix: "UNKNOWN",
    local_operator_seal: "PENDING",
    ci_remote_seal: "PENDING",
    codeql: "UNKNOWN",
    gitleaks: "UNKNOWN",
  }),
  coverage: Object.freeze({ present: true, lines: 92.84, threshold: 80 }),
  perf: Object.freeze({
    present: true,
    boot_latency_ms: 120,
    ceiling: 150,
    mode: "A_PLUS_LOCAL_OR_CI_HEADROOM",
  }),
  claims: Object.freeze([]),
  risks: Object.freeze([
    Object.freeze({
      id: "R-GATHERED-001",
      desc: "Gathered fixture — advisory CI rails default UNKNOWN without verified CI evidence attestation",
      severity: "MEDIUM",
      status: "OPEN",
    }),
  ]),
  release_mode: false,
});

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function ledgerFromAuditResult(auditResult) {
  if (auditResult?.ledger && typeof auditResult.ledger === "object") {
    return auditResult.ledger;
  }
  if (auditResult && typeof auditResult === "object" && auditResult.schema) {
    return auditResult;
  }
  return null;
}

function resolveSnapshotSource(auditResult, ledger) {
  if (auditResult?.hermetic === true) return "hermetic";
  if (auditResult?.hermetic === false) return "gathered";
  if (ledger?.commit === "hermetic-control-plane-fixture-commit") return "hermetic";
  return "gathered";
}

export function computeReadyLocalEligible(ledger) {
  const blockers = [];
  if (!ledger || typeof ledger !== "object") {
    blockers.push("ledger_missing");
    return freezeDeep({ eligible: false, blockers: Object.freeze(blockers) });
  }
  if (!ledger.commit || String(ledger.commit).trim() === "") {
    blockers.push("missing_commit");
  }
  if (String(ledger.commit).trim() === "UNKNOWN") {
    blockers.push("commit_unknown_sentinel");
  }
  if (!ledger.receipt_hash || !String(ledger.receipt_hash).startsWith("sha256:")) {
    blockers.push("missing_receipt_hash");
  }
  const boundary = ledger.boundary ?? {};
  if (boundary.local_only !== true) blockers.push("boundary_local_only");
  if (boundary.no_network_required !== true) blockers.push("boundary_no_network_required");
  if (boundary.no_token_mint !== true) blockers.push("boundary_no_token_mint");
  if (boundary.no_wallet_action !== true) blockers.push("boundary_no_wallet_action");
  if (boundary.no_node1_activation !== true) blockers.push("boundary_no_node1_activation");
  if (boundary.no_urp_publication !== true) blockers.push("boundary_no_urp_publication");
  if (boundary.no_autonomous_runtime !== true) blockers.push("boundary_no_autonomous_runtime");
  if (detectEconomicOverclaim(ledger.economic?.active_claims ?? ledger.claims ?? [])) {
    blockers.push("economic_overclaim");
  }
  if (ledger.release_verdict !== "READY_LOCAL") {
    blockers.push("release_verdict_not_ready_local");
  }
  const controlPlaneVerified = verifyNode0ProofOfTruthControlPlane(ledger);
  if (!controlPlaneVerified.ok) {
    blockers.push("control_plane_verify_failed");
  }
  return freezeDeep({
    eligible: blockers.length === 0,
    blockers: Object.freeze(blockers),
  });
}

export function buildNode0ProofSnapshotAttachment({ auditResult } = {}) {
  const ledger = ledgerFromAuditResult(auditResult);
  const snapshot_source = resolveSnapshotSource(auditResult, ledger);
  const control_plane_verified = ledger
    ? verifyNode0ProofOfTruthControlPlane(ledger)
    : Object.freeze({ ok: false, blocked_by: Object.freeze(["ledger_missing"]) });
  const ready = ledger
    ? computeReadyLocalEligible(ledger)
    : Object.freeze({ eligible: false, blockers: Object.freeze(["ledger_missing"]) });

  const ci = ledger?.ci_cd ?? {};
  const attestation = auditResult?.ci_evidence_attestation ?? null;
  return freezeDeep({
    schema: NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA,
    truth_label: NODE0_PROOF_SNAPSHOT_ATTACHMENT_TRUTH_LABEL,
    snapshot_source,
    ci_evidence_attestation: attestation,
    attestation_merged: auditResult?.attestation_merged === true,
    advisory_rails: Object.freeze({
      codeql: ci.codeql ?? "UNKNOWN",
      gitleaks: ci.gitleaks ?? "UNKNOWN",
      ci_matrix: ci.ci_matrix ?? "UNKNOWN",
      ci_cd_status: ci.status ?? "ADVISORY",
      note: "Advisory rails remain UNKNOWN unless a verified CI evidence attestation is merged",
    }),
    ledger,
    ledger_summary: ledger
      ? Object.freeze({
          schema: ledger.schema,
          truth_label: ledger.truth_label,
          commit: ledger.commit,
          release_verdict: ledger.release_verdict,
          receipt_hash: ledger.receipt_hash,
          next_action: ledger.next_action,
        })
      : null,
    ready_local_eligible: ready.eligible,
    ready_local_blockers: ready.blockers,
    control_plane_verified,
    what_this_proves: Object.freeze([
      "A proof:truth ledger snapshot is structurally attached for operator review.",
      "Release verdict and advisory CI rails are reported honestly (READY_LOCAL or BLOCKED).",
    ]),
    what_this_does_not_prove: Object.freeze([
      "Not remote CI seal, public-safe publication, or economic activation.",
      "UNKNOWN advisory rails are not upgraded to PASS without verified CI evidence attestation.",
    ]),
    boundary: buildPreviewBoundary(),
    boundaries: buildPreviewBoundary(),
  });
}

export function verifyNode0ProofSnapshotAttachment(attachment) {
  const blocked_by = [];

  if (!attachment || attachment.schema !== NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA) {
    blocked_by.push("invalid_schema");
    return freezeDeep({ ok: false, blocked_by });
  }
  if (attachment.truth_label !== NODE0_PROOF_SNAPSHOT_ATTACHMENT_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (!attachment.ledger || typeof attachment.ledger !== "object") {
    blocked_by.push("ledger_missing");
  }
  if (!attachment.ledger_summary) {
    blocked_by.push("ledger_summary_missing");
  }
  if (!["gathered", "hermetic"].includes(attachment.snapshot_source)) {
    blocked_by.push("invalid_snapshot_source");
  }

  const ledger = attachment.ledger;
  if (ledger) {
    if (ledger.schema !== NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_SCHEMA) {
      blocked_by.push("ledger_invalid_schema");
    }
    if (ledger.truth_label !== NODE0_PROOF_OF_TRUTH_CONTROL_PLANE_TRUTH_LABEL) {
      blocked_by.push("ledger_invalid_truth_label");
    }
    if (!ledger.commit || String(ledger.commit).trim() === "") {
      blocked_by.push("missing_commit");
    }
    if (String(ledger.commit).trim() === "UNKNOWN") {
      blocked_by.push("commit_unknown_sentinel");
    }
    if (!ledger.receipt_hash || !String(ledger.receipt_hash).startsWith("sha256:")) {
      blocked_by.push("missing_receipt_hash");
    }
    const boundary = ledger.boundary ?? {};
    if (boundary.local_only !== true) blocked_by.push("boundary_local_only");
    if (boundary.no_network_required !== true) blocked_by.push("boundary_no_network_required");
    if (boundary.no_token_mint !== true) blocked_by.push("boundary_no_token_mint");
    if (boundary.no_wallet_action !== true) blocked_by.push("boundary_no_wallet_action");
    if (boundary.no_node1_activation !== true) blocked_by.push("boundary_no_node1_activation");
    if (boundary.no_urp_publication !== true) blocked_by.push("boundary_no_urp_publication");
    if (boundary.no_autonomous_runtime !== true) blocked_by.push("boundary_no_autonomous_runtime");
    if (detectEconomicOverclaim(ledger.economic?.active_claims ?? [])) {
      blocked_by.push("economic_overclaim");
    }
  }

  const previewBoundary = attachment.boundary ?? attachment.boundaries;
  if (!previewBoundary || !Object.values(previewBoundary).every((v) => v === false)) {
    blocked_by.push("attachment_boundary_not_all_false");
  }

  return freezeDeep({ ok: blocked_by.length === 0, blocked_by });
}

export function runNode0ProofSnapshotAttachment({ auditResult } = {}) {
  const attachment = buildNode0ProofSnapshotAttachment({ auditResult });
  const verified = verifyNode0ProofSnapshotAttachment(attachment);
  return freezeDeep({
    ok: verified.ok,
    schema: NODE0_PROOF_SNAPSHOT_ATTACHMENT_SCHEMA,
    truth_label: NODE0_PROOF_SNAPSHOT_ATTACHMENT_TRUTH_LABEL,
    verified,
    ready_local_eligible: attachment.ready_local_eligible,
    release_verdict: attachment.ledger_summary?.release_verdict ?? "BLOCKED",
    attachment,
  });
}

export function buildGatheredAdvisoryAuditResult() {
  const ledger = buildNode0ProofOfTruthControlPlane(GATHERED_ADVISORY_SNAPSHOT_INPUT);
  return freezeDeep({ ledger, hermetic: false, release_mode: false });
}

export function formatNode0ProofSnapshotAttachment(attachment) {
  const summary = attachment.ledger_summary ?? {};
  return [
    "DEMA · Node0 proof snapshot attachment (local-only)",
    `  schema: ${attachment.schema}`,
    `  truth: ${attachment.truth_label}`,
    `  source: ${attachment.snapshot_source}`,
    `  commit: ${summary.commit ?? "UNKNOWN"}`,
    `  release_verdict: ${summary.release_verdict ?? "UNKNOWN"}`,
    `  ready_local_eligible: ${attachment.ready_local_eligible}`,
    `  advisory: codeql=${attachment.advisory_rails?.codeql} gitleaks=${attachment.advisory_rails?.gitleaks}`,
  ].join("\n");
}
