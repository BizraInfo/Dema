// NODE0-KILLER-DEMO-VALUE-LOOP-COMPOSE-GATE-1A — pure compose gate for killer-demo stack.
//
// Chains docs-only kernels: scan modes → unstructured awareness → multi-device
// constellation → Dema Home Node Space ontology. Read-only fixture compose;
// no content read, no network, no mint, wallet, URP, or Node0 activation.

import { buildPreviewBoundary } from "./preview-boundary.js";
import {
  UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA,
  UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL,
  DEFAULT_SCAN_MODE as SCAN_MODES_DEFAULT,
  buildUnstructuredAssetScanModesPolicy,
  verifyUnstructuredAssetScanModesPolicy,
} from "./unstructured-asset-scan-modes.js";
import {
  UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
  UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
  UNSTRUCTURED_FIXTURE_ASSETS,
  buildUnstructuredAssetAwareness,
  verifyUnstructuredAssetAwareness,
} from "./unstructured-asset-awareness.js";
import {
  MULTI_DEVICE_ASSET_AWARENESS_SCHEMA,
  MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL,
  DEFAULT_SCAN_MODE as MULTI_DEVICE_DEFAULT_SCAN_MODE,
  DEVICE_CONSTELLATION_FIXTURE,
  buildMultiDeviceAssetAwareness,
  verifyMultiDeviceAssetAwareness,
} from "./multi-device-asset-awareness.js";
import {
  DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA,
  DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL,
  ONTOLOGY_NODE_IDS,
  buildDemaHomeNodeSpaceOntology,
  verifyDemaHomeNodeSpaceOntology,
} from "./dema-home-node-space-ontology.js";

export const NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA =
  "bizra.dema.node0_killer_demo_value_loop_compose_gate.v0.1";
export const NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL =
  "NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_DOCS_ONLY";

export const KILLER_DEMO_VALUE_LOOP_STEPS = Object.freeze([
  Object.freeze({ pr: "#279", stage: "scan_modes", kernel: "unstructured-asset-scan-modes" }),
  Object.freeze({ pr: "#280", stage: "unstructured_awareness", kernel: "unstructured-asset-awareness" }),
  Object.freeze({ pr: "#281", stage: "multi_device", kernel: "multi-device-asset-awareness" }),
  Object.freeze({ pr: "#282", stage: "node_space_ontology", kernel: "dema-home-node-space-ontology" }),
]);

export const KILLER_DEMO_FIXTURE_GENERATED_AT = "2026-06-26T19:00:00.000Z";

const ECONOMIC_BOUNDARY_FLAGS = Object.freeze([
  "poi_receipt_minted",
  "token_minted",
  "wallet_accessed",
  "urp_submission_performed",
  "sat_settlement_performed",
  "economic_action_performed",
]);

function freezeDeep(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) freezeDeep(child);
  return value;
}

function boundaryAllFalse(boundary) {
  const canonical = buildPreviewBoundary();
  if (!boundary || typeof boundary !== "object") return false;
  return Object.keys(canonical).every((key) => boundary[key] === false);
}

function collectEconomicViolations(boundary, prefix, blocked_by) {
  for (const flag of ECONOMIC_BOUNDARY_FLAGS) {
    if (boundary?.[flag] === true) {
      blocked_by.push(`${prefix}_economic_boundary_violation:${flag}`);
    }
  }
}

/**
 * @param {object} [params]
 * @param {string} [params.generated_at_iso]
 */
export function composeNode0KillerDemoValueLoop({
  generated_at_iso = KILLER_DEMO_FIXTURE_GENERATED_AT,
} = {}) {
  const scan_modes = buildUnstructuredAssetScanModesPolicy({ generated_at_iso });
  const unstructured_awareness = buildUnstructuredAssetAwareness({ generated_at_iso });
  const multi_device = buildMultiDeviceAssetAwareness({ generated_at_iso });
  const node_space_ontology = buildDemaHomeNodeSpaceOntology({ generated_at_iso });

  return freezeDeep({
    schema: NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA,
    truth_label: NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL,
    value_loop_steps: KILLER_DEMO_VALUE_LOOP_STEPS,
    product_law: Object.freeze({
      default: scan_modes.product_law?.default ?? "metadata awareness",
      deeper_scans: scan_modes.product_law?.full_content_scan ?? "explicit scoped consent",
      share_export: scan_modes.product_law?.sharing_export ?? "separate consent",
      economic_never_implied: scan_modes.product_law?.reward_urp_token ?? "never implied by scanning",
    }),
    scan_modes,
    unstructured_awareness,
    multi_device,
    node_space_ontology,
    value_loop_summary: Object.freeze({
      scan_mode_count: scan_modes.scan_modes?.length ?? 0,
      unstructured_asset_count: UNSTRUCTURED_FIXTURE_ASSETS.length,
      device_count: DEVICE_CONSTELLATION_FIXTURE.length,
      ontology_node_count: ONTOLOGY_NODE_IDS.length,
      default_scan_mode: SCAN_MODES_DEFAULT,
      preview_only: true,
    }),
    what_this_does_not_prove: Object.freeze([
      "This compose gate does not execute scans or activate Node0.",
      "Chaining previews does not imply consent for content read, share, or economic action.",
      "Node Space ontology potential does not imply live runtime or network federation.",
    ]),
    boundary: buildPreviewBoundary(),
  });
}

