// NODE0-TRANSITION-COVERAGE-1A — red-first kernel tests.
//
// `receipt_per_transition` <- node0_transition_receipt_chain, three-valued.
//
// THE ASYMMETRY IS THE POINT. Registry incompleteness blocks SATISFIED but does
// NOT erase a concrete counterexample: one proven authoritative transition
// without its receipt falsifies "every state change is receipted", however many
// other domains remain unclassified. Conversely, absence of evidence is UNKNOWN
// and never VIOLATED — a row cannot be refuted by not having looked.

import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";

import {
  NODE0_TRANSITION_COVERAGE_SCHEMA,
  NODE0_TRANSITION_RECEIPT_CHAIN_SCOPE,
  COVERAGE_VERDICTS,
  buildTransitionCoverageObservation,
  verifyTransitionCoverageHash,
  isProvenCounterexample,
} from "../packages/core/src/node0-transition-coverage.js";

const hash = (v) => `sha256:${createHash("sha256").update(JSON.stringify(v)).digest("hex")}`;

/// A counterexample is only proven when the ABSENCE was measured with a control
/// showing the receipt mechanism exists and is used elsewhere.
const CX_IDENTITY = {
  domain_id: "authorship_identity_rotation",
  writer: "packages/receipts/src/authorship-key-store.js",
  transition: "rotateAuthorshipKey: active generation retired, successor installed",
  classification: "AUTHORITATIVE",
  authority_source: "operator consent via `dema authorship rotate`",
  consumers_count: 45,
  receipt_call_present: false,
  receipt_mechanism_exists_elsewhere: true,
  receipt_mechanism: "appendCanonicalReceipt",
  verified_by: "independent_source_trace",
};
const CX_NONCE = {
  domain_id: "consent_nonce_consumption",
  writer: "packages/receipts/src/consent-nonce-registry.js",
  transition: "nonce consumed: future replay of the same consent proof is denied",
  classification: "AUTHORITATIVE",
  authority_source: "KEYCONSENT-1A consent proof",
  consumers_count: 2,
  receipt_call_present: false,
  receipt_mechanism_exists_elsewhere: true,
  receipt_mechanism: "appendCanonicalReceipt",
  verified_by: "independent_source_trace",
};

const b = (over = {}) =>
  buildTransitionCoverageObservation({
    registry: { unclassified_count: 0, authoritative_domains: 2, receipted_domains: 0 },
    counterexamples: [CX_IDENTITY, CX_NONCE],
    evidenceClass: "OBSERVED",
    executedCodeHash: "sha256:k",
    hash,
    ...over,
  });

test("two proven counterexamples make the row VIOLATED", () => {
  const o = b();
  assert.equal(o.schema, NODE0_TRANSITION_COVERAGE_SCHEMA);
  assert.equal(o.coverage_verdict, "COVERAGE_VIOLATED");
  assert.equal(o.observed, false, "the evaluator compares observed:false against required:true");
  assert.equal(o.scope, NODE0_TRANSITION_RECEIPT_CHAIN_SCOPE);
  assert.equal(o.proven_counterexample_count, 2);
  assert.equal(NODE0_TRANSITION_RECEIPT_CHAIN_SCOPE, "node0_transition_receipt_chain");
});

test("the two domains are preserved SEPARATELY, never collapsed into 'some receipt missing'", () => {
  const o = b();
  assert.deepEqual(o.counterexample_domains, ["authorship_identity_rotation", "consent_nonce_consumption"]);
  assert.equal(o.counterexamples.length, 2);
  for (const cx of o.counterexamples) {
    assert.ok(cx.writer && cx.transition && cx.authority_source, "each domain keeps its own evidence");
  }
});

// ── the asymmetry ────────────────────────────────────────────────────────────
test("registry incompleteness does NOT erase a proven counterexample", () => {
  const o = b({ registry: { unclassified_count: 7, authoritative_domains: 2, receipted_domains: 0 } });
  assert.equal(o.coverage_verdict, "COVERAGE_VIOLATED");
  assert.equal(o.observed, false);
});

test("registry incompleteness DOES block SATISFIED", () => {
  const o = b({ counterexamples: [], registry: { unclassified_count: 1, authoritative_domains: 2, receipted_domains: 2 } });
  assert.equal(o.coverage_verdict, "REGISTRY_INCOMPLETE");
  assert.equal(o.observed, null, "an unknown must contribute no observed value at all");
});

// ── absence is UNKNOWN, never VIOLATED ───────────────────────────────────────
test("NC: missing evidence is UNKNOWN, not VIOLATED", () => {
  const o = buildTransitionCoverageObservation({ evidenceClass: "NONE", executedCodeHash: "sha256:k", hash });
  assert.equal(o.coverage_verdict, "NOT_OBSERVED");
  assert.equal(o.observed, null);
});

