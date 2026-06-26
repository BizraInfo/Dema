import test from "node:test";
import assert from "node:assert/strict";

import {
  buildNode0KillerDemoValueLoopCli,
  verifyNode0KillerDemoValueLoopCli,
  runNode0KillerDemoValueLoopCli,
  formatNode0KillerDemoValueLoopCli,
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA,
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL,
  NODE0_KILLER_DEMO_VALUE_LOOP_CLI_COMMAND,
  NODE0_KILLER_DEMO_VALUE_LOOP_DEMO_STAGE,
} from "../packages/core/src/node0-killer-demo-value-loop-cli.js";
import {
  UNSTRUCTURED_FIXTURE_ASSETS,
} from "../packages/core/src/unstructured-asset-awareness.js";
import {
  DEVICE_CONSTELLATION_FIXTURE,
} from "../packages/core/src/multi-device-asset-awareness.js";
import {
  ONTOLOGY_NODE_IDS,
} from "../packages/core/src/dema-home-node-space-ontology.js";

test("CLI envelope has required schema, truth label, command, and demo stage", () => {
  const envelope = buildNode0KillerDemoValueLoopCli();
  assert.equal(envelope.schema, NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA);
  assert.equal(envelope.truth_label, NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL);
  assert.equal(envelope.command, NODE0_KILLER_DEMO_VALUE_LOOP_CLI_COMMAND);
  assert.equal(envelope.demo_stage, NODE0_KILLER_DEMO_VALUE_LOOP_DEMO_STAGE);
});

test("CLI summaries match compose gate fixture dimensions", () => {
  const envelope = buildNode0KillerDemoValueLoopCli();
  assert.equal(
    envelope.unstructured_asset_summary.asset_count,
    UNSTRUCTURED_FIXTURE_ASSETS.length,
  );
  assert.equal(envelope.multi_device_summary.device_count, DEVICE_CONSTELLATION_FIXTURE.length);
  assert.equal(envelope.node_space_summary.ontology_node_count, ONTOLOGY_NODE_IDS.length);
  assert.equal(envelope.value_transformation_candidates.length, 0);
});

test("CLI boundaries are all false", () => {
  const envelope = buildNode0KillerDemoValueLoopCli();
  assert.ok(
    Object.values(envelope.boundaries).every((v) => v === false),
    "boundaries must be all false",
  );
  assert.ok(
    Object.values(envelope.boundary).every((v) => v === false),
    "boundary must be all false",
  );
});

test("verify passes on canonical CLI envelope", () => {
  const result = runNode0KillerDemoValueLoopCli();
  assert.equal(result.ok, true);
  assert.equal(result.verified.ok, true);
});

test("verify fails when value_transformation_candidates is non-empty", () => {
  const envelope = buildNode0KillerDemoValueLoopCli();
  const tampered = {
    ...envelope,
    value_transformation_candidates: ["should-not-run"],
  };
  const verified = verifyNode0KillerDemoValueLoopCli(tampered);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("value_transformation_candidates_must_be_empty"));
});

test("formatNode0KillerDemoValueLoopCli renders human summary", () => {
  const envelope = buildNode0KillerDemoValueLoopCli();
  const text = formatNode0KillerDemoValueLoopCli(envelope);
  assert.match(text, /killer demo value loop/i);
  assert.match(text, /PRE_TOKEN_LOCAL_PROOF|preview-only/i);
});

test("review gate script passes hermetic check", async () => {
  const { runNode0KillerDemoValueLoopCliCheck } = await import(
    "../scripts/review/node0-killer-demo-value-loop-cli-check.mjs"
  );
  const result = runNode0KillerDemoValueLoopCliCheck();
  assert.equal(result.ok, true);
});

test("CLI smoke via apps/cli index", async () => {
  const { execFileSync } = await import("node:child_process");
  const { fileURLToPath } = await import("node:url");
  const { dirname, join } = await import("node:path");
  const repoRoot = dirname(dirname(fileURLToPath(import.meta.url)));
  const out = execFileSync(
    "node",
    ["apps/cli/src/index.js", "demo", "node0-value-loop", "--json"],
    { encoding: "utf8", cwd: repoRoot },
  );
  const parsed = JSON.parse(out);
  assert.equal(parsed.schema, NODE0_KILLER_DEMO_VALUE_LOOP_CLI_SCHEMA);
  assert.equal(parsed.truth_label, NODE0_KILLER_DEMO_VALUE_LOOP_CLI_TRUTH_LABEL);
});