export function verifyNode0KillerDemoValueLoopComposeGate(composed) {
  const blocked_by = [];

  if (!composed || composed.schema !== NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA) {
    blocked_by.push("invalid_compose_schema");
    return Object.freeze({ ok: false, blocked_by });
  }
  if (composed.truth_label !== NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL) {
    blocked_by.push("invalid_compose_truth_label");
  }

  const subVerifiers = [
    ["scan_modes", verifyUnstructuredAssetScanModesPolicy(composed.scan_modes)],
    ["unstructured_awareness", verifyUnstructuredAssetAwareness(composed.unstructured_awareness)],
    ["multi_device", verifyMultiDeviceAssetAwareness(composed.multi_device)],
    ["node_space_ontology", verifyDemaHomeNodeSpaceOntology(composed.node_space_ontology)],
  ];

  for (const [name, result] of subVerifiers) {
    if (!result?.ok) {
      for (const code of result?.blocked_by ?? ["verify_failed"]) {
        blocked_by.push(`${name}:${code}`);
      }
    }
  }

  const stages = [
    ["scan_modes", composed.scan_modes, UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA, UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL],
    [
      "unstructured_awareness",
      composed.unstructured_awareness,
      UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
      UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
    ],
    [
      "multi_device",
      composed.multi_device,
      MULTI_DEVICE_ASSET_AWARENESS_SCHEMA,
      MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL,
    ],
    [
      "node_space_ontology",
      composed.node_space_ontology,
      DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA,
      DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL,
    ],
  ];

  for (const [name, report, schema, truthLabel] of stages) {
    if (!report || report.schema !== schema) {
      blocked_by.push(`invalid_${name}_schema`);
      continue;
    }
    if (report.truth_label !== truthLabel) {
      blocked_by.push(`invalid_${name}_truth_label`);
    }
    if (report.valid !== true && name !== "scan_modes") {
      blocked_by.push(`${name}_not_valid`);
    }
    if (!boundaryAllFalse(report.boundary)) {
      blocked_by.push(`${name}_boundary_not_all_false`);
    }
    collectEconomicViolations(report.boundary, name, blocked_by);
  }

  if (composed.scan_modes?.default_mode !== SCAN_MODES_DEFAULT) {
    blocked_by.push("scan_modes_default_mismatch");
  }
  if (composed.multi_device?.default_scan_mode !== MULTI_DEVICE_DEFAULT_SCAN_MODE) {
    blocked_by.push("multi_device_default_scan_mode_mismatch");
  }
  if (composed.scan_modes?.default_mode !== composed.multi_device?.default_scan_mode) {
    blocked_by.push("default_scan_mode_not_aligned");
  }

  const summary = composed.value_loop_summary ?? {};
  if (summary.unstructured_asset_count !== UNSTRUCTURED_FIXTURE_ASSETS.length) {
    blocked_by.push("unstructured_asset_count_mismatch");
  }
  if (summary.device_count !== DEVICE_CONSTELLATION_FIXTURE.length) {
    blocked_by.push("device_count_mismatch");
  }
  if (summary.ontology_node_count !== ONTOLOGY_NODE_IDS.length) {
    blocked_by.push("ontology_node_count_mismatch");
  }
  if (summary.preview_only !== true) {
    blocked_by.push("value_loop_not_preview_only");
  }

  if (!boundaryAllFalse(composed.boundary)) {
    blocked_by.push("compose_boundary_not_all_false");
  }
  collectEconomicViolations(composed.boundary, "compose", blocked_by);

  return Object.freeze({ ok: blocked_by.length === 0, blocked_by });
}

export function runNode0KillerDemoValueLoopComposeGate() {
  const composed = composeNode0KillerDemoValueLoop();
  const verified = verifyNode0KillerDemoValueLoopComposeGate(composed);
  return freezeDeep({
    ok: verified.ok,
    schema: NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA,
    truth_label: NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL,
    verified,
    value_loop_step_count: KILLER_DEMO_VALUE_LOOP_STEPS.length,
    value_loop_summary: composed.value_loop_summary,
    composed,
  });
}
