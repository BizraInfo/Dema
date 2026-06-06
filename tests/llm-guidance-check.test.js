import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  buildLlmGuidanceReport,
  formatLlmGuidanceReport,
} from "../scripts/llm-guidance-check.mjs";

const execFileAsync = promisify(execFile);
const scriptPath = fileURLToPath(
  new URL("../scripts/llm-guidance-check.mjs", import.meta.url),
);

test("buildLlmGuidanceReport verifies canonical LLM flow alignment", () => {
  const report = buildLlmGuidanceReport();

  assert.equal(report.schema, "bizra.dema.llm_guidance_check.v0.1");
  assert.equal(report.mode, "READ_ONLY_AUDIT");
  assert.equal(report.ok, true);
  assert.equal(report.boundary.runtime_started, false);
  assert.ok(
    report.checks.some(
      (check) => check.name === "canonical_flow_invariants_present",
    ),
  );
});

test("formatLlmGuidanceReport renders concise human output", () => {
  const output = formatLlmGuidanceReport(buildLlmGuidanceReport());

  assert.match(output, /DEMA LLM Guidance Check/);
  assert.match(output, /Result: PASS/);
  assert.match(output, /Boundary: read-only audit; no runtime; no network/);
});

test("llm-guidance-check script supports --json", async () => {
  const { stdout } = await execFileAsync("node", [scriptPath, "--json"]);
  const report = JSON.parse(stdout);

  assert.equal(report.schema, "bizra.dema.llm_guidance_check.v0.1");
  assert.equal(report.ok, true);
});

test("llm-guidance-check fails when the canonical flow loses required invariants", () => {
  const root = mkdtempSync(join(tmpdir(), "dema-llm-guidance-"));
  try {
    mkdirSync(join(root, "docs", "06-adr"), { recursive: true });

    for (const path of [
      "README.md",
      "docs/ARCHITECTURE.md",
      "docs/ENGINEERING_DISCIPLINE.md",
      "docs/06-adr/ADR-001-dema-is-one-face.md",
      "docs/06-adr/ADR-005-operator-actions-require-explicit-consent.md",
    ]) {
      writeFileSync(join(root, path), "# placeholder\n");
    }

    writeFileSync(join(root, "AGENTS.md"), "[flow](docs/LLM_SYSTEM_FLOW.md)\n");
    writeFileSync(join(root, "CLAUDE.md"), "[flow](docs/LLM_SYSTEM_FLOW.md)\n");
    writeFileSync(
      join(root, "docs", "INDEX.md"),
      "Historical and reference material\n\ndocs/_absorbed\n\nsuperpowers\n\nWorking design artifacts\n",
    );
    writeFileSync(
      join(root, "docs", "LLM_SYSTEM_FLOW.md"),
      "# LLM System Flow Contract\n",
    );

    const report = buildLlmGuidanceReport({ root });

    assert.equal(report.ok, false);
    assert.ok(
      report.checks.some(
        (check) =>
          check.name === "canonical_flow_invariants_present" &&
          check.ok === false,
      ),
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
