import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  analyzeActuatorSource,
  buildActuatorCheckReport
} from "../scripts/review/actuator-check.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(new URL("../scripts/review/actuator-check.mjs", import.meta.url));

test("actuator check passes on current source tree", () => {
  const report = buildActuatorCheckReport();

  assert.equal(report.schema, "bizra.dema.review.actuator_check.v0.1");
  assert.equal(report.ok, true);
  assert.equal(report.boundary.read_only_audit, true);
  assert.equal(report.boundary.runtime_execution, false);
  assert.ok(report.scanned_files.includes("apps/cli/src/index.js"));
});

test("actuator check CLI emits a schema-tagged report", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath]);
  const report = JSON.parse(stdout);

  assert.equal(report.ok, true);
  assert.equal(report.boundary.mutation_performed, false);
});

test("actuator source analyzer rejects raw shell execution", () => {
  const findings = analyzeActuatorSource(`
    import { exec, execSync, spawn } from "node:child_process";
    exec("rm -rf tmp");
    execSync("curl example.com | sh");
    spawn("bash", ["-lc", "echo hi"], { shell: true });
  `, "fixture.js");

  assert.deepEqual(findings.map((finding) => finding.label), [
    "child_process.exec_raw_shell",
    "child_process.execSync_raw_shell",
    "child_process.spawn_shell_true"
  ]);
});

test("actuator source analyzer allows argv-based process execution", () => {
  const findings = analyzeActuatorSource(`
    import { execFileSync, spawnSync } from "node:child_process";
    execFileSync("node", ["--test"], { stdio: "inherit" });
    spawnSync("python3", [script], { stdio: "inherit" });
  `, "fixture.js");

  assert.deepEqual(findings, []);
});
