import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCiVendorAvailabilityMarker,
  buildDefaultCiVendorAvailabilityMarker,
  mergeCiVendorAvailabilityIntoWorkflows,
  defaultGithubActionsBillingLockFdeFixture,
  NODE0_CI_VENDOR_AVAILABILITY_SCHEMA,
} from "../packages/core/src/node0-ci-vendor-availability.js";
import { diagnoseDemaFailure } from "../packages/core/src/dema-fde-dual-diagnostic.js";
import { summarizeEmpiricalRail } from "../packages/core/src/node0-proof-rails.js";
import { buildNode0ProofOfTruthControlPlane } from "../packages/core/src/node0-proof-of-truth-control-plane.js";

test("CV-01: default billing-lock marker is eligible and code not implicated", () => {
  const marker = buildDefaultCiVendorAvailabilityMarker();
  assert.equal(marker.schema, NODE0_CI_VENDOR_AVAILABILITY_SCHEMA);
  assert.equal(marker.availability, "GITHUB_ACTIONS_BILLING_LOCK");
  assert.equal(marker.code_implicated, false);
  assert.equal(marker.local_proof_lane, true);
  assert.deepEqual(marker.blocked_by, []);
});

test("CV-02: merge promotes VENDOR_LOCK workflow without PASS ci_matrix", () => {
  const marker = buildDefaultCiVendorAvailabilityMarker();
  const merge = mergeCiVendorAvailabilityIntoWorkflows({ ci_matrix: "UNKNOWN" }, marker);
  assert.equal(merge.merged, true);
  assert.equal(merge.workflows.ci_matrix, "VENDOR_LOCK");
  assert.equal(merge.workflows.ci_vendor_availability, "GITHUB_ACTIONS_BILLING_LOCK");
});

test("CV-03: empirical rail passes local gates under billing-lock lane", () => {
  const marker = buildDefaultCiVendorAvailabilityMarker();
  const merge = mergeCiVendorAvailabilityIntoWorkflows({ ci_matrix: "UNKNOWN" }, marker);
  const empirical = summarizeEmpiricalRail(
    {
      test: true,
      check: true,
      delivery: true,
      codeql: "UNKNOWN",
      gitleaks: "UNKNOWN",
      bizra_review_gate: "UNKNOWN",
    },
    { present: true, lines: 95, threshold: 80 },
    { present: true, boot_latency_ms: 120, ceiling: 150 },
    merge.workflows,
  );
  assert.equal(empirical.local_proof_lane, true);
  assert.equal(empirical.ci_matrix_pass, true);
  assert.equal(empirical.status, "PASS");
});

test("CV-04: proof ledger READY_LOCAL with vendor billing-lock workflows", () => {
  const marker = buildDefaultCiVendorAvailabilityMarker();
  const merge = mergeCiVendorAvailabilityIntoWorkflows(
    {
      ci_matrix: "UNKNOWN",
      codeql: "UNKNOWN",
      gitleaks: "UNKNOWN",
      ci_remote_seal: "PENDING",
    },
    marker,
  );
  const ledger = buildNode0ProofOfTruthControlPlane({
    commit: "vendor-lock-fixture-commit",
    checks: {
      schema: true,
      invariants: true,
      fail_closed: true,
      test: true,
      coverage: true,
      check: true,
      perf: true,
      delivery: true,
      sha256: true,
      codeql: "UNKNOWN",
      gitleaks: "UNKNOWN",
      bizra_review_gate: "UNKNOWN",
    },
    workflows: merge.workflows,
    coverage: { present: true, lines: 95, threshold: 80 },
    perf: { present: true, boot_latency_ms: 120, ceiling: 150 },
    claims: [],
    risks: [],
  });
  assert.equal(ledger.release_verdict, "READY_LOCAL");
  assert.equal(ledger.empirical.local_proof_lane, true);
});

test("CV-05: non-billing FDE report does not produce eligible marker", () => {
  const fde = diagnoseDemaFailure(defaultGithubActionsBillingLockFdeFixture());
  const tampered = { ...fde, failure_class: "implementation_defect" };
  const marker = buildCiVendorAvailabilityMarker({ fde_report: tampered });
  assert.equal(marker.availability, "UNKNOWN");
  assert.ok(marker.blocked_by.includes("not_billing_lock_classification"));
});
