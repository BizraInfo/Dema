import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { verifyNode0ActivationLadder } from "../packages/core/src/node0-activation-ladder.js";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

test("dema node0 ladder --json mirrors real on-disk rung presence", () => {
  const out = execFileSync("node", [BIN, "node0", "ladder", "--json"], {
    env: { ...process.env, NO_COLOR: "1", DEMA_NO_TUI: "1" },
    timeout: 20000,
  }).toString();
  const report = JSON.parse(out);

  assert.equal(report.schema, "bizra.dema.node0_activation_ladder.v0.1");
  assert.equal(report.truth_label, "NODE0_ACTIVATION_LADDER_LOCAL_ONLY");

  const byId = Object.fromEntries(report.rungs.map((r) => [r.id, r.status]));
  // All eight preview rungs ship on the current tree.
  for (const id of [
    "observe",
    "benchmark",
    "route",
    "hardware",
    "talk_hint",
    "mission_routing",
    "blackboard",
    "activation_chain",
  ]) {
    assert.equal(byId[id], "SHIPPED", `${id} should be SHIPPED on disk`);
  }
  assert.equal(byId.activate, "GATED_OPERATOR_ONLY");

  // Boundary all-false; nothing executed.
  assert.ok(Object.values(report.boundary).every((v) => v === false));

  // The emitted report verifies against a fresh re-derivation.
  assert.equal(verifyNode0ActivationLadder(report).ok, true);
});
