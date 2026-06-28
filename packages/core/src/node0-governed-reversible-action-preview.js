// NODE0-GOVERNED-REVERSIBLE-ACTION-PREVIEW-1A
//
// Preview-only action-eligibility envelope over APR route refinements. It can
// describe one reversible local action candidate; it does not execute it.

import { createHash } from "node:crypto";

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  buildAasrNode0StateRouterPreview,
} from "./aasr-node0-state-router-preview.js";
import {
  buildAprNode0RouteRefineryPreview,
  verifyAprNode0RouteRefineryPreview,
  APR_NODE0_ROUTE_REFINERY_SCHEMA,
} from "./apr-node0-route-refinery-preview.js";

export const NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_SCHEMA =
  "bizra.node0.governed_reversible_action_preview.v0.1";
export const NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_TRUTH_LABEL =
  "NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_ONLY";
export const NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_STAGE =
  "NODE0_GOVERNED_REVERSIBLE_ACTION_CANDIDATE_PREVIEW";
export const NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE =
  "rename_preview_to_governed_action_candidate";
export const NODE0_GOVERNED_REVERSIBLE_ACTION_HUMAN_GO_PHRASE =
  "GO: preview governed reversible action only";
export const NODE0_BACKUP_MANIFEST_PREVIEW_SCHEMA =
  "bizra.node0.backup_manifest_preview.v0.1";
export const NODE0_UNDO_MANIFEST_PREVIEW_SCHEMA =
  "bizra.node0.undo_manifest_preview.v0.1";
export const NODE0_PRE_EXECUTION_RECEIPT_PREVIEW_SCHEMA =
  "bizra.node0.pre_execution_receipt_preview.v0.1";
export const NODE0_POST_EXECUTION_RECEIPT_REQUIREMENTS_SCHEMA =
  "bizra.node0.post_execution_receipt_requirements.v0.1";

const ALLOWED_PROPOSED_ACTION_KEYS = Object.freeze([
  "action_type",
  "target_resource",
  "operator_intent",
  "execution_requested",
]);

const ALLOWED_TARGET_RESOURCE_KEYS = Object.freeze([
  "resource_id_hash",
  "parent_path_hash",
  "current_name",
  "proposed_name",
  "content_read_required",
]);

const FORBIDDEN_ACTION_TYPES = Object.freeze([
  "delete",
  "delete_file",
  "move",
  "move_file",
  "merge",
  "merge_files",
  "content_read",
  "network",
  "token_mint",
  "wallet",
]);

const FORBIDDEN_ACTION_FRAGMENTS = Object.freeze([
  "delete",
  "deleted",
  "move",
  "moved",
  "merge",
  "merged",
  "content read",
  "read content",
  "network",
  "token",
  "mint",
  "wallet",
  "daemon",
  "autonomous action",
  "execute",
  "executed",
]);

const POST_EXECUTION_RECEIPT_FIELDS = Object.freeze([
  "pre_execution_receipt_hash",
  "operator_go_phrase_hash",
  "action_attempted",
  "action_result",
  "backup_manifest_hash",
  "undo_manifest_hash",
  "post_action_verification_hash",
  "boundary_after_action",
]);

const SHA256_HASH_PATTERN = /^sha256:[0-9a-f]{64}$/;

function freezeDeep(value) {
  if (!value || typeof value !== "object") return value;
  for (const child of Object.values(value)) freezeDeep(child);
  if (!Object.isFrozen(value)) Object.freeze(value);
  return value;
}

function stableStringify(value) {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item) ?? "null").join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.keys(value)
      .sort()
      .flatMap((key) => {
        const serializedValue = stableStringify(value[key]);
        return serializedValue === undefined
          ? []
          : [`${JSON.stringify(key)}:${serializedValue}`];
      });
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function previewHash(payload) {
  return `sha256:${sha256(stableStringify(payload))}`;
}

function defaultRefinedRoutePreview() {
  return buildAprNode0RouteRefineryPreview({
    aasr_route_preview: buildAasrNode0StateRouterPreview({
      consent_proof: { collected: true, mode: "exact_preview" },
    }),
  });
}

