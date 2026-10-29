import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  OUTSIDER_LOOP_SCHEMA,
  OUTSIDER_LOOP_TRUTH_LABEL,
  runOutsiderFirstRunLoop,
} from "../scripts/proof/outsider-first-run-loop.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/proof/outsider-first-run-loop.mjs", import.meta.url),
);

test("runOutsiderFirstRunLoop completes under reduced PATH policy", () => {
  const report = runOutsiderFirstRunLoop();
  assert.equal(report.schema, OUTSIDER_LOOP_SCHEMA);
  assert.equal(report.truth_label, OUTSIDER_LOOP_TRUTH_LABEL);
  assert.equal(report.ok, true);
  assert.equal(report.boundary.global_dema_required, false);
  assert.equal(report.boundary.operator_home_mutated, false);
  assert.equal(report.boundary.authority_delta, 0);
  assert.equal(report.steps.length, 6);
  assert.ok(
    report.doctor_exit === 0 || report.doctor_exit === 1,
    `doctor exit ${report.doctor_exit}`,
  );
});

test("outsider-first-run-loop.mjs CLI exits 0 and emits schema", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath], {
    encoding: "utf8",
  });
  const report = JSON.parse(stdout);
  assert.equal(report.schema, OUTSIDER_LOOP_SCHEMA);
  assert.equal(report.ok, true);
});
