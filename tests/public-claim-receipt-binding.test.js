import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  PUBLIC_CLAIM_RECEIPT_BINDING_SCHEMA,
  validatePublicClaimReceiptBindingEvidence,
} from "../scripts/audit/public-claim-receipt-binding-core.mjs";
import {
  closureLabel,
  runPublicClaimReceiptBindingCheck,
} from "../scripts/review/public-claim-receipt-binding-check.mjs";

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

// OBSERVATION-FRESHNESS-1A
// A manifest asserts the live site's state at one past instant. Nothing in the
// content of that manifest expires. Without a freshness bound, a CLOSED verdict
// derived from an observation of any age reads exactly like a current one.

const OBSERVED_MS = Date.parse("2026-08-04T15:28:28.537Z");
const HOUR_MS = 60 * 60 * 1000;

function closedEvidence() {
  return evidence([
    claim({
      disposition: "BOUND",
      blocker: null,
      receipt_hashes: [RECEIPT_HASH],
      receipt_links: ["https://bizra.ai/receipts/BIZRA-PUBLIC-001.json"],
    }),
  ]);
}

test("a stale observation cannot be closure-ready", () => {
  const result = validatePublicClaimReceiptBindingEvidence(closedEvidence(), {
    now: OBSERVED_MS + 8 * 24 * HOUR_MS,
    maxObservationAgeMs: 24 * HOUR_MS,
  });

  assert.equal(result.ok, false);
  assert.equal(result.closure_ready, false);
  assert.ok(
    result.violations.some((entry) => entry.code === "stale_observation"),
    "expected a stale_observation violation",
  );
});

test("a fresh observation within the bound stays closure-ready", () => {
  // Control for the stale test: identical evidence, only `now` moves. Proves the
  // refusal above is caused by age and not by passing the options object at all.
  const result = validatePublicClaimReceiptBindingEvidence(closedEvidence(), {
    now: OBSERVED_MS + HOUR_MS,
    maxObservationAgeMs: 24 * HOUR_MS,
  });

  assert.equal(result.ok, true);
  assert.equal(result.closure_ready, true);
  assert.equal(result.observation_age_ms, HOUR_MS);
});

test("an observation dated after the evaluation instant fails closed", () => {
  const result = validatePublicClaimReceiptBindingEvidence(closedEvidence(), {
    now: OBSERVED_MS - HOUR_MS,
    maxObservationAgeMs: 24 * HOUR_MS,
  });

  assert.equal(result.ok, false);
  assert.ok(
    result.violations.some((entry) => entry.code === "stale_observation"),
    "a future-dated observation is not evidence about the present",
  );
});

test("omitting the freshness bound leaves the verdict unchanged", () => {
  const withoutOptions = validatePublicClaimReceiptBindingEvidence(
    closedEvidence(),
  );
  const withEmptyOptions = validatePublicClaimReceiptBindingEvidence(
    closedEvidence(),
    {},
  );

  assert.equal(withoutOptions.closure_ready, true);
  assert.equal(withEmptyOptions.closure_ready, true);
  assert.deepEqual(withEmptyOptions.violations, []);
});

test("--require-closed refuses when no freshness bound is declared", () => {
  const report = runPublicClaimReceiptBindingCheck({ requireClosed: true });

  assert.equal(report.closure_ready, false);
  assert.ok(
    report.violations.some((entry) => entry.code === "missing_freshness_bound"),
    "closure must not be asserted without a declared observation age bound",
  );
});

test("a refused manifest never displays its self-declared CLOSED status", () => {
  assert.equal(
    closureLabel({ closure_ready: false, closure_status: "CLOSED" }),
    "REFUSED (manifest declares CLOSED)",
  );
  // Controls: the honest states are reported verbatim.
  assert.equal(
    closureLabel({ closure_ready: true, closure_status: "CLOSED" }),
    "CLOSED",
  );
  assert.equal(
    closureLabel({
      closure_ready: false,
      closure_status: "BLOCKED_PENDING_RECEIPT_BINDING",
    }),
    "BLOCKED_PENDING_RECEIPT_BINDING",
  );
});

test("the documented closure command declares a freshness bound", () => {
  // Three tracked documents name `npm run claims:receipt-binding:require-closed` as
  // THE closure command. Requiring a bound at the closure boundary made that script
  // refuse with `missing_freshness_bound` regardless of claim state — which would
  // report closure as failed on the day it actually succeeds. The script must carry
  // the bound so the refusal can only ever be about the claims themselves.
  const pkg = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  );
  const script = pkg.scripts["claims:receipt-binding:require-closed"];

  assert.match(script, /--require-closed/);
  assert.match(
    script,
    /--max-age-hours=\d+/,
    "closure script must declare how stale an observation may be",
  );
});

test("a closed manifest is not refused for a missing freshness bound", () => {
  // Regression: transports the actual defect. With every claim BOUND, the only
  // legitimate reason to refuse closure is the claims or their age — never the
  // absence of a bound the shipped command is supposed to supply.
  const report = runPublicClaimReceiptBindingCheck({
    requireClosed: true,
    maxObservationAgeMs: 24 * 60 * 60 * 1000,
    now: Date.parse("2026-08-04T15:31:37.984Z") + 60 * 60 * 1000,
  });

  assert.ok(
    !report.violations.some((entry) => entry.code === "missing_freshness_bound"),
    "a declared bound must clear the missing_freshness_bound refusal",
  );
  assert.ok(
    !report.violations.some((entry) => entry.code === "stale_observation"),
    "an in-bound observation must not be reported stale",
  );
});

test("inspection without --require-closed needs no freshness bound", () => {
  // Control for the gate refusal: same manifest, closure not asserted.
  const report = runPublicClaimReceiptBindingCheck();

  assert.equal(report.manifest_valid, true);
  assert.deepEqual(report.violations, []);
});
