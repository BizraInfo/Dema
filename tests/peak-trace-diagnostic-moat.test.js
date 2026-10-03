import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign } from "node:crypto";

import { buildPeakSelfLoopPreview } from "../packages/core/src/peak-self-loop-preview.js";
import {
  isCanonicalBoundary,
  PREVIEW_BOUNDARY_CANONICAL_KEYS,
} from "../packages/core/src/preview-boundary.js";
import {
  DEMA_TRACE_DIAGNOSTIC_CONTRACT_V2_SCHEMA,
  computeTraceDiagnosticReplaySubjectHashV2,
} from "../packages/core/src/dema-trace-diagnostic-contract.js";
import {
  TRACE_CORROBORATION_ORIGIN_SCHEMA,
  canonicalTraceCorroborationOriginPayload,
  verifyTraceCorroborationOrigin,
} from "../packages/core/src/trace-corroboration-origin.js";

const BOUND = (i) => ({
  id: `moat-${i}`,
  type: "gate_passed",
  weight: 1,
  truth_label: "MEASURED",
  source_ref: `receipts/moat-${i}.json`,
  source_sha256: String(i).repeat(64).slice(0, 64),
});

// PTM-01: moat exists and is frozen preview-only composition
test("PTM-01: peak self-loop composes trace diagnostic moat as self-consistency gate", () => {
  const out = buildPeakSelfLoopPreview();
  assert.ok(out.trace_diagnostic_moat, "trace_diagnostic_moat must exist at top level");
  assert.ok(out.proactive_self.trace_diagnostic_moat, "must also be inside proactive_self");
  assert.equal(Object.isFrozen(out.trace_diagnostic_moat), true);
  assert.equal(out.trace_diagnostic_moat.report.schema, DEMA_TRACE_DIAGNOSTIC_CONTRACT_V2_SCHEMA);
  assert.equal(isCanonicalBoundary(out.boundary), true);
  assert.equal(Object.keys(out.boundary).length, PREVIEW_BOUNDARY_CANONICAL_KEYS.length);
});

// PTM-02: default fixtures (unbound) yield BLOCKED moat and HOLD critique (via SNR + moat gaps)
test("PTM-02: default unverified signals yield BLOCKED moat and HOLD with gap", () => {
  const out = buildPeakSelfLoopPreview();
  assert.equal(out.trace_diagnostic_moat.promotion_status, "BLOCKED");
  assert.equal(out.trace_diagnostic_moat.verified.ok, true); // BLOCKED report is still well-formed
  assert.equal(out.trace_diagnostic_moat.synthesis.insight_authorized, false);
  assert.equal(out.trace_diagnostic_moat.synthesis.self_consistent, false);
  assert.equal(out.proactive_self.compliance.trace_diagnostic_authorized, false);
  assert.ok(out.proactive_self.critique.gaps.some((g) => g.includes("TRACE moat BLOCKED")));
  // default HOLD is driven by SNR=0; trace moat is the second HOLD reason now surfaced as gap
  assert.ok(out.proactive_self.critique.verdict.startsWith("HOLD"));
});

// PTM-03: one verified signal with a vacuous alternative hypothesis is NOT a
// valid disambiguation graph. The second hypothesis must answer to admissible
// evidence; enumerating an empty alternative never authorizes an insight.
test("PTM-03: one verified signal plus vacuous alternative yields REMAIN_TRACE", () => {
  const out = buildPeakSelfLoopPreview({ signal_events: [BOUND(1)], noise_events: [] });
  assert.equal(out.trace_diagnostic_moat.promotion_status, "REMAIN_TRACE");
  assert.equal(out.trace_diagnostic_moat.synthesis.insight_authorized, false);
  assert.equal(out.trace_diagnostic_moat.synthesis.self_consistent, false);
  assert.equal(out.proactive_self.compliance.trace_diagnostic_authorized, false);
  assert.ok(out.trace_diagnostic_moat.blocked_by.some((b) => b.includes("v2_disambiguation_hypothesis_without_evidence")));
});

// PTM-04: raw caller corroboration assertions are not sufficient. Origin
// verification is mandatory; positive signed-origin coverage lives in TCO-05.
test("PTM-04: raw caller corroboration remains trace without origin proof", () => {
  const nine = Array.from({ length: 9 }, (_, i) => BOUND(i));
  const baseline = buildPeakSelfLoopPreview({ signal_events: nine, noise_events: [] });
  assert.equal(baseline.trace_diagnostic_moat.promotion_status, "REMAIN_TRACE");

  const replaySubjectHash = computeTraceDiagnosticReplaySubjectHashV2(
    baseline.trace_diagnostic_moat.trace_set,
    baseline.trace_diagnostic_moat.hypothesis_graph,
    baseline.trace_diagnostic_moat.insight_candidate,
  );
  const out = buildPeakSelfLoopPreview({
    signal_events: nine,
    noise_events: [],
    trace_corroboration: {
      replay_performed: true,
      independent: true,
      independent_replay_hash: "d".repeat(64),
      replay_subject_hash: replaySubjectHash,
    },
  });

  assert.equal(out.trace_diagnostic_moat.origin_verification.ok, false);
  assert.equal(out.trace_diagnostic_moat.promotion_status, "REMAIN_TRACE");
  assert.equal(out.trace_diagnostic_moat.synthesis.insight_authorized, false);
  assert.equal(out.proactive_self.compliance.trace_diagnostic_authorized, false);
});