function defaultProposedAction() {
  return freezeDeep({
    action_type: NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE,
    target_resource: {
      resource_id_hash: previewHash({
        resource_id: "node0-governed-action-candidate-resource",
      }),
      parent_path_hash: previewHash({
        parent_path: "node0-governed-action-candidate-parent",
      }),
      current_name: "draft-node0-note.txt",
      proposed_name: "governed-draft-node0-note.txt",
      content_read_required: false,
    },
    operator_intent: "Preview whether one local rename could become eligible after backup and undo proofs.",
    execution_requested: false,
  });
}

function defaultBackupManifestPreview(proposedAction = defaultProposedAction()) {
  return freezeDeep({
    schema: NODE0_BACKUP_MANIFEST_PREVIEW_SCHEMA,
    truth_label: "BACKUP_MANIFEST_PREVIEW_ONLY",
    source_resource_id_hash:
      proposedAction?.target_resource?.resource_id_hash ?? "sha256:unknown",
    backup_preview_available: true,
    backup_written: false,
    content_read_performed: false,
    restore_point_written: false,
    blocked_by: Object.freeze([]),
  });
}

function defaultUndoManifestPreview(proposedAction = defaultProposedAction()) {
  return freezeDeep({
    schema: NODE0_UNDO_MANIFEST_PREVIEW_SCHEMA,
    truth_label: "UNDO_MANIFEST_PREVIEW_ONLY",
    action_type: proposedAction?.action_type ?? NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE,
    undo_preview_available: true,
    undo_steps: Object.freeze([
      {
        step: "restore_original_name_preview",
        from_name: proposedAction?.target_resource?.proposed_name ?? null,
        to_name: proposedAction?.target_resource?.current_name ?? null,
        execution_performed: false,
      },
    ]),
    undo_executed: false,
    blocked_by: Object.freeze([]),
  });
}

