import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  buildHarnessIntegrationSummary,
  formatHarnessIntegrationSummary,
} from "../packages/core/src/harness-integration.js";
import { execFileSync } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";

const FIXED_NOW = new Date("2026-05-25T12:00:00Z");
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

describe("formatHarnessIntegrationSummary", () => {
  it("returns a string", () => {
    const summary = buildHarnessIntegrationSummary({ now: FIXED_NOW });
    const formatted = formatHarnessIntegrationSummary(summary);
    assert.ok(typeof formatted === "string");
  });

  it("contains DEMA Harness Summary header", () => {
    const summary = buildHarnessIntegrationSummary({ now: FIXED_NOW });
    const formatted = formatHarnessIntegrationSummary(summary);
    assert.ok(formatted.includes("DEMA Harness Summary"));
  });

  it("contains verdict", () => {
    const summary = buildHarnessIntegrationSummary({ now: FIXED_NOW });
    const formatted = formatHarnessIntegrationSummary(summary);
    assert.ok(
      formatted.includes("CLEAN") || formatted.includes("REVIEW"),
      "formatted summary must contain verdict value",
    );
    assert.ok(formatted.includes(summary.verdict));
  });

  it("contains pass/total (gates fraction)", () => {
    const summary = buildHarnessIntegrationSummary({ now: FIXED_NOW });
    const formatted = formatHarnessIntegrationSummary(summary);
    // gates field is e.g. "3/3 passing"
    assert.ok(
      formatted.includes(summary.gates),
      `formatted summary must include gates fraction "${summary.gates}"`,
    );
  });

  it("contains hook count", () => {
    const summary = buildHarnessIntegrationSummary({ now: FIXED_NOW });
    const formatted = formatHarnessIntegrationSummary(summary);
    assert.ok(
      formatted.includes(String(summary.hooks_wired)),
      "formatted summary must include hooks_wired count",
    );
  });

  it("is compact — fewer lines than the full formatHarnessIntegration output", () => {
    // The full formatter has 40+ lines; summary should be ≤10
    const summary = buildHarnessIntegrationSummary({ now: FIXED_NOW });
    const formatted = formatHarnessIntegrationSummary(summary);
    const lineCount = formatted.split("\n").length;
    assert.ok(lineCount <= 10, `summary should be ≤10 lines, got ${lineCount}`);
  });

  it("does NOT contain full-format section headers", () => {
    const summary = buildHarnessIntegrationSummary({ now: FIXED_NOW });
    const formatted = formatHarnessIntegrationSummary(summary);
    // These are section headers that belong only in the full formatter
    assert.ok(!formatted.includes("Verdict Inputs:"));
    assert.ok(!formatted.includes("Micro-Compliance:"));
    assert.ok(!formatted.includes("Micro-Consent:"));
    assert.ok(!formatted.includes("Behavioral Probes:"));
    assert.ok(!formatted.includes("Hook Inventory:"));
  });
});

describe("harness CLI --summary (human path)", () => {
  function runCLI(args) {
    return execFileSync(
      "node",
      [join(REPO_ROOT, "apps/cli/src/index.js"), ...args],
      {
        cwd: REPO_ROOT,
        env: {
          ...process.env,
          NO_COLOR: "1",
          NODE_ENV: "test",
          DEMA_NO_TUI: "1",
          DEMA_HOME: mkdtempSync(join(tmpdir(), "dema-hsf-test-")),
        },
        timeout: 15000,
      },
    ).toString();
  }

  it("--summary (no --json) outputs compact summary, not full multi-section output", () => {
    const out = runCLI(["harness", "--summary"]);
    // Must include summary header + verdict
    assert.ok(
      out.includes("DEMA Harness Summary"),
      "must include summary header",
    );
    // Must NOT include full-format section headers
    assert.ok(
      !out.includes("Verdict Inputs:"),
      "must not include Verdict Inputs section",
    );
    assert.ok(
      !out.includes("Micro-Compliance:"),
      "must not include Micro-Compliance section",
    );
    assert.ok(
      !out.includes("Hook Inventory:"),
      "must not include Hook Inventory section",
    );
  });

  it("--summary --json still returns summary schema (existing behavior unchanged)", () => {
    const raw = runCLI(["harness", "--summary", "--json"]);
    const parsed = JSON.parse(raw);
    assert.equal(parsed.schema, "bizra.dema.harness_integration_summary.v0.4");
  });

  it("no flags outputs full format with Verdict Inputs section", () => {
    const out = runCLI(["harness"]);
    assert.ok(out.includes("DEMA Harness Integration v0.4"));
    assert.ok(out.includes("Verdict Inputs:"));
  });
});