test("NC: a complete registry with no counterexample and nothing receipted is UNKNOWN", () => {
  // 0 of 2 known authoritative domains receipted is COVERAGE_INCOMPLETE rather
  // than "no evidence" — we know the domains and we know none is covered. The
  // load-bearing part either way is that it contributes NO observed value.
  const o = b({ counterexamples: [], registry: { unclassified_count: 0, authoritative_domains: 2, receipted_domains: 0 } });
  assert.equal(o.coverage_verdict, "COVERAGE_INCOMPLETE");
  assert.equal(o.observed, null);
});

// ── a derived writer without a receipt is not a violation ────────────────────
test("NC: a DERIVED or DIAGNOSTIC unreceipted write must NOT become VIOLATED", () => {
  for (const cls of ["DERIVED", "DIAGNOSTIC", "CACHE", "EPHEMERAL"]) {
    const o = b({ counterexamples: [{ ...CX_IDENTITY, classification: cls }] });
    assert.notEqual(o.coverage_verdict, "COVERAGE_VIOLATED", `${cls} must not falsify the row`);
    assert.equal(o.proven_counterexample_count, 0);
  }
});

// ── a forged violation is rejected ───────────────────────────────────────────
test("NC: a violation flag without re-derived evidence is rejected", () => {
  // No control proving the receipt mechanism exists elsewhere: the absence could
  // simply be that nothing in the tree receipts anything.
  const o = b({ counterexamples: [{ ...CX_IDENTITY, receipt_mechanism_exists_elsewhere: false }] });
  assert.equal(o.proven_counterexample_count, 0);
  assert.notEqual(o.coverage_verdict, "COVERAGE_VIOLATED");
});

test("NC: a counterexample not verified by an independent trace is rejected", () => {
  const o = b({ counterexamples: [{ ...CX_IDENTITY, verified_by: "asserted" }] });
  assert.equal(o.proven_counterexample_count, 0);
});

test("NC: claiming receipt_call_present true while alleging a violation is incoherent", () => {
  const o = b({ counterexamples: [{ ...CX_IDENTITY, receipt_call_present: true }] });
  assert.equal(o.proven_counterexample_count, 0);
});

test("isProvenCounterexample is the single gate, and it is strict", () => {
  assert.equal(isProvenCounterexample(CX_IDENTITY), true);
  for (const k of ["domain_id", "writer", "transition", "authority_source"]) {
    const bad = { ...CX_IDENTITY }; delete bad[k];
    assert.equal(isProvenCounterexample(bad), false, `${k} is required`);
  }
});

// ── the SATISFIED path must be reachable, or VIOLATED proves nothing ─────────
test("POSITIVE CONTROL: a complete registry with every authoritative domain receipted CAN satisfy", () => {
  const o = b({ counterexamples: [], registry: { unclassified_count: 0, authoritative_domains: 2, receipted_domains: 2 } });
  assert.equal(o.coverage_verdict, "COVERAGE_SATISFIED");
  assert.equal(o.observed, true);
});

test("NC: a fully receipted authoritative fixture must NOT emit observed:false", () => {
  const o = b({ counterexamples: [], registry: { unclassified_count: 0, authoritative_domains: 3, receipted_domains: 3 } });
  assert.notEqual(o.observed, false);
});

test("NC: partial receipting is not coverage — 2 of 3 still fails", () => {
  const o = b({ counterexamples: [], registry: { unclassified_count: 0, authoritative_domains: 3, receipted_domains: 2 } });
  assert.notEqual(o.coverage_verdict, "COVERAGE_SATISFIED");
  assert.notEqual(o.observed, true);
});

// ── hash + vocabulary ────────────────────────────────────────────────────────
test("the hash excludes observed_at and a hand-edited verdict fails re-derivation", () => {
  const x = b({ observedAt: "2026-01-01" });
  const y = b({ observedAt: "2031-01-01" });
  assert.equal(x.observation_hash, y.observation_hash);
  assert.ok(verifyTransitionCoverageHash(x, hash));
  assert.equal(verifyTransitionCoverageHash({ ...x, observed: true }, hash), false);
});

test("an absent injected hash is refused rather than defaulted", () => {
  assert.throws(() => buildTransitionCoverageObservation({}), TypeError);
});

test("the verdict vocabulary is closed and exactly one verdict yields observed:false", () => {
  const falsy = COVERAGE_VERDICTS.filter((v) => v === "COVERAGE_VIOLATED");
  assert.deepEqual(falsy, ["COVERAGE_VIOLATED"]);
  assert.ok(COVERAGE_VERDICTS.includes("COVERAGE_SATISFIED"));
});
