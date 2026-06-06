import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildIntegrationCheckReport,
  extractHelpCommands,
  parseSmokeCommands,
} from "../scripts/review/integration-check.mjs";

test("parseSmokeCommands parses valid smoke command arrays (behavior preserved)", () => {
  const src =
    'rows.add(["status", ["--json", "--no-color"]]); push(["doctor", []]);';
  assert.deepEqual(parseSmokeCommands(src), [
    ["status", ["--json", "--no-color"]],
    ["doctor", []],
  ]);
});

test("parseSmokeCommands resists catastrophic backtracking (ReDoS)", () => {
  // Unterminated array literal that forces the inner quantifier to backtrack.
  // The vulnerable nested-quantifier regex takes >30s at N=20 (exponential,
  // even after JIT warmup); a linear regex returns in well under a millisecond.
  const evil = '["!",[""' + ' ""'.repeat(20);
  const t0 = Date.now();
  const result = parseSmokeCommands(evil);
  const elapsed = Date.now() - t0;
  assert.deepEqual(result, [], "unterminated input must yield no commands");
  assert.ok(elapsed < 1000, `parse took ${elapsed}ms — possible ReDoS`);
});

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/review/integration-check.mjs", import.meta.url),
);

test("integration check passes on current command, docs, smoke, and test matrix wiring", async () => {
  const report = await buildIntegrationCheckReport();

  assert.equal(report.schema, "bizra.dema.review.integration_check.v0.1");
  assert.equal(report.ok, true);
  assert.ok(report.checks.every((check) => check.ok));
  assert.equal(report.boundary.read_only_audit, true);
  assert.equal(report.boundary.runtime_execution, false);
  assert.equal(report.boundary.receipt_minted, false);
});

test("integration check CLI emits a schema-tagged read-only report", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath]);
  const report = JSON.parse(stdout);

  assert.equal(report.ok, true);
  assert.equal(report.boundary.mutation_performed, false);
  assert.equal(report.boundary.ci_modified, false);
});

test("extractHelpCommands derives command names without prose descriptions", () => {
  const source = [
    "const HELP = `Dema CLI",
    "  dema ambient:json Show the ambient boundary as schema-tagged JSON",
    '  dema consent plan [--json] "<intent>"',
    '  dema urp launch-5sat --consent "LAUNCH NODE0 URP WITH 5 SAT ONLY" [--json]',
    '  dema covenant consent <decision.json> --typed-go "GO" [--json]',
    "  dema memory show NAME",
    "`;",
  ].join("\n");

  assert.deepEqual(extractHelpCommands(source), [
    "dema ambient:json",
    "dema consent plan",
    "dema covenant consent",
    "dema memory show",
    "dema urp launch-5sat --consent",
  ]);
});

test("integration check accepts committed code-block architecture command maps", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-integration-code-map-"));
  await mkdir(join(root, "apps", "cli", "src"), { recursive: true });
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(join(root, "tests"), { recursive: true });

  await writeFile(
    join(root, "apps", "cli", "src", "index.js"),
    [
      "const HELP = `Dema CLI",
      "  dema status       Show status",
      "  dema report safety [--json]",
      "`;",
    ].join("\n"),
  );
  await writeFile(
    join(root, "scripts", "check.mjs"),
    'export const commands = [["node", ["apps/cli/src/index.js", "status"]]];\n',
  );
  await writeFile(
    join(root, "docs", "ARCHITECTURE.md"),
    [
      "```text",
      "dema status",
      "  reads status",
      "",
      "dema report safety / dema report safety --json",
      "  previews safety",
      "```",
    ].join("\n"),
  );
  await writeFile(
    join(root, "docs", "TESTING.md"),
    [
      "| Test file | Surface covered |",
      "|---|---|",
      "| `tests/example.test.js` | Example. |",
      "",
      "node apps/cli/src/index.js status",
    ].join("\n"),
  );
  await writeFile(
    join(root, "tests", "example.test.js"),
    "import test from 'node:test';\n",
  );

  const report = await buildIntegrationCheckReport({ root });

  assert.equal(report.ok, true);
});

test("integration check rejects command-map drift in a fixture repo", async () => {
  const root = await mkdtemp(join(tmpdir(), "dema-integration-check-"));
  await mkdir(join(root, "apps", "cli", "src"), { recursive: true });
  await mkdir(join(root, "docs"), { recursive: true });
  await mkdir(join(root, "scripts"), { recursive: true });
  await mkdir(join(root, "tests"), { recursive: true });

  await writeFile(
    join(root, "apps", "cli", "src", "index.js"),
    [
      "const HELP = `Dema CLI",
      "  dema status       Show status",
      "  dema report safety [--json]",
      "`;",
    ].join("\n"),
  );
  await writeFile(
    join(root, "scripts", "check.mjs"),
    'export const commands = [["node", ["apps/cli/src/index.js", "status"]]];\n',
  );
  await writeFile(
    join(root, "docs", "ARCHITECTURE.md"),
    [
      "| Command | Primary surface | Effect boundary |",
      "|---|---|---|",
      "| `dema status` | status | read-only |",
    ].join("\n"),
  );
  await writeFile(
    join(root, "docs", "TESTING.md"),
    [
      "| Test file | Surface covered |",
      "|---|---|",
      "| `tests/example.test.js` | Example. |",
      "",
      "node apps/cli/src/index.js status",
    ].join("\n"),
  );
  await writeFile(
    join(root, "tests", "example.test.js"),
    "import test from 'node:test';\n",
  );

  const report = await buildIntegrationCheckReport({ root });

  assert.equal(report.ok, false);
  assert.ok(
    report.checks.some(
      (check) =>
        check.name === "help_commands_in_architecture_map" &&
        check.missing.includes("dema report safety"),
    ),
  );
});
