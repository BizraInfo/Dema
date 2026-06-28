// AASR-FILE-ACTION-AND-RESOURCE-STATE-ROUTER-PREVIEW-1A
//
// Preview-only state router over File Steward receipt atoms and Node0
// multi-device resource manifests. It routes state; it does not execute state.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import { buildDemaNodeSpaceBondingFileSteward } from "./dema-node-space-bonding-file-steward.js";
import { buildNode0MultiDeviceUrpResourceManifestPreview } from "./node0-multi-device-urp-resource-manifest-preview.js";

export const AASR_NODE0_STATE_ROUTER_SCHEMA =
  "bizra.node0.aasr_state_router_preview.v0.1";
export const AASR_NODE0_STATE_ROUTER_TRUTH_LABEL =
  "AASR_NODE0_STATE_ROUTER_PREVIEW_ONLY";
export const AASR_NODE0_ROUTER_STAGE =
  "AASR_NODE0_FILE_AND_RESOURCE_STATE_ROUTING_PREVIEW";

const DEFAULT_SNR_WEIGHTS = Object.freeze({
  evidence: 0.4,
  consent: 0.25,
  compliance: 0.25,
  boundary: 0.1,
});

const DEFAULT_PAT_SAT_REFS = Object.freeze([
  "PAT:file_action_preview_atom",
  "SAT:node0_resource_manifest_preview",
]);

const DEFAULT_COMPLIANCE_POLICY = Object.freeze({
  forbidden_claim_fragments: Object.freeze([
    "executed",
    "renamed",
    "moved",
    "merged",
    "deleted",
    "content read",
    "token minted",
    "wallet accessed",
    "urp submitted",
    "daemon started",
    "autonomous action performed",
  ]),
  required_truth_label: AASR_NODE0_STATE_ROUTER_TRUTH_LABEL,
});

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function previewHash(payload) {
  return `sha256:${sha256(stableStringify(payload))}`;
}

function aasrBoundary() {
  return freezeDeep({
    ...buildPreviewBoundary(),
    scan_executed: false,
    file_mutation_performed: false,
    file_content_read: false,
    ocr_performed: false,
    embedding_generated: false,
    network_used: false,
    urp_write_performed: false,
    token_minted: false,
    wallet_accessed: false,
    transfer_performed: false,
    daemon_started: false,
    model_invocation_performed: false,
    autonomous_action_performed: false,
  });
}

function defaultFileActionReceiptPreview() {
  const steward = buildDemaNodeSpaceBondingFileSteward();
  return steward.file_action_receipt_previews[0];
}

function defaultResourceManifestPreview() {
  return buildNode0MultiDeviceUrpResourceManifestPreview();
}

