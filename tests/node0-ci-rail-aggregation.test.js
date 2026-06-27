import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  mapGithubWorkflowConclusionToRailStatus,
  mapWorkflowConclusionsToCiEvidenceRails,
  allCiEvidenceRailsPass,
} from "../packages/core/src/node0-ci-evidence-attestation.js";
import { aggregateNode0CiEvidenceAttestation } from "../scripts/ci/aggregate-node0-ci-evidence-attestation.mjs";
import { runNode0CiRailAggregationCheck } from "../scripts/review/node0-ci-rail-aggregation-check.mjs";

test("CAGG-01: success maps to PASS", () => {
  assert.equal(mapGithubWorkflowConclusionToRailStatus("success"), "PASS");
});

test("CAGG-02: failure maps to FAIL", () => {
  assert.equal(mapGithubWorkflowConclusionToRailStatus("failure"), "FAIL");
});

test("CAGG-03: in_progress maps to UNKNOWN", () => {
  assert.equal(mapGithubWorkflowConclusionToRailStatus("in_progress"), "UNKNOWN");
});

test("CAGG-04: all success conclusions yield all PASS rails", () => {
  const rails = mapWorkflowConclusionsToCiEvidenceRails({
    check: "success",
    codeql: "success",
    gitleaks: "success",
  });
  assert.equal(allCiEvidenceRailsPass(rails), true);
});

test("CAGG-05: partial failure yields honest FAIL rail", () => {
  const rails = mapWorkflowConclusionsToCiEvidenceRails({
    check: "success",
    codeql: "failure",
    gitleaks: "success",
  });
  assert.equal(rails.codeql, "FAIL");
  assert.equal(allCiEvidenceRailsPass(rails), false);
});

test("CAGG-06: aggregate export writes verified JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "dema-ci-rail-agg-"));
  const outPath = join(dir, "aggregated.json");
  try {
    const result = aggregateNode0CiEvidenceAttestation({
      commit: "cagg-export-commit-001",
      conclusions: { check: "success", codeql: "success", gitleaks: "success" },
      outPath,
      evidence_source: "test_aggregate",
    });
    assert.equal(result.ok, true);
    assert.equal(result.all_rails_pass, true);
    const parsed = JSON.parse(readFileSync(outPath, "utf8"));
    assert.equal(parsed.rails.ci_matrix, "PASS");
    assert.equal(parsed.rails.codeql, "PASS");
    assert.equal(parsed.rails.gitleaks, "PASS");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CAGG-07: hermetic review gate passes", () => {
  const result = runNode0CiRailAggregationCheck();
  assert.equal(result.ok, true);
});
