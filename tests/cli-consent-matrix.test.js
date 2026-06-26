import test from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

import { COMMAND_TABLE } from "../apps/cli/src/index.js";
import {
  buildCliConsentMatrixReport,
  verifyCliConsentMatrixReport,
  CLI_CONSENT_MATRIX_SCHEMA,
  CLI_RISK_LEVELS,
  CONSENT_MECHANISMS,
} from "../packages/core/src/cli-consent-matrix.js";
import { CLI_CONSENT_MATRIX_ENTRIES } from "../packages/core/src/cli-consent-matrix-entries.js";

test("matrix exports frozen rows with known risk and consent vocabularies", () => {
  assert.ok(CLI_CONSENT_MATRIX_ENTRIES.length >= 80);
  for (const entry of CLI_CONSENT_MATRIX_ENTRIES) {
    assert.ok(Object.isFrozen(entry));
    assert.ok(Object.isFrozen(entry.risk_levels));
    assert.ok(Object.isFrozen(entry.consent));
    for (const risk of entry.risk_levels) {
      assert.ok(CLI_RISK_LEVELS.includes(risk), `unknown risk ${risk}`);
    }
    assert.ok(CONSENT_MECHANISMS.includes(entry.consent.mechanism));
  }
});

test("COMMAND_TABLE parity: every dispatcher token has a matrix row", () => {
  const report = buildCliConsentMatrixReport({
    commandSurface: Object.keys(COMMAND_TABLE),
    testFileExists: () => true,
  });
  assert.deepEqual(report.missing_commands, []);
  assert.deepEqual(report.orphan_commands, []);
});

test("non-read-only commands declare strong consent coverage", () => {
  const report = buildCliConsentMatrixReport({
    commandSurface: Object.keys(COMMAND_TABLE),
    testFileExists: () => true,
  });
  const blocked = report.findings.filter((f) =>
    [
      "mutating_command_requires_strong_consent",
      "high_sensitivity_requires_strong_consent",
      "missing_test_refs",
    ].includes(f.code),
  );
  assert.deepEqual(blocked, [], JSON.stringify(blocked, null, 2));
});

test("matrix test_refs resolve to real files in the repo", () => {
  const report = buildCliConsentMatrixReport({
    commandSurface: Object.keys(COMMAND_TABLE),
    testFileExists: (rel) => existsSync(rel),
  });
  assert.equal(report.ok, true, JSON.stringify(report.findings, null, 2));
  assert.equal(report.schema, CLI_CONSENT_MATRIX_SCHEMA);
  assert.equal(verifyCliConsentMatrixReport(report).ok, true);
});

test("review gate helper passes on the live dispatcher surface", async () => {
  const { runCliConsentMatrixCheck } = await import(
    "../scripts/review/cli-consent-matrix-check.mjs"
  );
  const result = runCliConsentMatrixCheck();
  assert.equal(result.ok, true, JSON.stringify(result.report.findings, null, 2));
});
