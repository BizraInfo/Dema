import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const demaCli = fileURLToPath(new URL("../bin/dema", import.meta.url));
const cliEnv = { ...process.env, NODE_ENV: "test" };

import { runDiffusionCommand } from "../apps/cli/src/commands/diffusion.js";

const NOISY = "Maybe this is the ultimate world-class claim that should work.";
const MID = "This claim is supported by the local kernel evidence.";
const CLEAN = "This claim is supported by the local kernel evidence.";

test("1 · dema-diffusion refine emits bounded human report without generating text", async () => {
  const output = await runDiffusionCommand([
    "refine",
    "--drafts",
    `${NOISY}\n${MID}\n${CLEAN}`,
    "--evidence",
    "tests/diffusion-reasoner.test.js,packages/core/src/diffusion-reasoner.js",
    "--claim-id",
    "diffusion-cli-test",
  ]);
  assert.match(output, /DEMA · DIFFUSION REASONER — BOUNDED CLI/);
  assert.match(output, /status: CONVERGED/);
  assert.match(output, /verify: valid/);
  assert.match(output, /no neural diffusion/);
  assert.match(output, /no model call/);
  assert.match(output, /no file write/);
});

test("2 · refine --json returns the kernel envelope and keeps all boundary flags false", async () => {
  const raw = await runDiffusionCommand([
    "refine",
    "--json",
    "--drafts",
    `${NOISY}\n${CLEAN}`,
    "--evidence",
    "evidence-a",
  ]);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.schema, "bizra.dema.diffusion_reasoner.v0.1");
  assert.equal(parsed.truth_label, "DIFFUSION_REASONER_BOUNDED_KERNEL");
  assert.equal(parsed.neural_diffusion, false);
  assert.equal(parsed.learned_sampling, false);
  for (const [key, value] of Object.entries(parsed.boundary)) {
    assert.equal(value, false, `boundary.${key} must stay false`);
  }
});

test("3 · dema-diffusion verify reads a saved report and returns verifier result", async () => {
  const raw = await runDiffusionCommand([
    "refine",
    "--json",
    "--drafts",
    `${NOISY}\n${CLEAN}`,
    "--evidence",
    "evidence-a",
  ]);
  const dir = await mkdtemp(join(tmpdir(), "dema-diffusion-cli-"));
  const reportPath = join(dir, "report.json");
  await writeFile(reportPath, raw, "utf8");
  const verified = JSON.parse(await runDiffusionCommand(["verify", reportPath, "--json"]));
  assert.equal(verified.valid, true);
  assert.equal(verified.reason_code, "diffusion_refinement_valid");
  assert.equal(verified.convergence_status, "CONVERGED");
});

test("4 · malformed inputs fail closed instead of pretending to converge", async () => {
  const raw = await runDiffusionCommand(["refine", "--json"]);
  const parsed = JSON.parse(raw);
  assert.equal(parsed.valid, false);
  assert.equal(parsed.reason_code, "drafts_empty");
});

test("5 · dema diffusion is a space-subcommand on the single dema binary (no second binary) and runs end-to-end", async () => {
  const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
  assert.equal(pkg.bin.dema, "bin/dema");
  assert.equal(pkg.bin["dema-diffusion"], undefined, "ADR-012: no second binary — diffusion is a `dema diffusion` subcommand");
  // end-to-end through the real dispatcher
  const { stdout } = await execFileAsync(
    "node",
    [demaCli, "diffusion", "refine", "--drafts", "Maybe the ultimate fix\nThe fix is an ESM readFileSync import", "--evidence", "docs/ARCHITECTURE.md", "--json"],
    { env: cliEnv },
  );
  const report = JSON.parse(stdout);
  assert.equal(report.schema, "bizra.dema.diffusion_reasoner.v0.1");
  assert.equal(report.convergence_status, "CONVERGED");
});

test("6 · dema diffusion verify fails closed on a non-absolute path (via the dispatcher)", async () => {
  let code = 0;
  let combined = "";
  try {
    await execFileAsync("node", [demaCli, "diffusion", "verify", "relative/report.json"], { env: cliEnv });
  } catch (e) {
    code = e.code ?? 1;
    combined = `${e.stderr ?? ""}${e.stdout ?? ""}`;
  }
  assert.notEqual(code, 0);
  assert.match(combined, /absolute path|Dema error/i);
});

test("7 · dema diffusion verify EXITS NON-ZERO on an invalid report (fail-closed, not just prints valid:false)", async () => {
  const dir = await mkdtemp(join(tmpdir(), "diffusion-cli-"));
  const file = join(dir, "invalid-report.json");
  await writeFile(file, JSON.stringify({ schema: "not-a-diffusion-report", boundary: {} }));
  let code = 0;
  let stdout = "";
  try {
    const r = await execFileAsync("node", [demaCli, "diffusion", "verify", file], { env: cliEnv });
    stdout = r.stdout;
  } catch (e) {
    code = e.code ?? 1;
    stdout = `${e.stdout ?? ""}`;
  }
  assert.notEqual(code, 0, "invalid report must exit non-zero");
  assert.match(stdout, /"valid": false/);
});