function actionBoundary() {
  return freezeDeep({
    ...buildPreviewBoundary(),
    scan_executed: false,
    action_execution_performed: false,
    file_mutation_performed: false,
    actual_rename_performed: false,
    move_performed: false,
    merge_performed: false,
    delete_performed: false,
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

function actionBoundaryKeys() {
  return Object.keys(actionBoundary());
}

function boundaryAllFalse(boundary, requiredKeys = null) {
  if (!boundary || typeof boundary !== "object") return false;
  const values = Object.values(boundary);
  if (values.length === 0) return false;
  if (requiredKeys?.some((key) => boundary[key] !== false)) return false;
  return values.every((value) => value === false);
}

function actionBoundaryAllFalse(boundary) {
  return boundaryAllFalse(boundary, actionBoundaryKeys());
}

function refinedRouteId(route) {
  return (
    route?.chained_refinement_block_preview?.block_preview_hash ??
    previewHash({
      schema: route?.schema ?? null,
      truth_label: route?.truth_label ?? null,
      stage: route?.refinery_stage ?? null,
    })
  );
}

function consentState(consentProof) {
  const collected = consentProof?.collected === true;
  const mode = consentProof?.mode ?? null;
  const phrase = consentProof?.phrase ?? null;
  const exactPreviewConsent =
    collected &&
    mode === "exact_preview" &&
    phrase === NODE0_GOVERNED_REVERSIBLE_ACTION_HUMAN_GO_PHRASE;
  const executionAllowed = consentProof?.execution_allowed === true;
  const blocked_by = Object.freeze([
    ...(exactPreviewConsent ? [] : ["exact_preview_consent_missing"]),
    ...(executionAllowed ? ["execution_allowed_true"] : []),
  ]);

  return freezeDeep({
    collected,
    mode,
    phrase_hash: phrase ? previewHash({ phrase }) : null,
    exact_preview_consent: exactPreviewConsent,
    execution_allowed: executionAllowed,
    blocked_by,
  });
}

function manifestBlockedBy(manifest, prefix) {
  const blocked = Array.isArray(manifest?.blocked_by) ? manifest.blocked_by : [];
  return blocked.map((reason) => `${prefix}:${reason}`);
}

function backupReview(backupManifestPreview, proposedAction) {
  const expectedResourceHash =
    proposedAction?.target_resource?.resource_id_hash ?? null;
  const blocked_by = Object.freeze([
    ...manifestBlockedBy(backupManifestPreview, "backup_manifest_blocked"),
    ...(backupManifestPreview?.schema === NODE0_BACKUP_MANIFEST_PREVIEW_SCHEMA
      ? []
      : ["backup_manifest_schema_invalid"]),
    ...(backupManifestPreview?.truth_label === "BACKUP_MANIFEST_PREVIEW_ONLY"
      ? []
      : ["backup_manifest_truth_label_invalid"]),
    ...(SHA256_HASH_PATTERN.test(
      backupManifestPreview?.source_resource_id_hash ?? "",
    )
      ? []
      : ["backup_manifest_resource_hash_invalid"]),
    ...(backupManifestPreview?.source_resource_id_hash === expectedResourceHash
      ? []
      : ["backup_manifest_resource_mismatch"]),
    ...(backupManifestPreview?.backup_preview_available === true
      ? []
      : ["backup_manifest_preview_missing"]),
    ...(backupManifestPreview?.backup_written === false
      ? []
      : ["backup_written_or_unknown"]),
    ...(backupManifestPreview?.restore_point_written === false
      ? []
      : ["restore_point_written_or_unknown"]),
    ...(backupManifestPreview?.content_read_performed === false
      ? []
      : ["backup_content_read_performed"]),
  ]);
  return freezeDeep({
    ok: blocked_by.length === 0,
    blocked_by,
  });
}

function undoReview(undoManifestPreview, proposedAction) {
  const undoSteps = Array.isArray(undoManifestPreview?.undo_steps)
    ? undoManifestPreview.undo_steps
    : [];
  const expectedActionType = proposedAction?.action_type ?? null;
  const expectedFromName = proposedAction?.target_resource?.proposed_name ?? null;
  const expectedToName = proposedAction?.target_resource?.current_name ?? null;
  const hasMatchingUndoStep = undoSteps.some(
    (step) =>
      step?.from_name === expectedFromName &&
      step?.to_name === expectedToName &&
      step?.execution_performed === false,
  );
  const blocked_by = Object.freeze([
    ...manifestBlockedBy(undoManifestPreview, "undo_manifest_blocked"),
    ...(undoManifestPreview?.schema === NODE0_UNDO_MANIFEST_PREVIEW_SCHEMA
      ? []
      : ["undo_manifest_schema_invalid"]),
    ...(undoManifestPreview?.truth_label === "UNDO_MANIFEST_PREVIEW_ONLY"
      ? []
      : ["undo_manifest_truth_label_invalid"]),
    ...(undoManifestPreview?.action_type === expectedActionType
      ? []
      : ["undo_manifest_action_type_mismatch"]),
    ...(undoManifestPreview?.undo_preview_available === true
      ? []
      : ["undo_manifest_preview_missing"]),
    ...(undoManifestPreview?.undo_executed === false
      ? []
      : ["undo_executed_or_unknown"]),
    ...(undoSteps.length > 0 ? [] : ["undo_steps_missing"]),
    ...(hasMatchingUndoStep ? [] : ["undo_steps_do_not_restore_candidate"]),
  ]);
  return freezeDeep({
    ok: blocked_by.length === 0,
    undo_step_count: undoSteps.length,
    blocked_by,
  });
}

function routeReview(refinedRoutePreview) {
  const verification = verifyAprNode0RouteRefineryPreview(refinedRoutePreview);
  const schemaOk = refinedRoutePreview?.schema === APR_NODE0_ROUTE_REFINERY_SCHEMA;
  const safeRecommendation =
    refinedRoutePreview?.safe_next_action_recommendation ===
    "route_refined_for_human_review_only";
  const blocked_by = Object.freeze([
    ...(schemaOk ? [] : ["apr_refinement_required"]),
    ...verification.blocked_by,
    ...(safeRecommendation ? [] : ["apr_route_not_refined_for_human_review"]),
  ]);

  return freezeDeep({
    ok: blocked_by.length === 0,
    schema_ok: schemaOk,
    apr_verified: verification.ok,
    safe_next_action_recommendation:
      refinedRoutePreview?.safe_next_action_recommendation ?? null,
    blocked_by,
  });
}

function routeRefinementEvidence(refinedRoutePreview, route) {
  return freezeDeep({
    schema: refinedRoutePreview?.schema ?? null,
    truth_label: refinedRoutePreview?.truth_label ?? null,
    route_quality_score: refinedRoutePreview?.route_quality_score ?? null,
    safe_next_action_recommendation:
      refinedRoutePreview?.safe_next_action_recommendation ?? null,
    refinement_block_hash:
      refinedRoutePreview?.chained_refinement_block_preview?.block_preview_hash ??
      null,
    apr_verified: route.apr_verified,
    verification_blocked_by: route.blocked_by,
  });
}

function unknownKeys(value, allowed) {
  if (!value || typeof value !== "object") return Object.freeze([]);
  return Object.freeze(
    Object.keys(value).filter((key) => !allowed.includes(key)).sort(),
  );
}

function riskReview({ proposedAction, boundaries }) {
  const actionType = proposedAction?.action_type ?? null;
  const targetResource = proposedAction?.target_resource;
  const actionUnknownKeys = unknownKeys(proposedAction, ALLOWED_PROPOSED_ACTION_KEYS);
  const targetUnknownKeys = unknownKeys(targetResource, ALLOWED_TARGET_RESOURCE_KEYS);
  const serialized = stableStringify(proposedAction ?? {}).toLowerCase();
  const operatorIntent = proposedAction?.operator_intent;
  const operatorIntentOk =
    typeof operatorIntent === "string" && operatorIntent.trim().length > 0;
  const forbiddenFragments = FORBIDDEN_ACTION_FRAGMENTS.filter((fragment) =>
    serialized.includes(fragment),
  );
  const forbiddenType = FORBIDDEN_ACTION_TYPES.includes(actionType);
  const renameCandidateOk =
    actionType === NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE &&
    targetResource &&
    SHA256_HASH_PATTERN.test(targetResource.resource_id_hash) &&
    SHA256_HASH_PATTERN.test(targetResource.parent_path_hash) &&
    typeof targetResource.current_name === "string" &&
    typeof targetResource.proposed_name === "string" &&
    proposedAction?.target_resource?.content_read_required === false &&
    operatorIntentOk &&
    proposedAction?.execution_requested === false &&
    actionUnknownKeys.length === 0 &&
    targetUnknownKeys.length === 0;
  const boundaryOk = actionBoundaryAllFalse(boundaries);
  const blocked_by = Object.freeze([
    ...(renameCandidateOk ? [] : ["unsupported_or_unsafe_action_candidate"]),
    ...(operatorIntentOk ? [] : ["operator_intent_missing_or_invalid"]),
    ...(forbiddenType ? [`forbidden_action_type:${actionType}`] : []),
    ...forbiddenFragments.map((fragment) => `forbidden_action_fragment:${fragment}`),
    ...actionUnknownKeys.map((key) => `unknown_action_key:${key}`),
    ...targetUnknownKeys.map((key) => `unknown_target_resource_key:${key}`),
    ...(boundaryOk ? [] : ["boundary_not_all_false"]),
  ]);

  return freezeDeep({
    ok: blocked_by.length === 0,
    risk_level: blocked_by.length === 0 ? "low" : "blocked",
    supported_action_type: NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE,
    forbidden_action_types: FORBIDDEN_ACTION_TYPES,
    forbidden_fragments: FORBIDDEN_ACTION_FRAGMENTS,
    matched_forbidden_fragments: Object.freeze(forbiddenFragments),
    unknown_action_keys: actionUnknownKeys,
    unknown_target_resource_keys: targetUnknownKeys,
    boundary_ok: boundaryOk,
    blocked_by,
  });
}

function actionEligibility({
  route,
  consent,
  backup,
  undo,
  risk,
  boundaries,
}) {
  const blocked_by = Object.freeze([
    ...new Set([
      ...route.blocked_by,
      ...consent.blocked_by,
      ...backup.blocked_by,
      ...undo.blocked_by,
      ...risk.blocked_by,
      ...(actionBoundaryAllFalse(boundaries) ? [] : ["boundary_not_all_false"]),
    ]),
  ]);
  return freezeDeep({
    eligible_for_human_go_review: blocked_by.length === 0,
    eligible_for_execution: false,
    execution_blocked_by_design: true,
    blocked_by,
  });
}

function preExecutionReceiptPayload({
  inputRefinedRouteId,
  proposedAction,
  consent,
  backupManifestPreview,
  undoManifestPreview,
  risk,
}) {
  return {
    input_refined_route_id: inputRefinedRouteId,
    proposed_action: proposedAction,
    consent_state: consent,
    backup_manifest_preview: backupManifestPreview,
    undo_manifest_preview: undoManifestPreview,
    risk_review: risk,
  };
}

function preExecutionReceiptPreview(payload) {
  return freezeDeep({
    schema: NODE0_PRE_EXECUTION_RECEIPT_PREVIEW_SCHEMA,
    truth_label: "PRE_EXECUTION_RECEIPT_PREVIEW_ONLY",
    receipt_preview_hash: previewHash(payload),
    receipt_written: false,
    action_executed: false,
  });
}

function postExecutionReceiptRequirements() {
  return freezeDeep({
    schema: NODE0_POST_EXECUTION_RECEIPT_REQUIREMENTS_SCHEMA,
    required_fields: POST_EXECUTION_RECEIPT_FIELDS,
    receipt_required_after_any_future_execution: true,
    receipt_written_now: false,
  });
}

function actionBlockPayload({
  previousStateHash,
  inputRefinedRouteId,
  routeRefinementEvidenceReport,
  proposedAction,
  actionEligibilityReport,
  consent,
  backupManifestPreview,
  undoManifestPreview,
  risk,
  preExecutionReceipt,
  postExecutionRequirements,
  policies,
  boundaries,
}) {
  return {
    previous_state_hash: previousStateHash,
    input_refined_route_id: inputRefinedRouteId,
    route_refinement_evidence: routeRefinementEvidenceReport,
    proposed_action: proposedAction,
    action_eligibility: actionEligibilityReport,
    consent_state: consent,
    backup_manifest_preview: backupManifestPreview,
    undo_manifest_preview: undoManifestPreview,
    risk_review: risk,
    pre_execution_receipt_preview: preExecutionReceipt,
    post_execution_receipt_requirements: postExecutionRequirements,
    human_go_phrase_required: NODE0_GOVERNED_REVERSIBLE_ACTION_HUMAN_GO_PHRASE,
    policies,
    boundaries,
  };
}

function chainedActionBlockPreview(payload, previousStateHash) {
  return freezeDeep({
    previous_state_hash: previousStateHash,
    block_preview_hash: previewHash(payload),
    verification_result: "NODE0_GOVERNED_REVERSIBLE_ACTION_BLOCK_HASHED",
    action_executed: false,
    state_written: false,
    undo_executed: false,
  });
}

function verificationResult(blockedBy) {
  return Object.freeze({
    ok: blockedBy.length === 0,
    blocked_by: Object.freeze([...blockedBy]),
  });
}

function expectedActionBlockHash(report) {
  return previewHash(
    actionBlockPayload({
      previousStateHash: report.chained_action_block_preview?.previous_state_hash,
      inputRefinedRouteId: report.input_refined_route_id,
      routeRefinementEvidenceReport: report.route_refinement_evidence,
      proposedAction: report.proposed_action,
      actionEligibilityReport: report.action_eligibility,
      consent: report.consent_state,
      backupManifestPreview: report.backup_manifest_preview,
      undoManifestPreview: report.undo_manifest_preview,
      risk: report.risk_review,
      preExecutionReceipt: report.pre_execution_receipt_preview,
      postExecutionRequirements: report.post_execution_receipt_requirements,
      policies: report.policies,
      boundaries: report.boundaries,
    }),
  );
}

export function buildNode0GovernedReversibleActionPreview({
  refined_route_preview = defaultRefinedRoutePreview(),
  proposed_action = defaultProposedAction(),
  consent_proof = {
    collected: true,
    mode: "exact_preview",
    phrase: NODE0_GOVERNED_REVERSIBLE_ACTION_HUMAN_GO_PHRASE,
  },
  backup_policy = {},
  undo_policy = {},
  execution_policy = {},
  backup_manifest_preview = defaultBackupManifestPreview(proposed_action),
  undo_manifest_preview = defaultUndoManifestPreview(proposed_action),
  previous_state_hash = "sha256:node0-governed-reversible-action-preview-genesis",
  boundary = actionBoundary(),
} = {}) {
  const boundaries = freezeDeep({ ...actionBoundary(), ...boundary });
  const proposedAction = freezeDeep({
    ...defaultProposedAction(),
    ...(proposed_action ?? {}),
  });
  const backupManifestPreview = freezeDeep({
    ...defaultBackupManifestPreview(proposedAction),
    ...(backup_manifest_preview ?? {}),
  });
  const undoManifestPreview = freezeDeep({
    ...defaultUndoManifestPreview(proposedAction),
    ...(undo_manifest_preview ?? {}),
  });
  const input_refined_route_id = refinedRouteId(refined_route_preview);
  const route_review = routeReview(refined_route_preview);
  const route_refinement_evidence = routeRefinementEvidence(
    refined_route_preview,
    route_review,
  );
  const consent_state = consentState(consent_proof);
  const backup_review = backupReview(backupManifestPreview, proposedAction);
  const undo_review = undoReview(undoManifestPreview, proposedAction);
  const risk_review = riskReview({ proposedAction, boundaries });
  const action_eligibility = actionEligibility({
    route: route_review,
    consent: consent_state,
    backup: backup_review,
    undo: undo_review,
    risk: risk_review,
    boundaries,
  });
  const pre_execution_receipt_preview = preExecutionReceiptPreview(
    preExecutionReceiptPayload({
      inputRefinedRouteId: input_refined_route_id,
      proposedAction,
      consent: consent_state,
      backupManifestPreview,
      undoManifestPreview,
      risk: risk_review,
    }),
  );
  const post_execution_receipt_requirements = postExecutionReceiptRequirements();
  const policies = freezeDeep({
    backup_policy,
    undo_policy,
    execution_policy: {
      ...execution_policy,
      execution_allowed_now: false,
    },
  });
  const blockPayload = actionBlockPayload({
    previousStateHash: previous_state_hash,
    inputRefinedRouteId: input_refined_route_id,
    routeRefinementEvidenceReport: route_refinement_evidence,
    proposedAction,
    actionEligibilityReport: action_eligibility,
    consent: consent_state,
    backupManifestPreview,
    undoManifestPreview,
    risk: risk_review,
    preExecutionReceipt: pre_execution_receipt_preview,
    postExecutionRequirements: post_execution_receipt_requirements,
    policies,
    boundaries,
  });
  const chained_action_block_preview = chainedActionBlockPreview(
    blockPayload,
    previous_state_hash,
  );
  const blocked_by = Object.freeze([...action_eligibility.blocked_by]);

  return freezeDeep({
    schema: NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_SCHEMA,
    truth_label: NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_TRUTH_LABEL,
    action_stage: NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_STAGE,
    input_refined_route_id,
    route_refinement_evidence,
    proposed_action: proposedAction,
    action_type: proposedAction.action_type,
    action_eligibility,
    consent_state,
    backup_manifest_preview: backupManifestPreview,
    undo_manifest_preview: undoManifestPreview,
    risk_review,
    pre_execution_receipt_preview,
    post_execution_receipt_requirements,
    human_go_phrase_required: NODE0_GOVERNED_REVERSIBLE_ACTION_HUMAN_GO_PHRASE,
    blocked_by,
    chained_action_block_preview,
    policies,
    boundaries,
    what_this_proves: Object.freeze([
      "Node0 can preview whether one APR-refined route has enough consent, backup, undo, and risk evidence to become a governed reversible action candidate.",
      "The candidate can be content-addressed before execution without mutating files or writing state.",
      "The supported 1A action type is limited to rename_preview_to_governed_action_candidate.",
    ]),
    what_this_does_not_prove: Object.freeze([
      "No rename, move, merge, delete, content read, OCR, embedding, network call, URP write, token mint, wallet access, daemon, runtime, or autonomous action occurred.",
      "This does not prove live governed runtime execution, backup restoration, post-action verification, federation, token economics, or production readiness.",
    ]),
  });
}

export function verifyNode0GovernedReversibleActionPreview(report) {
  const blocked_by = [];

  if (!report || report.schema !== NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_SCHEMA) {
    blocked_by.push("invalid_schema");
    return verificationResult(blocked_by);
  }
  if (report.truth_label !== NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_TRUTH_LABEL) {
    blocked_by.push("invalid_truth_label");
  }
  if (report.action_stage !== NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_STAGE) {
    blocked_by.push("invalid_action_stage");
  }
  if (!/^sha256:/.test(report.input_refined_route_id ?? "")) {
    blocked_by.push("missing_input_refined_route_id");
  }
  if (report.route_refinement_evidence?.schema !== APR_NODE0_ROUTE_REFINERY_SCHEMA) {
    blocked_by.push("apr_refinement_required");
  }
  if (report.route_refinement_evidence?.apr_verified !== true) {
    blocked_by.push("apr_refinement_not_verified");
  }
  if (
    report.route_refinement_evidence?.refinement_block_hash !==
    report.input_refined_route_id
  ) {
    blocked_by.push("input_refined_route_hash_mismatch");
  }
  if (report.action_type !== NODE0_GOVERNED_REVERSIBLE_ACTION_TYPE) {
    blocked_by.push("unsupported_action_type");
  }
  if (report.action_eligibility?.eligible_for_human_go_review !== true) {
    blocked_by.push("action_not_eligible_for_human_go_review");
  }
  if (report.action_eligibility?.eligible_for_execution !== false) {
    blocked_by.push("eligible_for_execution_true");
  }
  if (report.action_eligibility?.execution_blocked_by_design !== true) {
    blocked_by.push("execution_blocked_by_design_missing");
  }
  if (!Array.isArray(report.action_eligibility?.blocked_by)) {
    blocked_by.push("action_eligibility_blocked_by_invalid");
  }
  if (report.consent_state?.exact_preview_consent !== true) {
    blocked_by.push("exact_preview_consent_missing");
  }
  const expectedConsentPhraseHash = previewHash({
    phrase: NODE0_GOVERNED_REVERSIBLE_ACTION_HUMAN_GO_PHRASE,
  });
  if (report.consent_state?.phrase_hash !== expectedConsentPhraseHash) {
    blocked_by.push("exact_preview_consent_phrase_hash_mismatch");
  }
  if (report.consent_state?.execution_allowed !== false) {
    blocked_by.push("execution_allowed_true");
  }
  blocked_by.push(
    ...backupReview(report.backup_manifest_preview, report.proposed_action)
      .blocked_by,
  );
  blocked_by.push(
    ...undoReview(report.undo_manifest_preview, report.proposed_action)
      .blocked_by,
  );
  const expectedRiskReview = riskReview({
    proposedAction: report.proposed_action,
    boundaries: report.boundaries,
  });
  if (
    expectedRiskReview.ok !== true ||
    stableStringify(report.risk_review) !== stableStringify(expectedRiskReview)
  ) {
    blocked_by.push("risk_review_mismatch");
  }
  if (report.pre_execution_receipt_preview?.schema !== NODE0_PRE_EXECUTION_RECEIPT_PREVIEW_SCHEMA) {
    blocked_by.push("pre_execution_receipt_schema_invalid");
  }
  const expectedReceiptHash = previewHash(
    preExecutionReceiptPayload({
      inputRefinedRouteId: report.input_refined_route_id,
      proposedAction: report.proposed_action,
      consent: report.consent_state,
      backupManifestPreview: report.backup_manifest_preview,
      undoManifestPreview: report.undo_manifest_preview,
      risk: report.risk_review,
    }),
  );
  if (!/^sha256:[0-9a-f]{64}$/.test(report.pre_execution_receipt_preview?.receipt_preview_hash ?? "")) {
    blocked_by.push("pre_execution_receipt_hash_missing");
  } else if (
    report.pre_execution_receipt_preview.receipt_preview_hash !== expectedReceiptHash
  ) {
    blocked_by.push("pre_execution_receipt_hash_mismatch");
  }
  if (report.pre_execution_receipt_preview?.receipt_written !== false) {
    blocked_by.push("pre_execution_receipt_written");
  }
  if (report.pre_execution_receipt_preview?.action_executed !== false) {
    blocked_by.push("pre_execution_action_executed");
  }
  if (
    report.post_execution_receipt_requirements?.schema !==
    NODE0_POST_EXECUTION_RECEIPT_REQUIREMENTS_SCHEMA
  ) {
    blocked_by.push("post_execution_receipt_requirements_schema_invalid");
  }
  const requiredPostFields =
    report.post_execution_receipt_requirements?.required_fields;
  if (!Array.isArray(requiredPostFields)) {
    blocked_by.push("post_execution_receipt_required_fields_invalid");
  } else {
    for (const field of POST_EXECUTION_RECEIPT_FIELDS) {
      if (!requiredPostFields.includes(field)) {
        blocked_by.push(`post_execution_receipt_requirement_missing:${field}`);
      }
    }
  }
  if (
    report.post_execution_receipt_requirements
      ?.receipt_required_after_any_future_execution !== true
  ) {
    blocked_by.push("post_execution_receipt_future_requirement_disabled");
  }
  if (report.post_execution_receipt_requirements?.receipt_written_now !== false) {
    blocked_by.push("post_execution_receipt_written_now");
  }
  if (
    report.human_go_phrase_required !==
    NODE0_GOVERNED_REVERSIBLE_ACTION_HUMAN_GO_PHRASE
  ) {
    blocked_by.push("invalid_human_go_phrase");
  }
  if (!actionBoundaryAllFalse(report.boundaries)) {
    blocked_by.push("boundary_not_all_false");
  }
  if (report.policies?.execution_policy?.execution_allowed_now !== false) {
    blocked_by.push("execution_policy_allowed_now_true");
  }
  const blockHash = report.chained_action_block_preview?.block_preview_hash ?? "";
  if (!/^sha256:[0-9a-f]{64}$/.test(blockHash)) {
    blocked_by.push("missing_action_block_hash");
  } else if (blockHash !== expectedActionBlockHash(report)) {
    blocked_by.push("action_block_hash_mismatch");
  }
  if (report.chained_action_block_preview?.action_executed !== false) {
    blocked_by.push("action_executed");
  }
  if (report.chained_action_block_preview?.state_written !== false) {
    blocked_by.push("state_written");
  }
  if (report.chained_action_block_preview?.undo_executed !== false) {
    blocked_by.push("undo_executed");
  }

  return verificationResult([...new Set(blocked_by)]);
}

export function runNode0GovernedReversibleActionPreviewGate() {
  const report = buildNode0GovernedReversibleActionPreview();
  const verified = verifyNode0GovernedReversibleActionPreview(report);
  return freezeDeep({
    ok: verified.ok,
    schema: NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_SCHEMA,
    truth_label: NODE0_GOVERNED_REVERSIBLE_ACTION_PREVIEW_TRUTH_LABEL,
    verified,
    input_refined_route_id: report.input_refined_route_id,
    action_type: report.action_type,
    eligible_for_human_go_review:
      report.action_eligibility.eligible_for_human_go_review,
    eligible_for_execution: report.action_eligibility.eligible_for_execution,
    report,
  });
}