function normalizeClaim(incomingClaim) {
  return String(incomingClaim ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

function detectArtifactType(fileAction, resourceManifest) {
  if (fileAction && resourceManifest) return "file_action_and_resource_manifest";
  if (fileAction) return "file_action_receipt_preview";
  if (resourceManifest) return "resource_manifest_preview";
  return "none";
}

function buildConsentState(consentProof) {
  const collected = consentProof?.collected === true;
  return freezeDeep({
    collected,
    mode: consentProof?.mode ?? "preview_only",
    exact_consent_required: true,
    execution_allowed: false,
    state_transition_preview_allowed: true,
    blocked_by: Object.freeze(collected ? [] : ["consent_missing_for_state_transition"]),
  });
}

function buildComplianceState(normalizedClaim, compliancePolicy) {
  const fragments = compliancePolicy?.forbidden_claim_fragments ?? [];
  const violations = fragments.filter((fragment) =>
    normalizedClaim.includes(String(fragment).toLowerCase()),
  );
  return freezeDeep({
    policy: compliancePolicy ?? DEFAULT_COMPLIANCE_POLICY,
    ok: violations.length === 0,
    violations: Object.freeze(violations),
    blocked_by: Object.freeze(
      violations.map((fragment) => `forbidden_claim_fragment:${fragment}`),
    ),
  });
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  return Object.values(boundary).every((value) => value === false);
}

function buildSnrDecision({
  fileAction,
  resourceManifest,
  consentState,
  complianceState,
  boundaries,
  snrWeights,
}) {
  const weights = { ...DEFAULT_SNR_WEIGHTS, ...(snrWeights ?? {}) };
  const evidencePresent = Boolean(fileAction || resourceManifest);
  const boundaryOk = boundaryAllFalse(boundaries);
  const score =
    (evidencePresent ? weights.evidence : 0) +
    (consentState.collected ? weights.consent : 0) +
    (complianceState.ok ? weights.compliance : 0) +
    (boundaryOk ? weights.boundary : 0);
  return freezeDeep({
    weights,
    score: Number(score.toFixed(4)),
    threshold: 0.85,
    signal: evidencePresent ? "preview_artifacts_present" : "missing_preview_artifact",
    noise: Object.freeze([
      ...(consentState.collected ? [] : ["missing_exact_consent"]),
      ...(complianceState.ok ? [] : ["compliance_violation"]),
      ...(boundaryOk ? [] : ["boundary_crossed"]),
    ]),
    decision: score >= 0.85 ? "ROUTE_SIGNAL_ACCEPTED" : "ROUTE_SIGNAL_BLOCKED",
  });
}

function buildFileActionTransition(fileAction) {
  if (!fileAction) return freezeDeep({ present: false, transition: "NO_FILE_ACTION_INPUT" });
  return freezeDeep({
    present: true,
    source_receipt_preview_id: fileAction.receipt_preview_id,
    action_id: fileAction.action_id,
    action_type: fileAction.action_type,
    transition: "FILE_ACTION_PREVIEW_ROUTED_NO_EXECUTION",
    mutation_performed: false,
  });
}

function buildResourceTransition(resourceManifest) {
  if (!resourceManifest) {
    return freezeDeep({ present: false, transition: "NO_RESOURCE_MANIFEST_INPUT" });
  }
  return freezeDeep({
    present: true,
    source_schema: resourceManifest.schema,
    source_truth_label: resourceManifest.truth_label,
    device_count: resourceManifest.device_count,
    resource_count: resourceManifest.unified_node_space_summary?.resource_count ?? 0,
    transition: "RESOURCE_MANIFEST_PREVIEW_ROUTED_NO_URP_WRITE",
    urp_write_performed: false,
  });
}

function buildPatSatRoute(patSatRefs, artifactType) {
  return freezeDeep({
    refs: Object.freeze([...(patSatRefs ?? DEFAULT_PAT_SAT_REFS)]),
    artifact_type: artifactType,
    route_status: "preview_reference_only",
    pat_executed: false,
    sat_executed: false,
  });
}

function buildStateBlock({
  previousStateHash,
  normalizedClaim,
  artifactType,
  fileTransition,
  resourceTransition,
  snrDecision,
  consentState,
  complianceState,
  boundaries,
}) {
  const block = {
    previous_state_hash: previousStateHash,
    normalized_claim: normalizedClaim,
    artifact_type: artifactType,
    file_action_id: fileTransition.action_id ?? null,
    resource_schema: resourceTransition.source_schema ?? null,
    snr_decision: snrDecision.decision,
    consent_collected: consentState.collected,
    compliance_ok: complianceState.ok,
    boundaries,
  };
  return freezeDeep({
    previous_state_hash: previousStateHash,
    block_preview_hash: previewHash(block),
    verification_result: "PREVIEW_ROUTER_STATE_BLOCK_HASHED",
    state_written: false,
  });
}

function buildAprRecommendation({ consentState, complianceState, snrDecision }) {
  const recommendation = !complianceState.ok
    ? "reduce_claim_to_preview_safe_language"
    : !consentState.collected
      ? "collect_exact_preview_consent_before_execution_surface"
      : snrDecision.decision === "ROUTE_SIGNAL_ACCEPTED"
        ? "ready_for_apr_preview_refinement"
        : "increase_evidence_or_reduce_scope";
  return freezeDeep({
    recommendation,
    model_invoked: false,
    apr_executed: false,
    preview_only: true,
  });
}

function finalVerdict(blockedBy, snrDecision) {
  if (blockedBy.length > 0) return "AASR_PREVIEW_BLOCKED";
  return snrDecision.decision === "ROUTE_SIGNAL_ACCEPTED"
    ? "AASR_PREVIEW_ROUTE_READY"
    : "AASR_PREVIEW_ROUTE_NOT_READY";
}

export function buildAasrNode0StateRouterPreview({
  incoming_claim = "Route Node0 file and resource preview state.",
  file_action_receipt_preview = defaultFileActionReceiptPreview(),
  resource_manifest_preview = defaultResourceManifestPreview(),
  snr_weights = DEFAULT_SNR_WEIGHTS,
  pat_sat_refs = DEFAULT_PAT_SAT_REFS,
  consent_proof = Object.freeze({ collected: false, mode: "preview_only" }),
  compliance_policy = DEFAULT_COMPLIANCE_POLICY,
  previous_state_hash = "sha256:aasr-preview-genesis",
  boundary = aasrBoundary(),
} = {}) {
  const boundaries = freezeDeep({ ...aasrBoundary(), ...boundary });
  const normalized_claim = normalizeClaim(incoming_claim);
  const routed_artifact_type = detectArtifactType(
    file_action_receipt_preview,
    resource_manifest_preview,
  );
  const consent_state = buildConsentState(consent_proof);
  const compliance_state = buildComplianceState(normalized_claim, compliance_policy);
  const snr_decision = buildSnrDecision({
    fileAction: file_action_receipt_preview,
    resourceManifest: resource_manifest_preview,
    consentState: consent_state,
    complianceState: compliance_state,
    boundaries,
    snrWeights: snr_weights,
  });
  const file_action_state_transition_preview = buildFileActionTransition(
    file_action_receipt_preview,
  );
  const resource_state_transition_preview = buildResourceTransition(
    resource_manifest_preview,
  );
  const blocked_by = Object.freeze([
    ...consent_state.blocked_by,
    ...compliance_state.blocked_by,
    ...(boundaryAllFalse(boundaries) ? [] : ["boundary_not_all_false"]),
    ...(routed_artifact_type === "none" ? ["no_preview_artifact_to_route"] : []),
  ]);
  const chained_state_block_preview = buildStateBlock({
    previousStateHash: previous_state_hash,
    normalizedClaim: normalized_claim,
    artifactType: routed_artifact_type,
    fileTransition: file_action_state_transition_preview,
    resourceTransition: resource_state_transition_preview,
    snrDecision: snr_decision,
    consentState: consent_state,
    complianceState: compliance_state,
    boundaries,
  });
  const apr_refinement_recommendation = buildAprRecommendation({
    consentState: consent_state,
    complianceState: compliance_state,
    snrDecision: snr_decision,
  });

  return freezeDeep({
    schema: AASR_NODE0_STATE_ROUTER_SCHEMA,
    truth_label: AASR_NODE0_STATE_ROUTER_TRUTH_LABEL,
    router_stage: AASR_NODE0_ROUTER_STAGE,
    incoming_claim,
    normalized_claim,
    routed_artifact_type,
    snr_decision,
    pat_sat_route: buildPatSatRoute(pat_sat_refs, routed_artifact_type),
    consent_state,
    compliance_state,
    resource_state_transition_preview,
    file_action_state_transition_preview,
    chained_state_block_preview,
    apr_refinement_recommendation,
    final_router_verdict: finalVerdict(blocked_by, snr_decision),
    blocked_by,
    boundaries,
    what_this_proves: Object.freeze([
      "AASR can route File Steward receipt previews and Node0 resource manifest previews as state-block candidates.",
      "The router can separate signal, consent, compliance, PAT/SAT references, and preview-only state transitions.",
      "Missing consent or compliance violations block execution while preserving a reviewable preview.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "AASR did not execute a file action, scan, model call, URP write, token mint, wallet action, transfer, daemon, or autonomous act.",
      "AASR did not prove live APR, RSI, reward, federation, or runtime autonomy.",
    ]),
  });
}

export function verifyAasrNode0StateRouterPreview(report) {
  const blocked_by = [];

  if (!report || report.schema !== AASR_NODE0_STATE_ROUTER_SCHEMA) {
    blocked_by.push("invalid_schema");
    return Object.freeze({ ok: false, blocked_by });
  }
  if (report.truth_label !== AASR_NODE0_STATE_ROUTER_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (report.router_stage !== AASR_NODE0_ROUTER_STAGE) {
    blocked_by.push("invalid_router_stage");
  }
  if (!boundaryAllFalse(report.boundaries)) {
    blocked_by.push("boundary_not_all_false");
  }
  if (!report.normalized_claim) {
    blocked_by.push("missing_normalized_claim");
  }
  if (!report.snr_decision?.decision) {
    blocked_by.push("missing_snr_decision");
  }
  if (report.pat_sat_route?.pat_executed !== false) {
    blocked_by.push("pat_execution_not_false");
  }
  if (report.pat_sat_route?.sat_executed !== false) {
    blocked_by.push("sat_execution_not_false");
  }
  if (report.consent_state?.execution_allowed !== false) {
    blocked_by.push("execution_allowed");
  }
  if (report.file_action_state_transition_preview?.mutation_performed === true) {
    blocked_by.push("file_mutation_performed");
  }
  if (report.resource_state_transition_preview?.urp_write_performed === true) {
    blocked_by.push("urp_write_performed");
  }
  if (!/^sha256:/.test(report.chained_state_block_preview?.block_preview_hash ?? "")) {
    blocked_by.push("missing_state_block_hash");
  }
  if (report.chained_state_block_preview?.state_written !== false) {
    blocked_by.push("state_written");
  }
  if (report.apr_refinement_recommendation?.model_invoked !== false) {
    blocked_by.push("apr_model_invoked");
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runAasrNode0StateRouterPreviewGate() {
  const report = buildAasrNode0StateRouterPreview();
  const verified = verifyAasrNode0StateRouterPreview(report);
  return freezeDeep({
    ok: verified.ok,
    schema: AASR_NODE0_STATE_ROUTER_SCHEMA,
    truth_label: AASR_NODE0_STATE_ROUTER_TRUTH_LABEL,
    verified,
    final_router_verdict: report.final_router_verdict,
    routed_artifact_type: report.routed_artifact_type,
    report,
  });
}
