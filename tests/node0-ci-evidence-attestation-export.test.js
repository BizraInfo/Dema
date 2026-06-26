import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { exportNode0CiEvidenceAttestation } from "../scripts/ci/export-node0-ci-evidence-attestation.mjs";
import {
  verifyNode0CiEvidenceAttestation,
  NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA,
} from "../packages/core/src/node0-ci-evidence-attestation.js";

const FIXTURE_COMMIT = "ci-export-attestation-commit-001";

test("CEX-01: export writes verified attestation JSON", () => {
  const dir = mkdtempSync(join(tmpdir(), "dema-attest-export-"));
  const outPath = join(dir, "attestation.json");
  try {
    const result = exportNode0CiEvidenceAttestation({
      commit: FIXTURE_COMMIT,
      rails: { ci_matrix: "PASS", codeql: "UNKNOWN", gitleaks: "UNKNOWN" },
      evidence_source: "test_export",
      outPath,
    });
    assert.equal(result.ok, true);
    assert.equal(result.out_path, outPath);
    const parsed = JSON.parse(readFileSync(outPath, "utf8"));
    assert.equal(parsed.schema, NODE0_CI_EVIDENCE_ATTESTATION_SCHEMA);
    assert.equal(parsed.commit, FIXTURE_COMMIT);
    const verified = verifyNode0CiEvidenceAttestation(parsed);
    assert.equal(verified.ok, true);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CEX-02: export fails closed on invalid rail env value", () => {
  const dir = mkdtempSync(join(tmpdir(), "dema-attest-export-"));
  try {
    assert.throws(
      () =>
        exportNode0CiEvidenceAttestation({
          commit: FIXTURE_COMMIT,
          rails: { ci_matrix: "MAYBE", codeql: "PASS", gitleaks: "PASS" },
          outPath: join(dir, "bad.json"),
        }),
      /invalid rail ci_matrix/,
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("CEX-03: post_check context defaults ci_matrix to PASS", () => {
  const prior = process.env.NODE0_CI_EVIDENCE_EXPORT_CONTEXT;
  process.env.NODE0_CI_EVIDENCE_EXPORT_CONTEXT = "post_check";
  delete process.env.NODE0_CI_EVIDENCE_RAIL_CI_MATRIX;
  delete process.env.NODE0_CI_EVIDENCE_RAIL_CODEQL;
  delete process.env.NODE0_CI_EVIDENCE_RAIL_GITLEAKS;
  const dir = mkdtempSync(join(tmpdir(), "dema-attest-export-"));
  try {
    const result = exportNode0CiEvidenceAttestation({
      commit: FIXTURE_COMMIT,
      outPath: join(dir, "post-check.json"),
    });
    assert.equal(result.rails.ci_matrix, "PASS");
    assert.equal(result.rails.codeql, "UNKNOWN");
    assert.equal(result.rails.gitleaks, "UNKNOWN");
  } finally {
    if (prior === undefined) delete process.env.NODE0_CI_EVIDENCE_EXPORT_CONTEXT;
    else process.env.NODE0_CI_EVIDENCE_EXPORT_CONTEXT = prior;
    rmSync(dir, { recursive: true, force: true });
  }
});
