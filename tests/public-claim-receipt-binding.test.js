import test from "node:test";
import assert from "node:assert/strict";

import {
  PUBLIC_CLAIM_RECEIPT_BINDING_SCHEMA,
  validatePublicClaimReceiptBindingEvidence,
} from "../scripts/audit/public-claim-receipt-binding-core.mjs";
import { runPublicClaimReceiptBindingCheck } from "../scripts/review/public-claim-receipt-binding-check.mjs";

const COMMIT = "a".repeat(40);
const RECEIPT_HASH = "b".repeat(64);

function claim(overrides = {}) {
  return {
    claim_id: "BIZRA-PUBLIC-001",
    routes: ["/"],
    evidence_commits: [COMMIT],
    receipt_hashes: [],
    receipt_links: [],
    disposition: "RECEIPT_UNBOUND",
    blocker: "TRUSTED_SIGNER_ROTATION_PENDING",
    ...overrides,
  };
}

function evidence(claims, summaryOverrides = {}) {
  const boundCount = claims.filter((entry) => entry.disposition === "BOUND").length;
  const removedCount = claims.filter((entry) => entry.disposition === "REMOVED").length;
  const unboundCount = claims.filter(
    (entry) => entry.disposition === "RECEIPT_UNBOUND",
  ).length;
  const routes = [...new Set(claims.flatMap((entry) => entry.routes))].sort();
  return {
    schema: PUBLIC_CLAIM_RECEIPT_BINDING_SCHEMA,
    observed_at: "2026-08-04T15:28:28.537Z",
    origin: "https://bizra.ai",
    scan: {
      schema: "bizra.dema.public_link_scan.v0.2",
      surface_count: 62,
      request_error_count: 0,
      response_digest_set_sha256: "c".repeat(64),
      route_result_set_sha256: "d".repeat(64),
    },
    route_observations: routes.map((route) => ({
      route,
      status: 200,
      body_sha256: "e".repeat(64),
      claim_ids: claims
        .filter((entry) => entry.routes.includes(route))
        .map((entry) => entry.claim_id)
        .sort(),
    })),
    claims,
    summary: {
      claim_count: claims.length,
      bound_count: boundCount,
      removed_count: removedCount,
      unbound_count: unboundCount,
      closure_status:
        unboundCount === 0
          ? "CLOSED"
          : "BLOCKED_PENDING_RECEIPT_BINDING",
      ...summaryOverrides,
    },
    boundary: {
      read_only_scan: true,
      credentials_included: false,
      raw_bodies_retained: false,
      runtime_mutation_performed: false,
      receipt_issued: false,
    },
  };
}

test("an honest receipt-unbound manifest is valid but not closure-ready", () => {
  const result = validatePublicClaimReceiptBindingEvidence(evidence([claim()]));

  assert.equal(result.ok, true);
  assert.equal(result.closure_ready, false);
  assert.deepEqual(result.unbound_claim_ids, ["BIZRA-PUBLIC-001"]);
});

test("a bound live claim requires commit, receipt hash, and receipt link", () => {
  const result = validatePublicClaimReceiptBindingEvidence(
    evidence([
      claim({
        disposition: "BOUND",
        blocker: null,
        receipt_hashes: [RECEIPT_HASH],
        receipt_links: ["https://bizra.ai/receipts/BIZRA-PUBLIC-001.json"],
      }),
    ]),
  );

  assert.equal(result.ok, true);
  assert.equal(result.closure_ready, true);
});

test("a removed claim requires removal evidence and no live routes", () => {
  const result = validatePublicClaimReceiptBindingEvidence(
    evidence([
      claim({
        disposition: "REMOVED",
        blocker: null,
        routes: [],
      }),
    ]),
  );

  assert.equal(result.ok, true);
  assert.equal(result.closure_ready, true);
});

test("a falsely bound claim fails closed", () => {
  const result = validatePublicClaimReceiptBindingEvidence(
    evidence([
      claim({
        disposition: "BOUND",
        blocker: null,
      }),
    ]),
  );

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((entry) => entry.code === "bound_receipt_hash_required"));
  assert.ok(result.violations.some((entry) => entry.code === "bound_receipt_link_required"));
});

test("summary laundering fails closed", () => {
  const result = validatePublicClaimReceiptBindingEvidence(
    evidence([claim()], {
      unbound_count: 0,
      closure_status: "CLOSED",
    }),
  );

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((entry) => entry.code === "summary_mismatch"));
});

test("duplicate claim ids and unsupported blockers fail closed", () => {
  const result = validatePublicClaimReceiptBindingEvidence(
    evidence([
      claim(),
      claim({ blocker: "MAKE_IT_GREEN" }),
    ]),
  );

  assert.equal(result.ok, false);
  assert.ok(result.violations.some((entry) => entry.code === "duplicate_claim_id"));
  assert.ok(result.violations.some((entry) => entry.code === "invalid_blocker"));
});

test("claim routes must match the measured route observations", () => {
  const manifest = evidence([claim()]);
  manifest.route_observations[0].claim_ids = ["BIZRA-PUBLIC-999"];

  const result = validatePublicClaimReceiptBindingEvidence(manifest);

  assert.equal(result.ok, false);
  assert.ok(
    result.violations.some(
      (entry) => entry.code === "claim_route_observation_mismatch",
    ),
  );
  assert.ok(
    result.violations.some(
      (entry) => entry.code === "observed_claim_missing_record",
    ),
  );
});

test("the committed live manifest is valid and honestly blocked", () => {
  const report = runPublicClaimReceiptBindingCheck();

  assert.equal(report.manifest_valid, true);
  assert.equal(report.closure_ready, false);
  assert.equal(report.closure_status, "BLOCKED_PENDING_RECEIPT_BINDING");
  assert.equal(report.unbound_count, 5);
  assert.deepEqual(report.unbound_claim_ids, [
    "BIZRA-PUBLIC-001",
    "BIZRA-PUBLIC-002",
    "BIZRA-PUBLIC-003",
    "BIZRA-PUBLIC-004",
    "BIZRA-PUBLIC-005",
  ]);
});
