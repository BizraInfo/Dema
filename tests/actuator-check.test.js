import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  analyzeActuatorSource,
  analyzeEffectCapInvariantSource,
  buildActuatorCheckReport,
} from "../scripts/review/actuator-check.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/review/actuator-check.mjs", import.meta.url),
);

test("actuator check passes on current source tree", () => {
  const report = buildActuatorCheckReport();

  assert.equal(report.schema, "bizra.dema.review.actuator_check.v0.1");
  assert.equal(report.ok, true);
  assert.equal(report.boundary.read_only_audit, true);
  assert.equal(report.boundary.runtime_execution, false);
  assert.ok(report.scanned_files.includes("apps/cli/src/index.js"));
  assert.ok(
    report.scanned_files.includes(
      "packages/dema-ui/tests/operation-correspondence-routes.test.mjs",
    ),
  );
  assert.ok(
    report.scanned_files.includes(
      "packages/dema-ui/tests/trusted-requirement.test.mjs",
    ),
  );
});

test("actuator check still scans unrelated directories named tests", () => {
  const root = mkdtempSync(join(tmpdir(), "dema-actuator-check-"));
  const sourcePath = "packages/example/tests/fixture.js";
  try {
    const absolutePath = join(root, sourcePath);
    mkdirSync(join(root, "packages/example/tests"), { recursive: true });
    writeFileSync(absolutePath, "export const fixture = true;\n");

    const report = buildActuatorCheckReport({
      root,
      scanRoots: ["packages"],
    });

    assert.deepEqual(report.scanned_files, [sourcePath]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("test-path Function helpers do not fail actuator; exec in tests still fails", () => {
  const root = mkdtempSync(join(tmpdir(), "dema-actuator-check-"));
  try {
    mkdirSync(join(root, "packages/demo/tests"), { recursive: true });
    mkdirSync(join(root, "packages/demo/src"), { recursive: true });
    writeFileSync(
      join(root, "packages/demo/tests/helper.mjs"),
      'const handler = new Function("x", "return x");\n',
    );
    writeFileSync(
      join(root, "packages/demo/src/prod.js"),
      'const handler = new Function("x", "return x");\n',
    );

    const cleanTests = buildActuatorCheckReport({
      root,
      scanRoots: ["packages/demo/tests"],
    });
    assert.equal(cleanTests.ok, true);

    const dirtyProd = buildActuatorCheckReport({
      root,
      scanRoots: ["packages/demo/src"],
    });
    assert.equal(dirtyProd.ok, false);
    assert.ok(
      dirtyProd.findings.some((f) => f.label === "policy.executable_rule_code"),
    );

    writeFileSync(
      join(root, "packages/demo/tests/shell.mjs"),
      'import { exec } from "node:child_process";\nexec("echo hi");\n',
    );
    const dirtyTests = buildActuatorCheckReport({
      root,
      scanRoots: ["packages/demo/tests"],
    });
    assert.equal(dirtyTests.ok, false);
    assert.ok(
      dirtyTests.findings.some((f) => f.label === "child_process.exec_raw_shell"),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("actuator check CLI emits a schema-tagged report", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath]);
  const report = JSON.parse(stdout);

  assert.equal(report.ok, true);
  assert.equal(report.boundary.mutation_performed, false);
});

test("actuator source analyzer rejects raw shell execution", () => {
  const findings = analyzeActuatorSource(
    `
    import { exec, execSync, spawn } from "node:child_process";
    exec("rm -rf tmp");
    execSync("curl example.com | sh");
    spawn("bash", ["-lc", "echo hi"], { shell: true });
  `,
    "fixture.js",
  );

  assert.deepEqual(
    findings.map((finding) => finding.label),
    [
      "child_process.exec_raw_shell",
      "child_process.execSync_raw_shell",
      "child_process.spawn_shell_true",
    ],
  );
});

test("actuator source analyzer allows argv-based process execution", () => {
  const findings = analyzeActuatorSource(
    `
    import { execFileSync, spawnSync } from "node:child_process";
    execFileSync("node", ["--test"], { stdio: "inherit" });
    spawnSync("python3", [script], { stdio: "inherit" });
  `,
    "fixture.js",
  );

  assert.deepEqual(findings, []);
});

test("effectcap invariant analyzer rejects caller-provided execution closures", () => {
  const findings = analyzeEffectCapInvariantSource(
    `
    effectingOperation(cap, "file:notes", "read", exec);
    EffectCap.perform(intent, exec);
    perform(intent, () => writeFileSync("x", "y"));
  `,
    "fixture.js",
  );

  assert.deepEqual(
    findings.map((finding) => finding.label),
    [
      "effectcap.caller_exec_closure",
      "effectcap.caller_exec_closure",
      "effectcap.caller_exec_closure",
    ],
  );
});

test("effectcap invariant analyzer rejects executable policy code", () => {
  const findings = analyzeEffectCapInvariantSource(
    `
    const bad = eval(rule.condition);
    const alsoBad = Function("mission", rule.condition);
  `,
    "fixture.js",
  );

  assert.deepEqual(
    findings.map((finding) => finding.label),
    ["policy.executable_rule_code", "policy.executable_rule_code"],
  );
});
