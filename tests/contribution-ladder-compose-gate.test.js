import test from "node:test";
import assert from "node:assert/strict";

import {
  composeContributionLadder,
  verifyContributionLadderComposeGate,
  runContributionLadderComposeGate,
  buildContributionLadderFixtureInventory,
  CONTRIBUTION_LADDER_COMPOSE_GATE_SCHEMA,
  CONTRIBUTION_LADDER_COMPOSE_GATE_TRUTH_LABEL,
  CONTRIBUTION_LADDER_STEPS,
  LADDER_FIXTURE_RECORDS,
} from "../packages/core/src/contribution-ladder-compose-gate.js";
import {
  HOMEBASE_ASSET_AWARENESS_SCHEMA,
  HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL,
} from "../packages/core/src/homebase-asset-awareness.js";
import {
  POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA,
  POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL,
} from "../packages/core/src/poi-receipt-eligibility-plan.js";
import { LOCAL_ASSET_INVENTORY_SCHEMA } from "../packages/core/src/local-asset-awareness.js";

test("ladder steps document PR #264–#268 chain", () => {
  assert.equal(CONTRIBUTION_LADDER_STEPS.length, 5);
  assert.deepEqual(
    CONTRIBUTION_LADDER_STEPS.map((s) => s.pr),
    ["#264", "#265", "#266", "#267", "#268"],
  );
});

test("fixture inventory is metadata-only", () => {
  const inventory = buildContributionLadderFixtureInventory();
  assert.equal(inventory.schema, LOCAL_ASSET_INVENTORY_SCHEMA);
  assert.equal(inventory.valid, true);
  assert.equal(inventory.boundary.file_content_read, false);
  assert.equal(inventory.boundary.network_used, false);
  assert.equal(inventory.records.length, LADDER_FIXTURE_RECORDS.length);
});

test("compose chain produces valid awareness through receipt-plan", () => {
  const inventory = buildContributionLadderFixtureInventory();
  const composed = composeContributionLadder({ inventory });

  assert.equal(composed.schema, CONTRIBUTION_LADDER_COMPOSE_GATE_SCHEMA);
  assert.equal(composed.truth_label, CONTRIBUTION_LADDER_COMPOSE_GATE_TRUTH_LABEL);
  assert.equal(composed.awareness.schema, HOMEBASE_ASSET_AWARENESS_SCHEMA);
  assert.equal(composed.awareness.truth_label, HOMEBASE_ASSET_AWARENESS_TRUTH_LABEL);
  assert.equal(composed.receipt_plan.schema, POI_RECEIPT_ELIGIBILITY_PLAN_SCHEMA);
  assert.equal(
    composed.receipt_plan.truth_label,
    POI_RECEIPT_ELIGIBILITY_PLAN_TRUTH_LABEL,
  );
  assert.ok(composed.receipt_plan.resource_receipt_plans.length > 0);
});

test("verify passes on canonical fixture compose", () => {
  const composed = composeContributionLadder({
    inventory: buildContributionLadderFixtureInventory(),
  });
  const verified = verifyContributionLadderComposeGate(composed);
  assert.equal(verified.ok, true, verified.blocked_by.join(", "));
});

test("compose is deterministic for identical fixture input", () => {
  const inventory = buildContributionLadderFixtureInventory();
  const a = composeContributionLadder({ inventory });
  const b = composeContributionLadder({ inventory });
  assert.equal(a.receipt_plan.report_id, b.receipt_plan.report_id);
  assert.equal(a.benefit_preview.report_id, b.benefit_preview.report_id);
});

test("invalid inventory fails closed", () => {
  const composed = composeContributionLadder({
    inventory: { schema: "invalid", records: [] },
  });
  const verified = verifyContributionLadderComposeGate(composed);
  assert.equal(verified.ok, false);
  assert.ok(verified.blocked_by.includes("awareness_not_valid"));
});

test("runContributionLadderComposeGate returns ok on fixture", () => {
  const result = runContributionLadderComposeGate();
  assert.equal(result.ok, true, result.verified.blocked_by.join(", "));
  assert.equal(result.ladder_step_count, 5);
  assert.ok(result.resource_receipt_plan_count > 0);
});

test("review gate helper passes", async () => {
  const { runContributionLadderComposeGateCheck } = await import(
    "../scripts/review/contribution-ladder-compose-gate.mjs"
  );
  const result = runContributionLadderComposeGateCheck();
  assert.equal(result.ok, true, result.verified.blocked_by.join(", "));
});
