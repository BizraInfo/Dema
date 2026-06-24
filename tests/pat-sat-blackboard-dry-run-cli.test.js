import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { PAT_SAT_BLACKBOARD_DRY_RUN_SCHEMA } from "../packages/core/src/pat-sat-blackboard-dry-run.js";

const BIN = fileURLToPath(new URL("../bin/dema", import.meta.url));

test("dema agent-loop blackboard --json emits a preview-only envelope", () => {
  const out = execFileSync(
    "node",
    [BIN, "agent-loop", "blackboard", "--pain", "x", "--goal", "y", "--json"],
    { encoding: "utf8" },
  );
  const report = JSON.parse(out);
  assert.equal(report.schema, PAT_SAT_BLACKBOARD_DRY_RUN_SCHEMA);
  assert.equal(report.final_state, "QUIESCENT_CONSENT_READY");
  assert.equal(report.boundary.live_coordination_performed, false);
  assert.equal(report.boundary.model_invoked, false);
  assert.ok(Object.values(report.boundary).every((v) => v === false));
});
