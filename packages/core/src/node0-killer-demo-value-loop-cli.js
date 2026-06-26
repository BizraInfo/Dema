// NODE0-KILLER-DEMO-VALUE-LOOP-CLI-1A — preview-only CLI envelope for killer demo stack.
//
// Composes the docs-only value-loop gate into a single operator-facing JSON
// surface for `dema demo node0-value-loop --json`. Read-only; no content read,
// OCR, network, upload, wallet, token mint, URP, or Node0 activation.

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  composeNode0KillerDemoValueLoop,
  verifyNode0KillerDemoValueLoopComposeGate,
  NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL,
} from "./node0-killer-demo-value-loop-compose-gate.js";

export const NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA =
  "bizra.dema.node0_killer_demo_value_loop_cli.v0.1";

export const NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL =
  "NODE0_KILLER_DEMO_VALUE_LOOP_CLI_PREVIEW_ONLY";

export const NODE0_KILLER_DEMO_VALUE_LOOP_CLI_COMMAND =
  "dema demo node0-value-loop --json";

export const NODE0_KILLER_DEMO_VALUE_LOOP_DEMO_STAGE = "PRE_TOKEN_LOCAL_PROOF";

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function boundaryAllFalse(boundary) {
  if (!boundary || typeof boundary !== "object") return false;
  return Object.values(boundary).every((v) => v === false);
}

function buildScanModeSummary(scanModes) {
  return freezeDeep({
    schema: scanModes?.schema ?? null,
    truth_label: scanModes?.truth_label ?? null,
    default_mode: scanModes?.default_mode ?? null,
    mode_count: scanModes?.scan_modes?.length ?? 0,
    product_law_default: scanModes?.product_law?.default ?? null,
    preview_only: true,
  });
}

function buildUnstructuredAssetSummary(unstructured) {
  return freezeDeep({
    schema: unstructured?.schema ?? null,
    truth_label: unstructured?.truth_label ?? null,
    asset_count: unstructured?.asset_management_plan?.asset_count ?? 0,
    category_counts: unstructured?.category_counts ?? {},
    sensitivity_classes: unstructured?.sensitivity_classes ?? {},
    duplicate_candidate_count: unstructured?.duplicate_candidates?.length ?? 0,
    preview_only: true,
  });
}

function buildMultiDeviceSummary(multiDevice) {
  return freezeDeep({
    schema: multiDevice?.schema ?? null,
    truth_label: multiDevice?.truth_label ?? null,
    device_count: multiDevice?.devices?.length ?? 0,
    default_scan_mode: multiDevice?.default_scan_mode ?? null,
    cross_device_index_preview: multiDevice?.cross_device_index_plan?.preview_only === true,
    preview_only: true,
  });
}

function buildNodeSpaceSummary(ontology) {
  return freezeDeep({
    schema: ontology?.schema ?? null,
    truth_label: ontology?.truth_label ?? null,
    ontology_node_count: ontology?.ontology_nodes?.length ?? 0,
    invariant_count: ontology?.invariants?.length ?? 0,
    axiom: ontology?.axiom ?? {},
    preview_only: true,
  });
}

function buildOrganizationAndDedupePlan(composed) {
  const unstructured = composed.unstructured_awareness ?? {};
  const multiDevice = composed.multi_device ?? {};
  return freezeDeep({
    unstructured_asset_management: unstructured.asset_management_plan ?? {},
    unstructured_duplicate_candidates: unstructured.duplicate_candidates ?? [],
    cross_device_organization: multiDevice.organization_plan ?? {},
    cross_device_duplicate_resolution: multiDevice.duplicate_resolution_plan ?? {},
    preview_only: true,
  });
}

function buildReceiptProofRequirements(composed) {
  const unstructured = composed.unstructured_awareness?.proof_plan ?? {};
  const multiDevice = composed.multi_device?.proof_receipt_requirements ?? {};
  const ontology = composed.node_space_ontology?.proof_requirements ?? {};
  return freezeDeep({
    unstructured,
    multi_device: multiDevice,
    node_space: ontology,
    preview_only: true,
  });
}

/**
 * @param {object} [params]
 * @param {string} [params.generated_at_iso]
 */
