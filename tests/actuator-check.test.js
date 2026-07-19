import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
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

test("actuator check excludes generated Next.js output", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dema-actuator-next-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "packages", "ui", ".next"), { recursive: true });
  writeFileSync(
    join(root, "packages", "ui", ".next", "bundle.js"),
    'exec("generated framework code");\n',
  );
  writeFileSync(
    join(root, "packages", "ui", "source.js"),
    'export const safe = true;\n',
  );

  const report = buildActuatorCheckReport({ root, scanRoots: ["packages"] });

  assert.equal(report.ok, true);
  assert.deepEqual(report.scanned_files, ["packages/ui/source.js"]);
});

test("actuator check still rejects raw shell execution in TypeScript source", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dema-actuator-ts-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  writeFileSync(
    join(root, "packages", "ui", "unsafe.tsx"),
    'export const run = () => exec("unsafe shell");\n',
  );

  const report = buildActuatorCheckReport({ root, scanRoots: ["packages"] });

  assert.equal(report.ok, false);
  assert.deepEqual(report.scanned_files, ["packages/ui/unsafe.tsx"]);
  assert.equal(report.findings[0]?.label, "child_process.exec_raw_shell");
});

test("actuator check never follows external or cyclic source-tree symlinks", (t) => {
  const root = mkdtempSync(join(tmpdir(), "dema-actuator-link-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  const outside = mkdtempSync(join(tmpdir(), "dema-actuator-private-"));
  t.after(() => rmSync(outside, { recursive: true, force: true }));
  mkdirSync(join(root, "packages", "ui"), { recursive: true });
  writeFileSync(join(outside, "private.js"), 'exec("private shell");\n');
  symlinkSync(outside, join(root, "packages", "ui", "linked-private"));
  symlinkSync(".", join(root, "packages", "ui", "cycle"));

  const report = buildActuatorCheckReport({ root, scanRoots: ["packages"] });

  assert.equal(report.ok, true);
  assert.deepEqual(report.scanned_files, []);
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
