// NODE0-CI-EVIDENCE-ATTESTATION-BRIDGE-1A — pure CI evidence attestation kernel.
//
// Converts structured CI rail evidence into a hashable, fail-closed attestation
// object for proof snapshot attachment. No network; no raw env-as-truth in core.

import { sha256, stableStringify } from "../../consent/src/consent-common.js";
import { buildNode0ProofOfTruthControlPlane } from "./node0-proof-of-truth-control-plane.js";
import { GATHERED_ADVISORY_SNAPSHOT_INPUT } from "./node0-proof-snapshot-attachment.js";

export const NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA =
  "bizra.dema.node0_ci_evidence_attestation.v0.1";

export const NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL =
  "NODE0_CI_EVIDENCE_ATTESTATION_LOCAL_ONLY";

export const CI_EVIDENCE_RAIL_STATUSES = Object.freeze(["PASS", "FAIL", "UNKNOWN"]);

export const CI_EVIDENCE_REQUIRED_RAILS = Object.freeze([
  "ci_matrix",
  "codeql",
  "gitleaks",
]);

export const CI_EVIDENCE_ATTESTATION_OVERCLAIM_VERDICTS = Object.freeze([
  "READY_REMOTE",
  "PUBLIC_SAFE",
]);

/** Attestation fixture with all required rails PASS (commit must match caller). */
export const CI_EVIDENCE_ATTESTATION_PASS_FIXTURE = Object.freeze({
  rails: Object.freeze({
    ci_matrix: "PASS",
    codeql: "PASS",
    gitleaks: "PASS",
  }),
  evidence_source: "ci_export_fixture",
});

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

export function buildCiEvidenceAttestationBoundary() {
  return Object.freeze({
    local_only: true,
    no_network_required: true,
    not_remote_seal: true,
    not_public_safe_claim: true,
  });
}

function normalizeRailStatus(value) {
  if (value === "PASS" || value === "FAIL" || value === "UNKNOWN") return value;
  return null;
}

function normalizeRails(rails = {}) {
  const normalized = {};
  for (const key of CI_EVIDENCE_REQUIRED_RAILS) {
    normalized[key] = normalizeRailStatus(rails[key]) ?? "UNKNOWN";
  }
  return Object.freeze(normalized);
}

function computeAttestationReceiptHash(body) {
  return `sha256:${sha256(stableStringify(body))}`;
}

export function buildNode0CiEvidenceAttestation({
  commit,
  rails = {},
  evidence_source = "operator_supplied_or_ci_exported",
  claimed_release_verdict = null,
} = {}) {
  const normalizedRails = normalizeRails(rails);
  const boundary = buildCiEvidenceAttestationBoundary();
  const body = {
    schema: NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
    truth_label: NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
    commit: commit == null ? "" : String(commit),
    rails: normalizedRails,
    evidence_source: String(evidence_source),
    boundary,
  };
  if (claimed_release_verdict != null) {
    body.claimed_release_verdict = String(claimed_release_verdict);
  }
  const receipt_hash = computeAttestationReceiptHash(body);
  return freezeDeep({ ...body, receipt_hash });
}

