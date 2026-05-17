import { test } from "node:test";
import assert from "node:assert/strict";

import { buildNode0StatePreview } from "../packages/core/src/state.js";

test("buildNode0StatePreview emits canonical schema + truth label", () => {
  const state = buildNode0StatePreview();
  assert.equal(state.schema, "bizra.dema.node0_state.v0.1");
  assert.equal(state.truth_label, "NODE0_LOCAL_SEED");
  assert.equal(state.node, "Node0");
  assert.equal(state.mission_centered, true);
});

test("buildNode0StatePreview pins all runtime boundaries to false", () => {
  const { runtime } = buildNode0StatePreview();
  assert.equal(runtime.autonomous_daemon, false);
  assert.equal(runtime.federation, false);
  assert.equal(runtime.minting, false);
  assert.equal(runtime.public_network, false);
});

test("buildNode0StatePreview pins local_models.routing_allowed to false and shared_urp.status to locked_preview", () => {
  const state = buildNode0StatePreview();
  assert.equal(state.local_models.routing_allowed, false);
  assert.equal(state.local_models.role, "bounded_supporting_resource");
  assert.equal(state.shared_urp.status, "locked_preview");
});

test("buildNode0StatePreview declares PAT/SAT ownership split", () => {
  const state = buildNode0StatePreview();
  assert.equal(state.pat.owner, "human");
  assert.equal(state.pat.loyalty, "user_mission");
  assert.equal(state.sat.owner, "system");
  assert.equal(state.sat.loyalty, "system_integrity");
});

test("buildNode0StatePreview boundary object is exhaustively false", () => {
  const { boundary } = buildNode0StatePreview();
  for (const key of Object.keys(boundary)) {
    assert.equal(boundary[key], false, `boundary.${key} must be false`);
  }
});

test("buildNode0StatePreview returns a deeply frozen object", () => {
  const state = buildNode0StatePreview();
  assert.equal(Object.isFrozen(state), true);
  assert.equal(Object.isFrozen(state.runtime), true);
  assert.equal(Object.isFrozen(state.pat), true);
  assert.equal(Object.isFrozen(state.sat), true);
  assert.equal(Object.isFrozen(state.local_models), true);
  assert.equal(Object.isFrozen(state.shared_urp), true);
  assert.equal(Object.isFrozen(state.boundary), true);
});

test("buildNode0StatePreview accepts operator override", () => {
  const state = buildNode0StatePreview({ operator: "TestOperator" });
  assert.equal(state.operator, "TestOperator");
});

test("buildNode0StatePreview defaults operator to MoMo", () => {
  const state = buildNode0StatePreview();
  assert.equal(state.operator, "MoMo");
});
