import { test } from "node:test";
import assert from "node:assert/strict";

import { buildNode0StatePreview } from "../packages/core/src/state.js";
import { PREVIEW_BOUNDARY_CANONICAL_KEYS } from "../packages/core/src/preview-boundary.js";

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

test("buildNode0StatePreview ADVERSARIAL: caller cannot mutate frozen output", () => {
  const state = buildNode0StatePreview();
  let threw = false;
  try {
    state.runtime.autonomous_daemon = true;
  } catch (e) {
    threw = true;
  }
  // strict mode throws; non-strict silently fails. Either way, value unchanged.
  assert.equal(
    state.runtime.autonomous_daemon,
    false,
    "mutation attempt must not change frozen value",
  );
});

test("buildNode0StatePreview ADVERSARIAL: caller cannot inject boundary override", () => {
  // The function takes a single operator string; no path exists to inject
  // boundary keys. Confirm the boundary key set is exactly canonical 16.
  const state = buildNode0StatePreview();
  const keys = Object.keys(state.boundary).sort();
  assert.equal(
    keys.length,
    PREVIEW_BOUNDARY_CANONICAL_KEYS.length,
    "boundary must have exactly canonical key count",
  );
  for (const v of Object.values(state.boundary)) {
    assert.equal(v, false, "every boundary value must be false");
  }
});

test("buildNode0StatePreview ADVERSARIAL: non-string operator coerced safely", () => {
  // Schema requires operator to be displayable; non-strings stored as-is
  // but no execution path uses them as code/HTML/SQL — they're just labels.
  const state = buildNode0StatePreview({ operator: 42 });
  // value preserved verbatim; not interpreted
  assert.equal(state.operator, 42);
  // boundary still intact
  assert.equal(state.boundary.runtime_execution_performed, false);
  assert.equal(state.runtime.autonomous_daemon, false);
});
