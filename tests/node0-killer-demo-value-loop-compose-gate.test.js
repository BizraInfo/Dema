import test from "node:test";
import assert from "node:assert/strict";

import {
  composeNode0KillerDemoValueLoop,
  verifyNode0KillerDemoValueLoopComposeGate,
  runNode0KillerDemoValueLoopComposeGate,
  NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL,
  KILLER_DEMO_VALUE_LOOP_STEPS,
} from "../packages/core/src/node0-killer-demo-value-loop-compose-gate.js";
import {
  UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA,
  UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL,
  DEFAULT_SCAN_MODE,
} from "../packages/core/src/unstructured-asset-scan-modes.js";
import {
  UNSTRUCTURED_ASSET_AWARENESS_SCHEMA,
  UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
  UNSTRUCTURED_FIXTURE_ASSETS,
} from "../packages/core/src/unstructured-asset-awareness.js";
import {
  MULTI_DEVICE_ASSET_AWARENESS_SCHEMA,
  MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL,
  DEVICE_CONSTELLATION_FIXTURE,
} from "../packages/core/src/multi-device-asset-awareness.js";
import {
  DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA,
  DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL,
  ONTOLOGY_NODE_IDS,
} from "../packages/core/src/dema-home-node-space-ontology.js";

test("value loop steps document PR #279–#282 chain", () => {
  assert.equal(KILLER_DEMO_VALUE_LOOP_STEPS.length, 4);
  assert.deepEqual(
    KILLER_DEMO_VALUE_LOOP_STEPS.map((s) => s.pr),
    ["#279", "#280", "#281", "#282"],
  );
});

test("compose chains scan modes through node space ontology", () => {
  const composed = composeNode0KillerDemoValueLoop();

  assert.equal(composed.schema, NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_SCHEMA);
  assert.equal(composed.truth_label, NODE0_KILLER_DEMO_VALUE_LOOP_COMPOSE_GATE_TRUTH_LABEL);
  assert.equal(composed.scan_modes.schema, UNSTRUCTURED_ASSET_SCAN_MODES_SCHEMA);
  assert.equal(composed.scan_modes.truth_label, UNSTRUCTURED_ASSET_SCAN_MODES_TRUTH_LABEL);
  assert.equal(composed.unstructured_awareness.schema, UNSTRUCTURED_ASSET_AWARENESS_SCHEMA);
  assert.equal(
    composed.unstructured_awareness.truth_label,
    UNSTRUCTURED_ASSET_AWARENESS_TRUTH_LABEL,
  );
  assert.equal(composed.multi_device.schema, MULTI_DEVICE_ASSET_AWARENESS_SCHEMA);
  assert.equal(composed.multi_device.truth_label, MULTI_DEVICE_ASSET_AWARENESS_TRUTH_LABEL);
  assert.equal(composed.node_space_ontology.schema, DEMA_HOME_NODE_SPACE_ONTOLOGY_SCHEMA);
  assert.equal(
    composed.node_space_ontology.truth_label,
    DEMA_HOME_NODE_SPACE_ONTOLOGY_TRUTH_LABEL,
  );
});

test("default scan modes align across compose stack", () => {
  const composed = composeNode0KillerDemoValueLoop();
  assert.equal(composed.scan_modes.default_mode, DEFAULT_SCAN_MODE);
  assert.equal(composed.multi_device.default_scan_mode, DEFAULT_SCAN_MODE);
  assert.equal(composed.value_loop_summary.default_scan_mode, DEFAULT_SCAN_MODE);
});

test("value loop summary matches fixture dimensions", () => {
  const composed = composeNode0KillerDemoValueLoop();
  assert.equal(composed.value_loop_summary.unstructured_asset_count, UNSTRUCTURED_FIXTURE_ASSETS.length);
  assert.equal(composed.value_loop_summary.device_count, DEVICE_CONSTELLATION_FIXTURE.length);
  assert.equal(composed.value_loop_summary.ontology_node_count, ONTOLOGY_NODE_IDS.length);
  assert.equal(composed.value_loop_summary.preview_only, true);
});

test("product law preserves metadata default and separate share consent", () => {
  const composed = composeNode0KillerDemoValueLoop();
  assert.match(composed.product_law.default, /metadata/i);
  assert.match(composed.product_law.share_export, /separate consent/i);
  assert.match(composed.product_law.economic_never_implied, /never implied/i);
});

test("verify passes on canonical compose", () => {
  const composed = composeNode0KillerDemoValueLoop();
  const verified = verifyNode0KillerDemoValueLoopComposeGate(composed);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
});

test("compose is deterministic for identical input", () => {
  const a = composeNode0KillerDemoValueLoop();
  const b = composeNode0KillerDemoValueLoop();
  assert.equal(
    a.unstructured_awareness.report_id,
    b.unstructured_awareness.report_id,
  );
  assert.equal(a.multi_device.report_id, b.multi_device.report_id);
  assert.equal(a.node_space_ontology.ontology_id, b.node_space_ontology.ontology_id);
});

test("tampered compose fails closed", () => {
  const composed = composeNode0KillerDemoValueLoop();
  const tampered = {
    ...composed,
    multi_device: {
      ...composed.multi_device,
      default_scan_mode: "content_classification_consent",
    },
  };
  const verified = verifyNode0KillerDemoValueLoopComposeGate(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.some((c) => c.includes("default_scan_mode")));
});

test("runNode0KillerDemoValueLoopComposeGate returns ok", () => {
  const result = runNode0KillerDemoValueLoopComposeGate();
  assert.equal(result.ok, true, result.verified.blocked_by.join(", "));
  assert.equal(result.value_loop_step_count, 4);
});

test("review gate helper passes", async () => {
  const { runNode0KillerDemoValueLoopComposeGateCheck } = await import(
    "../scripts/review/node0-killer-demo-value-loop-compose-gate.mjs"
  );
  const result = runNode0KillerDemoValueLoopComposeGateCheck();
  assert.equal(result.ok, true, result.verified.blocked_by.join(", "));
});