export function buildNode0KillerDemoValueLoopCli({
  generated_at_iso,
} = {}) {
  const composed = composeNode0KillerDemoValueLoop(
    generated_at_iso ? { generated_at_iso } : {},
  );
  const boundary = buildPreviewBoundary();

  return freezeDeep({
    schema: NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA,
    truth_label: NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL,
    command: NODE0_KILLER_DEMO_VALUE_LOOP_CLI_COMMAND,
    demo_stage: NODE0_KILLER_DEMO_VALUE_LOOP_DEMO_STAGE,
    compose_gate_schema: NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA,
    compose_gate_truth_label: NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL,
    node_space_summary: buildNodeSpaceSummary(composed.node_space_ontology),
    scan_mode_summary: buildScanModeSummary(composed.scan_modes),
    unstructured_asset_summary: buildUnstructuredAssetSummary(composed.unstructured_awareness),
    multi_device_summary: buildMultiDeviceSummary(composed.multi_device),
    mobile_resource_value_profile:
      composed.multi_device?.mobile_resource_value_profile ??
      Object.freeze({ high_value: false, high_sensitivity: false }),
    organization_and_dedupe_plan: buildOrganizationAndDedupePlan(composed),
    content_awareness_consent_plan:
      composed.multi_device?.content_awareness_consent_plan ??
      composed.unstructured_awareness?.consent_requirements ??
      Object.freeze({}),
    value_transformation_candidates: Object.freeze([]),
    receipt_proof_requirements: buildReceiptProofRequirements(composed),
    boundaries: boundary,
    boundary,
    what_this_proves: Object.freeze([
      "Dema can present one killer-demo envelope chaining scan modes → unstructured awareness → multi-device constellation → Node Space ontology.",
      "Metadata-first default, scoped consent ladder, and mobile high-value/high-sensitivity posture are truth-labeled previews.",
      "Organization, dedupe, and receipt requirements are plan-only — not executed transforms.",
    ]),
    what_this_does_not_prove: Object.freeze([
      ...composed.what_this_does_not_prove,
      "This CLI command does not read file content, perform OCR, or contact any network.",
      "Empty value_transformation_candidates at CLI layer means no transform was executed.",
      "PRE_TOKEN_LOCAL_PROOF does not mint tokens, access wallets, submit URP, or activate Node0.",
    ]),
    value_loop_summary: composed.value_loop_summary,
    product_law: composed.product_law,
  });
}

export function verifyNode0KillerDemoValueLoopCli(envelope) {
  const blocked_by = [];

  if (!envelope || envelope.schema !== NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA) {
    blocked_by.push("invalid_cli_schema");
    return Object.freeze({ ok: false, blocked_by });
  }
  if (envelope.truth_label !== NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL) {
    blocked_by.push("invalid_cli_truth_label");
  }
  if (envelope.command !== NODE0_KILLER_DEMO_VALUE_LOOP_CLI_COMMAND) {
    blocked_by.push("invalid_cli_command");
  }
  if (envelope.demo_stage !== NODE0_KILLER_DEMO_VALUE_LOOP_DEMO_STAGE) {
    blocked_by.push("invalid_demo_stage");
  }
  if (envelope.compose_gate_schema !== NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA) {
    blocked_by.push("invalid_compose_gate_schema");
  }
  if (envelope.compose_gate_truth_label !== NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL) {
    blocked_by.push("invalid_compose_gate_truth_label");
  }

  const composed = composeNode0KillerDemoValueLoop();
  const composeVerified = verifyNode0KillerDemoValueLoopComposeGate(composed);
  if (!composeVerified.ok) {
    for (const code of composeVerified.blocked_by) {
      blocked_by.push(`compose:${code}`);
    }
  }

  if (!Array.isArray(envelope.value_transformation_candidates)) {
    blocked_by.push("value_transformation_candidates_not_array");
  } else if (envelope.value_transformation_candidates.length !== 0) {
    blocked_by.push("value_transformation_candidates_must_be_empty");
  }

  if (!boundaryAllFalse(envelope.boundaries)) {
    blocked_by.push("boundaries_not_all_false");
  }
  if (!boundaryAllFalse(envelope.boundary)) {
    blocked_by.push("boundary_not_all_false");
  }

  const summary = envelope.value_loop_summary ?? {};
  if (summary.preview_only !== true) {
    blocked_by.push("value_loop_not_preview_only");
  }

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runNode0KillerDemoValueLoopCli(params = {}) {
  const envelope = buildNode0KillerDemoValueLoopCli(params);
  const verified = verifyNode0KillerDemoValueLoopCli(envelope);
  return freezeDeep({
    ok: verified.ok,
    schema: NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA,
    truth_label: NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL,
    verified,
    envelope,
  });
}

export function formatNode0KillerDemoValueLoopCli(envelope) {
  const lines = [
    "DEMA · Node0 killer demo value loop (preview-only)",
    `  schema: ${envelope.schema}`,
    `  truth: ${envelope.truth_label}`,
    `  command: ${envelope.command}`,
    `  demo_stage: ${envelope.demo_stage}`,
    `  scan_modes: ${envelope.scan_mode_summary?.mode_count ?? 0}`,
    `  unstructured_assets: ${envelope.unstructured_asset_summary?.asset_count ?? 0}`,
    `  devices: ${envelope.multi_device_summary?.device_count ?? 0}`,
    `  ontology_nodes: ${envelope.node_space_summary?.ontology_node_count ?? 0}`,
    `  mobile_high_value: ${envelope.mobile_resource_value_profile?.high_value === true}`,
  ];
  return lines.join("\n");
}
