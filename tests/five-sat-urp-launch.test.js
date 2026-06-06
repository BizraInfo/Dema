/**
 * URP-5SAT-1A tests (PROTOTYPE)
 *
 * Tests the Node0 5 SAT URP launch/lock declaration.
 * [PROTOTYPE] — Matches the completion of BIZRA URP launch with only Node0 5 SAT, locked against PAT/Dema/Momo.
 */

import test from "node:test";
import assert from "node:assert/strict";
import {
  buildNode05SatU rpLaunch,
  verifyNode05SatU rpLaunch,
  NODE0_5SAT_URP_LAUNCH_RESULT_SCHEMA,
} from "../packages/urp/src/five-sat-urp-launch.js";

test("buildNode05SatU rpLaunch declares exactly 5 SAT, active, locked", () => {
  const result = buildNode05SatU rpLaunch();
  assert.equal(result.schema, NODE0_5SAT_URP_LAUNCH_RESULT_SCHEMA);
  assert.equal(result.launched, true);
  assert.equal(result.locked, true);
  assert.equal(result.active_sat_count, 5);
  assert.deepEqual(result.body.active_sat, [
    "Guardian",
    "Reasoner",
    "Builder",
    "Critic",
    "Archivist",
  ]);
  assert.equal(result.body.always_active, true);
  assert.deepEqual(result.body.manipulators_blocked, ["PAT", "Dema", "Momo"]);
  assert.ok(result.launch_hash.startsWith("sha256:"));
});

test("verifyNode05SatU rpLaunch succeeds on valid launch result", () => {
  const built = buildNode05SatU rpLaunch();
  const verified = verifyNode05SatU rpLaunch(built);
  assert.equal(verified.verified, true);
  assert.equal(verified.active_sat.length, 5);
  assert.equal(verified.locked, true);
  assert.ok(verified.connection_rules);
  assert.equal(verified.connection_rules.node0_connects_to_network_via_its_urp, true);
  assert.equal(verified.connection_rules.node1_connects_to_bizra_universal_resource_pool, true);
  assert.equal(verified.connection_rules.node1_declares_new_5_sat, "preview_only_not_minted_in_dema");
});

test("buildNode15SatPreview for Node1 new 5 SAT via universal pool", () => {
  const preview = buildNode15SatPreview();
  assert.equal(preview.schema, "bizra.dema.node1_5sat_preview_result.v0.1");
  assert.equal(preview.preview, true);
  assert.equal(preview.body.connects_to, "bizra_universal_resource_pool");
  assert.equal(preview.body.mint, "preview_only_not_minted_in_dema");
  assert.deepEqual(preview.body.new_5_sat, [
    "Guardian",
    "Reasoner",
    "Builder",
    "Critic",
    "Archivist",
  ]);
});