export function verifyNode0CiEvidenceAttestation(attestation, { require_pass_rails = false } = {}) {
  const blocked_by = [];

  if (!attestation || attestation.schema !== NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA) {
    blocked_by.push("invalid_schema");
    return freezeDeep({ ok: false, blocked_by });
  }
  if (attestation.truth_label !== NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (!attestation.commit || String(attestation.commit).trim() === "") {
    blocked_by.push("missing_commit");
  }
  if (String(attestation.commit).trim() === "UNKNOWN") {
    blocked_by.push("commit_unknown_sentinel");
  }
  if (!attestation.receipt_hash || !String(attestation.receipt_hash).startsWith("sha256:")) {
    blocked_by.push("missing_receipt_hash");
  }

  const expectedBody = { ...attestation };
  delete expectedBody.receipt_hash;
  const expectedHash = computeAttestationReceiptHash(expectedBody);
  if (attestation.receipt_hash !== expectedHash) {
    blocked_by.push("receipt_hash_mismatch");
  }

  const boundary = attestation.boundary ?? {};
  if (boundary.local_only !== true) blocked_by.push("boundary_local_only");
  if (boundary.no_network_required !== true) blocked_by.push("boundary_no_network_required");
  if (boundary.not_remote_seal !== true) blocked_by.push("boundary_not_remote_seal");
  if (boundary.not_public_safe_claim !== true) blocked_by.push("boundary_not_public_safe_claim");

  if (
    attestation.claimed_release_verdict &&
    CI_EVIDENCE_ATTESTATION_OVERCLAIM_VERDICTS.includes(attestation.claimed_release_verdict)
  ) {
    blocked_by.push("overclaim_release_verdict");
  }

  for (const rail of CI_EVIDENCE_REQUIRED_RAILS) {
    const status = attestation.rails?.[rail];
    if (!CI_EVIDENCE_RAIL_STATUSES.includes(status)) {
      blocked_by.push(`invalid_rail_${rail}`);
    }
    if (require_pass_rails && status !== "PASS") {
      blocked_by.push(`rail_${rail}_not_pass`);
    }
  }

  if (require_pass_rails) {
    for (const rail of CI_EVIDENCE_REQUIRED_RAILS) {
      if (attestation.rails?.[rail] === "UNKNOWN") {
        blocked_by.push(`rail_${rail}_unknown_when_pass_required`);
      }
    }
  }

  return freezeDeep({ ok: blocked_by.length === 0, blocked_by });
}

export function ciEvidenceAttestationReadyForReadyLocal(attestation) {
  return verifyNode0CiEvidenceAttestation(attestation, { require_pass_rails: true });
}

export function mergeCiEvidenceAttestationIntoGatheredInput(baseInput, attestation) {
  const verified = verifyNode0CiEvidenceAttestation(attestation);
  if (!verified.ok) {
    return freezeDeep({ input: baseInput, merged: false, verified });
  }
  if (String(attestation.commit) !== String(baseInput.commit)) {
    return freezeDeep({
      input: baseInput,
      merged: false,
      verified,
      blocked_by: Object.freeze(["commit_mismatch"]),
    });
  }

  const rails = attestation.rails;
  const allPass = CI_EVIDENCE_REQUIRED_RAILS.every((rail) => rails[rail] === "PASS");
  const mergedInput = {
    ...baseInput,
    checks: {
      ...baseInput.checks,
      codeql: rails.codeql,
      gitleaks: rails.gitleaks,
      bizra_review_gate: allPass ? "PASS" : "UNKNOWN",
    },
    workflows: {
      ...baseInput.workflows,
      ci_matrix: rails.ci_matrix,
      codeql: rails.codeql,
      gitleaks: rails.gitleaks,
    },
    risks: [
      ...(Array.isArray(baseInput.risks) ? baseInput.risks : []),
      Object.freeze({
        id: "R-ATTEST-001",
        desc: `CI evidence attestation applied (${attestation.evidence_source})`,
        severity: allPass ? "LOW" : "MEDIUM",
        status: "OPEN",
      }),
    ],
  };

  return freezeDeep({ input: mergedInput, merged: true, verified, attestation });
}

export function buildGatheredAuditResultWithCiEvidenceAttestation(baseInput, attestation) {
  const merge = mergeCiEvidenceAttestationIntoGatheredInput(baseInput, attestation);
  const input = merge.merged ? merge.input : baseInput;
  const ledger = buildNode0ProofOfTruthControlPlane(input);
  return freezeDeep({
    ledger,
    hermetic: false,
    release_mode: false,
    ci_evidence_attestation: attestation,
    attestation_merged: merge.merged === true,
  });
}

export function buildAttestedPassAuditResult(commit) {
  const attestation = buildNode0CiEvidenceAttestation({
    commit,
    ...CI_EVIDENCE_ATTESTATION_PASS_FIXTURE,
  });
  const baseInput = {
    ...GATHERED_ADVISORY_SNAPSHOT_INPUT,
    commit,
    checks: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.checks },
    workflows: { ...GATHERED_ADVISORY_SNAPSHOT_INPUT.workflows },
    risks: [],
  };
  return buildGatheredAuditResultWithCiEvidenceAttestation(baseInput, attestation);
}

export function runNode0CiEvidenceAttestation(params = {}) {
  const attestation = buildNode0CiEvidenceAttestation(params);
  const verified = verifyNode0CiEvidenceAttestation(attestation);
  const readyLocal = ciEvidenceAttestationReadyForReadyLocal(attestation);
  return freezeDeep({
    ok: verified.ok,
    schema: NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
    truth_label: NODE0_CI_EVIDENCE_ATTESTATION_TRUTH_LABEL,
    verified,
    ready_local_rails_eligible: readyLocal.ok,
    attestation,
  });
}

export function formatNode0CiEvidenceAttestation(attestation) {
  return [
    "DEMA · Node0 CI evidence attestation (local-only)",
    `  schema: ${attestation.schema}`,
    `  truth: ${attestation.truth_label}`,
    `  commit: ${attestation.commit}`,
    `  rails: ci_matrix=${attestation.rails?.ci_matrix} codeql=${attestation.rails?.codeql} gitleaks=${attestation.rails?.gitleaks}`,
    `  source: ${attestation.evidence_source}`,
    `  receipt_hash: ${attestation.receipt_hash}`,
  ].join("\n");
}