// PTM-05: boundary remains all-false and frozen, doxology bound
test("PTM-05: trace moat preserves all-false boundary and doxology", () => {
  const out = buildPeakSelfLoopPreview({ signal_events: [BOUND(0)], noise_events: [] });
  for (const [k, v] of Object.entries(out.boundary)) assert.equal(v, false, k);
  assert.equal(out.trace_diagnostic_moat.synthesis.doxology_bound, true);
  assert.equal(out.trace_diagnostic_moat.insight_candidate.doxology.includes("Ihs"), true);
  // report hash re-derivable (semantic rederivation)
  assert.match(out.trace_diagnostic_moat.diagnostic_hash, /^sha256:[0-9a-f]{64}$/);
  assert.equal(out.trace_diagnostic_moat.report.diagnostic_hash, out.trace_diagnostic_moat.diagnostic_hash);
});

// PTM-06: HHMM diffusion and moat are independent but both preview-only
test("PTM-06: HHMM diffusion intact alongside moat, both preview-only", () => {
  const out = buildPeakSelfLoopPreview({ signal_events: [BOUND(0)], noise_events: [] });
  assert.equal(out.hhmm.mode, "preview_diffusion_not_runtime_engine");
  assert.equal(out.hhmm.phases.length, 5);
  assert.equal(out.trace_diagnostic_moat.report.stage, "TRACE_DIAGNOSTIC_PROMOTION_GATE");
  // self-consistency requires both moat and no neural claim
  assert.equal(out.what_this_does_not_prove.includes("moat verifies cryptographic receipt origin"), true);
});

// PTM-07: render includes trace_moat line
test("PTM-07: render includes trace diagnostic moat line", async () => {
  const { renderPeakSelfLoopPreview } = await import("../packages/core/src/peak-self-loop-preview.js");
  const out = buildPeakSelfLoopPreview({ signal_events: [BOUND(0)], noise_events: [] });
  const text = renderPeakSelfLoopPreview(out);
  assert.ok(text.includes("trace_moat:"));
  assert.ok(text.includes("trace_moat"));
});


// PTM-08: regression for same-process corroboration laundering.
// Source-bound signals may satisfy provenance/consistency/disambiguation,
// but MUST NOT self-mint the corroboration rail. Without caller-supplied
// independent replay evidence, promotion remains REMAIN_TRACE.
test("PTM-08: bound signals alone cannot self-authorize corroboration", () => {
  const nine = Array.from({ length: 9 }, (_, i) => BOUND(i));
  const out = buildPeakSelfLoopPreview({ signal_events: nine, noise_events: [] });
  assert.equal(out.trace_diagnostic_moat.promotion_status, "REMAIN_TRACE");
  assert.equal(out.trace_diagnostic_moat.synthesis.insight_authorized, false);
  assert.equal(out.proactive_self.compliance.trace_diagnostic_authorized, false);
  assert.ok(
    out.trace_diagnostic_moat.blocked_by.some((b) => b.includes("corroboration")),
    "expected a corroboration blocker",
  );
});


const ORIGIN_SUBJECT = "a".repeat(64);
const ORIGIN_REPLAY = "b".repeat(64);
const ORIGIN_CHALLENGE = "trace-origin-challenge-001";
const { publicKey: ORIGIN_PUBLIC_KEY, privateKey: ORIGIN_PRIVATE_KEY } =
  generateKeyPairSync("ed25519");
const ORIGIN_PUBLIC_KEY_PEM = ORIGIN_PUBLIC_KEY.export({
  type: "spki",
  format: "pem",
});
const ORIGIN_TRUSTED = Object.freeze([
  Object.freeze({
    verifier_id: "sat.external.trace-v1",
    verifier_key_id: "sat.external.trace-v1:key-1",
    public_key_pem: ORIGIN_PUBLIC_KEY_PEM,
    status: "ACTIVE",
  }),
]);

