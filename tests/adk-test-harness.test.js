import { test } from "node:test";
import assert from "node:assert/strict";

import {
  runAdkAdversarialSuite,
  runAdkContractHarness,
  ADK_ADVERSARIAL_NEGATIVE_CASES,
  ADK_ADVERSARIAL_POSITIVE_CASES,
} from "../packages/adk/src/test-harness.js";
import { buildPatAgentTemplate } from "../packages/adk/src/pat-template.js";

test("adversarial suite is CLEAN", () => {
  const report = runAdkAdversarialSuite();
  assert.equal(report.schema, "bizra.dema.adk_test_harness.v0.1");
  assert.equal(report.verdict, "CLEAN");
  assert.equal(report.failed_count, 0);
  assert.equal(
    report.case_count,
    ADK_ADVERSARIAL_NEGATIVE_CASES.length + ADK_ADVERSARIAL_POSITIVE_CASES.length,
  );
  assert.equal(report.boundary.agent_execution_performed, false);
  assert.equal(report.boundary.network_used, false);
});

test("negative cases are refused individually", () => {
  for (const def of ADK_ADVERSARIAL_NEGATIVE_CASES) {
    const report = runAdkAdversarialSuite();
    const row = report.cases.find((c) => c.id === def.id);
    assert.ok(row, def.id);
    assert.equal(row.ok, true, `${def.id} harness row`);
    assert.equal(row.kind, "negative");
  }
});

test("single contract harness passes valid PAT template", () => {
  const contract = buildPatAgentTemplate({ agent_id: "pat-engineer" });
  const report = runAdkContractHarness(contract);
  assert.equal(report.verdict, "PASS");
  assert.equal(report.receipt_preview.built, true);
});

test("single contract harness fails invalid contract", () => {
  const report = runAdkContractHarness({ agent_id: "bad" });
  assert.equal(report.verdict, "FAIL");
  assert.equal(report.validation.valid, false);
});