function signedOriginReceipt(overrides = {}) {
  const receipt = {
    schema: TRACE_CORROBORATION_ORIGIN_SCHEMA,
    verifier_id: "sat.external.trace-v1",
    verifier_key_id: "sat.external.trace-v1:key-1",
    replay_performed: true,
    replay_subject_hash: ORIGIN_SUBJECT,
    independent_replay_hash: ORIGIN_REPLAY,
    challenge_nonce: ORIGIN_CHALLENGE,
    ...overrides,
  };
  const signature = sign(
    null,
    Buffer.from(canonicalTraceCorroborationOriginPayload(receipt), "utf8"),
    ORIGIN_PRIVATE_KEY,
  ).toString("base64");
  return { ...receipt, signature_b64: signature };
}

function verifyOrigin(receipt, overrides = {}) {
  return verifyTraceCorroborationOrigin({
    corroboration: receipt,
    expected_subject_hash: ORIGIN_SUBJECT,
    trusted_verifiers: ORIGIN_TRUSTED,
    proposer_origin: "pat.local.proposer",
    executor_origin: "node0.local.executor",
    expected_challenge: ORIGIN_CHALLENGE,
    ...overrides,
  });
}

test("PTM-09: same-origin verifier cannot satisfy independent corroboration", () => {
  const receipt = signedOriginReceipt({ verifier_id: "pat.local.proposer" });
  const out = verifyOrigin(receipt, {
    trusted_verifiers: [{
      verifier_id: "pat.local.proposer",
      verifier_key_id: receipt.verifier_key_id,
      public_key_pem: ORIGIN_PUBLIC_KEY_PEM,
      status: "ACTIVE",
    }],
  });
  assert.equal(out.ok, false);
  assert.ok(out.blocked_by.includes("corroboration_origin_same_as_proposer"));
});

test("PTM-10: unknown verifier and wrong subject/challenge fail closed", () => {
  const unknown = verifyOrigin(
    signedOriginReceipt({ verifier_id: "unknown.verifier" }),
  );
  assert.equal(unknown.ok, false);
  assert.ok(unknown.blocked_by.includes("corroboration_origin_unknown_verifier"));

  const wrongSubject = verifyOrigin(
    signedOriginReceipt({ replay_subject_hash: "c".repeat(64) }),
  );
  assert.equal(wrongSubject.ok, false);
  assert.ok(wrongSubject.blocked_by.includes("corroboration_origin_subject_mismatch"));

  const wrongChallenge = verifyOrigin(
    signedOriginReceipt({ challenge_nonce: "stale-challenge" }),
  );
  assert.equal(wrongChallenge.ok, false);
  assert.ok(wrongChallenge.blocked_by.includes("corroboration_origin_challenge_mismatch"));
});

test("PTM-11: valid signed external-origin receipt normalizes to v0.2 corroboration", () => {
  const out = verifyOrigin(signedOriginReceipt());
  assert.equal(out.ok, true);
  assert.deepEqual(out.blocked_by, []);
  assert.deepEqual(out.normalized_corroboration, {
    replay_performed: true,
    independent: true,
    independent_replay_hash: ORIGIN_REPLAY,
    replay_subject_hash: ORIGIN_SUBJECT,
  });
  assert.equal(out.verification_mode, "ed25519_origin_receipt");
});

test("PTM-12: peak moat accepts only verified external-origin corroboration", () => {
  const nine = Array.from({ length: 9 }, (_, i) => BOUND(i));
  const baseline = buildPeakSelfLoopPreview({ signal_events: nine, noise_events: [] });
  const subjectHash = computeTraceDiagnosticReplaySubjectHashV2(
    baseline.trace_diagnostic_moat.trace_set,
    baseline.trace_diagnostic_moat.hypothesis_graph,
    baseline.trace_diagnostic_moat.insight_candidate,
  );

  const rawAssertion = buildPeakSelfLoopPreview({
    signal_events: nine,
    noise_events: [],
    trace_corroboration: {
      replay_performed: true,
      independent: true,
      independent_replay_hash: ORIGIN_REPLAY,
      replay_subject_hash: subjectHash,
    },
  });
  assert.equal(rawAssertion.trace_diagnostic_moat.promotion_status, "REMAIN_TRACE");

  const receipt = signedOriginReceipt({ replay_subject_hash: subjectHash });
  const signed = buildPeakSelfLoopPreview({
    signal_events: nine,
    noise_events: [],
    trace_corroboration: receipt,
    trace_corroboration_context: {
      trusted_verifiers: ORIGIN_TRUSTED,
      proposer_origin: "pat.local.proposer",
      executor_origin: "node0.local.executor",
      expected_challenge: ORIGIN_CHALLENGE,
    },
  });
  assert.equal(signed.trace_diagnostic_moat.origin_verification.ok, true);
  assert.equal(signed.trace_diagnostic_moat.promotion_status, "INSIGHT_AUTHORIZED");
});
